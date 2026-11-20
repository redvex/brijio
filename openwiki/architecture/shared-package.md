---
type: "Reference"
title: "Shared Package Domain"
openwiki_generated: true
verified:
  - by: openwiki/0.9.0
    at: 2026-11-20T16:42:52.757Z
sources:
  - id: openwiki-source-f1095c7cb96feaaa76db91f6
    resource: repo://packages/shared/README.md
  - id: openwiki-source-5524638d57e96598fd8e40d4
    resource: repo://packages/shared/src/background-controller.ts
  - id: openwiki-source-80e64b9dd72ec480e5446518
    resource: repo://packages/shared/src/batch-handler.ts
  - id: openwiki-source-b2e292fc681ed23e984881a3
    resource: repo://packages/shared/src/bridge-settings.ts
  - id: openwiki-source-bc65bb054d93f6f2010c5def
    resource: repo://packages/shared/src/content-handler.ts
  - id: openwiki-source-265221f77947a8a08e9a018a
    resource: repo://packages/shared/src/index.ts
  - id: openwiki-source-1669ed9d0aafe9214762e96c
    resource: repo://packages/shared/src/logger.ts
  - id: openwiki-source-53b67975839245816ac31b9a
    resource: repo://packages/shared/src/page-content.ts
  - id: openwiki-source-a1871d17727869ddfaa844c0
    resource: repo://packages/shared/src/page-context.ts
  - id: openwiki-source-d380cba6c89b8f95a90615c9
    resource: repo://packages/shared/src/page-reader.ts
  - id: openwiki-source-3a2454cb82811a478ce21783
    resource: repo://packages/shared/src/popup-init.ts
  - id: openwiki-source-c20cbcf46daa07e6332e3f7f
    resource: repo://packages/shared/src/protocol.ts
  - id: openwiki-source-1ec43d507e953fef91f2d9a9
    resource: repo://packages/shared/src/timers.ts
generated: { by: "openwiki/0.9.0", at: "2026-11-20T16:42:52.757Z" }
---

# Shared Package Domain

`packages/shared` is the single source of truth for everything both the Chrome and Safari browser extensions and the relay/server side share: the wire protocol, the browser-agnostic background controller, the pure-DOM page extraction, the batch engine, popup wiring, and shared utilities. It contains **no browser API calls**; all browser-specific behavior is injected through adapter interfaces implemented at the edges (in each extension package). Protocol and data-shape changes start here and then propagate to the relay, the [MCP server](mcp-server.md), and the [browser extensions](browser-extensions.md).

## What lives here

`src/index.ts` re-exports the public surface so both sides import from `@brijio/shared`:

| Module                                                     | Responsibility                                                                                                                                                   |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `protocol.ts`                                              | WebSocket envelope shape, request/response discriminated unions, type guards, and response/builder constructors.                                                 |
| `background-controller.ts`                                 | `BrijioBackgroundController` — adapter-driven background dispatch: WebSocket lifecycle, badge state, message routing, approval gating.                           |
| `content-handler.ts`                                       | `handleContentRequest` — content-script request handler; validates requests and delegates to page-context or page-content extraction, plus per-action execution. |
| `page-context.ts` / `page-content.ts`                      | Pure-DOM progressive-disclosure extraction (structured context before paginated content).                                                                        |
| `page-reader.ts`                                           | Tab-level read/action coordination across the extension/content-script boundary, including idempotent content-script injection.                                  |
| `batch-handler.ts`                                         | Batch request tool logic (ADR 0044): sequential action execution with navigation abort and `readAfterActions`.                                                   |
| `popup-init.ts` / `popup-messages.ts` / `popup-parsers.ts` | Shared popup behavior: settings, connect/disconnect, connection-state polling (ADR 0030/0031).                                                                   |
| `bridge-settings.ts`                                       | Token/URL/identity settings normalization and `browserInstanceId` generation.                                                                                    |
| `timers.ts` / `logger.ts`                                  | Injected-timer factory and structured JSON logger.                                                                                                               |
| `content-helpers.ts`                                       | Shared response type guards and "content script unavailable" error factories.                                                                                    |

## Ownership boundary

`packages/shared` is the ownership home for protocol shapes and browser-agnostic behavior. Two invariants follow from this:

- **Protocol definitions belong here; do not duplicate them.** The MCP server and relay import `BrijioEnvelope`, payload unions, and the `create*Envelope`/`is*Envelope` helpers from `@brijio/shared` rather than redefining wire types. Changes to message shapes start in `protocol.ts` and propagate outward.
- **Browser-agnostic logic stays here; browser-specific adapters stay thin at the edges.** The controller, page reader, and popup code operate purely against injected adapter interfaces (`StorageAdapter`, `ActionAdapter`, `PageReaderAdapter`, `TabsApi`, `ScriptingApi`, …). Chrome/Safari packages supply the `chrome.*` / `browser.*` implementations and entry-point wiring only.

## Protocol (`protocol.ts`)

The wire transport is a single envelope type:

```ts
export interface WebSocketEnvelope {
  type: "message";
  id?: string;
  target?: { browserInstanceId?: string; tabId?: string };
  payload: unknown;
}
```

`payload` is a discriminated union over message types: `auth` / `auth_success`, `browser_presence_request` / `browser_presence_announce`, `list_tabs` / `tab_list_response`, `get_page_context` / `page_context_response`, `get_page_content` / `page_content_response`, `perform_action` / `action_result`, `perform_batch` / `batch_result`, `navigate_to_url`, `open_tab`, `download_status` / `download_file` / `fetch_resource` (with start/chunk/complete/error stream messages), `capture_screenshot`, `extension_keepalive`, and the generic `error` envelope. `protocol.ts` also defines:

- `BrowserPresence` and `BrowserCapability` — the capability list a browser advertises (`page_context`, `page_content`, `click`, `fill_input`, `fill_editable`, `set_checked`, `select_options`, `submit_form`, `navigate`, `batch`, `upload_file`, `download_status`, `download_file`, `fetch_resource`, `screenshot`).
- `BrijioErrorCode` — the unified error code set used across auth, target resolution, upload staging, downloads, fetch, and batch failures.
- Request/response shape types (`PageContext`, `PageContent`, `ActionResultData` and its action-specific variants, `BatchResultEntry`, download/fetch/screenshot shapes) and the `defaultPageContentMaxPayloadBytes` (131072) budget constant.
- Type guards (`isGetPageContextEnvelope`, `isPerformBatchEnvelope`, `isBatchAction`, …) and response constructors (`createPageContextResponse`, `createActionResultErrorResponse`, `createBatchResultResponse`, …) used by both the controller (extension side) and the server/relay (which also validates inbound envelopes via `ParseBrijioEnvelopeResult`).

The batch protocol constrains `PerformBatchRequest.actions` to `1..BATCH_MAX_ACTIONS` (20) entries; the guard validates each action target shape (e.g. click targets must carry a non-empty `id` of kind `link`/`action`; form-control targets must carry non-empty `formId`/`controlId`).

## Background controller (`background-controller.ts`)

`BrijioBackgroundController` is the shared dispatch layer both extension background scripts instantiate. Each extension wires its own adapters via `BrijioBackgroundControllerOptions` and provides only `createWebSocket`, `storage`, `action` (badge), `pageReader`, `pageActions`, `pageBatch`, `pageNavigation`, `pageOpenTab?`, `download?`, `pageScreenshot?`, `tabLister?`, `approval?`, `setup`, and `timers`.

### Responsibilities

- **WebSocket lifecycle.** On `handleActionClicked`/`requestConnect`, it loads settings via `storage.getBridgeSettings()`, opens a socket, and on open sends `createAuthEnvelope(pairingToken)`, starts a keepalive interval (20s `extension_keepalive`), and sets the connected badge. On close/error it schedules reconnect with exponential backoff (initial 1s, max 30s, ±25% jitter) unless a manual disconnect is in progress. `manualDisconnect` short-circuits reconnect and clears `approvalSessionGrants`.
- **Badge state machine.** `connecting` (`...`/amber), `connected` (`ON`/green), `reconnecting` (`RCY`/amber, with attempt count), `disconnected` (`OFF`/grey), `error` (`ERR`/red). `getConnectionStatus()` exposes state plus `pendingRequests` count and, for `reconnecting`, the attempt number.
- **Request dispatch.** `handleSocketMessage` parses each frame, extracts `tabId` from `target.tabId`, and routes by envelope type to a handler. It increments/decrements `pendingRequestCount` around each in-flight request so the popup can show "N requests in flight". See the dispatch diagram below.
- **Capability advertising.** `announcePresence` (on `auth_success` or `browser_presence_request`) sends `createBrowserPresenceAnnounceEnvelope` with the configured `browserInstanceId`/`label`/`browserName`/`profileName` and capabilities, conditionally including download/fetch capabilities only when a `download` adapter is present.
- **Approval gating.** For `submit_form`, `fetch_resource`, and `download_file` actions carrying `approvalRequest: true`, the controller calls `ensureApprovedAction`, which resolves an active origin, checks a per-session grant set (`approvalSessionGrants` keyed by `origin\u0000actionType`), and otherwise races `approval.requestApproval` against a timeout (`approvalTimeoutMs`, default 55000ms). `approve_session` grants all future same-origin/same-action requests for the connection; `deny` returns `approval_denied`; an origin change before the approved action runs returns `approval_origin_changed`.

### Per-call tabId targeting

Routing preserves explicit per-call `tabId` targeting. `extractTabId` reads `message.target.tabId` (a string placed by the MCP server) and parses it to a number; when absent it returns `undefined` and the downstream reader/action adapter falls back to the active tab. Handlers thread the resolved `tabId` into every adapter call (`getPageContext(tabId)`, `getPageContent(index, tabId)`, `performPageAction(action, pageContextId, visibleContextId, tabId)`, `performBatch(batchMessage, tabId)`, `navigateToUrl(url, tabId)`).

### Dispatch flow

<!-- openwiki: mermaid parse failed and this diagram was converted to a text fence so it does not break rendering. Fix the diagram source and restore the mermaid fence. Parser error: Heuristic: an unescaped angle bracket inside a label breaks rendering; rephrase the label. -->

```text
flowchart TD
    WS["WebSocket frame"] --> Parse["JSON.parse + extractTabId"]
    Parse --> G{"isAuthSuccess or PresenceRequest?"}
    G -- yes --> Announce["announcePresence"]
    G -- no --> Route{"payload.type?"}
    Route -- get_page_context --> HCtx["handlePageContextRequest(tabId)"]
    Route -- get_page_content --> HContent["handlePageContentRequest(index, tabId)"]
    Route -- perform_action --> HAction["handlePerformActionRequest(action, pageContextId, visibleContextId, tabId)"]
    Route -- perform_batch --> HBatch["handlePerformBatchRequest(payload, tabId)"]
    Route -- navigate_to_url --> HNav["handleNavigateToUrlRequest(url, tabId)"]
    Route -- open_tab --> HTab["handleOpenTabRequest(url)"]
    Route -- list_tabs --> HList["handleListTabsRequest"]
    Route -- download_status --> HDS["handleDownloadStatusRequest(ids)"]
    Route -- download_file --> HDF["handleDownloadFileRequest(url, ...) + approval"]
    Route -- fetch_resource --> HFR["handleFetchResourceRequest(url, ...) + approval"]
    Route -- capture_screenshot --> HShot["handleScreenshotRequest"]
    HCtx --> Reader["pageReader.getPageContext(tabId)"]
    HContent --> Reader2["pageReader.getPageContent(index, tabId)"]
    HAction --> Approve{"ensureApprovedAction"} --> Perform["performPageAction -> pageActions.*"]
    HBatch --> BatchPath{"hasApprovalGatedAction?"}
    BatchPath -- yes --> ApprovalBatch["performApprovalAwareBatch -> pageActions per action"]
    BatchPath -- no --> PageBatch["pageBatch.performBatch(batchMessage, tabId)"]
    Reader --> Send["socket.send(create*Response)"]
    Perform --> Send
    ApprovalBatch --> Send
    PageBatch --> Send
    HNav --> NavAdapter["pageNavigation.navigateToUrl(url, tabId)"]
    HDS --> DownAdapter["download.downloadStatus(ids)"]
    HDF --> DownAdapter2["download.downloadFile(...)"]
    HFR --> DownAdapter3["download.fetchResource(...)"]
    HShot --> ShotAdapter["pageScreenshot.captureScreenshot()"]
```

_The controller routes each incoming envelope to a handler that threads the resolved `tabId` (or active-tab fallback) into the appropriate adapter, then serializes the adapter result back over the WebSocket via the `create*Response` constructors._

## Progressive-disclosure page extraction

Reading a page is split into a cheap structured context step and a larger, paginated content step, implemented as pure-DOM functions with no browser API dependencies.

### `page-context.ts` — structured context

`extractPageContext({ document, locationHref, title, selectedText, now, previewMaxBytes, defaultMaxPayloadBytes })` returns a `PageContext`:

- `preview` — a small (`previewMaxBytes`) first chunk of readable content, so callers get usable text immediately without a second round trip.
- `structure` — `headings`, `landmarks`, `links`, `images`, `forms` (with `controls`, each carrying `type`, `required`/`requiredSource`, `disabled`, `sensitive`, `valueState`, `filledBy`, `checked`, `options`, `validity`), `editables`, and `actions` (elements matching `ACTION_SELECTORS`: native buttons/inputs plus ARIA `role="button"`, `menuitem`, `tab`, `switch`, `option`, `link`, …).
- `content` — a pointer that more content is available via `get_page_content` starting at `firstIndex: 1`, with `defaultMaxPayloadBytes`.
- `visibleContextId` / `computeVisibleContextId` — a hash of the visible form structure used as a stale-context guard for subsequent form actions.

### `page-content.ts` — paginated content

`extractPageContent(document)` walks a readable root and produces Markdown-ish blocks (links/images/tables rendered via `renderMarkdownLink`/`renderMarkdownImage`/`renderMarkdownTable`). `chunkReadableContent(content, index, maxContentBytes)` splits by double-newline blocks (falling back to character splitting for oversized blocks) using UTF-8 byte length, returns the 1-based chunk, and sets `truncated` when more chunks remain. An out-of-range `index` throws `invalid_index`.

### `content-handler.ts` — the content-script handler

`handleContentRequest(request, environment)` is the largest shared module. `ContentEnvironment` is deliberately browser-free: `{ document, locationHref, title, selectedText, now }`. The handler:

1. For `extract_page_context`, calls `extractPageContext` and stamps `_csVersion` (`CONTENT_SCRIPT_VERSION`) and `pageContextId` (a module-scoped version incremented on `pageshow`).
2. For all action requests carrying `pageContextId`, rejects with `page_navigated` if the id no longer matches the current version (stale-context validation, ADR 0043).
3. For requests carrying `visibleContextId`, recomputes the visible form-structure id and rejects with `stale_context` (`visible_controls_changed`) on mismatch before acting.
4. Dispatches `perform_click`, `perform_write_text`, `perform_set_checked`, `perform_select_options`, `perform_submit_form`, `perform_upload_file` to DOM implementations; form actions annotate results with `contextStale`/`currentVisibleContextId` when the visible structure changed during the action, and submit returns `validationErrors` from HTML constraint validation.
5. For `extract_page_content`, chunks readable content and returns `PageContent` with `index`/`truncated`/`maxPayloadBytes`.

`registerPageNavigationListener` installs a `pageshow` listener on `window`, storing it on `globalThis.__brijioPageShowListener` so re-injection replaces rather than accumulates the previous listener.

## `page-reader.ts` — tab-level coordination

`page-reader.ts` bridges the background controller and the content script through browser-provided `TabsApi`/`ScriptingApi` adapters. `readActiveTabPage`, `performActiveTabAction`, and `performActiveTabBatch` each resolve the target tab the same way:

- If a numeric `tabId` is provided, use it directly.
- Otherwise query the active tab in the current window; return `no_active_tab` if none with a URL, or `unsupported_page` if `isRegularPageUrl` rejects it (HTTP/HTTPS only).
- **Idempotent injection (ADR 0043):** call `scripting.executeScript({ target, files: ['content.js'] })` before sending the request, so the latest content script is loaded; the entry-point listener-replacement mechanism prevents duplicate listeners.
- Send the content request with `sendMessageWithTimeout` (default 4000ms), validate the response with `isContentResponse`, and translate failures into `regular_page_permission_required` (via `onCatchPermissionCheck`) or `content_script_unavailable`.

Batch handling prefers the native `perform_batch` content-script message; if the content script returns a non-`BatchResult` (older script), it falls back to `performActiveTabBatchViaSingleActions`, which replays actions one-by-one with the same navigation/`continueOnError` semantics.

## Batch engine (`batch-handler.ts`, ADR 0044)

`executeBatch(request, environment)` runs `BatchAction[]` sequentially in the content script:

- Validates `visibleContextId` up front; on mismatch returns a single `stale_context` entry with `aborted: true`.
- After each action, compares `environment.locationHref` to the pre-batch URL; **navigation always aborts remaining actions** with `page_navigated`, regardless of `continueOnError`.
- Without `continueOnError` (default), any element-level error aborts the rest; with `continueOnError`, errors are recorded but execution continues.
- `readAfterActions` appends a fresh `extract_page_context` (preview 4096 bytes, default 131072) as the final `BatchResultEntry`.
- `ok` is `results.every(entry => entry.ok)`.

`batchActionToContentRequest` adapts a `BatchAction` to the `ContentRequest` discriminated union the content handler expects. The background controller's approval-aware path (`performApprovalAwareBatch`) mirrors this loop but interleaves `ensureApprovedAction`: an approval timeout aborts the rest and marks skipped entries, while other approval failures record and continue.

## Popup (`popup-init.ts` and friends)

Per ADR 0030/0031, Chrome and Safari popup logic is unified via `initPopup(document, sendMessage)`:

- `queryPopupElements` locates the required form/inputs/buttons/status nodes or throws if any are missing.
- `loadSettings`/`saveSettings` round-trip settings through `createGetSettingsMessage`/`createSaveSettingsMessage` (`popup-messages.ts`); `validateForm` requires websocket URL, pairing token, profile name, and browser label.
- Connect saves settings first, then sends `createConnectMessage`, switches the UI to `connecting`, and `pollConnectionStatus` polls `get_status` (500ms, up to 10 attempts) until a terminal state is reached.
- `formatStatusText`/`applyStatusUI` render state (`connected`/`connecting`/`reconnecting`/`error`/`disconnected`) plus pending-request counts and spinner visibility via `state-*` CSS classes.
- `popup-parsers.ts` defensively parse settings/status/error responses from the background script.

## Settings, timers, logger, helpers

- **`bridge-settings.ts`** normalizes raw stored values via `normalizeBridgeSettings`, defaults `browserName`/`profileName`/`label`, and generates `browserInstanceId` as `${browserName}-${crypto.randomUUID()}`. `isUsableSettings` (in the controller) requires all six fields to be non-empty before connecting.
- **`timers.ts`** `createGlobalTimers(scope)` returns a `TimersAdapter` wrapping `setInterval`/`clearInterval`/`setTimeout`/`clearTimeout`; tests inject a fake timer scope.
- **`logger.ts`** `createLogger(service, sink?)` emits one JSON `LogEntry` per line (timestamp, level, message, service, plus context) to `process.stderr` by default.
- **`content-helpers.ts`** provides `isContentResponse`, `isPageContentErrorCode`, and `contentScriptUnavailable`/`actionContentScriptUnavailable` factories shared by `page-reader.ts`.

## Relationships to other pages

- The end-to-end runtime path — MCP tool call → relay → controller dispatch → content script → back — is documented in [MCP ↔ WebSocket ↔ Extension Flow](mcp-extension-flow.md).
- Browser-specific adapter wiring (Chrome/Safari) is covered in [Browser Extensions](browser-extensions.md).
- Server-side consumption of this protocol and the MCP tool layer is covered in [MCP Server](mcp-server.md).
