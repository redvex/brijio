# WebSocket Single-Channel Echo And Pub/Sub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved unauthenticated local WebSocket server that echoes valid messages to the sender and broadcasts them to peers on one implicit channel.

**Architecture:** `servers/websocket/src/protocol.ts` owns message validation, `servers/websocket/src/server.ts` owns connection tracking and fan-out, and `servers/websocket/src/index.ts` starts the local server from environment defaults. Tests drive validation, echo, broadcast, and invalid-message behavior.

**Tech Stack:** TypeScript, Node.js 22, `ws`, Node test runner through `tsx`.

---

### Task 1: Test Harness And Failing Server Tests

**Files:**

- Modify: `servers/websocket/package.json`
- Create: `servers/websocket/tsconfig.json`
- Create: `servers/websocket/src/server.test.ts`

- [x] **Step 1: Add test/build scripts and dependencies**

Add `build`, `check`, and `test` scripts that execute TypeScript directly, with `ws` for WebSocket server/client behavior.

- [x] **Step 2: Write failing tests**

Cover:

- a valid message echoes back to the sender;
- a valid message broadcasts to another connected client;
- invalid JSON returns `type: "error"` with `code: "invalid_json"`;
- unsupported envelopes return `type: "error"` with `code: "invalid_message"`.

- [x] **Step 3: Run tests and verify red**

Run: `pnpm --filter @browserbridge/websocket test`

Expected: failure because `createWebSocketServer` and protocol code do not exist yet.

### Task 2: Minimal Protocol And Server Implementation

**Files:**

- Create: `servers/websocket/src/protocol.ts`
- Create: `servers/websocket/src/server.ts`
- Create: `servers/websocket/src/index.ts`
- Modify: `servers/websocket/src/server.test.ts`

- [x] **Step 1: Implement protocol parsing**

Accept only JSON objects with `type: "message"` and a `payload` property. Return typed structured errors for invalid JSON and invalid message envelopes.

- [x] **Step 2: Implement server fan-out**

Track connected sockets in memory. For each valid message, send the original envelope to the sender and all other currently open clients.

- [x] **Step 3: Run websocket tests and verify green**

Run: `pnpm --filter @browserbridge/websocket test`

Expected: all websocket tests pass.

### Task 3: Documentation And Package Verification

**Files:**

- Modify: `servers/websocket/README.md`
- Modify: `docs/architecture/decisions/0002-websocket-single-channel-echo-pubsub.md`

- [x] **Step 1: Update docs**

Document the temporary no-auth, single-channel local behavior and local commands.

- [x] **Step 2: Mark ADR accepted**

Change ADR 0002 from `Proposed` to `Accepted` after implementation matches the approved design.

- [x] **Step 3: Run verification**

Run:

```sh
pnpm --filter @browserbridge/websocket test
pnpm --filter @browserbridge/websocket build
pnpm --filter @browserbridge/websocket check
```

Expected: each command exits with code 0.
