# BrowserBridge Chrome Extension

The Chrome extension is the first BrowserBridge browser client.

It must remain user-controlled:

- The user manually starts and stops the bridge through the extension toolbar
  action.
- The extension opens a WebSocket connection only after user action.
- The extension responds to MCP-originated requests while connected.
- The extension reads browser state only for explicit requests.
- The extension does not continuously stream page content.

Current page read behavior:

- Connect to the local WebSocket server.
- `get_page_context` returns the active tab URL, title, selected text, a small
  readable preview, and a structure snapshot for headings, landmarks, links,
  images, forms, and actions.
- `get_page_content` returns readable page content in 1-based chunks.
- Page content is plain text with light Markdown for headings, links, images,
  and simple tables.
- `page_content_response.data.truncated` tells the requester whether another
  chunk is available at the next index.

Current page action behavior:

- `perform_action` with `action.type: "click"` clicks a visible link or
  button-like action from the active regular page.
- Click targets use short-lived IDs from the latest `get_page_context`
  response, scoped by `target.kind`.
- The extension returns `action_result` with the same request ID.

## User Flow

The extension is transparent during normal use:

1. Load the extension in Chrome.
2. Click the BrowserBridge toolbar action the first time.
3. Enter the local WebSocket URL, for example `ws://127.0.0.1:8787`.
4. Optionally enable regular page access for HTTP and HTTPS pages.
5. Click the toolbar action again to start the bridge.
6. Click the toolbar action while connected to stop the bridge.

The extension shows connection state through the toolbar badge and title:

- `OFF`: configured but stopped.
- `ON`: connected to the WebSocket server.
- `ERR`: the WebSocket connection reported an error.

No page context or page content is sent until the extension receives an
explicit read request over the user-started WebSocket connection.

While connected, the extension sends a small `extension_keepalive` message every
20 seconds. This message contains no browser state. It keeps the Manifest V3
service worker active while the user-visible bridge state is `ON`.

The extension reads DOM content only after an explicit WebSocket request while
the user-started bridge is connected. It does not stream or store page content.
Browser actions follow the same explicit request model and are not performed
unless a WebSocket peer sends a structured action request.

## Permissions

The manifest declares only the permissions required for the current extension
behavior:

- `activeTab`: grants temporary access to the active page after the user starts
  the bridge from the toolbar.
- `scripting`: injects the content script on demand for explicit page context
  and page content requests.
- `storage`: remembers the user-entered WebSocket URL.
- `tabs`: reads the active tab URL and title and sends messages to the active
  tab.

The manifest also declares optional host permissions for regular pages:

- `http://*/*`
- `https://*/*`

These optional permissions are requested only from the setup page after user
action. They let BrowserBridge read regular HTTP and HTTPS pages when the
temporary `activeTab` grant is not available. The extension still rejects
Chrome internal pages, extension pages, local files, and other unsupported
schemes.

Page DOM access remains tied to explicit reads while the user-controlled bridge
is connected. The extension does not continuously stream or store page content.

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

## Local WebSocket Requests

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
      "title": "Example Domain",
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
}
```

To read page content, request a 1-based chunk index:

```json
{
  "type": "message",
  "id": "content-1",
  "payload": {
    "type": "get_page_content",
    "index": 1
  }
}
```

The content response uses plain text with minimal Markdown:

```json
{
  "type": "message",
  "id": "content-1",
  "payload": {
    "type": "page_content_response",
    "ok": true,
    "data": {
      "url": "https://example.com/",
      "title": "Example Domain",
      "timestamp": "2026-05-25T10:00:01.000Z",
      "index": 1,
      "content": "# Example Domain\n\nReadable page content",
      "truncated": false,
      "maxPayloadBytes": 131072
    }
  }
}
```

If Chrome denies content script injection on a regular HTTP or HTTPS page and
regular page access has not been enabled, the extension returns:

```json
{
  "type": "message",
  "id": "content-1",
  "payload": {
    "type": "page_content_response",
    "ok": false,
    "error": {
      "code": "regular_page_permission_required",
      "message": "Regular page access is not enabled. Open BrowserBridge setup and enable regular page access."
    }
  }
}
```

To click a link or button-like page action, first request page context and use
an ID from either `structure.links[]` or `structure.actions[]`. Link and action
IDs are scoped to their own target kind:

```json
{
  "type": "message",
  "id": "action-1",
  "payload": {
    "type": "perform_action",
    "action": {
      "type": "click",
      "target": {
        "kind": "link",
        "id": "bb-1"
      }
    }
  }
}
```

Successful action responses preserve the request ID:

```json
{
  "type": "message",
  "id": "action-1",
  "payload": {
    "type": "action_result",
    "ok": true,
    "data": {
      "action": "click",
      "target": {
        "kind": "link",
        "id": "bb-1"
      }
    }
  }
}
```

Disabled or missing targets return structured action errors:

```json
{
  "type": "message",
  "id": "action-1",
  "payload": {
    "type": "action_result",
    "ok": false,
    "error": {
      "code": "target_not_found",
      "message": "No matching click target was found."
    }
  }
}
```

## Current Limitations

This package still uses the unauthenticated local single-channel WebSocket
server from ADR 0002. Authenticated private routing, MCP content resources, and
MCP action tools require separate ADR approval before implementation.
