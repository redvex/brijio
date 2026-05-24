# BrowserBridge WebSocket Server

The WebSocket server manages live browser extension connections and routes
requests between trusted server components and active extension sessions.

Initial responsibilities:

- Accept user-started extension connections.
- Track user, session, and channel identifiers.
- Authenticate connections with a local development token.
- Forward MCP-originated requests to the correct extension session.
- Return extension responses to the caller.
- Surface structured errors for missing sessions, invalid messages, auth
  failures, timeouts, and unsupported actions.

The first milestone only requires routing `get_status` to a connected Chrome
extension and returning a `status_response` with the current tab URL and title.

## Environment

Expected local variables:

```sh
WEBSOCKET_HOST=127.0.0.1
WEBSOCKET_PORT=8787
BROWSERBRIDGE_TOKEN=local-dev-token
```

## Development

Runtime code has not been implemented yet. Once implemented, this package should
support:

```sh
pnpm --filter @browserbridge/websocket dev
pnpm --filter @browserbridge/websocket test
```
