# ADR 0019: Safari Web Extension and Shared Extension Package

## Status

Proposed

## Date

2026-05-27

## Context

BrowserBridge currently has a working Chrome extension in
`clients/extensions/chrome` with the following capabilities:

- Manual connect/disconnect through the toolbar action.
- WebSocket connection to the local server while the user is connected.
- Page context extraction (URL, title, selected text, preview, structure).
- Paginated page content extraction.
- Browser actions: click, write text, set checked, select options, submit form.
- A setup page for WebSocket URL configuration and regular page access permission.
- Connection-state badge (ON/OFF/ERR with background color).
- A keepalive mechanism for the Manifest V3 service worker.
- Optional host permissions for regular HTTP/HTTPS pages.

The extension code is well-structured with adapter interfaces behind the
Chrome-specific API calls. The background controller (`background-controller.ts`)
depends on injected adapters for action badges, WebSocket creation, storage, page
reading, page actions, timers, and setup navigation. The content script
(`content.ts`) and page extraction logic (`page-context.ts`, `page-content.ts`,
`protocol.ts`) are pure DOM code with no Chrome API dependencies.

The Safari `clients/extensions/safari` directory currently holds only a placeholder
README. The `packages/shared` package is an empty skeleton with no source files.

Safari Web Extensions share a common API subset with Chrome extensions (the
`browser.*` namespace), but they differ significantly in distribution, permissions,
badge support, service worker lifecycle, and the requirement for a native
container app.

## Decision

Implement the Safari Web Extension with full feature parity against Chrome by
extracting shareable logic into `packages/shared` and creating a Safari-specific
adapter layer.

### Part 1: Extract shared logic into `@browserbridge/shared`

Move the following files from the Chrome extension into `packages/shared/src/`:

| Source (Chrome)                | Target (shared)            | Notes                                                                                                                                                                                                                         |
| ------------------------------ | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/protocol.ts`              | `protocol.ts`              | WebSocket envelope types, request/response types, guards, response constructors. Already browser-agnostic — no Chrome/DOM dependencies.                                                                                       |
| `src/background-controller.ts` | `background-controller.ts` | Already behind adapters. Move as-is. The adapter interfaces (`StorageAdapter`, `ActionAdapter`, `PageReaderAdapter`, `PageActionAdapter`, `SetupAdapter`, `TimersAdapter`, `BrowserBridgeSocket`) become the shared contract. |
| `src/page-context.ts`          | `page-context.ts`          | Pure DOM extraction. Takes a `Document` and environment — no Chrome API calls.                                                                                                                                                |
| `src/page-content.ts`          | `page-content.ts`          | Pure DOM content chunking. No Chrome API calls.                                                                                                                                                                               |
| `src/content.ts`               | `content-handler.ts`       | Content-script request handler. Takes a `ContentRequest` and `ContentEnvironment` — no Chrome API calls. The message listener registration stays browser-specific.                                                            |
| `src/timers.ts`                | `timers.ts`                | `createGlobalTimers` factory. Browser-agnostic.                                                                                                                                                                               |

Files that remain Chrome-specific:

| Chrome file          | Reason to keep in Chrome                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/background.ts`  | Chrome `chrome.*` API wiring, `DomWebSocketAdapter`, `chrome.scripting.executeScript`, `chrome.tabs.sendMessage`. |
| `src/permissions.ts` | Chrome `chrome.permissions` API. Safari handles permissions differently (see below).                              |
| `src/setup.ts`       | Chrome `chrome.runtime.sendMessage` and `chrome.permissions.request`. Safari needs its own setup UI.              |
| `src/setup.html`     | Chrome-specific setup page. Safari needs its own popup or settings.                                               |
| `manifest.json`      | Chrome Manifest V3 format.                                                                                        |

The Chrome extension will import from `@browserbridge/shared` and remove the
duplicated local copies. The Safari extension will likewise import from
`@browserbridge/shared` and provide its own browser-specific wiring.

### Part 2: Create Safari Web Extension in `clients/extensions/safari`

The Safari extension will live at `clients/extensions/safari/` and consist of:

**Safari-specific source files:**

| File                          | Purpose                                                                                                                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/background.ts`           | Safari background script. Wires `BrowserBridgeBackgroundController` to Safari `browser.*` APIs. Creates `SafariWebSocketAdapter`. Handles the toolbar action click API.                  |
| `src/permissions.ts`          | Safari permission model adapter. No runtime permission requests — broad host permissions are declared in the manifest (see below). Always returns `true` for regular page access checks. |
| `src/popup.ts` + `popup.html` | A popup UI for WebSocket URL configuration. Safari does not have a convenient setup-page pattern like Chrome, so we use a popup instead.                                                 |
| `manifest.json`               | Safari Web Extension manifest (see below).                                                                                                                                               |

**Safari manifest differences from Chrome:**

| Aspect                           | Chrome                                         | Safari                                                                                                                                        |
| -------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Manifest version                 | 3                                              | 2 (Safari converts MV3 manifests, but explicit MV2 is more compatible)                                                                        |
| Background                       | `"service_worker": "background.js"`            | `"scripts": ["background.js"]` (Safari does not use service workers for extensions)                                                           |
| Badge colors                     | `setBadgeBackgroundColor`, `setBadgeTextColor` | Not supported. Only `setBadgeText` is available.                                                                                              |
| Badge text                       | `setBadgeText`                                 | Supported but may truncate long text.                                                                                                         |
| Host permissions                 | `optional_host_permissions`                    | Not supported. Declared as required `permissions` with `"*://*/*"`.                                                                           |
| `chrome.permissions` API         | `contains()`, `request()`                      | Not supported.                                                                                                                                |
| `chrome.scripting.executeScript` | Supported                                      | Supported via `browser.scripting.executeScript`.                                                                                              |
| Popup                            | Not used (setup page instead)                  | Used as primary configuration UI.                                                                                                             |
| `chrome.action.onClicked`        | Fires when no popup is set                     | Fires when no popup is set. Since we use a popup, we add `browser.runtime.onMessage` handlers for connect/disconnect toggling from the popup. |

**Safari manifest (initial):**

```json
{
  "manifest_version": 2,
  "name": "BrowserBridge",
  "version": "0.0.0",
  "description": "User-controlled bridge between Safari and AI agents.",
  "background": {
    "scripts": ["background.js"]
  },
  "browser_action": {
    "default_title": "BrowserBridge",
    "default_popup": "popup.html"
  },
  "permissions": ["activeTab", "scripting", "storage", "tabs", "*://*/*"],
  "content_scripts": []
}
```

Note: Safari Web Extension `manifest.json` can use MV3 syntax and `xcrun safari-web-extension-converter` will convert it. However, declaring `*://*/*` as a required permission (instead of optional) reflects Safari's lack of runtime permission grants. The converter tool will handle the translation.

### Part 3: Safari permission model

Safari Web Extensions do not support `optional_host_permissions` or
`chrome.permissions.request()`. Host access is declared at install time and
granted as part of installation.

Decision: declare `*://*/*` as a required permission in the Safari manifest. This
gives BrowserBridge on Safari the same effective reach as Chrome with regular
page access enabled, but without runtime permission prompts.

Consequences:

- The Safari extension will always be able to read and act on regular HTTP/HTTPS
  pages when the bridge is connected. There is no "regular page access not
  enabled" state on Safari.
- The Safari `permissions.ts` adapter will always return `true` for regular page
  access checks, because the broad permission is always active.
- Safari users grant this access when they install the extension (or enable it in
  Safari Preferences → Extensions). The permission is visible and revocable.
- The README must document this difference clearly.

### Part 4: Badge and connection state

Safari's MV2 `browser_action` uses `browser.browserAction.setBadgeText()`, but
Safari does not support `setBadgeBackgroundColor()` or `setBadgeTextColor()`.
Safari renders badges with a fixed system style.

Decision: use badge text for connection state, matching Chrome's text labels:

| State      | Badge text | Chrome background | Safari                        |
| ---------- | ---------- | ----------------- | ----------------------------- |
| Connected  | `ON`       | Green `#1f8f4d`   | Text only, system badge style |
| Connecting | `...`      | Amber `#f59e0b`   | Text only, system badge style |
| Stopped    | `OFF`      | Gray `#666666`    | Text only, system badge style |
| Error      | `ERR`      | Red `#b42318`     | Text only, system badge style |

Safari will skip `setBadgeBackgroundColor()` and `setBadgeTextColor()` calls.
The `ActionAdapter` interface already abstracts these, so the Safari adapter
will provide no-op implementations for color methods.

State changes are also reflected in the popup UI (see next section).

### Part 5: Setup and popup UI

Chrome uses a dedicated setup page (`setup.html` + `setup.ts`) opened via
`chrome.tabs.create()`. Safari Web Extensions typically use a popup instead.

Decision: create a Safari popup (`popup.html` + `popup.ts`) with:

- WebSocket URL input field (pre-populated from `browser.storage.local`).
- Save button.
- Connect/Disconnect button (toggles bridge state).
- Status display (connected/disconnected/error).
- No regular-page-access button (permissions are always granted on Safari).

The popup communicates with the background script via `browser.runtime.sendMessage`
and `browser.runtime.onMessage.addListener`, following the same message contract
as Chrome's setup page (`{ type: 'get_settings' }`, `{ type: 'save_settings', websocketUrl }`).

### Part 6: Native container app and development workflow

Safari Web Extensions must be wrapped inside a native macOS app. We use
`xcrun safari-web-extension-converter` to generate the Xcode project from the
extension source.

The development workflow:

1. `pnpm --filter @browserbridge/safari-extension build` compiles TypeScript and
   bundles the extension into `clients/extensions/safari/dist/`.
2. `make safari` (or `pnpm safari`) runs
   `xcrun safari-web-extension-converter` on `clients/extensions/safari/dist/`
   and outputs the Xcode project to `clients/extensions/safari/BrowserBridge/`.
3. The generated Xcode project is checked into the repository under
   `clients/extensions/safari/BrowserBridge/` so the full project is
   self-contained.
4. Developers open the `.xcodeproj` in Xcode, build, and run to install into
   Safari.
5. After extension source changes, rebuild with step 1 and then rebuild in Xcode.

The `Makefile` (or root `package.json` scripts) will include:

```makefile
safari: safari-extension-build safari-xcode-project

safari-extension-build:
	pnpm --filter @browserbridge/safari-extension build

safari-xcode-project:
	xcrun safari-web-extension-converter \
		--force \
		--project-location clients/extensions/safari/BrowserBridge \
		clients/extensions/safari/dist
```

The generated Xcode project directory (`clients/extensions/safari/BrowserBridge/`)
must be added to `.gitignore` if it creates build artifacts, but the project
configuration files (`.xcodeproj`, `Info.plist`) should be committed so that
another developer can open and build without running the converter first.

### Part 7: Service worker lifecycle

Chrome Manifest V3 uses a service worker that can be terminated by the browser
after 30 seconds of inactivity. BrowserBridge handles this with a 20-second
keepalive interval.

Safari does not use service workers for extension backgrounds. Safari's
background scripts run in a persistent page context and are not subject to the
same termination pressure. However, Safari may still suspend extension pages
under memory pressure.

Decision: keep the same keepalive mechanism (`extension_keepalive` every 20
seconds). On Safari, the keepalive serves as insurance against unexpected
suspension rather than preventing deterministic 30-second termination. The
`TimersAdapter` abstraction makes this transparent — Safari uses the same
`setInterval`/`clearInterval` contract.

### Part 8: Feature parity

The Safari extension targets full feature parity with the Chrome extension:

- Connect/disconnect toggle via popup (Chrome uses toolbar action, Safari uses
  popup button).
- WebSocket connection to the configured server URL.
- `get_page_context` response with full structure extraction.
- `get_page_content` paginated response.
- `perform_action` with all action types: `click`, `write_text`, `set_checked`,
  `select_options`, `submit_form`.
- Structured error responses matching the Chrome error codes.
- Connection-state badges (text only on Safari).
- Keepalive messages while connected.
- WebSocket URL stored in `browser.storage.local`.

### Repository layout after this ADR

```text
/packages/shared/src/
  background-controller.ts
  content-handler.ts
  page-context.ts
  page-content.ts
  protocol.ts
  timers.ts
/clients/extensions/chrome/src/
  background.ts          (Chrome API wiring only)
  permissions.ts          (Chrome permissions adapter)
  setup.ts                (Chrome setup page)
  content-script-entry.ts (Thin entry: registers message listener, calls shared handler)
/clients/extensions/chrome/
  manifest.json
  src/setup.html
  tsconfig.build.json
  tsconfig.json
  package.json
/clients/extensions/safari/src/
  background.ts           (Safari API wiring)
  permissions.ts          (Safari permissions — always returns true for regular pages)
  popup.ts                (Safari popup for settings + connect/disconnect)
  content-script-entry.ts (Thin entry: registers message listener, calls shared handler)
/clients/extensions/safari/
  manifest.json
  src/popup.html
  tsconfig.build.json
  tsconfig.json
  package.json
  Makefile                 (or build script for xcrun converter)
  BrowserBridge/           (Generated Xcode project, committed)
```

## Considered Approaches

### Option 1: Safari-Only Port Without Extraction

Copy Chrome source files into `clients/extensions/safari/` and modify them
in place for Safari API differences.

This duplicates the protocol, controller, and extraction logic across two
packages. Future changes (new action types, protocol updates) would need to be
applied in two places. The current Chrome code is already well-abstracted, so
duplication would be unnecessary and would diverge over time.

### Option 2: Extract Shared Logic, Build Safari With Parity (selected)

Move browser-agnostic code into `@browserbridge/shared`, create Safari-specific
adapters, and target full feature parity.

This preserves the existing Chrome behavior, eliminates duplication, and gives
both extensions a single source of truth for protocol types, message handling,
content extraction, and the background controller. Safari-specific differences
(permission model, badge API, popup vs. setup page) are handled through the
adapter pattern already established in the Chrome extension.

### Option 3: WebExtension Polyfill Approach

Use the `webextension-polyfill` npm package to abstract `chrome.*` vs
`browser.*` API differences and maintain a single extension codebase.

This reduces per-browser adapter code but hides real API differences (badge
color, permissions model, service worker vs. persistent background). It also
introduces a runtime dependency for a problem that the adapter pattern already
solves at compile time. The polyfill does not handle Safari-specific manifest
differences or the distribution model (native container app).

### Option 4: Minimal Safari Port (First Milestone Only)

Port only the first milestone (connect + page context URL/title) to Safari,
leaving actions and content extraction for later.

This creates an incomplete Safari extension, requires a second ADR for the
remaining features, and means the shared extraction has no immediate Safari
consumer. Since the shared extraction work is already needed, full parity is
more straightforward than staged parity.

## Scope

In scope:

- Extract shared logic from Chrome extension into `@browserbridge/shared`.
- Update Chrome extension to import from `@browserbridge/shared`.
- Create Safari Web Extension package at `clients/extensions/safari/`.
- Safari manifest with required `*://*/*` permission.
- Safari background script with `BrowserBridgeBackgroundController` wired to
  `browser.*` APIs.
- Safari permissions adapter (always returns `true` for regular page access).
- Safari popup for WebSocket URL configuration and connect/disconnect control.
- Safari content script entry that registers message listener and delegates to
  shared handler.
- Safari badge text for connection state (no color API calls).
- Build script for `xcrun safari-web-extension-converter` and Xcode project
  generation.
- Commit the generated Xcode project to the repository.
- TDD coverage for Safari adapters, permission behavior, and popup logic.
- Update Chrome extension README to reflect shared imports.
- Write Safari extension README with build, install, and local usage steps.
- Update root README to mention Safari support.
- Write project artifact when this project area is complete.

Out of scope:

- App Store distribution (follow-up after developer-signed distribution works).
- iOS Safari support (requires separate container app and testing).
- Firefox implementation (remains a placeholder).
- Changes to the WebSocket server or MCP server.
- Authentication or private channel routing.
- Continuous page streaming or background observation.
- Navigation-specific tools beyond what the Chrome extension supports.

## Testing

Use TDD:

1. Add failing tests for the shared `BrowserBridgeBackgroundController` in
   `packages/shared` (moved from Chrome, tests move too, updated to import from
   shared path).
2. Add failing tests for the shared content handler (moved from Chrome).
3. Add failing tests for the Safari permissions adapter
   (`hasRegularPageAccess()` always returns `true`,
   `isRegularPageUrl()` shares logic with Chrome).
4. Add failing tests for the Safari popup message handling (save settings, get
   settings, connect/disconnect messages).
5. Add failing tests for the Safari background wiring (action badge text,
   WebSocket creation, storage adapter).
6. Implement the smallest changes to make tests pass.

Verification should include:

- `pnpm --filter @browserbridge/shared test` passes.
- `pnpm --filter @browserbridge/chrome-extension test` passes (updated imports).
- `pnpm --filter @browserbridge/safari-extension test` passes.
- `pnpm --filter @browserbridge/chrome-extension build` produces installable
  Chrome extension.
- `pnpm --filter @browserbridge/safari-extension build` produces Safari
  extension directory.
- `make safari` generates a valid Xcode project.
- Manual Safari install works: load the extension, configure WebSocket URL,
  connect, and verify page context and action responses.
- `pnpm lint:ts` passes.
- `pnpm lint:md` passes.
- `pnpm test` passes.

## Consequences

The shared package becomes the single source of truth for protocol types,
message handling, page extraction, and background controller logic. Both Chrome
and Safari extensions import from `@browserbridge/shared` and provide only
browser-specific adapters.

Safari users get full BrowserBridge feature parity with Chrome. The Safari
extension declares broad host permissions at install time instead of using
runtime permission prompts, which is the only viable Safari approach but
requires clear documentation.

Badge state on Safari uses text only (no background colors). This is a visible
difference from Chrome but preserves the information hierarchy (ON/OFF/ERR).

The project gains a `Makefile` target and pnpm script for generating the Safari
Xcode project. The generated project is committed to the repository so
developers can open and build without running the converter first.

The Chrome extension changes are limited to import path updates and removal of
local copies of moved files — no behavioral change.

Future browser ports (Firefox) will follow the same pattern: browser-specific
adapters importing from `@browserbridge/shared`.
