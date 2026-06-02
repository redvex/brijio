# ADR-0034: Integration test harness (WS + MCP real tool calls, Docker CI)

## Status

Proposed → Accepted

## Context

BrowserBridge has thorough unit tests for the WebSocket server (`server.test.ts`), MCP HTTP server (`index.test.ts`), and individual tool/unit tests (`websocket-client.test.ts`, `browser-list-tool.test.ts`, `click-element-tool.test.ts`, etc.). However, there is no integration test that exercises the **full stack** together:

1. Start a real WebSocket server
2. Start a real MCP HTTP server connected to it
3. Connect a mock browser extension over real WebSocket
4. Make real MCP tool calls via the MCP SDK client → HTTP transport → MCP server → WS client → WS server → extension
5. Verify the extension receives routed requests and the MCP client receives correct responses

The existing `index.test.ts` for MCP comes close — it uses real MCP SDK client + `StreamableHTTPClientTransport` — but mocks the WebSocket layer with a raw `WebSocketServer`. The missing piece is wiring a **real WS relay server** into the MCP runtime so that tool calls flow through auth, routing, and presence the same way they do in production.

Additionally, there is no Docker-based CI that validates the servers can be built and run in containers. The `docker-compose.yml` currently lacks a `test` profile, and no CI step validates container builds.

## Decision

### 1. Create `servers/mcp/src/integration.test.ts`

A new integration test file that:

- Starts a real `createWebSocketServer()` (port 0) with a known pairing token
- Starts a real `startBrowserBridgeMcpHttpServer()` pointed at that WS server
- Connects a mock browser extension via raw WebSocket, authenticates, and announces presence
- Uses the MCP SDK `Client` + `StreamableHTTPClientTransport` to make real tool calls
- Verifies end-to-end responses for every tool: `list_browsers`, `read_current_page`, `click_element`, `fill_input`, `fill_editable`, `set_checked`, `select_options`, `submit_form`
- Tests error flows: unauthenticated requests, disconnected browser, ambiguous browser target, missing browser instance

The mock extension answers requests with fixture data (page context, action results, browser list).

### 2. Test fixtures as extension response helpers

Create shared helper functions that:

- Connect, authenticate, and announce presence (`authenticatedExtension()`)
- Provide fixture responses for each request type (`page_context_response`, `action_result`, `browser_list`, etc.)
- Handle the `list_browsers` request transparently (since the WS server answers this itself from presence data, not forwarding to extension)

### 3. Add `test` profile to `docker-compose.yml`

Add a `test` service that:

- Builds from the monorepo root (like existing Dockerfiles)
- Runs `pnpm test` inside the container
- Uses `docker compose --profile test` to execute

This validates:

- Docker builds succeed for both server packages
- Tests pass in a clean container environment

### 4. Test coverage matrix

| Area              | Tests                                                                  |
| ----------------- | ---------------------------------------------------------------------- |
| Auth              | Reject unauthenticated MCP requests; accept authenticated ones         |
| list_browsers     | Returns presence-registered browsers; resolves ambiguous target errors |
| read_current_page | Returns page context from extension via full stack                     |
| click_element     | Routes click action to extension, returns action result                |
| fill_input        | Routes fill action to extension, writes text                           |
| fill_editable     | Routes editable fill to extension                                      |
| set_checked       | Routes set_checked to extension                                        |
| select_options    | Routes select_options to extension                                     |
| submit_form       | Routes submit action to extension                                      |
| Form lifecycle    | Fill → submit round-trip with formId tracking                          |
| Error paths       | Browser unavailable; timeout; disconnected extension                   |
| Health endpoints  | WS /health and MCP /health return correct status                       |

### 5. File layout

```
servers/mcp/src/integration.test.ts   # End-to-end tests using real WS + MCP servers
```

The test uses helpers from the existing `server.test.ts` pattern (raw WebSocket client, message factories) and the existing `index.test.ts` pattern (MCP SDK client, HTTP transport).

### 6. Docker compose test profile

```yaml
# Added to docker-compose.yml
test:
  build:
    context: .
    dockerfile: Dockerfile.test
  environment: ...
  profiles:
    - test
```

A `Dockerfile.test` at the monorepo root that installs dependencies, builds, and runs `pnpm test`.

## Consequences

### Positive

- Full-stack confidence: every code path from MCP SDK client → HTTP → MCP server → WS client → WS server → extension is exercised
- Catches regressions in auth, routing, presence, and protocol parsing that unit tests can miss
- Docker CI validates container builds and clean-environment test runs
- The integration test file uses the same patterns as existing tests, keeping the codebase consistent

### Negative

- Integration tests are slower than unit tests (real TCP listeners, event loop pauses)
- Mock extension responses must stay in sync with real extension behavior
- Docker test profile adds CI build time

### Mitigations

- Keep integration tests focused on critical paths, not exhaustive edge cases (unit tests cover those)
- Use shared fixture helpers to reduce duplication
- Event loop settling uses minimal delays (`setTimeout(resolve, 10)`) as in existing tests
