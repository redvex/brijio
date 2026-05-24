# BrowserBridge MCP Server

The MCP server exposes BrowserBridge tools to AI agents and routes those tool
calls to an active browser extension session through the WebSocket server.

Initial tools:

- `get_browser_status`
- `get_current_page_context`
- `navigate_to_url`
- `click_element`
- `fill_input`
- `submit_form`

The first milestone only requires `get_browser_status`.

Tool responses should be structured and predictable, using explicit success and
error shapes.

## Environment

Expected local variables:

```sh
WEBSOCKET_URL=ws://127.0.0.1:8787
BROWSERBRIDGE_TOKEN=local-dev-token
MCP_SESSION_ID=local
```

## Development

Runtime code has not been implemented yet. Once implemented, this package should
support:

```sh
pnpm --filter @browserbridge/mcp dev
pnpm --filter @browserbridge/mcp test
```
