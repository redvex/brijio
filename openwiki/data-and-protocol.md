---
type: "Reference"
title: "Protocol and Data Model Guide"
description: "Canonical reference for shared data structures and protocol shapes: WebSocket envelope, auth and presence, browser capabilities, tab listing, file uploads, download/fetch status, and screenshots."
tags:
  [
    protocol,
    data-model,
    websocket,
    envelope,
    capabilities,
    tabs,
    uploads,
    downloads,
  ]
verified:
  - by: openwiki/0.5.2
    at: 2026-09-19T12:17:06.598Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-a31e56605839ce458ceb1d44
    resource: repo://docs/architecture/decisions/0060-explicit-tab-listing-and-selection.md
  - id: openwiki-source-79dd91ec51a55e7e78c52ccc
    resource: repo://docs/architecture/decisions/0064-visual-action-verification.md
  - id: openwiki-source-9b8357af9c7ef75912f57765
    resource: repo://docs/project/CAPABILITY_MATRIX.md
  - id: openwiki-source-5524638d57e96598fd8e40d4
    resource: repo://packages/shared/src/background-controller.ts
  - id: openwiki-source-265221f77947a8a08e9a018a
    resource: repo://packages/shared/src/index.ts
  - id: openwiki-source-c20cbcf46daa07e6332e3f7f
    resource: repo://packages/shared/src/protocol.ts
  - id: openwiki-source-48d3485f346966d1c44c7ea7
    resource: repo://servers/mcp/src/protocol.ts
  - id: openwiki-source-fc4b25ba659ae4c102750c8d
    resource: repo://servers/mcp/src/websocket-client.ts
  - id: openwiki-source-875036d8e83469fa1fc3f8e3
    resource: repo://servers/websocket/src/server.ts
generated: { by: "openwiki/0.5.2", at: "2026-09-19T12:17:06.598Z" }
---

# Protocol and Data Model Guide

This page is the canonical OpenWiki reference for the shared data structures and
protocol message shapes that flow between the MCP server, the WebSocket relay,
and the browser extensions. The source of truth for these shapes is
`packages/shared/src/protocol.ts`; the MCP-side relay client builds envelopes in
`servers/mcp/src/protocol.ts`, and the relay server re-exports and enforces them
in `servers/websocket/src/protocol.ts`.

Changing any shape described here without updating the relay, MCP server, and
extensions breaks interoperability across package boundaries (AGENTS.md: a
cross-package protocol or schema change requires an ADR).

## The canonical envelope

Every application message is wrapped in a `WebSocketEnvelope`:

```ts
export interface WebSocketEnvelope {
  type: "message";
  id?: string;
  target?: {
    browserInstanceId?: string;
    tabId?: string;
  };
  payload: unknown;
}
```

- `type` is always `'message'` for normal traffic. Errors that the relay itself
  rejects use a separate `BrijioErrorEnvelope` with `type: 'error'` (see
  [Errors](#errors)).
- `id` is an optional request correlation id. The MCP client generates ids of
  the form `mcp-<timestamp>-<random>`; the relay stores `scopeKey:id` in a
  pending-request map so it can route the extension's response back to the
  requesting MCP socket.
- `target` carries explicit routing. `browserInstanceId` selects which connected
  extension receives the message; `tabId` selects which browser tab the extension
  acts on. Both are optional and per-call — there is no hidden "selected browser"
  or "selected tab" session state.
- `payload` is the typed message body (auth, presence, a request, or a
  response).

`BrijioEnvelope` is an alias for `WebSocketEnvelope`. The relay parses every
incoming frame with `parseBrijioEnvelope`, which `JSON.parse`s the frame and
validates that it is an object with `type: 'message'` and a `payload` property;
invalid JSON yields a `BrijioErrorEnvelope` with code `invalid_json`, and a
non-envelope object yields `invalid_message`.

## Auth and roles

A connection authenticates with an `AuthPayload` carried as the envelope
payload:

```ts
export type BrijioRole = "extension" | "mcp";

export interface AuthPayload {
  type: "auth";
  role: BrijioRole;
  token: string;
}
```

`createAuthEnvelope` builds this envelope (accepting either a bare token — which
defaults `role` to `'extension'` — or a `{ token, role, requestId }` object). The
relay checks the token against the configured pairing token set, derives a
`scopeKey` from its SHA-256 hash, stores `role`/`scopeKey` on the connection
state, and replies with an `AuthSuccessPayload` (`type: 'auth_success'`). Only
after auth success does the relay accept further messages.

`scopeKey` is the isolation boundary: presence records and pending requests are
keyed by `scopeKey`, so two different pairing tokens never see each other's
browsers or responses.

## Browser presence and capabilities

Immediately after authenticating an extension, the relay sends a
`BrowserPresenceRequestPayload` (`type: 'browser_presence_request'`). The
extension replies with a `BrowserPresenceAnnouncePayload`, which extends
`BrowserPresence` with `type: 'browser_presence_announce'`:

```ts
export interface BrowserPresence {
  browserInstanceId: string;
  label: string;
  browserName: string;
  profileName: string;
  connectedAt?: string;
  lastSeenAt?: string;
  capabilities: BrowserCapability[];
}
```

The relay upserts this into a per-`scopeKey` presence map, preserving the
original `connectedAt` on reconnect and refreshing `lastSeenAt`. `list_browsers`
responses are built directly from this presence table by the relay (the message
is answered in-process, not forwarded to an extension).

`BrowserCapability` is the closed set of named browser features an extension can
announce:

```ts
export type BrowserCapability =
  | "page_context"
  | "page_content"
  | "click"
  | "fill_input"
  | "fill_editable"
  | "set_checked"
  | "select_options"
  | "submit_form"
  | "navigate"
  | "batch"
  | "upload_file"
  | "download_status"
  | "download_file"
  | "fetch_resource"
  | "screenshot";
```

`isBrowserPresenceAnnouncePayload` validates the announce payload, including
that every entry in `capabilities` is one of these names. Note the capability
name is `screenshot` (the MCP tool is `capture_screenshot` and the request
payload type is `capture_screenshot`, but the capability enum value is
`screenshot`).

## Tab listing and tab targeting

Tab-awareness primitives (ADR 0060) let an agent enumerate tabs and target a
specific tab per call.

```ts
export interface TabInfo {
  tabId: string; // opaque raw Chrome/Safari tab id as a string
  windowId: string;
  title: string;
  url: string; // HTTP/HTTPS only
  active: boolean;
  supported: boolean; // always true for listed tabs
}

export interface ListTabsRequestPayload {
  type: "list_tabs";
}
export interface TabListResponsePayload {
  type: "tab_list_response";
  ok: true;
  data: { tabs: TabInfo[] };
}
export interface TabListErrorResponsePayload {
  type: "tab_list_response";
  ok: false;
  error: { code: string; message: string };
}
```

Routing differs from `list_browsers`:

- `list_browsers` is answered by the relay from its presence table.
- `list_tabs` is **forwarded** to the selected extension. The relay's
  `handleMcpMessage` selects the target extension via `target.browserInstanceId`,
  registers the request id as pending, and forwards the full envelope unchanged.
  The extension's `BrijioBackgroundController.handleSocketMessage` detects
  `isListTabsEnvelope`, calls its `tabLister.listTabs()` adapter (which queries
  all tabs and filters to regular HTTP/HTTPS pages), and replies with a
  `tab_list_response` that the relay routes back via `message.id`.

`TabInfo.tabId`/`windowId` are `string` (not number) so the shape can transition
to opaque UUIDs for the cloud model without a protocol change.

### Per-call tab targeting

Tab targeting is explicit and per-call. The MCP client places `tabId` into
`envelope.target.tabId`; the relay forwards `target` unchanged; the extension's
`extractTabId` reads `message.target?.tabId`, parses it to a number, and threads
it through every handler (`handlePageContextRequest`, `handlePerformActionRequest`,
`handlePerformBatchRequest`, `handleNavigateToUrlRequest`, `handlePageContentRequest`).
When `tabId` is absent, every function falls back to
`tabs.query({ active: true, currentWindow: true })` — the active foreground tab.
There is deliberately no `select_tab` session-level default (ADR 0060 scope);
stateless per-call targeting mirrors how `browserInstanceId` works.

## File upload staged flow

File uploads use a staged chunked protocol so large files can be uploaded to the
extension before being attached to a file input. The flow is start → chunk(s) →
complete → (staged) → ack, with an error path at any stage:

| Payload type                 | Direction       | Purpose                                                                                                   |
| ---------------------------- | --------------- | --------------------------------------------------------------------------------------------------------- |
| `stage_file_upload_start`    | MCP → extension | Announce `uploadId`, file metadata (`name`, `size`, optional `type`/`sha256`), `chunkSize`, `totalChunks` |
| `stage_file_upload_chunk`    | MCP → extension | One base64 chunk: `uploadId`, `index`, `dataBase64`                                                       |
| `stage_file_upload_complete` | MCP → extension | All chunks sent: `uploadId`, optional `sha256`                                                            |
| `stage_file_upload_staged`   | extension → MCP | Acknowledgement that staging succeeded: `uploadId`                                                        |
| `stage_file_upload_ack`      | MCP → extension | Final acknowledgement: `uploadId`                                                                         |
| `stage_file_upload_error`    | either          | Failure: `uploadId` + `error.code`                                                                        |

`StageFileUploadErrorPayload.error.code` is a closed set:
`invalid_file_payload`, `checksum_mismatch`, `file_too_large`,
`invalid_file_name`, `invalid_file_type`, `upload_expired`. Each staged message
has a dedicated envelope interface (e.g. `StageFileUploadStartEnvelope`) whose
`target` is `{ browserInstanceId?: string }` (uploads target a browser, not a
tab). The same codes appear in the shared `BrijioErrorCode` union, which also
adds `upload_staging_failed`, `upload_not_staged`, and
`target_not_file_input` for the later `perform_action` `upload_file` step that
consumes the staged file.

## Downloads and fetch resource status

Download and fetch status (ADR 0047) share a `DownloadState` of
`in_progress | complete | interrupted`; `FetchResourceInfo` additionally allows
`'streaming'`.

```ts
export interface DownloadInfo {
  id: number;
  kind: "download";
  filename: string;
  url: string;
  mime: string | null;
  size: number | null;
  state: DownloadState;
  error?: string;
  danger?: string;
}

export interface FetchResourceInfo {
  id: string;
  kind: "fetch";
  url: string;
  contentType: string | null;
  bytesReceived: number;
  totalBytes: number | null;
  state: DownloadState | "streaming";
  error?: string;
}
```

- **Download status** — `DownloadStatusRequest` (`type: 'download_status'`,
  optional `ids`, `browserInstanceId`) → `DownloadStatusResponse`
  (`type: 'download_status_response'`, `ok: true`, `capability: 'full' |
'not_supported'`, `items`) or `DownloadStatusErrorResponse`. The `capability`
  field lets Safari report `not_supported` with an empty item list.
- **Download file** — `DownloadFileRequest` (`type: 'download_file'`, `url`,
  optional `filename`/`conflictAction`) → `DownloadFileResponse` (with
  `downloadId` and `status: 'initiated' | 'initiated_fire_and_forget'`) or an
  error response.
- **Fetch resource** — `FetchResourceRequest` (`type: 'fetch_resource'`, `url`,
  optional `maxSizeBytes`/`timeout`) returns a **stream** of messages:
  `fetch_resource_start` (headers/total size) → zero or more
  `fetch_resource_chunk` (base64 chunks) → `fetch_resource_complete` (with
  `sha256`, `totalBytes`, optional inline `dataBase64`) or `fetch_resource_error`.

`DownloadFileRequest` and `FetchResourceRequest` extend `ApprovalMetadata`
(optional `actionUUID`/`approvalRequest`), so these actions can be gated by the
user-approval workflow.

## Screenshot capture

Screenshot capture (ADR 0064) is an explicit, viewport-only, JPEG request.

```ts
export interface CaptureScreenshotRequest {
  type: "capture_screenshot";
}

export interface CaptureScreenshotResponse {
  type: "screenshot_response";
  ok: true;
  data: {
    dataBase64: string;
    width: number;
    height: number;
    tabId: string;
    capturedAt: string;
  };
}

export interface CaptureScreenshotErrorResponse {
  type: "screenshot_response";
  ok: false;
  error: {
    code:
      | "capability_not_supported"
      | "capture_failed"
      | "no_visible_tab"
      | "timeout";
    message: string;
  };
}
```

The MCP tool returns MCP image content (`{ type: 'image', data, mimeType:
'image/jpeg' }`). The shared controller's `handleScreenshotRequest` delegates to
a `PageScreenshotAdapter`; the response `tabId` and `capturedAt` are filled in
by the controller (the extension adapter currently returns just `dataBase64`,
`width`, `height`). For P3.3 only the active/visible tab can be captured
(`captureVisibleTab`); the `tabId` input parameter exists for forward
compatibility but is validated against the active tab.

## Errors

Relay-level rejections use `BrijioErrorEnvelope`, which is distinct from the
`type: 'message'` envelope:

```ts
export type BrijioErrorCode =
  | "invalid_json"
  | "invalid_message"
  | "auth_required"
  | "auth_failed"
  | "invalid_auth_message"
  | "browser_unavailable"
  | "ambiguous_browser_target"
  | "invalid_browser_target"
  | "timeout"
  | "unsupported_action"
  | "batch_failed"
  | "invalid_file_payload"
  | "checksum_mismatch"
  | "file_too_large"
  | "invalid_file_name"
  | "invalid_file_type"
  | "upload_staging_failed"
  | "upload_not_staged"
  | "target_not_file_input"
  | "upload_expired"
  | "download_not_found"
  | "fetch_resource_failed";

export interface BrijioErrorEnvelope {
  type: "error";
  error: {
    code: BrijioErrorCode;
    message: string;
    browsers?: BrowserPresence[];
  };
}
```

`browsers` is included on `browser_unavailable` and `ambiguous_browser_target`
so the MCP client can surface which browsers are online when a target could not
be resolved. Application-level (per-request) failures are **not** error
envelopes; they are normal `type: 'message'` envelopes with a payload whose
`ok: false` field carries a domain-specific `error.code` (e.g.
`PageContextErrorResponse`, `ActionResultErrorResponse`,
`BatchResultErrorResponse`).

## Entity model

The diagram below shows the core protocol entities and how they relate.

```mermaid
erDiagram
    WebSocketEnvelope ||--o| Target : "target"
    WebSocketEnvelope ||--|| Payload : "payload"
    Target ||--o| TabInfo : "tabId"
    BrowserPresence ||--{ BrowserCapability : "capabilities"
    BrowserPresenceAnnouncePayload ||--|| BrowserPresence : "extends"
    TabListResponsePayload ||--{ TabInfo : "data.tabs"

    WebSocketEnvelope {
      string type "message"
      string id "optional"
      Target target "optional"
      unknown payload "typed"
    }
    Target {
      string browserInstanceId "optional"
      string tabId "optional"
    }
    Payload {
      string type "discriminant"
    }
    BrowserPresence {
      string browserInstanceId
      string label
      string browserName
      string profileName
      string connectedAt
      string lastSeenAt
    }
    BrowserCapability {
      string name "page_content click navigate screenshot etc"
    }
    TabInfo {
      string tabId
      string windowId
      string title
      string url
      boolean active
      boolean supported
    }
```

Figure: Core protocol entities — envelope, target, presence, capability enum, and tab info.

## Capability matrix reconciliation

The WebSocket Relay Protocol table in `docs/project/CAPABILITY_MATRIX.md` uses
message names that predate the typed protocol and do **not** match the payload
`type` discriminants in the code. The matrix lists `extension_connected`,
`get_status`/`status_response`, `extension_keepalive`, `get_page_context`, and
`action_result` as the message vocabulary; the code uses `browser_presence_*`,
`list_browsers`/`browser_list`, `extension_keepalive` (payload type, matched by
the relay's `isKeepalivePayload`), `get_page_context`/`page_context_response`,
and `perform_action`/`action_result`. The matrix also omits the tab, upload,
download/fetch, and screenshot message types entirely. Treat the code as
authoritative for the on-the-wire `payload.type` values; the matrix is the
product contract for capabilities and browser support, not a wire-format
reference.

## Related source files

- `packages/shared/src/protocol.ts` — source of truth for all shapes and
  envelope helpers (`createAuthEnvelope`, `parseBrijioEnvelope`, type guards,
  `create*Response`/`create*Envelope` builders).
- `packages/shared/src/index.ts` — re-exports the protocol module.
- `packages/shared/src/background-controller.ts` — extension-side dispatch:
  `handleSocketMessage`, `extractTabId`, `handleListTabsRequest`,
  `handleScreenshotRequest`.
- `servers/mcp/src/protocol.ts` — MCP-side envelope construction and response
  parsing (`createListTabsEnvelope`, `parseTabListEnvelope`,
  `parseBrowserListEnvelope`, `BrijioTabListResult`, `BrijioBrowserListResult`).
- `servers/mcp/src/websocket-client.ts` — relay client: `requestListTabs`,
  `requestBrowserList`, `targetEnvelope` (merges `browserInstanceId`/`tabId`
  into `target`).
- `servers/websocket/src/protocol.ts` and `servers/websocket/src/server.ts` —
  relay re-exports and routing/auth/presence logic.
- `docs/architecture/decisions/0060-explicit-tab-listing-and-selection.md`,
  `docs/architecture/decisions/0062-thread-tabid-through-action-stack.md`,
  `docs/architecture/decisions/0064-visual-action-verification.md` — design
  history for tabs and screenshots.
- `docs/project/CAPABILITY_MATRIX.md` — product capability contract (see
  reconciliation note above).
