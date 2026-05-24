# BrowserBridge Chrome Extension

The Chrome extension is the first BrowserBridge browser client.

It must remain user-controlled:

- The user manually connects and disconnects from popup UI.
- The extension opens a WebSocket connection only after user action.
- The extension responds to MCP-originated requests while connected.
- The extension reads browser state only for explicit requests.
- The extension does not continuously stream page content.

First milestone behavior:

- Connect to the local WebSocket server.
- Respond to `get_status`.
- Return the current tab URL and title.

Future behavior requires ADR approval before implementation.

## Permissions

The current manifest declares no permissions. Add permissions only when a tested
feature requires them, and document why each permission is needed.

## Development

Runtime code has not been implemented yet. The expected package command shape is:

```sh
pnpm --filter @browserbridge/chrome-extension dev
pnpm --filter @browserbridge/chrome-extension build
```
