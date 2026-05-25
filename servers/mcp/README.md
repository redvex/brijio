# BrowserBridge MCP Server

The MCP server exposes BrowserBridge resources and tools to AI agents and
routes explicit page-reading requests to an active browser extension session
through the WebSocket server.

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

The implementation also exposes the read-only MCP tool from ADR 0010:

- `read_current_page`

The tool reads the current page context and, by default, the first available
readable content chunk. It exists for tool-first clients and agents that are
more likely to discover tools than resources. It reuses the same
`get_page_context` and `get_page_content` WebSocket request path as the
resources.

The stdio MCP runtime uses the official TypeScript MCP SDK for server
lifecycle, protocol framing, initialization, resource discovery, resource
reads, tool discovery, and tool calls. BrowserBridge code only owns page
reading behavior and WebSocket request routing.

The Chrome extension must already be connected by the user. The MCP server does
not start browser access on its own and does not stream or store page state.

Browser action tools remain out of scope for this package version.

Out of scope for this package version:

- Tools for browser actions such as navigation, click, fill, or submit.
- Authentication and private session routing.
- Multiple browser sessions.
- Page body text or DOM extraction inside the MCP server. The MCP server only
  relays explicit requests to the connected extension.
- Server-side LLM summarization.

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

## Tool Result

`read_current_page` accepts:

```json
{
  "includeContent": true,
  "maxContentChunks": 1
}
```

Both fields are optional. `includeContent` defaults to `true`.
`maxContentChunks` defaults to `1` and must be an integer from `0` through `5`.
Use `includeContent: false` or `maxContentChunks: 0` to return only page
context.

Successful tool calls return:

```json
{
  "ok": true,
  "data": {
    "context": {
      "url": "https://example.com/",
      "title": "Example"
    },
    "content": [
      {
        "index": 1,
        "content": "# Example\n\nReadable content",
        "truncated": false
      }
    ],
    "contentTruncated": false,
    "nextContentIndex": null
  }
}
```

When the final fetched chunk is still truncated because `maxContentChunks` was
reached, `contentTruncated` is `true` and `nextContentIndex` points at the next
1-based chunk index to request through the resource path or a later tool call.

Tool failures use the same structured `ok: false` shape. Tool-specific input
errors use:

- `invalid_tool_input`

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
