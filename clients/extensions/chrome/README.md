# BrowserBridge Chrome Extension

The Chrome extension is the first BrowserBridge browser client.

It must remain user-controlled:

- The user manually starts and stops the bridge through the extension toolbar
  action.
- The extension opens a WebSocket connection only after user action.
- The extension authenticates with the configured local pairing token.
- The extension announces browser instance presence after authentication and
  whenever the WebSocket server asks for presence.
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
- `perform_action` with `action.type: "write_text"` writes provided text into a
  supported visible form control or contenteditable surface from the active
  regular page.
- `perform_action` with `action.type: "set_checked"` sets checkbox state or
  selects a radio option.
- `perform_action` with `action.type: "select_options"` selects options in
  single-select and multi-select controls.
- `perform_action` with `action.type: "submit_form"` submits a visible form
  with browser validation.
- Click targets use short-lived IDs from the latest `get_page_context`
  response, scoped by `target.kind`.
- Form-control actions use short-lived form and control IDs from the latest
  `get_page_context` response.
- The extension returns `action_result` with the same request ID.

## User Flow

The extension is transparent during normal use:

1. Load the extension in Chrome.
2. Click the BrowserBridge toolbar action the first time.
3. Enter the local WebSocket URL, for example `ws://127.0.0.1:8787`.
4. Enter the pairing token generated with `pnpm token`.
5. Confirm the auto-generated browser identity or edit the profile/label fields.
6. Optionally enable regular page access for HTTP and HTTPS pages.
7. Click the toolbar action again to start the bridge.
8. Click the toolbar action while connected to stop the bridge.

The extension shows connection state through the toolbar badge and title:

- `OFF`: configured but stopped.
- `ON`: connected to the WebSocket server.
- `ERR`: the WebSocket connection reported an error.

No page context or page content is sent until the extension receives an
explicit read request over the user-started WebSocket connection.

While connected, the extension authenticates first, announces presence, and
sends a small `extension_keepalive` message every 20 seconds. Keepalive messages
contain no browser state. Presence contains only the browser instance ID, browser
name, profile name, user-visible label, and supported capability names. It does
not include page URL, title, content, selected text, or DOM state.

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
- `storage`: remembers the user-entered WebSocket URL, pairing token, and
  browser identity fields.
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

With the local WebSocket server running and the extension connected, clients
must authenticate before sending browser requests. Extension auth uses:

```json
{
  "type": "message",
  "id": "auth-1",
  "payload": {
    "type": "auth",
    "role": "extension",
    "token": "your-local-token"
  }
}
```

After auth succeeds, the extension announces presence:

```json
{
  "type": "message",
  "id": "presence-1",
  "payload": {
    "type": "browser_presence_announce",
    "browserInstanceId": "chrome-default-test",
    "label": "Chrome Default",
    "browserName": "Chrome",
    "profileName": "Default",
    "capabilities": ["page_context", "page_content", "page_actions"]
  }
}
```

The MCP side can then send browser requests through the authenticated WebSocket
server:

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

To write text into a supported form control, first request page context and use
IDs from `structure.forms[]` and `structure.forms[].controls[]`. Form IDs are
scoped to the page context, and control IDs are scoped to the containing form:

```json
{
  "type": "message",
  "id": "action-2",
  "payload": {
    "type": "perform_action",
    "action": {
      "type": "write_text",
      "target": {
        "formId": "bb-1",
        "controlId": "bb-2"
      },
      "text": "Ada Lovelace"
    }
  }
}
```

Successful text action responses include the written text length but not the
text itself:

```json
{
  "type": "message",
  "id": "action-2",
  "payload": {
    "type": "action_result",
    "ok": true,
    "data": {
      "action": "write_text",
      "target": {
        "formId": "bb-1",
        "controlId": "bb-2"
      },
      "textLength": 12
    }
  }
}
```

The write action supports visible `<textarea>`, contenteditable text surfaces,
and visible value-entry inputs including text, search, email, URL, telephone,
number, date, time, datetime-local, month, week, color, and range controls. It
does not support password, file, hidden, checkbox, radio, select, button,
submit, reset, or rich HTML insertion.

Checkboxes and radio buttons use `set_checked`:

```json
{
  "type": "message",
  "id": "action-3",
  "payload": {
    "type": "perform_action",
    "action": {
      "type": "set_checked",
      "target": {
        "formId": "bb-1",
        "controlId": "bb-4"
      },
      "checked": true
    }
  }
}
```

Select controls use `select_options` with option values from page context:

```json
{
  "type": "message",
  "id": "action-4",
  "payload": {
    "type": "perform_action",
    "action": {
      "type": "select_options",
      "target": {
        "formId": "bb-1",
        "controlId": "bb-5"
      },
      "values": ["alpha", "gamma"]
    }
  }
}
```

Forms use an explicit `submit_form` action:

```json
{
  "type": "message",
  "id": "action-5",
  "payload": {
    "type": "perform_action",
    "action": {
      "type": "submit_form",
      "target": {
        "formId": "bb-1"
      }
    }
  }
}
```

## Current Limitations

Presence is runtime-only and exists only while the user-controlled WebSocket is
connected. Browser identity is local extension configuration; future cloud token
issuance and hosted account/session handling remain separate milestones.
