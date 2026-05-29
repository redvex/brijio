# P1-1 One-Command Startup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `pnpm dev` start WS + MCP servers, auto-configure tokens, and print a ready banner — zero manual `.env` editing required.

**Architecture:** Node.js orchestrator script spawns both servers as child processes, manages `.env` configuration, health-checks readiness, prints startup banner, supervises crashes, and propagates shutdown signals.

**Tech Stack:** Node.js built-ins (`child_process`, `net`, `http`, `crypto`, `readline`), `tsx watch`, `node:test` + `node:assert/strict`

---

### Task 1: Extract token generation into shared module

**Files:**

- Create: `scripts/token-utils.mjs`
- Modify: `scripts/browserbridge-token.mjs`
- Test: `scripts/browserbridge-token.test.mjs`

**Step 1: Write the failing test**

Add a test in `scripts/browserbridge-token.test.mjs` that imports from `token-utils.mjs`:

```javascript
import { generatePairingToken, generateAuthToken } from "./token-utils.mjs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("token-utils", () => {
  describe("generatePairingToken", () => {
    it("produces a 43-char URL-safe string", () => {
      const token = generatePairingToken();
      assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    });

    it("produces unique tokens", () => {
      const tokens = new Set(
        Array.from({ length: 100 }, () => generatePairingToken()),
      );
      assert.equal(tokens.size, 100);
    });
  });

  describe("generateAuthToken", () => {
    it("produces a 43-char URL-safe string", () => {
      const token = generateAuthToken();
      assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    });

    it("produces unique tokens", () => {
      const tokens = new Set(
        Array.from({ length: 100 }, () => generateAuthToken()),
      );
      assert.equal(tokens.size, 100);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test scripts/browserbridge-token.test.mjs`
Expected: FAIL — `generateAuthToken` and `token-utils.mjs` import fail

**Step 3: Create `scripts/token-utils.mjs`**

```javascript
import { randomBytes } from "node:crypto";

export function generatePairingToken() {
  return randomBytes(32).toString("base64url");
}

export function generateAuthToken() {
  return randomBytes(32).toString("base64url");
}
```

**Step 4: Update `scripts/browserbridge-token.mjs` to import from shared module**

Replace the inline `generatePairingToken` with an import:

```javascript
import { generatePairingToken } from "./token-utils.mjs";
import { fileURLToPath } from "node:url";

function printToken() {
  const token = generatePairingToken();

  console.log(token);
  console.error("");
  console.error("Use this token for local BrowserBridge pairing:");
  console.error("- BROWSERBRIDGE_PAIRING_TOKEN for the WebSocket server");
  console.error("- BROWSERBRIDGE_PAIRING_TOKEN for the MCP server");
  console.error("- Pairing token in the Chrome extension setup page");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  printToken();
}
```

**Step 5: Run test to verify both pass**

Run: `node --test scripts/browserbridge-token.test.mjs`
Expected: PASS

**Step 6: Run existing tests**

Run: `pnpm test`
Expected: All existing tests pass (no regressions)

**Step 7: Commit**

```bash
git add scripts/token-utils.mjs scripts/browserbridge-token.mjs scripts/browserbridge-token.test.mjs
git commit -m "feat: extract token generation into shared token-utils module"
```

---

### Task 2: Add `/health` endpoint to WebSocket server

**Files:**

- Modify: `servers/websocket/src/server.ts`
- Test: `servers/websocket/src/server.test.ts`

**Step 1: Write the failing test**

Add a test in `servers/websocket/src/server.test.ts`:

```typescript
describe("health endpoint", () => {
  it("responds with status ok on GET /health", async () => {
    const server = await createBrowserBridgeWebSocketServer({
      host: "127.0.0.1",
      port: 0,
      pairingToken: generatePairingToken(),
    });
    try {
      const url = new URL(
        "/health",
        `http://${server.url.replace("ws://", "")}`,
      );
      const response = await fetch(url);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "application/json");
      const body = await response.json();
      assert.deepEqual(body, { status: "ok" });
    } finally {
      await server.close();
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @browserbridge/websocket test`
Expected: FAIL — `/health` returns 404 or connection refused

**Step 3: Implement `/health` endpoint in `server.ts`**

The WS server currently uses `new WebSocketServer({ host, port })`. Change it to create an explicit `http.Server` first, attach a `/health` handler, then pass to `WebSocketServer`:

```typescript
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

// In createBrowserBridgeWebSocketServer:
function healthHandler(req: IncomingMessage, res: ServerResponse): void {
  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }
  res.writeHead(404);
  res.end();
}

// Create HTTP server, attach health handler, then create WS server on it
const httpServer = createHttpServer(healthHandler);
const wsServer = new WebSocketServer({ server: httpServer });

// Listen on host:port via httpServer
await new Promise<void>((resolve, reject) => {
  httpServer.listen(port, host, () => resolve());
  httpServer.on("error", reject);
});

// Update closeServer to close httpServer too
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @browserbridge/websocket test`
Expected: PASS

**Step 5: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add servers/websocket/src/server.ts servers/websocket/src/server.test.ts
git commit -m "feat(ws): add GET /health endpoint"
```

---

### Task 3: Add `/health` endpoint to MCP server

**Files:**

- Modify: `servers/mcp/src/http-server.ts`
- Test: `servers/mcp/src/index.test.ts`

**Step 1: Write the failing test**

Add a test in `servers/mcp/src/index.test.ts`:

```typescript
describe("health endpoint", () => {
  it("responds with status ok on GET /health", async () => {
    const runtime = await startBrowserBridgeMcpHttpServer({
      host: "127.0.0.1",
      port: 0,
      path: "/mcp",
      authToken: generateAuthToken(),
      allowedHosts: ["127.0.0.1", "localhost"],
      allowedOrigins: [],
      allowTailscaleHosts: false,
      allowLocalHosts: false,
    });
    try {
      const healthUrl = new URL("/health", runtime.url.replace("/mcp", ""));
      const response = await fetch(healthUrl);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "application/json");
      const body = await response.json();
      assert.deepEqual(body, { status: "ok" });
    } finally {
      await runtime.close();
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @browserbridge/mcp test`
Expected: FAIL

**Step 3: Implement `/health` in `http-server.ts`**

In the `createServer` callback or `handleMcpHttpRequest`, add a health check before the path matching:

```typescript
// In handleMcpHttpRequest, before the path check:
if (request.url === "/health" && request.method === "GET") {
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ status: "ok" }));
  return;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @browserbridge/mcp test`
Expected: PASS

**Step 5: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add servers/mcp/src/http-server.ts servers/mcp/src/index.test.ts
git commit -m "feat(mcp): add GET /health endpoint"
```

---

### Task 4: Create orchestrator script `scripts/dev.mjs`

**Files:**

- Create: `scripts/dev.mjs`
- Test: `scripts/dev.test.mjs`

This is the main orchestrator. TDD approach — write test for each function, then implement.

**Sub-task 4a: `.env` configuration manager**

Write tests first for:

1. `createEnvFromTemplate(templatePath, envPath)` — copies `.env.example` to `.env` if missing
2. `readEnv(envPath)` — parses `.env` file into key-value pairs
3. `writeEnv(envPath, config)` — writes key-value pairs to `.env`
4. `isPlaceholderToken(value)` — checks if a value is `replace-with-generated-token` or `replace-with-generated-mcp-token`
5. `deriveHosts(allowLocalHosts, allowTailscaleHosts)` — returns `{ websocketHost, mcpHost, allowedHosts }`
6. `interactiveSetup(envPath)` — the interactive prompt flow (mocked stdin/stdout for testing)

Each function gets its own test in `scripts/dev.test.mjs`.

**Sub-task 4b: Process spawner**

1. `spawnServer(command, args, env)` — spawns a `tsx watch` child process
2. Tests: verify process starts, verify env vars passed, verify stdout/stderr prefix labels work

**Sub-task 4c: Health checker**

1. `healthCheck(url, timeoutMs, intervalMs)` — polls `GET /health` until `{ "status": "ok" }` or timeout
2. Tests: mock HTTP server for success/failure/timeout scenarios

**Sub-task 4d: Startup banner printer**

1. `printBanner(config)` — prints formatted banner to stdout and stderr
2. Tests: verify output format

**Sub-task 4e: Supervisor loop**

1. `startSupervisor(processes)` — monitors child processes, restarts on crash with backoff
2. `gracefulShutdown(processes)` — sends SIGTERM, waits, then SIGKILL

**Sub-task 4f: Main entry point**

1. Wire everything together: `.env` setup → spawn → health check → print banner → supervise
2. Handle `--yes` flag and `CI=true` env var for non-interactive mode
3. Handle SIGINT/SIGTERM for graceful shutdown

Each sub-task follows the RED-GREEN-REFACTOR cycle. After all sub-tasks, run the full test suite.

**Step (final): Commit**

```bash
git add scripts/dev.mjs scripts/dev.test.mjs
git commit -m "feat: add dev orchestrator script with .env setup, health checks, and supervision"
```

---

### Task 5: Update root `package.json` scripts

**Files:**

- Modify: `package.json` (root)

**Step 1: Update scripts section**

Change:

```json
"dev": "pnpm -r --parallel dev"
```

To:

```json
"dev": "node scripts/dev.mjs",
"dev:ws": "tsx watch servers/websocket/src/index.ts",
"dev:mcp": "tsx watch servers/mcp/src/index.ts"
```

Keep `"token": "node scripts/browserbridge-token.mjs"` as-is.

**Step 2: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

**Step 3: Lint**

Run: `pnpm lint`
Expected: No errors

**Step 4: Commit**

```bash
git add package.json
git commit -m "feat: replace pnpm dev with orchestrator, add dev:ws and dev:mcp"
```

---

### Task 6: Integration test — end-to-end `pnpm dev` smoke test

**Files:**

- Create: `scripts/dev-e2e.test.mjs`

**Step 1: Write the integration test**

Test that `pnpm dev --yes` (non-interactive mode):

1. Creates `.env` if missing
2. Generates tokens in `.env`
3. Starts both servers
4. Health checks pass
5. Prints banner with tokens and URLs
6. Shuts down cleanly on SIGINT

This is a process-level test that actually spawns `node scripts/dev.mjs --yes` and verifies output.

**Step 2: Run the test**

Run: `node --test scripts/dev-e2e.test.mjs`
Expected: PASS

**Step 3: Commit**

```bash
git add scripts/dev-e2e.test.mjs
git commit -m "test: add e2e smoke test for pnpm dev"
```

---

### Task 7: Update `.env.example` with new defaults

**Files:**

- Modify: `.env.example`

**Step 1: Update placeholder values**

Change `MCP_HTTP_ALLOW_LOCAL_HOSTS=false` and `MCP_HTTP_ALLOW_TAILSCALE_HOSTS=false` to have clear comments indicating the orchestrator will prompt for these.

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: update .env.example with orchestrator-prompted fields"
```

---

### Task 8: Run full lint + test and fix any issues

**Step 1: Run lint**

Run: `pnpm lint`
Fix any issues.

**Step 2: Run full test suite**

Run: `pnpm test`
Fix any failures.

**Step 3: Final commit if fixes needed**

```bash
git add -A
git commit -m "fix: address lint and test issues from P1-1 implementation"
```
