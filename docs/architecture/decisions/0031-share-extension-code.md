# ADR 0031: Share Extension Code Between Chrome and Safari

## Status

Proposed

## Date

2026-05-29

## Context

Chrome and Safari extensions share ~200 lines of identical or near-identical code across 7 file pairs. ADR 0030 explicitly deferred shared extraction ("two consumers do not justify shared extraction"), but implementation revealed significant duplication:

- **6 message creator functions** — identical between both `popup.ts` files
- **`parseSettingsResponse`** / **`parseErrorResponse`** — identical logic in both `popup.ts` files
- **`normalizeBridgeSettings`** / **`stringValue`** / **`requireString`** — duplicated between both `background.ts` files
- **`isRegularPageUrl`** / **`hasRegularPageAccess`** — identical in both `permissions.ts` files
- **`isContentResponse`** / **`isPageContentErrorCode`** / **`isRecord`** — duplicated in both `background.ts` files
- **`readActiveTabPage`** / **`performActiveTabAction`** core flow — structurally identical with adapter injection differences

Further, Safari's popup has three bugs that Chrome already fixed:

1. **`updateConnectionStatus()` overwrites save/error messages** — Chrome removed this call in `saveSettings`/`disconnect`/`connect`; Safari still calls it
2. **No form validation** — Chrome added `validateForm()` and `novalidate`; Safari relies on `type="url"` which rejects WebSocket URLs
3. **`parseStatusResponse` returns `boolean`** — Chrome returns `{ state, lastError }` for rich status; Safari cannot show connecting/error details

## Decision

Extract shared code to `@browserbridge/shared` in two phases.

### Phase 1: Extract Shared Pure Functions

Move duplicated pure functions to shared, keeping browser-specific adapters in each extension.

**New shared modules:**

```
packages/shared/src/
  popup-messages.ts    # createGetSettingsMessage, createSaveSettingsMessage, etc.
  popup-parsers.ts     # parseSettingsResponse, parseErrorResponse, parseStatusResponse
  bridge-settings.ts   # normalizeBridgeSettings, stringValue, requireString, createBrowserInstanceId
  permissions.ts       # isRegularPageUrl, hasRegularPageAccess (moved from extensions)
  page-reader.ts       # readActiveTabPage, performActiveTabAction, isContentResponse, etc.
```

**Shared `parseStatusResponse` will return `{ state, lastError }` (Chrome's richer shape).** Safari's background-entry will be updated to return `{ state, lastError }` from `get_status` instead of `{ connected: boolean }`. This unifies the status protocol and fixes Safari's inability to show "Connecting..." or error messages.

### Phase 2: Unify Popup Entry With Browser-Agnostic `initPopup`

Refactor Safari's `popup-entry.ts` from module-level side effects to Chrome's testable DI pattern:

```typescript
// shared: packages/shared/src/popup-entry.ts
export async function initPopup(document, runtime, options) { ... }

// options provides browser-specific behavior:
interface PopupOptions {
  browserName: string         // "Chrome" or "Safari" — for default label
  sendMessage: (msg) => Promise<unknown>  // Promise-based (Chrome) or promisified (Safari)
}
```

Each extension's `popup-entry.ts` becomes a thin adapter:

```typescript
// Chrome: clients/extensions/chrome/src/popup-entry.ts
import { initPopup } from '@browserbridge/shared'
void initPopup(document, chrome, { browserName: 'Chrome', ... })

// Safari: clients/extensions/safari/src/popup-entry.ts
import { initPopup } from '@browserbridge/shared'
void initPopup(document, browser, { browserName: 'Safari', ... })
```

### Safari Bug Fixes (Done as Part of This ADR)

1. Add `novalidate` + `type="text"` to Safari `popup.html` (same fix as Chrome)
2. Add `validateForm()` to shared `initPopup` (both browsers benefit)
3. Remove `void updateConnectionStatus()` from `saveSettings`/`disconnect` in Safari
4. Update Safari `background-entry.ts` to return `{ state, lastError }` from `get_status`

### What Remains Browser-Specific

These files/factories stay in each extension directory because they wrap browser-specific APIs:

| Component                      | Why Browser-Specific                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `manifest.json`                | MV2 vs MV3 structural format                                                          |
| `background.ts`                | Controller construction with browser API globals (`chrome.*` vs `browser.*`)          |
| `background-entry.ts` (Safari) | `browser.browserAction.onClicked` listener, message handler wiring                    |
| Badge adapters                 | Safari badge color APIs are no-ops                                                    |
| WebSocket factory              | Safari needs `SafariWebSocketConnection` lifecycle; Chrome wraps existing `WebSocket` |
| Build targets                  | `--target=chrome116` vs `--target=safari17 --external:browser`                        |

## File Structure After Phase 1

```
packages/shared/src/
  popup-messages.ts       # 6 message creator functions
  popup-messages.test.ts  # Tests
  popup-parsers.ts        # parseSettingsResponse, parseErrorResponse, parseStatusResponse
  popup-parsers.test.ts   # Tests
  bridge-settings.ts     # normalizeBridgeSettings, stringValue, requireString, createBrowserInstanceId
  bridge-settings.test.ts # Tests
  permissions.ts          # isRegularPageUrl, hasRegularPageAccess
  permissions.test.ts     # Tests
  page-reader.ts          # readActiveTabPage, performActiveTabAction, isContentResponse, etc.
  page-reader.test.ts     # Tests

clients/extensions/chrome/src/
  background.ts           # Imports from shared; keeps Chrome-specific adapters + message handler
  popup-entry.ts          # Imports from shared; keeps Chrome DI boot
  popup.html              # novalidate, type="text", "Chrome Default"
  content-script-entry.ts # Unchanged (namespace diff only)
  permissions.ts          # DELETED — moved to shared

clients/extensions/safari/src/
  background.ts           # Imports from shared; keeps Safari-specific adapters
  background-entry.ts     # Updated: get_status returns { state, lastError }
  popup-entry.ts          # Imports from shared; Safari DI boot
  popup.html              # Fixed: novalidate, type="text", "Safari Default"
  popup.ts                # DELETED — all contents in shared
  content-script-entry.ts # Unchanged (namespace diff only)
  permissions.ts          # DELETED — moved to shared
  placeholder.ts          # Unchanged (build artifact)
```

## File Structure After Phase 2

```
packages/shared/src/
  popup-entry.ts          # Unified initPopup with DI
  popup-entry.test.ts     # Tests for shared initPopup
  (plus all Phase 1 additions)

clients/extensions/chrome/src/
  popup-entry.ts          # 3 lines: import shared + boot with Chrome runtime
  background.ts           # Chrome-specific adapters + message handler
  popup.html              # Browser-specific defaults
  content-script-entry.ts # Chrome namespace

clients/extensions/safari/src/
  popup-entry.ts          # 3 lines: import shared + boot with Safari runtime
  background.ts           # Safari-specific adapters
  background-entry.ts     # Message handler wiring + get_status with rich status
  popup.html              # Browser-specific defaults
  content-script-entry.ts # Safari namespace
  placeholder.ts          # Build artifact
```

## Scope

In scope:

- Phase 1: Extract and test shared pure functions
- Phase 1: Update Chrome+Safari to import from shared
- Phase 1: Delete deduplicated files from extensions
- Phase 2: Unified `initPopup` in shared
- Safari bug fixes (novalidate, validateForm, status overwrite, rich status)
- Update ADR 0030: mark "Shared popup module" as superseded by this ADR

Out of scope:

- Firefox extension (still a placeholder per ADR 0028)
- Auto-reconnect (separate ADR per ADR 0028 P1-3)
- Content script unification (different runtime globals, not worth extracting for 2 consumers yet)

## Testing

TDD for each extraction:

1. Write shared tests that verify the same behavior as the extension tests
2. Implement shared module
3. Update extension imports to use shared
4. Delete extension-local copies
5. Run `pnpm -r test` + `pnpm lint` after each extraction

## Consequences

### Positive

- **DRY** — ~200 lines of duplication eliminated
- **Bug parity** — Safari gets Chrome's fixes (validation, status messages, rich status)
- **Single source of truth** — message format changes propagate to both browsers
- **Unified status** — Safari can now show "Connecting...", "Error — message" instead of just Connected/Disconnected
- **Better Safari testability** — DI pattern enables unit testing of Safari popup

### Negative

- **Tight coupling** — both extensions depend on shared popup behavior; a change for one browser affects the other
- **Shared interface complexity** — `initPopup` options must accommodate both Chrome's MV3 and Safari's MV2 patterns

### Neutral

- ADR 0030's "Out of scope: Shared popup module" is superseded by this ADR
- Build artifact count in `packages/shared` increases but total code decreases
