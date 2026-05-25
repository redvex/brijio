# BrowserBridge MCP Server

The MCP server exposes BrowserBridge resources to AI agents and routes explicit
resource reads to an active browser extension session through the WebSocket
server.

## Current Scope

The current implementation exposes the read-only MCP resources from ADR 0007
and ADR 0009:

- `browser://page/current`, named `current-page-context`
- `browser://page/current/content/{index}`, named `current-page-content`

The page context resource handler opens a WebSocket connection to the
configured BrowserBridge WebSocket server, sends a `get_page_context` request
with a generated request ID, waits for the matching `page_context_response`, and
returns a structured JSON result.

The page content resource handler parses the 1-based `{index}` path segment,
sends a `get_page_content` request for that chunk, waits for the matching
`page_content_response`, and returns a structured JSON result.

The stdio MCP runtime uses the official TypeScript MCP SDK for server
lifecycle, protocol framing, initialization, resource discovery, and resource
reads. BrowserBridge code only owns page-context behavior and WebSocket request
routing.

The Chrome extension must already be connected by the user. The MCP server does
not start browser access on its own and does not stream or store page state.

For MCP client startup compatibility, the server also responds to `tools/list`
with an empty tool list. Browser action tools remain out of scope for this
package version.

Out of scope for this package version:

- Tools for browser actions such as navigation, click, fill, or submit.
- Authentication and private session routing.
- Multiple browser sessions.
- Page body text or DOM extraction inside the MCP server. The MCP server only
  relays explicit requests to the connected extension.

## Resource Result

Successful responses use:

```json
{
  "ok": true,
  "data": {
    "url": "https://example.com/",
    "title": "Example",
    "timestamp": "2026-05-25T10:00:00.000Z",
    "selectedText": null,
    "preview": {
      "content": "Example preview",
      "truncated": false,
      "maxBytes": 4096
    },
    "structure": {
      "headings": [],
      "landmarks": [],
      "links": [],
      "images": [],
      "forms": [],
      "actions": []
    },
    "content": {
      "available": true,
      "requestType": "get_page_content",
      "firstIndex": 1,
      "defaultMaxPayloadBytes": 131072
    }
  }
}
```

Page content chunk responses use:

```json
{
  "ok": true,
  "data": {
    "url": "https://example.com/",
    "title": "Example",
    "timestamp": "2026-05-25T10:00:00.000Z",
    "index": 1,
    "content": "# Example\n\nReadable content",
    "truncated": false,
    "maxPayloadBytes": 131072
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
- `invalid_resource_uri`

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
parsing, resource result shaping, page content chunk routing, resource template
discovery, and SDK-backed MCP lifecycle behavior.

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

An MCP-compatible client can then read `browser://page/current` for rich page
context. When `data.content.available` is true, the client can read
`browser://page/current/content/1`, then continue with later indexes while
`data.truncated` is true.
