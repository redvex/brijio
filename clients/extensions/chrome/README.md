# BrowserBridge Chrome Extension

The Chrome extension is the first BrowserBridge browser client.

It must remain user-controlled:

- The user manually starts and stops the bridge through the extension toolbar
  action.
- The extension opens a WebSocket connection only after user action.
- The extension responds to MCP-originated requests while connected.
- The extension reads browser state only for explicit requests.
- The extension does not continuously stream page content.

First milestone behavior:

- Connect to the local WebSocket server.
- Respond to `get_page_context`.
- Return the current tab URL and title.

Future behavior requires ADR approval before implementation.

## User Flow

The extension is transparent during normal use:

1. Load the extension in Chrome.
2. Click the BrowserBridge toolbar action the first time.
3. Enter the local WebSocket URL, for example `ws://127.0.0.1:8787`.
4. Click the toolbar action again to start the bridge.
5. Click the toolbar action while connected to stop the bridge.

The extension shows connection state through the toolbar badge and title:

- `OFF`: configured but stopped.
- `ON`: connected to the WebSocket server.
- `ERR`: the WebSocket connection reported an error.

No page context is sent until the extension receives an explicit
`get_page_context` request over the user-started WebSocket connection.

While connected, the extension sends a small `extension_keepalive` message every
20 seconds. This message contains no browser state. It keeps the Manifest V3
service worker active while the user-visible bridge state is `ON`.

## Permissions

The manifest declares only the permissions required for the first milestone:

- `storage`: remembers the user-entered WebSocket URL.
- `tabs`: reads the active tab URL and title when responding to an explicit
  `get_page_context` request.

The extension does not declare host permissions for this milestone because it
does not inject scripts or read DOM content.

## Development

Build the extension package:

```sh
pnpm --filter @browserbridge/chrome-extension build
```

Run tests and type checks:

```sh
pnpm --filter @browserbridge/chrome-extension test
pnpm --filter @browserbridge/chrome-extension check
```

Load `clients/extensions/chrome/dist` through Chrome's "Load unpacked" flow.
The extension requires Chrome 116 or newer.

## Local WebSocket Request

With the local WebSocket server running and the extension connected, send a
message in the current single-channel envelope shape:

```json
{
  "type": "message",
  "id": "request-1",
  "payload": {
    "type": "get_page_context"
  }
}
```

The extension responds on the same WebSocket. The local WebSocket server forwards
that response to other connected clients and does not echo the original request
back to the sender.

```json
{
  "type": "message",
  "id": "request-1",
  "payload": {
    "type": "page_context_response",
    "ok": true,
    "data": {
      "url": "https://example.com/",
      "title": "Example Domain"
    }
  }
}
```

## Current Limitations

This package still uses the unauthenticated local single-channel WebSocket
server from ADR 0002. Authenticated private routing, MCP integration, richer
page context, and browser actions require separate ADR approval before
implementation.
