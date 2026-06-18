# Brijio Safari Extension

The Safari Web Extension brings Brijio functionality to Safari using
`@brijio/shared` for browser-agnostic logic and Safari-specific adapters for
WebExtension API differences.

For the complete current list of Brijio capabilities, browser support status,
and product boundaries, see the
[canonical capability matrix](../../docs/project/CAPABILITY_MATRIX.md).

## Architecture

The Safari extension follows the same adapter pattern as the Chrome extension.
Shared logic such as protocol types, the background controller, page extraction,
content handling, and timers lives in `@brijio/shared`. The Safari package
contributes only browser-specific wiring:

```text
@brijio/shared
  protocol.ts               WebSocket envelope types, request/response types, guards
  background-controller.ts  Background controller (adapter-driven, no browser API)
  page-context.ts           Pure DOM page-context extraction
  page-content.ts           Pure DOM page-content chunking
  content-handler.ts        Content-script request handler
  timers.ts                 createGlobalTimers factory

clients/extensions/safari/src/
  background.ts             Safari adapter classes
  background-entry.ts       Wires BrijioBackgroundController to browser.* APIs
  content-script-entry.ts   Registers runtime listeners and delegates shared handlers
  popup.ts                  Pure popup message construction and parsing logic
  popup-entry.ts            DOM wiring
  popup.html
  permissions.ts            Safari permissions helpers
```

### Adapter Mapping

| Chrome concept                                  | Safari adapter                                                  |
| ----------------------------------------------- | --------------------------------------------------------------- |
| `chrome.*` API namespace                        | `browser.*` namespace (WebExtension API)                        |
| Service worker (MV3)                            | Platform-specific MV2 background page                           |
| `setBadgeBackgroundColor` / `setBadgeTextColor` | No-op (`SafariActionBadge`)                                     |
| `chrome.permissions.request()`                  | Not needed because host permissions are granted at install time |
| Setup page (`chrome.tabs.create`)               | `popup.html` overlay                                            |
| `chrome.runtime.sendMessage`                    | `browser.runtime.sendMessage`                                   |

## Key Safari Differences From Chrome

- **`browser.*` namespace**: Safari uses the standard WebExtension `browser.*`
  API instead of Chrome's `chrome.*`. All API calls go through `browser.*`.
- **MV2 background page**: Safari uses Manifest V2 background scripts
  (`"scripts": ["background.js"]`). The iOS/iPadOS build uses
  `"persistent": false`; the macOS build uses `"persistent": true`.
- **Text-only badge**: Safari's MV2 `browser_action` supports
  `browser.browserAction.setBadgeText()` but does not support
  `setBadgeBackgroundColor()` or `setBadgeTextColor()`. Connection state is
  shown through badge text only (`ON`, `OFF`, `ERR`).
- **Broad host permissions at install time**: Safari does not support
  `optional_host_permissions` runtime permission requests. The manifest declares
  `"*://*/*"` as a required permission. Users grant access when they install or
  enable the extension.
- **`popup.html` instead of a setup page**: Configuration, connect/disconnect,
  and status display happen in the popup overlay.

## Build

```sh
pnpm --filter @brijio/safari-extension build
```

This compiles TypeScript bundles into platform-specific extension outputs:

- `clients/extensions/safari/dist-ios/` - iOS/iPadOS-safe manifest with
  `persistent: false`.
- `clients/extensions/safari/dist-macos/` - desktop Safari manifest with
  `persistent: true`.

Each output includes `background.js`, `content.js`, `popup.js`, `manifest.json`,
`popup.html`, and icons.

## Test

```sh
pnpm --filter @brijio/safari-extension test
```

Tests cover Safari adapter classes, permission logic, popup message handling,
platform manifest generation, and reconnect-on-wake behavior. Shared
controller, content handler, and extraction logic are tested in
`@brijio/shared`.

## Build And Convert To Xcode Projects

Safari Web Extensions must be wrapped in native Apple app projects. Use the
platform-specific Makefile targets:

```sh
make safari-macos
```

This builds the desktop Safari extension and converts `dist-macos` into
`clients/extensions/safari/Brijio-macOS/`.

```sh
make safari-ios
```

This builds the iOS/iPadOS-safe extension and converts `dist-ios` into
`clients/extensions/safari/Brijio-iOS/`.

`make safari` builds both platform projects.

After running one of the targets:

1. Open the generated Xcode project in Xcode.
2. Build and run to install the extension into Safari.
3. Enable the extension in Safari settings.
4. After source changes, rerun the same Makefile target and rebuild in Xcode.

To clean build output and generated Xcode projects:

```sh
make clean
```

## Permissions

The Safari manifest declares these permissions:

- `activeTab` - access the active tab when the user interacts with the
  extension.
- `scripting` - inject content scripts on demand.
- `storage` - store WebSocket URL, pairing token, profile name, browser label,
  stable browser instance ID, and desired connection state.
- `tabs` - read tab URLs and titles, and send messages to tabs.
- `*://*/*` - broad host access for regular HTTP and HTTPS pages.

Unlike Chrome, Safari does not have runtime permission prompts. Broad host
access is granted when the user installs or enables the extension. See ADR 0019
for details.

## User Flow

1. Load the extension in Safari through an Xcode build or Safari settings.
2. Click the Brijio toolbar button to open the popup.
3. Enter the local WebSocket URL, for example `ws://127.0.0.1:8787`.
4. Enter the pairing token used by the local WebSocket and MCP servers.
5. Confirm or edit the profile name and browser label used for browser
   discovery.
6. Click Save or Connect. Connect saves the current settings before starting
   the bridge.
7. The badge shows `ON` while connected, `OFF` when stopped, and `ERR` on
   error.
8. Click Disconnect to stop the bridge.

No page context or page content is sent until the extension receives an
explicit read request over the user-started WebSocket connection.

## Current Limitations

- The WebSocket server, MCP server, and Safari extension must be configured with
  the same local pairing token.
- The iOS/iPadOS build uses a non-persistent background page, so Safari may
  unload it. Brijio reconnects when the extension wakes again if the user
  previously clicked Connect.
- Page activity events are wake/reconnect hints only. They cannot keep iOS
  extension JavaScript running after Safari unloads the background page.
- The macOS build uses a persistent background page for a more stable desktop
  Safari WebSocket session.
