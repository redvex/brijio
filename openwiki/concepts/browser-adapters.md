---
type: concept
title: Browser Extension Adapters (Chrome and Safari)
description: How the Chrome and Safari extensions wrap the shared background controller, page-reader, and content-handler, and how their platform differences are isolated in thin BrowserApi adapters.
tags:
  [
    browser-adapters,
    chrome-extension,
    safari-extension,
    mv2,
    mv3,
    content-script,
    permissions,
  ]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-07T14:40:48.642Z
sources:
  - id: openwiki-source-dacf7bd89f09b6d1db0c5fa2
    resource: repo://clients/extensions/chrome/manifest.json
  - id: openwiki-source-0f5d8a945cabdf67f37b9ad7
    resource: repo://clients/extensions/chrome/src/background.ts
  - id: openwiki-source-46d9f24e40e9fa984f0c4b99
    resource: repo://clients/extensions/chrome/src/content-script-entry.ts
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
  - id: openwiki-source-9ed1e74f8568c62c22029ffe
    resource: repo://clients/extensions/safari/src/content-script-entry.ts
  - id: openwiki-source-b1b279dd38a2cf03093a02f6
    resource: repo://clients/extensions/safari/src/permissions.ts
  - id: openwiki-source-af7274aa59c39815b06b15de
    resource: repo://docs/architecture/decisions/0011-regular-page-host-permissions-for-chrome-extension.md
  - id: openwiki-source-ddecf2e5550aae0caa3b51ed
    resource: repo://docs/architecture/decisions/0019-safari-web-extension-and-shared-extension-package.md
  - id: openwiki-source-72f3bcdb59425d105b7dcbb7
    resource: repo://docs/architecture/decisions/0031-share-extension-code.md
  - id: openwiki-source-cd2cbe24b834539f2b235d3e
    resource: repo://docs/architecture/decisions/0043-idempotent-content-script-injection.md
  - id: openwiki-source-82dae6ecc2ead90ec4f6f7fa
    resource: repo://docs/architecture/decisions/0050-ios-safari-non-persistent-background.md
  - id: openwiki-source-f69a2741957d0592c2779376
    resource: repo://docs/architecture/decisions/0051-safari-platform-specific-builds.md
  - id: openwiki-source-3a9a453d50cda002ec878abd
    resource: repo://docs/architecture/decisions/0052-safari-client-reconnect-on-wake.md
  - id: openwiki-source-a31e56605839ce458ceb1d44
    resource: repo://docs/architecture/decisions/0060-explicit-tab-listing-and-selection.md
  - id: openwiki-source-79dd91ec51a55e7e78c52ccc
    resource: repo://docs/architecture/decisions/0064-visual-action-verification.md
  - id: openwiki-source-5524638d57e96598fd8e40d4
    resource: repo://packages/shared/src/background-controller.ts
  - id: openwiki-source-bc65bb054d93f6f2010c5def
    resource: repo://packages/shared/src/content-handler.ts
  - id: openwiki-source-d380cba6c89b8f95a90615c9
    resource: repo://packages/shared/src/page-reader.ts
generated: { by: "openwiki/0.9.0", at: "2026-11-07T14:40:48.642Z" }
---

# Browser Extension Adapters (Chrome and Safari)

Brijio ships as browser extensions that bridge a user's live browser session to
AI agents over a local WebSocket. The two implemented extensions — Chrome and
Safari — deliberately share almost all behavior while isolating their platform
differences behind thin adapter layers. This page explains the shared/adapter
split, the platform differences that the adapters exist to absorb, and the
content-script mechanisms both extensions rely on.

## The shared/adapter split

All browser-agnostic logic lives in `packages/shared/src/`:

- `background-controller.ts` — `BrijioBackgroundController`, the WebSocket
  lifecycle owner and protocol dispatcher, plus the adapter _interfaces_
  (`ActionAdapter`, `StorageAdapter`, `SetupAdapter`, `PageReaderAdapter`,
  `PageActionAdapter`, `PageBatchAdapter`, `PageNavigationAdapter`,
  `PageOpenTabAdapter`, `DownloadAdapter`, `ApprovalAdapter`,
  `TabListerAdapter`, `PageScreenshotAdapter`, `BrijioSocket`,
  `TimersAdapter`).
- `page-reader.ts` — `readActiveTabPage`, `performActiveTabAction`, and
  `performActiveTabBatch`, the shared flows that inject the content script and
  post messages to it. These take an `ActiveTabDeps` struct
  (`tabs`, `scripting`, `isRegularPageUrl`, optional `onCatchPermissionCheck`,
  optional `contentScriptMessageTimeoutMs`) rather than a global API.
- `content-handler.ts` — `handleContentRequest`, `executeBatch`,
  `registerPageNavigationListener`, and pure DOM extraction
  (`page-context.ts`, `page-content.ts`). The content script is pure DOM code
  with no `chrome.*`/`browser.*` dependency; only the _registration_ of its
  `onMessage` listener is browser-specific.
- `bridge-settings.ts`, `permissions.ts`, `popup-messages.ts`,
  `popup-parsers.ts`, `protocol.ts`, `timers.ts`, `batch-handler.ts`,
  `content-helpers.ts` — shared helpers.

Each extension provides only a thin `BrowserApi` adapter plus the controller
construction that wires it up. The rule is: **shared behavior belongs in
`packages/shared`; extensions do not duplicate protocol logic.** ADR 0019
introduced the split and ADR 0031 deepened it by extracting the duplicated
popup, settings, and permission helpers into shared.

## Controller construction

Both extensions instantiate a single `BrijioBackgroundController` with
browser-specific adapters. The controller owns the WebSocket connection,
reconnection with exponential backoff, the keepalive loop, the pending-request
counter, approval-session grants, and routing of inbound protocol envelopes to
the page-reader, page-action, batch, navigation, open-tab, download, tab-list,
and screenshot adapters. The options object mirrors the shared interfaces:

```ts
new BrijioBackgroundController({
  action, setup, storage, download, pageReader,
  pageActions, pageBatch, pageNavigation, pageOpenTab,
  pageScreenshot, tabLister, approval,
  createWebSocket(url) { ... return BrijioSocket },
  timers: createGlobalTimers()
})
```

`pageScreenshot`, `tabLister`, `approval`, `download`, and `pageOpenTab` are
optional adapters; when absent the controller reports the corresponding
capability as unavailable.

## Platform differences the adapters absorb

### Manifest and API namespace

| Aspect                   | Chrome                                                  | Safari                                          |
| ------------------------ | ------------------------------------------------------- | ----------------------------------------------- |
| Manifest version         | 3                                                       | 2                                               |
| Background               | `service_worker` (module), may be terminated after ~30s | `scripts` with `persistent: false` (event page) |
| API namespace            | `chrome.*`                                              | `browser.*`                                     |
| Action                   | `action`                                                | `browser_action`                                |
| Badges                   | `setBadgeText` + color/`setBadgeTextColor`              | text only; color calls are no-ops               |
| Host permissions         | `host_permissions: ["http://*/*","https://*/*"]`        | required `permissions: ["*://*/*"]`             |
| `chrome.permissions` API | present                                                 | not supported                                   |
| Popup vs setup page      | popup (`default_popup`)                                 | popup (primary config UI)                       |

Chrome's `manifest.json` declares MV3 with a service-worker background and
`host_permissions`. Safari's `manifest.json` declares MV2, a non-persistent
background, `browser_action`, and `content_scripts` that match HTTP/HTTPS (the
source manifest is iOS-safe; see build split below).

### Safari non-persistent background and reconnect-on-wake

ADR 0050 made the Safari background page non-persistent
(`"persistent": false`) so the extension can pass iOS/iPadOS App Store
validation. iOS Safari may unload the background page and drop the WebSocket;
the extension does not pretend to keep an always-running process. Durable
configuration lives in `browser.storage.local`; WebSocket objects, timers, and
the controller instance are treated as volatile.

ADR 0051 splits the _build output_ so the single iOS-safe source manifest
produces two artifacts: `dist-ios` with `persistent: false` and `dist-macos`
with `persistent: true`, each fed to `xcrun safari-web-extension-converter`
with `--ios-only` / `--macos-only`. Desktop and iOS therefore intentionally
diverge in background lifecycle.

ADR 0052 adds reconnect-on-wake. The Safari background entry persists a
`desiredConnectionState` key (`"connected"` / `"disconnected"`) on
Connect/Disconnect. When the entry point starts and the user previously
requested a connected bridge with usable settings, it reconnects. The Safari
content script also sends a lightweight `brijio_page_active` message on
`pageshow`, `focus`, and `visibilitychange` (when visible), giving the
background page another event-driven chance to reconnect. This is best-effort:
it reconnects only when Safari gives the extension runtime another event, not
while iOS has unloaded the JavaScript. Chrome, with its service worker, uses
the keepalive/standard reconnect path instead and does not persist desired
state.

### Badge colors

Chrome wires `setBadgeBackgroundColor`/`setBadgeTextColor` to real colors
(green `#1f8f4d`, amber `#f59e0b`, gray, red). Safari's `SafariActionBadge`
calls `setBadgeText` and provides **no-op** `setBadgeColor`/`setBadgeTextColor`,
so the same `ActionAdapter` calls are safe on both. Badge text (`ON`,
`...`, `OFF`, `ERR`) is shared.

### Setup and popup

Chrome opens a setup page via `chrome.tabs.create` (`getURL('popup.html')`);
Safari's `SafariSetupAdapter.openSetupPage` is a no-op because Safari uses the
popup as its primary configuration UI. Both communicate with the background via
the same `get_settings` / `save_settings` / `connect` / `disconnect` /
`get_status` runtime messages.

### WebSocket adapter

Chrome wraps the native `WebSocket` in a `DomWebSocketAdapter` that adapts its
event callbacks to `BrijioSocket`. Safari uses `SafariWebSocketConnection`,
which manages a created `WebSocket` and forwards `onopen`/`onmessage`/
`onclose`/`onerror`; both implement the same `BrijioSocket` contract so the
controller is unaware of the difference.

## Permissions model

Both extensions target only regular HTTP/HTTPS pages. `isRegularPageUrl(url)`
returns true for `http://`/`https://` and is shared logic (formerly duplicated,
now in shared/extension `permissions.ts`). The permission _grant_ model differs:

- **Chrome (ADR 0011 / ADR 0030):** broad host permission
  (`http://*/*`, `https://*/*`) is granted at install time via
  `host_permissions`. There is no runtime permission-request flow, so
  `hasRegularPageAccess()` always returns `true`. The manifest also keeps
  `activeTab` and `scripting`.
- **Safari (ADR 0019):** Safari does not support `optional_host_permissions` or
  `chrome.permissions.request()`. Broad host access (`*://*/*`) is declared as a
  required permission and granted at install time. Both
  `hasRegularPageAccess()` and `requestRegularPageAccess()` always return
  `true`; there is no "regular page access not enabled" state on Safari.

In the shared `readActiveTabPage`/`performActiveTabAction` flows, `ActiveTabDeps`
carries an optional `onCatchPermissionCheck`. Safari passes
`hasRegularPageAccess` there; the Chrome deps omit it. Because both always
return `true`, the `regular_page_permission_required` error path is currently
unreachable on either shipping extension, but the adapter keeps the seam
available for a future runtime-permission flow.

## Tab listing and targeting (ADR 0060)

Both extensions implement a `TabListerAdapter` (`tabLister`) that calls
`tabs.query({})`, filters to `isRegularPageUrl`, and maps each tab to a
`TabInfo` (`tabId` as string, `windowId` `'0'`, title, url, `active: false`,
`supported: true`). The `tabId` targeting parameter threads through
`readActiveTabPage`/`performActiveTabAction`/`performActiveTabBatch` via the
optional `tabId` on `ActiveTabDeps` calls: when provided, the shared flow skips
the `query({ active: true, currentWindow: true })` resolution and targets that
tab directly. Targeting is stateless and per-call (no session-level selected
tab), mirroring `browserInstanceId`.

### Tab indicator banner

When the agent targets a tab, the extension sends
`show_brijio_tab_indicator` (and `hide_brijio_tab_indicator` to the previous
tab). The content script injects two visual signals:

1. A **title prefix** `● ` (U+25CF + space) prepended to `document.title`,
   visible in the browser tab bar even for background tabs. A
   `MutationObserver` on `<title>` re-applies the prefix if the page changes
   its title. `document.title` is restored on hide.
2. A persistent blue (`#1a56db`) in-page banner (`#brijio-tab-indicator`,
   `role="status"`, `aria-live="polite"`) reading "Brijio is active on this
   tab".

Indicator state is stored on `globalThis.__brijioIndicatorStates`
(a `Map<Document, TabIndicatorState>`) and a 60s inactivity timer on
`__brijioIndicatorTimer`; on re-show the timer is reset rather than tearing the
indicator down, avoiding flicker when `executeScript` re-injects the content
script. This works identically on Chrome and Safari — pure DOM, no extension
API.

## Screenshot adapter (ADR 0064)

Both extensions provide a `pageScreenshot` adapter implementing
`PageScreenshotAdapter`. It calls `tabs.captureVisibleTab(undefined, {
format: 'jpeg', quality: 80 })`, strips the `data:image/...;base64,` prefix,
and returns base64 JPEG plus tabId and timestamp (width/height are `0`;
real dimensions are derived downstream). Runtime permission errors map to
`capability_not_supported`; other failures map to `capture_failed`. Viewport
only, active tab only — full-page capture is deferred (P4.5).

## Download / fetch adapters

Both implement `DownloadAdapter` but differ in capability:

- **Chrome** uses the real `chrome.downloads` API (`downloadStatus` reports
  `capability: 'full'` with searchable items; `downloadFile` returns a numeric
  `downloadId`; gracefully degrades to `not_supported` if the downloads API is
  absent). `fetchResource` uses `fetch` with credentials, optional
  `maxSizeBytes`/`timeout`, base64 + SHA-256, and maps `AbortError`→`timeout`,
  `TypeError`→`cors_blocked`.
- **Safari** `SafariDownloadAdapter.downloadStatus` returns
  `capability: 'not_supported'` with no items. `downloadFile` is
  fire-and-forget: it opens the URL in a new tab and returns
  `initiated_fire_and_forget` with a null `downloadId` (Safari lacks a
  reliable downloads API). `fetchResource` mirrors Chrome's fetch-based
  implementation.

## Approval adapter

Both extensions implement `ApprovalAdapter` (used by the
[Action Approval](../workflows/action-approval.md) flow). The adapter finds the
active tab, injects `content.js` via `scripting.executeScript`, and sends
`show_brijio_approval` with the action UUID, type, origin, and timeout. The
content script renders an approval banner (approve / approve session / deny)
and returns the decision; unrecognized responses default to `deny`.
`getActiveOrigin` returns the origin of the active regular tab; `hideApproval`
removes the banner. The logic is duplicated nearly identically across the two
extensions (`createChromeApprovalAdapter` vs `createSafariApprovalAdapter`),
differing only in the `chrome.*` vs `browser.*` API passed in.

## Shared content-script injection

Both content-script entry files follow the same structure despite the
namespace difference (`chrome.*` vs `browser.*`). Each is a thin entry that:

1. Calls `registerPageNavigationListener()` (increments `pageContextVersion`
   on `pageshow`).
2. (Safari only) calls `registerPageActivityListeners(browser)` to send
   `brijio_page_active` page-activity messages.
3. Builds an `onMessage` callback that handles approval, tab-indicator, batch,
   and standard content requests, delegating to shared `handleContentRequest` /
   `executeBatch`.
4. Registers the listener with **idempotent replacement** (see below).

### Idempotent content-script injection (ADR 0043)

The background script calls `scripting.executeScript({ files: ['content.js'] })`
before _every_ `tabs.sendMessage`. This guarantees the latest content-script
code is loaded (important after an extension update where a manifest-injected
script could be stale) but risks accumulating duplicate `onMessage` listeners,
duplicate `pageshow` listeners, and resetting `pageContextVersion` to 1 across
module scopes.

The solution is **listener replacement**. Each content-script entry stores its
`onMessage` callback on `globalThis.__brijioOnMessageListener`. On re-injection,
the new module reads and `removeListener`s the previous callback before
registering its own, so at most one listener is active per page and its
`pageContextVersion` matches the current module scope. `registerPageNavigationListener`
does the same for the `pageshow` listener via `globalThis.__brijioPageShowListener`.

Rejected alternatives were "try-first messaging" (send first, inject only if no
response — rejected because manifest-injected code could be stale) and a
"globalThis sentinel guard" (skip re-registration — rejected because the old
listener could be destroyed leaving none). The tab-indicator state survives
re-injection because it lives on `globalThis.__brijioIndicatorStates`, not in
module scope; the show path detects an existing indicator and resets the timer
instead of re-creating it.

### Injection mechanism differences

- **Chrome** injects _only programmatically_ (`scripting.executeScript`); the
  manifest has no `content_scripts` entry, so the background's per-call
  `executeScript` is what loads the content script.
- **Safari** declares `content_scripts` matching HTTP/HTTPS in the manifest,
  so the content script is auto-injected on matching pages, and the
  background still re-injects via `browser.scripting.executeScript` before each
  message (per ADR 0043, to load the latest code and stay idempotent).

## Runtime message contract

Both background entries register a `runtime.onMessage` listener handling the
same message types: `get_settings`, `save_settings`, `connect`, `disconnect`,
`get_status`, and (Safari) `brijio_page_active`. Responses are async
(`sendResponse` after a promise; the listener returns `true` to keep the
channel open). Chrome's handler is exported as `createMessageHandler` for
testability and only registered when `chrome.runtime.onMessage.addListener`
exists (so tests can construct the controller without the extension runtime).
The multi-tab flow is described in [Multi-Tab Workflows](../workflows/multi-tab.md)
and the end-to-end MCP↔extension flow in [MCP Extension Flow](../architecture/mcp-extension-flow.md).

## Firefox

Firefox is **planned but not implemented**. `clients/extensions/firefox/README.md`
exists only to reserve the client boundary; its packaging, permissions, and
user-control behavior are to be designed in a separate ADR before
implementation. Firefox should follow the same shared/adapter pattern
(browser-specific adapters importing from `@brijio/shared`), but no Firefox
behavior exists to document.
