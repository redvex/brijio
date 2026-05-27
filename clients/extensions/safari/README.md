# BrowserBridge Safari Extension

The Safari Web Extension brings full BrowserBridge functionality to Safari,
using `@browserbridge/shared` for browser-agnostic logic and Safari-specific
adapters for API differences.

## Architecture

The Safari extension follows the same adapter pattern as the Chrome extension.
Shared logic — protocol types, background controller, page extraction, content
handling, and timers — lives in `@browserbridge/shared`. The Safari package
contributes only browser-specific wiring:

```text
@browserbridge/shared
  protocol.ts           WebSocket envelope types, request/response types, guards
  background-controller.ts  Background controller (adapter-driven, no browser API)
  page-context.ts       Pure DOM page-context extraction
  page-content.ts       Pure DOM page-content chunking
  content-handler.ts    Content-script request handler
  timers.ts             createGlobalTimers factory

clients/extensions/safari/src/
  background.ts         Safari adapter classes (SafariActionBadge, SafariStorageAdapter,
                        SafariSetupAdapter, SafariPageReaderAdapter, SafariWebSocketConnection)
  background-entry.ts   Wires BrowserBridgeBackgroundController to browser.* APIs
  content-script-entry.ts  Registers browser.runtime.onMessage listener, delegates to shared handler
  popup.ts              Pure popup message construction and parsing logic
  popup-entry.ts        DOM wiring for popup.html
  permissions.ts        Safari permissions (always returns true for regular page access)
```

### Adapter mapping

| Chrome concept | Safari adapter |
|---|---|
| `chrome.*` API namespace | `browser.*` namespace (WebExtension API) |
| Service worker (MV3) | Persistent background script (MV2) |
| `setBadgeBackgroundColor` / `setBadgeTextColor` | No-op (`SafariActionBadge`) |
| `chrome.permissions.request()` | Not needed — broad host permissions at install time |
| Setup page (`chrome.tabs.create`) | `popup.html` overlay |
| `chrome.runtime.sendMessage` | `browser.runtime.sendMessage` |

## Key Safari differences from Chrome (ADR 0019)

- **`browser.*` namespace**: Safari uses the standard WebExtension `browser.*`
  API instead of Chrome's `chrome.*`. All API calls go through `browser.*`.

- **MV2 background scripts**: Safari uses persistent background scripts
  (`"scripts": ["background.js"]` in the manifest), not Manifest V3 service
  workers. The background script runs in a persistent page context.

- **Text-only badge**: Safari supports `browser.action.setBadgeText()` but
  does *not* support `setBadgeBackgroundColor()` or `setBadgeTextColor()`.
  Connection state is shown through badge text only (`ON`, `OFF`, `ERR`).
  The `SafariActionBadge` adapter provides no-op implementations for color
  methods.

- **Broad host permissions at install time**: Safari does not support
  `optional_host_permissions` or runtime permission requests. The manifest
  declares `"*://*/*"` as a required permission. Users grant this access when
  they install or enable the extension. There is no "regular page access not
  enabled" state on Safari — `hasRegularPageAccess()` always returns `true`.

- **`popup.html` instead of setup page**: Safari does not have a convenient
  setup-page pattern like Chrome's `chrome.tabs.create()`. Configuration,
  connect/disconnect, and status display all happen in a popup overlay
  (`popup.html`).

## Build

```sh
pnpm --filter @browserbridge/safari-extension build
```

This compiles TypeScript and bundles the extension into
`clients/extensions/safari/dist/` with:

- `background.js` — background script bundle
- `content.js` — content script bundle
- `popup.js` — popup script bundle
- `manifest.json` — copied from source
- `popup.html` — copied from source

## Test

```sh
pnpm --filter @browserbridge/safari-extension test
```

Tests cover the Safari adapter classes, permission logic, and popup message
handling. The shared controller, content handler, and extraction logic are
tested in `@browserbridge/shared`.

## Build and convert to Xcode project

Safari Web Extensions must be wrapped in a native macOS app. Use the Makefile
target to build the extension and generate the Xcode project:

```sh
make safari
```

This runs two steps:

1. `pnpm --filter @browserbridge/safari-extension build` — compiles and
   bundles the extension.
2. `xcrun safari-web-extension-converter --force --project-location
   clients/extensions/safari/BrowserBridge clients/extensions/safari/dist` —
   converts the built extension into an Xcode project at
   `clients/extensions/safari/BrowserBridge/`.

After running `make safari`:

1. Open `clients/extensions/safari/BrowserBridge/BrowserBridge.xcodeproj` in
   Xcode.
2. Build and run to install the extension into Safari.
3. Enable the extension in Safari Preferences → Extensions.
4. After source changes, rebuild with `make safari` and then rebuild in Xcode.

To clean the build output and Xcode project:

```sh
make clean
```

## Permissions

The Safari manifest declares these permissions:

- `activeTab` — access the active tab when the user interacts with the
  extension.
- `scripting` — inject content scripts on demand.
- `storage` — store the WebSocket URL.
- `tabs` — read tab URLs and titles, send messages to tabs.
- `*://*/*` — broad host access for regular HTTP and HTTPS pages.

Unlike Chrome, Safari does not have runtime permission prompts. Broad host
access is granted when the user installs or enables the extension. See ADR 0019
for details.

## User flow

1. Load the extension in Safari (via Xcode build or enabled in Safari
   Preferences → Extensions).
2. Click the BrowserBridge toolbar button to open the popup.
3. Enter the local WebSocket URL (for example `ws://127.0.0.1:8787`).
4. Click Connect to start the bridge.
5. The badge shows `ON` while connected, `OFF` when stopped, and `ERR` on
   error.
6. Click Disconnect to stop the bridge.

No page context or page content is sent until the extension receives an
explicit read request over the user-started WebSocket connection.

## Current limitations

- This extension uses the unauthenticated local single-channel WebSocket
  server from ADR 0002. Authenticated private routing and MCP content resources
  require separate ADR approval.
- Safari may suspend extension background pages under memory pressure. The
  keepalive mechanism (every 20 seconds) helps prevent unexpected suspension.