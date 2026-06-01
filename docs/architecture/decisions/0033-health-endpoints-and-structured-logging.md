# ADR 0033: Health Endpoints & Structured Logging

## Status

Accepted

## Context

Both the WS server and MCP server have stub `GET /health` endpoints returning `{"status":"ok"}`. For production observability (P1-4), operators need:

1. **Version** — which build is running
2. **Uptime** — how long since startup
3. **Connection state** — how many WS extensions are connected (WS server) and whether the WS backend is reachable (MCP server)

Both servers use `console.log`/`console.error` with unstructured messages. For Docker/OCI logging and monitoring pipelines, structured JSON logs are essential.

## Decision

### 1. Enrich /health on WS Server

Return a JSON object with `status`, `version` (from package.json), `uptimeSeconds`, and `extensions` (count + list of connected browser instance IDs with labels):

```json
{
  "status": "ok",
  "version": "0.0.0",
  "uptimeSeconds": 3621,
  "extensions": {
    "count": 2,
    "browsers": [
      { "browserInstanceId": "chrome-default", "label": "Chrome Default" }
    ]
  }
}
```

### 2. Enrich /health on MCP Server

The MCP server has no persistent WS connections — it creates a throwaway WS client per tool call. The health endpoint returns version, uptime, and the configured WS URL:

```json
{
  "status": "ok",
  "version": "0.0.0",
  "uptimeSeconds": 3621,
  "websocket": {
    "url": "ws://127.0.0.1:8787",
    "status": "reachable"
  }
}
```

The `reachable` check is an optional lightweight WS handshake probe with a short timeout. If the check fails or times out, it reports `"unknown"` rather than blocking the health response.

### 3. Structured JSON Logger

Create a minimal `Logger` type in `packages/shared/src/logger.ts`:

```typescript
interface LogEntry {
  timestamp: string; // ISO 8601
  level: "debug" | "info" | "warn" | "error";
  message: string;
  service: string; // 'websocket' | 'mcp'
  [key: string]: unknown;
}
```

Both servers create a logger with a service name. All `console.log`/`console.error` calls are replaced with `logger.info()`/`logger.error()` emitting single-line JSON to **stderr**. Stderr is chosen so it doesn't interfere with MCP stdio transport or HTTP response pipes.

No external dependencies (no pino, no winston). Just `JSON.stringify` + `process.stderr.write`.

### 4. Version Source

Read version from `package.json` at module load time. Both servers already set version `"0.0.0"` — this is the single source of truth. TypeScript `resolveJsonModule` enables the import.

## Consequences

- Health endpoints go from ~15 bytes to ~200 bytes — still trivial.
- Adding a shared dependency (`packages/shared`) for the logger means both servers import from the same place.
- The WS server must expose extension state via a new `getStatus()` function on the return object.
- No new HTTP routes beyond `/health` — keeps the attack surface minimal.
- JSON logging to stderr is OCI-compatible and works with `docker logs`, `journalctl`, and structured log shippers.
