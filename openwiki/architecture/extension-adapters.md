---
type: architecture
title: Browser Extension Adapters
description: The Chrome, Safari, and Firefox adapter contracts that wrap the shared BrijioBackgroundController through platform-specific ActiveTabDeps, approval, tab-listing, screenshot, download, and open-tab seams.
tags:
  [browser-extensions, adapters, chrome, safari, firefox, background-controller]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-14T14:46:23.462Z
sources:
  - id: openwiki-source-dacf7bd89f09b6d1db0c5fa2
    resource: repo://clients/extensions/chrome/manifest.json
  - id: openwiki-source-0f5d8a945cabdf67f37b9ad7
    resource: repo://clients/extensions/chrome/src/background.ts
  - id: openwiki-source-fa213a96cd30a09d577d0a92
    resource: repo://clients/extensions/chrome/src/permissions.ts
  - id: openwiki-source-beb468a32961295d57274fd5
    resource: repo://clients/extensions/firefox/README.md
  - id: openwiki-source-918a0bd56842e75b089b67a5
    resource: repo://clients/extensions/safari/manifest.json
  - id: openwiki-source-70dd1b5e429044bdf703d26f
    resource: repo://clients/extensions/safari/src/background-entry.ts
  - id: openwiki-source-151988bbc60a918980820e71
    resource: repo://clients/extensions/safari/src/background.ts
  - id: openwiki-source-b1b279dd38a2cf03093a02f6
    resource: repo://clients/extensions/safari/src/permissions.ts
  - id: openwiki-source-5524638d57e96598fd8e40d4
    resource: repo://packages/shared/src/background-controller.ts
  - id: openwiki-source-d380cba6c89b8f95a90615c9
    resource: repo://packages/shared/src/page-reader.ts
generated: { by: "openwiki/0.9.0", at: "2026-11-14T14:46:23.462Z" }
---

# Browser Extension Adapters

Brijio's browser extensions are deliberately **thin platform adapters** around one shared engine, `BrijioBackgroundController` in `packages/shared`. The controller owns every cross-cutting concern: WebSocket connection lifecycle, presence announcements, request dispatch, approval gating, result-envelope construction, and badge/UX state. Each browser package only supplies the platform-specific _deps_ that the controller can't know about — the `chrome.*` / `browser.*` namespaces, content-script injection, downloads, screenshots, and approval UI hosting.

This split lets the agent-facing protocol, routing, and approval semantics live in one place while the three supported browser platforms differ only in how they talk to their host browser.

## Adapter seams vs platform support

The controller is constructed from a `BrijioBackgroundControllerOptions` object (defined in `packages/shared/src/background-controller.ts`). Every option is a seam an extension must fill:

| Seam (option)     | Interface                                                                            | Chrome                                                                                                             | Safari                                                                                                                         | Firefox         |
| ----------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| `action`          | `ActionAdapter` (badge text/color, title)                                            | `chrome.action.*` (MV3 action)                                                                                     | `SafariActionBadge` over `browser.browserAction.*`, color methods are no-ops (ADR 0019)                                        | not implemented |
| `approval`        | `ApprovalAdapter` (`getActiveOrigin`, `requestApproval`, `hideApproval`)             | `createChromeApprovalAdapter` — injects `content.js`, sends `show_brijio_approval`/`hide_brijio_approval` messages | `createSafariApprovalAdapter` — identical mechanism via `browser.*`                                                            | not implemented |
| `createWebSocket` | factory returning `BrijioSocket`                                                     | `DomWebSocketAdapter` wrapping `new WebSocket(url)`                                                                | `SafariWebSocketConnection` with explicit `connect()`/`disconnect()`                                                           | not implemented |
| `download`        | `DownloadAdapter` (`downloadStatus`, `downloadFile`, `fetchResource`)                | full `chrome.downloads.*` (`search`/`download`) plus `fetch()`-based `fetchResource`                               | `SafariDownloadAdapter`: `not_supported` status, **fire-and-forget** download via `tabs.create({url})`, shared `fetchResource` | not implemented |
| `pageActions`     | `PageActionAdapter` (click/writeText/setChecked/selectOptions/submitForm/uploadFile) | delegates to shared `performActiveTabAction` with `chromeDeps`                                                     | delegates to shared `performActiveTabAction` with `safariDeps`                                                                 | not implemented |
| `pageBatch`       | `PageBatchAdapter` (`performBatch`)                                                  | shared `performActiveTabBatch` with `chromeDeps`                                                                   | shared `performActiveTabBatch` with `safariDeps`                                                                               | not implemented |
| `pageReader`      | `PageReaderAdapter` (`getPageContext`, `getPageContent`)                             | shared `readActiveTabPage` with `chromeDeps`                                                                       | `SafariPageReaderAdapter` using shared `readActiveTabPage` with `safariDeps`                                                   | not implemented |
| `pageNavigation`  | `PageNavigationAdapter` (`navigateToUrl`)                                            | `navigateActiveTabToUrl` (10s `tabs.update` timeout)                                                               | `SafariPageNavigationAdapter` (10s `tabs.update` timeout)                                                                      | not implemented |
| `pageOpenTab`     | `PageOpenTabAdapter` (`openTab`)                                                     | `chrome.tabs.create`                                                                                               | `browser.tabs.create`                                                                                                          | not implemented |
| `pageScreenshot`  | `PageScreenshotAdapter` (`captureScreenshot`)                                        | `chrome.tabs.captureVisibleTab` jpeg q80 (ADR 0064)                                                                | `browser.tabs.captureVisibleTab` jpeg q80 (ADR 0064)                                                                           | not implemented |
| `setup`           | `SetupAdapter` (`openSetupPage`)                                                     | opens `popup.html` via `chrome.tabs.create`                                                                        | `SafariSetupAdapter.openSetupPage` is a **no-op** (Safari uses a popup)                                                        | not implemented |
| `storage`         | `StorageAdapter` (`getBridgeSettings`/`setBridgeSettings`)                           | `chrome.storage.local` with `normalizeBridgeSettings(…, 'Chrome')`                                                 | `SafariStorageAdapter` over `browser.storage.local` with `normalizeBridgeSettings(…, 'Safari')`                                | not implemented |
| `tabLister`       | `TabListerAdapter` (`listTabs`)                                                      | `tabLister` filtering to `isRegularPageUrl` tabs                                                                   | `tabLister` filtering to `isRegularPageUrl` tabs                                                                               | not implemented |
| `timers`          | `TimersAdapter` (set/clear Interval/Timeout)                                         | `createGlobalTimers()`                                                                                             | `createGlobalTimers()`                                                                                                         | not implemented |

The optional seams (`approval`, `download`, `pageOpenTab`, `pageScreenshot`, `tabLister`) degrade gracefully inside the controller: when omitted or unsupported, request handlers reply with a `not_supported` / `capability_not_supported` error envelope rather than throwing. That is why Safari can ship a `not_supported` `downloadStatus` and a fire-and-forget `downloadFile` while still satisfying the same `DownloadAdapter` contract.

## What the shared controller owns

`BrijioBackgroundController` is the single state owner for the extension. From the controller, not the adapter, come:

- **Connection state machine** (`disconnected` → `connecting` → `connected` → `reconnecting` → `error`), with exponential backoff plus jitter reconnect scheduling (`INITIAL_RECONNECT_DELAY_MS` 1s, `MAX_RECONNECT_DELAY_MS` 30s, `×2` multiplier) and a `manualDisconnect` flag that suppresses reconnect on intentional disconnect.
- **WebSocket lifecycle**: opening the socket created by `createWebSocket`, sending the auth envelope on `onopen`, starting a 20s keepalive interval, parsing incoming envelopes on `onmessage`, and routing `onclose`/`onerror` to reconnect or stop.
- **Presence**: after auth success or a presence-request envelope, it announces browser identity (`browserInstanceId`, `label`, `browserName`, `profileName`) and capability list (which is extended with `download_status`/`download_file`/`fetch_resource` only when a `download` adapter is supplied).
- **Request dispatch**: a single `handleSocketMessage` parser branches on envelope type (`isGetPageContextEnvelope`, `isPerformActionEnvelope`, `isNavigateToUrlEnvelope`, `isOpenTabEnvelope`, `isPerformBatchEnvelope`, `isDownloadStatusEnvelope`, `isDownloadFileEnvelope`, `isFetchResourceEnvelope`, `isCaptureScreenshotEnvelope`, …) and delegates to the corresponding adapter seam, then serializes the result/error envelope back over the socket.
- **Approval gating**: `ensureApprovedAction` intercepts approval-gated action types (`submit_form`, `fetch_resource`, `download_file`) when `approvalRequest === true`, asks the `ApprovalAdapter` for the active origin, races `requestApproval` against a configurable timeout (default 55s), honors `approve_session` grants (cached per origin+actionType in `approvalSessionGrants`), and rejects on deny/timeout/origin-change. Batch requests run an approval-aware loop that skips remaining actions after an approval timeout.
- **Result envelopes**: all `create*Response` / `create*ErrorResponse` construction lives in the shared package; adapters return plain `ok`/`error` discriminated unions and the controller wraps them.
- **UX badges**: `setConnectedState`/`setConnectingState`/`setReconnectingState`/`setStoppedState`/`setErrorState` call the `ActionAdapter` to set badge text/color and tooltip; Safari simply no-ops the color calls.

The extension entry points therefore contain **no protocol logic**. They construct the controller once and wire two browser-event listeners: a toolbar-click handler (`controller.handleActionClicked()`) and a runtime-message handler that maps popup messages (`get_settings`, `save_settings`, `connect`, `disconnect`, `get_status`) onto controller methods.

## ActiveTabDeps: the shared page-access seam

Page reading, actions, and batches do **not** go through separate adapter methods on each platform. Instead the shared `page-reader.ts` exposes `readActiveTabPage`, `performActiveTabAction`, and `performActiveTabBatch`, parameterized by an `ActiveTabDeps` value:

```ts
export interface ActiveTabDeps {
  tabs: TabsApi;
  scripting: ScriptingApi;
  isRegularPageUrl: (url: string) => boolean;
  onCatchPermissionCheck?: PermissionCheck;
  contentScriptMessageTimeoutMs?: number;
}
```

Both Chrome and Safari build one of these (`chromeDeps` / `safariDeps`) and pass it into the shared helpers, which handle content-script (re-)injection, `tabs.sendMessage` with a 4s default timeout, regular-page gating, and stale-context handling. This is the concrete mechanism behind the "adapters stay in sync with shared page-reader/page-context behavior" invariant: the adapter provides only the raw `tabs`/`scripting` API handles plus an `isRegularPageUrl` predicate; the cross-platform sequencing is shared and tested in `packages/shared`.

### Regular-page host permission gating

`isRegularPageUrl` is the predicate that keeps Brijio off restricted browser pages: it returns `true` only for `http://` and `https://` URLs. The shared page-reader uses it to refuse to inject into or message `chrome://`, `about:`, `edge://`, and similar privileged pages, which would either fail silently or be unsafe to automate.

Both Chrome and Safari grant broad host permission **at install time** rather than through a runtime prompt:

- Chrome (`permissions.ts`, ADR 0011/0030): `hasRegularPageAccess()` always returns `true`; the manifest declares `host_permissions: ["http://*/*", "https://*/*"]` and `permissions` include `downloads`.
- Safari (`permissions.ts`, ADR 0019/0051): `hasRegularPageAccess()` and `requestRegularPageAccess()` both always return `true`; the MV2 manifest grants `"*://*/*"` and statically injects `content.js` on `http://*/*`/`https://*/*`.

`hasRegularPageAccess` surfaces to the shared layer through `ActiveTabDeps.onCatchPermissionCheck`, which the page reader consults when a content-script message fails to decide whether the failure is a missing-permission problem (returning `regular_page_permission_required`) versus a transient one. Because both platforms always grant at install, this path resolves to `true`, but the seam keeps the shared code platform-agnostic and leaves room for a future platform that requires runtime prompts (the notional Firefox adapter, for example).

## Platform contrast

### Chrome (`clients/extensions/chrome`)

- **Namespace:** `chrome.*` (typed locally via a `ChromeApi` interface so the module is testable without the global).
- **Manifest:** Manifest V3, `"service_worker"` background of `type: "module"` (`manifest.json`), `minimum_chrome_version` 116.
- **Permissions:** `activeTab`, `scripting`, `storage`, `tabs`, `downloads`, plus broad `host_permissions` granted at install (ADR 0011). No runtime permission flow (ADR 0030).
- **Action/badges:** full color via `chrome.action.setBadgeBackgroundColor` / `setBadgeTextColor`.
- **Downloads:** real `chrome.downloads` support — `downloadStatus` reports `capability: 'full'` with searchable items, `downloadFile` initiates a tracked download and returns a numeric `downloadId` with `status: 'initiated'`. `fetchResource` uses `fetch()` with `credentials: 'include'`, AbortController timeout, base64 + SHA-256 hashing, and explicit `cors_blocked`/`size_exceeded`/`http_error`/`timeout` error codes.
- **Screenshots:** `chrome.tabs.captureVisibleTab` (ADR 0064).
- **Background persistence:** the MV3 service worker is the controller's host; reconnect/backoff is handled by the shared controller.
- **Entry:** `background.ts` constructs `controller` inline and registers `chrome.runtime.onMessage` only when `chrome.runtime.onMessage.addListener` exists (so the module is importable in tests).

### Safari (`clients/extensions/safari`)

- **Namespace:** `browser.*` (typed via `BrowserApi`), per ADR 0019/0051.
- **Manifest:** Manifest V2, `"background.scripts": ["background.js"]` with `"persistent": false` (ADR 0050), `browser_action`, and a statically-declared `content_scripts` entry.
- **Permissions:** broad `"*://*/*"` host permission granted at install (ADR 0019); `hasRegularPageAccess`/`requestRegularPageAccess` are always `true`.
- **Action/badges:** `SafariActionBadge` implements `setBadgeText`/`setTitle` but **`setBadgeColor`/`setBadgeTextColor` are no-ops** because Safari only supports text badges (ADR 0019). The controller still calls them; they silently succeed.
- **Downloads:** Safari has no usable `browser.downloads` API in this configuration. `SafariDownloadAdapter.downloadStatus` returns `capability: 'not_supported'`; `downloadFile` is **fire-and-forget** — it opens the URL in a new tab via `tabs.create({url})` and returns `downloadId: null, status: 'initiated_fire_and_forget'`. `fetchResource` is shared byte-for-byte with Chrome's implementation.
- **Screenshots:** `browser.tabs.captureVisibleTab`, same WebExtensions API as Chrome (ADR 0064).
- **Non-persistent background & reconnect-on-wake:** because the MV2 background is non-persistent (ADR 0050), the controller can be torn down when Safari sleeps the extension. `background-entry.ts` implements the ADR 0052 reconnect strategy: it persists a `desiredConnectionState` ('connected'/'disconnected') in `browser.storage.local`; on startup and on the `brijio_page_active` runtime message it calls `reconnectIfDesired()`, which reconnects only if the controller is not already connected and the desired state is `'connected'`.
- **Setup:** `SafariSetupAdapter.openSetupPage` is a no-op because Safari is configured through a popup, not a separate setup page.
- **WebSocket:** `SafariWebSocketConnection` wraps `WebSocket` with an explicit `connect()`/`disconnect()` (the factory calls `connect()` before returning) so the same `BrijioSocket` interface is satisfied.

### Firefox (`clients/extensions/firefox`)

Firefox is **planned but not implemented**. The package currently contains only a `README.md` reserving the client boundary; packaging, permissions, and user-control behavior are deferred to a future ADR. The Firefox capability status is tracked in the capability matrix. Because the controller's optional seams degrade to `not_supported`, a future Firefox adapter would only need to supply the `browser.*`-style deps plus whatever subset of `download`/`approval`/`pageScreenshot` Firefox supports; no shared-code changes would be required for the basic page-reading and action flow.

## Control flow at a glance

<!-- openwiki: mermaid parse failed and this diagram was converted to a text fence so it does not break rendering. Fix the diagram source and restore the mermaid fence. Parser error: Heuristic: an unescaped angle bracket inside a label breaks rendering; rephrase the label. -->

```text
flowchart LR
  subgraph Extension[Browser extension entry point]
    Click["toolbar / onMessage"] --> Ctrl["BrijioBackgroundController<br/>(shared)"]
  end
  Ctrl -->|"createWebSocket"| WS["WebSocket → relay/MCP"]
  Ctrl -->|"onmessage dispatch"| Adapters
  subgraph Adapters[Platform adapter seams]
    PR["pageReader / pageActions / pageBatch<br/>via ActiveTabDeps"]
    Nav["pageNavigation / pageOpenTab"]
    DL["download (full or fire-and-forget)"]
    AP["approval (content-script UI)"]
    SS["pageScreenshot"]
    TL["tabLister"]
  end
  Adapters -->|tabs/scripting/downloads| Browser["chrome.*  /  browser.*"]
  Ctrl -->|"result envelopes"| WS
```

1. The popup or toolbar click sends a runtime message (`connect`/`disconnect`) or invokes `handleActionClicked`; the entry point forwards it to the controller.
2. The controller opens a `BrijioSocket` from `createWebSocket`, authenticates, announces presence with the capability set, and starts keepalive.
3. Inbound request envelopes are dispatched to the matching adapter seam; each adapter returns an `ok`/`error` union.
4. Approval-gated actions pause inside `ensureApprovedAction`, which drives the `ApprovalAdapter` (injecting `content.js` and sending `show_brijio_approval` to the active tab) and caches session grants.
5. The controller serializes a response/error envelope and sends it back over the socket; adapters never touch the socket directly.

## Invariants and failure semantics

- **Thin adapters, shared behavior.** Per `AGENTS.md`, browser-specific code stays in `clients/extensions/{chrome,safari}` and shared behavior stays in `packages/shared`; intentional platform differences must be both documented and tested. The `ActiveTabDeps` + shared `page-reader` helpers are the primary mechanism enforcing this.
- **Explicit per-call targeting.** The controller extracts `tabId` from each envelope's `target.tabId` and threads it through every action/read/batch/navigation call; when absent it falls back to the active tab. Adapters must preserve this and never introduce hidden selected-browser or selected-tab session state.
- **Optional seams degrade, never throw.** Missing `download`, `pageOpenTab`, `pageScreenshot`, `tabLister`, or `approval` produce structured `not_supported` / `capability_not_supported` envelopes; an adapter returning `{ ok: false, … }` is surfaced verbatim with its error code.
- **Regular-page gating.** Restricted (`chrome://`, `about:`, etc.) pages are excluded by `isRegularPageUrl` before any content-script injection or messaging; the shared reader returns `regular_page_permission_required` when `onCatchPermissionCheck` reports no access. Both current platforms always grant, keeping this a documentation/test contract rather than a runtime prompt.
- **Reconnect idempotency.** `manualDisconnect` suppresses reconnect; `cancelReconnect` resets the attempt counter. Safari's reconnect-on-wake (`reconnectIfDesired`) is a no-op when already connected or when the desired state is `disconnected`, so wake events cannot force an unwanted connection.
- **Navigation timeouts.** Both Chrome and Safari wrap `tabs.update` in a 10s timeout so a hung navigation on a restricted page still returns a `timeout` error to the MCP client instead of stalling the request.
- **Approval origin stability.** After a successful approval, `ensureApprovedAction` re-reads `getActiveOrigin` and rejects with `approval_origin_changed` if the user switched tabs before the approved action runs; `approve_session` grants are keyed by `origin\0actionType`.
