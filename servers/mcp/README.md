# BrowserBridge MCP Server

The MCP server exposes BrowserBridge resources and tools to AI agents and
routes explicit page-reading, click, and form-fill requests to an active
browser extension session through the WebSocket server.

## Current Scope

The current implementation authenticates to the BrowserBridge WebSocket server
with a local pairing token and exposes the read-only MCP resources from ADR
0007 and ADR 0009:

- `browser://page/current`, named `current-page-context`
- `browser://page/current/content/{index}`, named `current-page-content`

The page context resource handler opens a WebSocket connection to the
configured BrowserBridge WebSocket server, sends a `get_page_context` request
with a generated request ID, waits for the matching `page_context_response`, and
returns a structured JSON result.

The page content resource handler parses the 1-based `{index}` path segment,
sends a `get_page_content` request for that chunk, waits for the matching
`page_content_response`, and returns a structured JSON result.

The implementation also exposes MCP tools:

- `list_browsers`
- `read_current_page`
- `click_element`
- `fill_input`
- `fill_editable`
- `set_checked`
- `select_options`
- `submit_form`

`list_browsers` returns the browser instances currently online for the
configured pairing token. Use it when more than one browser extension instance
is connected and an agent needs to choose a target.

`read_current_page` reads the current page context and, by default, the first
available readable content chunk. It exists for tool-first clients and agents
that are more likely to discover tools than resources. It reuses the same
`get_page_context` and `get_page_content` WebSocket request path as the
resources.

`click_element` clicks a visible link or button-like action from the current
page using a short-lived target ID returned by `read_current_page`. It sends a
`perform_action` click request over WebSocket and waits for the matching
`action_result`.

`fill_input` writes text into a supported visible form control from the current
page using short-lived form and control IDs returned by `read_current_page`. It
sends a `perform_action` `write_text` request over WebSocket and waits for the
matching `action_result`.

`fill_editable` writes plain text into a visible contenteditable target from
the current page using a short-lived editable ID returned by
`read_current_page`. It sends a `perform_action` `write_text` request with the
ADR 0016 editable target shape.

`set_checked` sets checkbox state or selects a radio option using a
short-lived form control ID. `select_options` selects option values in a
visible single-select or multi-select control. `submit_form` submits a visible
form by short-lived form ID. Each tool sends one ADR 0016 `perform_action`
message and waits for the matching `action_result`.

The HTTP MCP runtime uses the official TypeScript MCP SDK Streamable HTTP
transport for server lifecycle, protocol framing, initialization, resource
discovery, resource reads, tool discovery, and tool calls. BrowserBridge code
owns HTTP boundary checks, page reading behavior, and WebSocket request routing.

The Chrome extension must already be connected by the user. The MCP server does
not start browser access on its own and does not stream or store page state.
Clicking and filling inputs are discrete browser-mutating tool calls, not
background automation.

Browser tools accept optional `browserInstanceId`. If omitted, the WebSocket
server routes automatically only when exactly one browser is online for the
pairing token. `BROWSERBRIDGE_BROWSER_INSTANCE_ID` can set a default target for
all tool and resource requests from this MCP server.

Out of scope for this package version:

- Navigation tools.
- CSS selector, XPath, text-query, coordinate, hover, keyboard, drag, or
  multi-step action support.
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
- `auth_required`
- `auth_failed`
- `browser_unavailable`
- `ambiguous_browser_target`
- `invalid_browser_target`

## Tool Results

`read_current_page` accepts:

```json
{
  "includeContent": true,
  "maxContentChunks": 1,
  "browserInstanceId": "chrome-default-test"
}
```

All fields are optional. `includeContent` defaults to `true`.
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

`click_element` accepts:

```json
{
  "kind": "link",
  "id": "bb-1",
  "browserInstanceId": "chrome-default-test"
}
```

`kind` must be `link` for targets from `structure.links[]` or `action` for
targets from `structure.actions[]`. `id` must be a non-empty short-lived
BrowserBridge target ID from the latest page context. Call
`read_current_page` first, choose a target, then pass its kind and ID to
`click_element`.

Successful click calls return:

```json
{
  "ok": true,
  "data": {
    "action": "click",
    "target": {
      "kind": "link",
      "id": "bb-1"
    }
  }
}
```

Click failures use the same structured shape:

```json
{
  "ok": false,
  "error": {
    "code": "browser_error",
    "message": "No matching click target was found."
  }
}
```

`fill_input` accepts:

```json
{
  "formId": "form-1",
  "controlId": "control-1",
  "text": "hello",
  "browserInstanceId": "chrome-default-test"
}
```

`formId` must be a non-empty short-lived ID from `structure.forms[]`.
`controlId` must be a non-empty short-lived ID from that form's
`controls[]`. `text` must be a string. Empty text is allowed so callers can
clear a supported text control.

Call `read_current_page` first, choose a target from
`data.context.structure.forms[].controls[]`, then pass the containing form ID,
control ID, and desired text to `fill_input`. The tool writes text only; it
does not submit the form.

Successful fill calls return:

```json
{
  "ok": true,
  "data": {
    "action": "write_text",
    "target": {
      "formId": "form-1",
      "controlId": "control-1"
    },
    "textLength": 5
  }
}
```

Fill failures use the same structured shape:

```json
{
  "ok": false,
  "error": {
    "code": "browser_error",
    "message": "No matching form control was found."
  }
}
```

`fill_editable` accepts:

```json
{
  "id": "bb-1",
  "text": "Plain text replacement",
  "browserInstanceId": "chrome-default-test"
}
```

`id` must be a non-empty short-lived ID from
`data.context.structure.editables[]`. `text` must be a string. Empty text is
allowed so callers can clear a supported contenteditable target.

Successful editable fill calls return:

```json
{
  "ok": true,
  "data": {
    "action": "write_text",
    "target": {
      "kind": "editable",
      "id": "bb-1"
    },
    "textLength": 22
  }
}
```

`set_checked` accepts:

```json
{
  "formId": "form-1",
  "controlId": "control-1",
  "checked": true,
  "browserInstanceId": "chrome-default-test"
}
```

Use it for checkbox controls and for selecting radio options. Radio controls
support `checked: true`; clearing a radio directly is rejected by the
extension.

Successful checked-state calls return:

```json
{
  "ok": true,
  "data": {
    "action": "set_checked",
    "target": {
      "formId": "form-1",
      "controlId": "control-1"
    },
    "checked": true,
    "changed": true
  }
}
```

`select_options` accepts:

```json
{
  "formId": "form-1",
  "controlId": "control-1",
  "values": ["alpha", "gamma"],
  "browserInstanceId": "chrome-default-test"
}
```

Values must come from the target control's page-context `options[]` metadata.
Single-select controls require one value. Multi-select controls accept zero or
more values.

Successful select calls return:

```json
{
  "ok": true,
  "data": {
    "action": "select_options",
    "target": {
      "formId": "form-1",
      "controlId": "control-1"
    },
    "values": ["alpha", "gamma"]
  }
}
```

`submit_form` accepts:

```json
{
  "formId": "form-1",
  "browserInstanceId": "chrome-default-test"
}
```

The extension resolves the visible form and uses browser-native submission
behavior. Successful submit calls return:

```json
{
  "ok": true,
  "data": {
    "action": "submit_form",
    "target": {
      "formId": "form-1"
    }
  }
}
```

## Environment

Expected local variables:

```sh
BROWSERBRIDGE_WEBSOCKET_URL=ws://127.0.0.1:8787
BROWSERBRIDGE_REQUEST_TIMEOUT_MS=5000
BROWSERBRIDGE_PAIRING_TOKEN=replace-with-generated-token
BROWSERBRIDGE_BROWSER_INSTANCE_ID=
MCP_HTTP_HOST=127.0.0.1
MCP_HTTP_PORT=8788
MCP_HTTP_PATH=/mcp
MCP_HTTP_AUTH_TOKEN=replace-with-generated-mcp-token
MCP_HTTP_ALLOWED_HOSTS=127.0.0.1,localhost
MCP_HTTP_ALLOWED_ORIGINS=
MCP_HTTP_ALLOW_TAILSCALE_HOSTS=false
MCP_HTTP_ALLOW_LOCAL_HOSTS=false
```

`WEBSOCKET_URL` is also accepted as a backward-compatible alias for
`BROWSERBRIDGE_WEBSOCKET_URL`. `BROWSERBRIDGE_TOKEN` is accepted as a
backward-compatible alias for `BROWSERBRIDGE_PAIRING_TOKEN`.

`MCP_HTTP_AUTH_TOKEN` is required. It authenticates MCP clients to this HTTP
server and must not be reused as the BrowserBridge pairing token.
`MCP_HTTP_ALLOWED_HOSTS` accepts comma-separated host names or host values.
`MCP_HTTP_ALLOWED_ORIGINS` accepts comma-separated origins for browser-based
MCP clients that send an `Origin` header.
Both lists support wildcard DNS suffix entries such as `*.ts.net` and
`*.local`.
`MCP_HTTP_ALLOW_TAILSCALE_HOSTS=true` appends `*.ts.net` to both checks so
Tailscale MagicDNS names are accepted while bearer-token authentication remains
required.
`MCP_HTTP_ALLOW_LOCAL_HOSTS=true` appends `*.local` to both checks for
mDNS-style local network names while keeping bearer-token authentication
required.

## Development

```sh
pnpm --filter @browserbridge/mcp build
pnpm --filter @browserbridge/mcp check
pnpm --filter @browserbridge/mcp dev
pnpm --filter @browserbridge/mcp test
```

The tests start local WebSocket servers on `127.0.0.1` with ephemeral ports and
exercise request ID correlation, timeout handling, connection failures, protocol
parsing, resource result shaping, page content chunk routing, click action
routing, form action routing, resource template discovery, and SDK-backed MCP
lifecycle behavior.

## Local Use

Start the WebSocket server:

```sh
pnpm --filter @browserbridge/websocket dev
```

Build and load the Chrome extension, configure it with
`ws://127.0.0.1:8787` and the same pairing token, then start the bridge from
the extension action.

Run the MCP server over HTTP:

```sh
BROWSERBRIDGE_WEBSOCKET_URL=ws://127.0.0.1:8787 BROWSERBRIDGE_PAIRING_TOKEN=your-local-token MCP_HTTP_AUTH_TOKEN=your-mcp-http-token pnpm --filter @browserbridge/mcp dev
```

The default MCP endpoint is `http://127.0.0.1:8788/mcp`. MCP clients must send
`Authorization: Bearer your-mcp-http-token`.

An MCP-compatible client can call `list_browsers` to discover online browser
instances and then read `browser://page/current` for rich page context. When
`data.content.available` is true, the client can read
`browser://page/current/content/1`, then continue with later indexes while
`data.truncated` is true.

For clicks, call the `read_current_page` tool and choose a target from
`data.context.structure.links[]` or `data.context.structure.actions[]`. Then
call `click_element` with that target's collection kind and ID.

For input filling, call `read_current_page` and choose a control from
`data.context.structure.forms[].controls[]`. Then call `fill_input` with the
containing form ID, control ID, and text to write.

For contenteditable text, choose a target from
`data.context.structure.editables[]`, then call `fill_editable` with the
editable ID and text to write.

For checkboxes, radio options, selects, and form submission, choose the target
form/control IDs from `data.context.structure.forms[]` and call `set_checked`,
`select_options`, or `submit_form`.
