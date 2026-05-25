# BrowserBridge MCP Server

The MCP server exposes BrowserBridge tools to AI agents and routes those tool
calls to an active browser extension session through the WebSocket server.

## Current Scope

The current implementation is the first approved MCP milestone from ADR 0007.
It exposes one tool:

- `get_current_page_context`

The tool opens a WebSocket connection to the configured BrowserBridge
WebSocket server, sends a `get_page_context` request with a generated request
ID, waits for the matching `page_context_response`, and returns a structured
result.

The stdio MCP runtime uses the official TypeScript MCP SDK for server
lifecycle, protocol framing, initialization, tool discovery, and tool calls.
BrowserBridge code only owns tool behavior and WebSocket request routing.

The Chrome extension must already be connected by the user. The MCP server does
not start browser access on its own and does not stream or store page state.

Out of scope for this package version:

- Browser actions such as navigation, click, fill, or submit.
- Authentication and private session routing.
- Multiple browser sessions.
- Page body text or DOM extraction.

## Tool Result

Successful responses use:

```json
{
  "ok": true,
  "data": {
    "url": "https://example.com/",
    "title": "Example"
  }
}
```

Failures use:

```json
{
  "ok": false,
  "error": {
    "code": "timeout",
    "message": "Timed out waiting for a browser page context response."
  }
}
```

Error codes are:

- `connection_failed`
- `timeout`
- `invalid_response`
- `browser_error`

## Environment

Expected local variables:

```sh
BROWSERBRIDGE_WEBSOCKET_URL=ws://127.0.0.1:8787
BROWSERBRIDGE_REQUEST_TIMEOUT_MS=5000
```

`WEBSOCKET_URL` is also accepted as a backward-compatible alias for
`BROWSERBRIDGE_WEBSOCKET_URL`.

## Development

```sh
pnpm --filter @browserbridge/mcp build
pnpm --filter @browserbridge/mcp check
pnpm --filter @browserbridge/mcp dev
pnpm --filter @browserbridge/mcp test
```

The tests start local WebSocket servers on `127.0.0.1` with ephemeral ports and
exercise request ID correlation, timeout handling, connection failures, protocol
parsing, tool result shaping, and SDK-backed MCP lifecycle behavior.

## Local Use

Start the WebSocket server:

```sh
pnpm --filter @browserbridge/websocket dev
```

Build and load the Chrome extension, configure it with
`ws://127.0.0.1:8787`, then start the bridge from the extension action.

Run the MCP server over stdio:

```sh
BROWSERBRIDGE_WEBSOCKET_URL=ws://127.0.0.1:8787 pnpm --filter @browserbridge/mcp exec tsx src/index.ts
```

An MCP-compatible client can then call `get_current_page_context`. The returned
data is limited to the current active tab URL and title for this milestone.
