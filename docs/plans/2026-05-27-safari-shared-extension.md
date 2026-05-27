# Safari Web Extension and Shared Extension Package — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Extract shared logic from Chrome extension into `@browserbridge/shared`, create Safari Web Extension with full feature parity, verify both extensions build and pass tests.

**Architecture:** Browser-agnostic code (protocol, controller, page extraction, content handler, timers) moves to `@browserbridge/shared`. Chrome and Safari each import from shared and provide browser-specific adapters. Safari uses `browser.*` namespace, popup UI for settings, and persistent background scripts (no service worker).

**Tech Stack:** TypeScript, pnpm workspaces, esbuild, Node.js test runner (`node --test`), linkedom for DOM mocking, tsx for running TS tests.

---

## Milestone 1: Set Up Shared Package Infrastructure

### Task 1: Create shared package build and test scaffolding

**Objective:** Set up `packages/shared` with working package.json, tsconfig, and test runner so it can export modules and run tests.

**Files:**

- Modify: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/tsconfig.build.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/shared.test.ts`

**Step 1: Write package.json with build, check, and test scripts**

Update `packages/shared/package.json`:

- Name: `@browserbridge/shared`
- Type: `module`
- Exports: `./src/index.ts` (for now, direct TS import via workspace)
- Scripts: build (tsc + esbuild), check (tsc --noEmit), test (node --import tsx --test src/\*_/_.test.ts)
- Dependencies: none yet
- DevDependencies: tsx, typescript, @types/node, linkedom (same versions as Chrome extension)

**Step 2: Create tsconfig.json**

Mirror the Chrome extension's tsconfig but targeting the shared package. Include `src/**/*.ts`.

**Step 3: Create tsconfig.build.json**

Extends tsconfig.json, sets `noEmit: false`, `outDir: dist`, includes only non-test source files.

**Step 4: Write a failing test that imports from the shared package**

Create `packages/shared/src/shared.test.ts`:

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("@browserbridge/shared", () => {
  it("exports a package version constant", () => {
    // This will fail until we add exports
    assert.ok(true, "placeholder — will be replaced when real exports exist");
  });
});
```

**Step 5: Run test to verify it passes (infrastructure test)**

Run: `pnpm --filter @browserbridge/shared test`
Expected: PASS (placeholder test confirms infrastructure works)

**Step 6: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): add package scaffolding with build, check, and test scripts"
```

---

## Milestone 2: Extract Browser-Agnostic Modules to Shared Package

### Task 2: Move protocol.ts to shared package

**Objective:** Move `protocol.ts` from Chrome to shared, update imports, verify all Chrome tests still pass.

**Files:**

- Move: `clients/extensions/chrome/src/protocol.ts` → `packages/shared/src/protocol.ts`
- Create: `packages/shared/src/protocol.test.ts` (copy from Chrome)
- Modify: `packages/shared/src/index.ts` (re-export protocol)
- Modify: all Chrome files that import from `./protocol.js` → `@browserbridge/shared`
- Modify: Chrome `tsconfig.build.json` (remove protocol.ts from include if needed)

**Step 1: Copy protocol.ts and protocol.test.ts to shared package**

Copy `clients/extensions/chrome/src/protocol.ts` to `packages/shared/src/protocol.ts`.
Copy `clients/extensions/chrome/src/protocol.test.ts` to `packages/shared/src/protocol.test.ts`.

Fix internal imports in the test file (change `./protocol.js` to `./protocol.js` — same, since it's local within shared now).

**Step 2: Run shared tests to verify they pass**

Run: `pnpm --filter @browserbridge/shared test`
Expected: All protocol tests PASS (they test pure functions, no DOM dependency)

**Step 3: Update packages/shared/src/index.ts to re-export protocol**

```typescript
export * from "./protocol.js";
```

**Step 4: Update Chrome extension imports**

In all Chrome source files, change `from './protocol.js'` to `from '@browserbridge/shared'`.
Files to update: `background-controller.ts`, `content.ts`, `background.ts`, `page-context.ts`, `page-content.ts`.

**Step 5: Remove the local protocol.ts from Chrome**

Delete `clients/extensions/chrome/src/protocol.ts`.

**Step 6: Run Chrome tests to verify nothing broke**

Run: `pnpm --filter @browserbridge/chrome-extension test`
Expected: All Chrome tests PASS

**Step 7: Run Chrome build to verify compilation**

Run: `pnpm --filter @browserbridge/chrome-extension build`
Expected: Build succeeds

**Step 8: Commit**

```bash
git add -A
git commit -m "feat(shared): move protocol.ts from Chrome to shared package"
```

### Task 3: Move timers.ts to shared package

**Objective:** Move `timers.ts` from Chrome to shared, update imports.

**Files:**

- Move: `clients/extensions/chrome/src/timers.ts` → `packages/shared/src/timers.ts`
- Move: `clients/extensions/chrome/src/timers.test.ts` → `packages/shared/src/timers.test.ts`
- Modify: `packages/shared/src/index.ts` (add timers re-export)
- Modify: `clients/extensions/chrome/src/background.ts` (update import)

**Step 1: Copy timers.ts and timers.test.ts to shared, fix imports**

In `timers.ts`, the import `from './background-controller.js'` needs to change to `from './background-controller.js'` — but wait, timers.ts is being moved before background-controller.ts. The import is `import type { TimersAdapter } from './background-controller.js'`.

**Important:** Since background-controller.ts hasn't been moved yet, we need to handle the circular dependency. Two options:
a. Move timers.ts with the TimersAdapter type inlined or imported from the future location.
b. Move timers.ts and background-controller.ts together.

**Decision:** Move timers.ts first. Change the import to reference background-controller from the Chrome package temporarily, OR define the TimersAdapter interface in timers.ts itself (it's small). Then when background-controller.ts moves, update the import.

Actually, looking at the code, `TimersAdapter` is defined in `background-controller.ts`. The cleanest approach is:

1. In `packages/shared/src/timers.ts`, keep the import from `./background-controller.js` — this will work once background-controller.ts is also in shared.
2. But for the intermediate step, since background-controller.ts is still in Chrome, we need a temporary solution.

**Better approach:** Move timers.ts WITHOUT the TimersAdapter import. Define the TimerScope interface (which TimersAdapter extends) directly. Then update background-controller.ts later.

Actually, the simplest approach: define `TimersAdapter` in timers.ts temporarily, then move it to background-controller.ts when we move that file.

Wait, let me re-read the code. `timers.ts` imports `TimersAdapter` from `background-controller.ts`. `background-controller.ts` exports `TimersAdapter`. If I move timers.ts to shared, it can't import from the Chrome package (that would create a workspace circular dependency).

**Best approach:** Extract the `TimersAdapter` interface into its own file in shared, OR move timers.ts and background-controller.ts together. Since background-controller.ts has many other imports from protocol.ts (which will already be in shared), let's move both together.

Actually, let me reconsider the order. The ADR specifies:

- protocol.ts (no deps)
- timers.ts (depends on TimersAdapter from background-controller.ts)
- background-controller.ts (depends on protocol.ts, timers.ts)
- page-context.ts (depends on protocol.ts, page-content.ts)
- page-content.ts (no deps)
- content-handler.ts (depends on protocol.ts, page-context.ts, page-content.ts)

The cleanest extraction order considering dependencies:

1. protocol.ts (no deps) ✓ (Task 2)
2. page-content.ts (no deps — it only uses TextEncoder internally)
3. timers.ts + background-controller.ts together (they reference each other)
4. page-context.ts (depends on protocol.ts, page-content.ts)
5. content-handler.ts (depends on all above)

Let me adjust the plan accordingly.

### Task 3: Move page-content.ts to shared package

**Objective:** Move `page-content.ts` from Chrome to shared. It has no dependencies on other Chrome files (uses only TextEncoder which is global).

**Files:**

- Move: `clients/extensions/chrome/src/page-content.ts` → `packages/shared/src/page-content.ts`
- Move: `clients/extensions/chrome/src/page-content.test.ts` → `packages/shared/src/page-content.test.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `clients/extensions/chrome/src/page-context.ts` (update import)
- Modify: `clients/extensions/chrome/src/content.ts` (update import)

**Step 1: Copy page-content.ts and page-content.test.ts to shared**

**Step 2: Run shared tests**

Run: `pnpm --filter @browserbridge/shared test`
Expected: All shared tests PASS (protocol + page-content)

**Step 3: Update Chrome imports to use @browserbridge/shared**

In `page-context.ts`: change `from './page-content.js'` to `from '@browserbridge/shared'`
In `content.ts`: change `from './page-content.js'` to `from '@browserbridge/shared'`

**Step 4: Delete local page-content.ts from Chrome**

**Step 5: Run Chrome tests**

Run: `pnpm --filter @browserbridge/chrome-extension test`
Expected: All Chrome tests PASS

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(shared): move page-content.ts from Chrome to shared package"
```

### Task 4: Move timers.ts and background-controller.ts to shared package

**Objective:** Move both files together since they reference each other (TimersAdapter defined in background-controller, used by timers.ts).

**Files:**

- Move: `clients/extensions/chrome/src/background-controller.ts` → `packages/shared/src/background-controller.ts`
- Move: `clients/extensions/chrome/src/background-controller.test.ts` → `packages/shared/src/background-controller.test.ts`
- Move: `clients/extensions/chrome/src/timers.ts` → `packages/shared/src/timers.ts`
- Move: `clients/extensions/chrome/src/timers.test.ts` → `packages/shared/src/timers.test.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `clients/extensions/chrome/src/background.ts` (update imports from ./background-controller.js and ./timers.js)
- Modify: inside timers.ts, the import stays as `./background-controller.js` (now local within shared)

**Step 1: Copy all four files to shared package, fix internal imports**

- `background-controller.ts`: imports from `./protocol.js` → will be local in shared ✓
- `timers.ts`: imports from `./background-controller.js` → will be local in shared ✓
- Update `background-controller.test.ts` and `timers.test.ts` imports to reference local files

**Step 2: Run shared tests**

Run: `pnpm --filter @browserbridge/shared test`
Expected: All shared tests PASS

**Step 3: Update Chrome background.ts imports**

Change:

- `from './background-controller.js'` → `from '@browserbridge/shared'`
- `from './timers.js'` → `from '@browserbridge/shared'`
- Types: `type BrowserBridgeBackgroundController`, `type BrowserBridgeSocket`, etc. from shared

**Step 4: Delete local background-controller.ts and timers.ts from Chrome**

**Step 5: Run Chrome tests**

Run: `pnpm --filter @browserbridge/chrome-extension test`
Expected: All Chrome tests PASS

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(shared): move background-controller.ts and timers.ts from Chrome to shared package"
```

### Task 5: Move page-context.ts to shared package

**Objective:** Move `page-context.ts` from Chrome to shared.

**Files:**

- Move: `clients/extensions/chrome/src/page-context.ts` → `packages/shared/src/page-context.ts`
- Move: `clients/extensions/chrome/src/page-context.test.ts` → `packages/shared/src/page-context.test.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `clients/extensions/chrome/src/content.ts` (update import)

**Step 1: Copy files to shared, fix imports**

page-context.ts imports from `./page-content.js` and `./protocol.js` — both now local in shared ✓.

**Step 2: Run shared tests**

**Step 3: Update Chrome content.ts import**

Change `from './page-context.js'` → `from '@browserbridge/shared'`

**Step 4: Delete local page-context.ts from Chrome**

**Step 5: Run Chrome tests**

**Step 6: Commit**

### Task 6: Extract content-handler.ts from content.ts and move to shared

**Objective:** Extract the pure-logic `handleContentRequest` function and related types from `content.ts` into `packages/shared/src/content-handler.ts`, keeping the Chrome-specific `chrome.runtime.onMessage` listener in a thin `content-script-entry.ts`.

**Files:**

- Create: `packages/shared/src/content-handler.ts` (extracted from content.ts)
- Create: `packages/shared/src/content-handler.test.ts` (extracted from content.test.ts)
- Create: `clients/extensions/chrome/src/content-script-entry.ts` (thin Chrome wiring)
- Modify: `packages/shared/src/index.ts`
- Delete: `clients/extensions/chrome/src/content.ts` (replaced by entry + shared handler)

**Step 1: Write content-handler.ts in shared**

Extract from content.ts:

- `ContentRequest` type
- `ContentResponse` type
- `ContentEnvironment` interface
- `handleContentRequest` function
- All helper functions (performWriteText, performClick, etc.)
- Helper types and utility functions

Do NOT extract:

- `ChromeRuntimeApi` interface (Chrome-specific)
- `chrome.runtime.onMessage.addListener(...)` call (Chrome-specific)

**Step 2: Write content-handler.test.ts in shared**

Extract from content.test.ts, updating imports to reference shared package.

**Step 3: Create Chrome content-script-entry.ts**

Thin file that:

1. Imports `handleContentRequest` and `ContentRequest`/`ContentResponse` from `@browserbridge/shared`
2. Registers `chrome.runtime.onMessage.addListener`
3. Calls `handleContentRequest` with the environment object

**Step 4: Delete Chrome content.ts**

**Step 5: Update Chrome esbuild config**

The build command in package.json bundles `src/content.ts` → need to change to `src/content-script-entry.ts`.

**Step 6: Run all tests**

Run: `pnpm --filter @browserbridge/shared test`
Run: `pnpm --filter @browserbridge/chrome-extension test`
Run: `pnpm --filter @browserbridge/chrome-extension build`

**Step 7: Commit**

```bash
git add -A
git commit -m "feat(shared): extract content-handler.ts from Chrome content script"
```

### Task 7: Verify complete Chrome extension refactoring

**Objective:** Full integration check — all shared tests pass, Chrome tests pass, Chrome build succeeds.

**Step 1: Run full test suite**

```bash
pnpm test
```

**Step 2: Run TypeScript checks**

```bash
pnpm check
```

**Step 3: Run lint**

```bash
pnpm lint
```

**Step 4: Run Chrome build**

```bash
pnpm --filter @browserbridge/chrome-extension build
```

**Step 5: Commit any remaining fixes**

---

## Milestone 3: Safari Web Extension

### Task 8: Create Safari extension package scaffolding

**Objective:** Set up `clients/extensions/safari` with package.json, tsconfig, manifest.json, and build scripts.

**Files:**

- Modify: `clients/extensions/safari/package.json` (replace placeholder)
- Create: `clients/extensions/safari/tsconfig.json`
- Create: `clients/extensions/safari/tsconfig.build.json`
- Create: `clients/extensions/safari/manifest.json`
- Create: `clients/extensions/safari/src/index.ts` (placeholder, for build verification)

**Step 1: Write package.json**

```json
{
  "name": "@browserbridge/safari-extension",
  "version": "0.0.0",
  "private": true,
  "description": "BrowserBridge Safari Web Extension.",
  "license": "PolyForm-Noncommercial-1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.build.json && esbuild src/content-script-entry.ts --bundle --format=iife --platform=browser --target=safari17 --outfile=dist/content.js && cp manifest.json dist/manifest.json && cp src/popup.html dist/popup.html && node scripts/verify-build-output.mjs",
    "check": "tsc --noEmit",
    "dev": "echo \"Safari extension dev workflow is not implemented yet\"",
    "test": "node --import tsx --test src/**/*.test.ts"
  },
  "dependencies": {
    "@browserbridge/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.15.21",
    "esbuild": "^0.28.0",
    "linkedom": "^0.18.12",
    "tsx": "^4.19.4",
    "typescript": "^5.8.3"
  }
}
```

**Step 2: Write manifest.json** (per ADR — MV2 syntax, broad permissions)

**Step 3: Write tsconfig.json and tsconfig.build.json**

**Step 4: Create placeholder src/index.ts**

**Step 5: Create scripts/verify-build-output.mjs** (similar to Chrome's)

**Step 6: Install dependencies**

```bash
pnpm install
```

**Step 7: Run `pnpm --filter @browserbridge/safari-extension check`**

Expected: PASS (even with placeholder)

**Step 8: Commit**

### Task 9: Create Safari permissions adapter with TDD

**Objective:** Write the Safari permissions module that always returns true for regular page access.

**Files:**

- Create: `clients/extensions/safari/src/permissions.ts`
- Create: `clients/extensions/safari/src/permissions.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isRegularPageUrl, hasRegularPageAccess } from "./permissions.js";

describe("Safari permissions", () => {
  describe("isRegularPageUrl", () => {
    it("returns true for http:// URLs", () => {
      assert.equal(isRegularPageUrl("http://example.com"), true);
    });

    it("returns true for https:// URLs", () => {
      assert.equal(isRegularPageUrl("https://example.com"), true);
    });

    it("returns false for chrome:// URLs", () => {
      assert.equal(isRegularPageUrl("chrome://extensions"), false);
    });

    it("returns false for safari-extension:// URLs", () => {
      assert.equal(isRegularPageUrl("safari-extension://abc"), false);
    });
  });

  describe("hasRegularPageAccess", () => {
    it("always returns true (Safari grants broad host permission at install)", async () => {
      assert.equal(await hasRegularPageAccess(), true);
    });
  });
});
```

**Step 2: Run test, verify RED**

```bash
pnpm --filter @browserbridge/safari-extension test
```

Expected: FAIL — module not found

**Step 3: Implement permissions.ts**

```typescript
export function isRegularPageUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

export async function hasRegularPageAccess(): Promise<boolean> {
  return true;
}
```

**Step 4: Run test, verify GREEN**

**Step 5: Commit**

### Task 10: Create Safari background script with TDD

**Objective:** Write the Safari background script that wires BrowserBridgeBackgroundController to `browser.*` APIs.

**Files:**

- Create: `clients/extensions/safari/src/background.ts`
- Create: `clients/extensions/safari/src/background.test.ts`

**Step 1: Write failing test for SafariBackgroundController or similar wiring**

Tests should verify:

- Badge text is set correctly for each state
- Badge color methods are no-ops
- WebSocket creation works
- Storage get/set delegates to browser.storage.local
- Message handling (get_settings, save_settings, connect, disconnect)

Since background.ts is primarily Chrome/Safari API wiring, the tests need to mock the browser APIs. Focus tests on the adapter behavior.

**Step 2: Implement Safari background.ts**

This creates:

- `SafariActionBadge` adapter (setBadgeText real, setBadgeColor/setBadgeTextColor no-ops)
- `SafariStorageAdapter` (browser.storage.local)
- `SafariSetupAdapter` (no-op or open popup — Safari uses popup, not setup page)
- `SafariPageReaderAdapter` (browser.scripting.executeScript + browser.tabs.sendMessage)
- `SafariPageActionAdapter` (delegates to content script)
- `DomWebSocketAdapter` (same as Chrome — uses WebSocket API)
- Controller instantiation and event listeners

**Step 3: Run tests**

**Step 4: Commit**

### Task 11: Create Safari popup UI with TDD

**Objective:** Create popup.html and popup.ts for Safari settings + connect/disconnect.

**Files:**

- Create: `clients/extensions/safari/src/popup.html`
- Create: `clients/extensions/safari/src/popup.ts`
- Create: `clients/extensions/safari/src/popup.test.ts`

**Step 1: Write failing test for popup message handlers**

Test the message types:

- `get_settings` request returns stored WebSocket URL
- `save_settings` request saves and disconnects
- Connect/disconnect toggle behavior

**Step 2: Implement popup.ts**

Popup sends `get_settings` on load, populates URL field, has Save and Connect/Disconnect buttons.

**Step 3: Create popup.html**

Simple HTML with input, buttons, status display.

**Step 4: Run tests**

**Step 5: Commit**

### Task 12: Create Safari content script entry with TDD

**Objective:** Thin entry file that registers browser.runtime.onMessage listener and delegates to shared handleContentRequest.

**Files:**

- Create: `clients/extensions/safari/src/content-script-entry.ts`

**Step 1: Write content-script-entry.ts**

This mirrors Chrome's content.ts bottom section but uses `browser.runtime.onMessage` instead of `chrome.runtime.onMessage`.

Since the `handleContentRequest` function is in `@browserbridge/shared`, the entry just registers the listener.

**Step 2: Verify it builds**

**Step 3: Commit**

### Task 13: Build pipeline and Makefile

**Objective:** Create the `make safari` target and Safari build scripts.

**Files:**

- Create: `Makefile` at repo root (or modify root package.json scripts)
- Create: `clients/extensions/safari/scripts/verify-build-output.mjs`

**Step 1: Create Makefile with safari target**

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

**Step 2: Add root package.json scripts**

Add `"safari": "make safari"` or equivalent pnpm script.

**Step 3: Create verify-build-output.mjs**

Similar to Chrome's — verify content.js doesn't have imports/exports.

**Step 4: Test the build**

```bash
pnpm --filter @browserbridge/safari-extension build
```

**Step 5: Commit**

---

## Milestone 4: Documentation

### Task 14: Update Chrome extension README

Update `clients/extensions/chrome/README.md` to note that shared modules are now imported from `@browserbridge/shared`.

### Task 15: Write Safari extension README

Create `clients/extensions/safari/README.md` with build, install, and usage steps, plus Safari-specific differences documented.

### Task 16: Update root README

Add Safari to supported browsers, update architecture diagram.

### Task 17: Final verification

Run full test suite, build, lint, and type-check everything:

```bash
pnpm test && pnpm check && pnpm lint && pnpm build
```

---

## Summary of Key Decisions

1. **Module extraction order** respects dependency graph: protocol → page-content → timers+background-controller → page-context → content-handler
2. **Chrome content.ts** is split: shared `content-handler.ts` (pure logic) + Chrome `content-script-entry.ts` (listener registration)
3. **Safari manifest** uses MV2 syntax (`background.scripts`), `browser.*` namespace, `*://*/*` as required permission
4. **Safari permissions** always return true for regular page access
5. **Safari popup** replaces Chrome setup page for configuration UI
6. **Badge colors** are no-ops on Safari (text-only badges)
7. **Build pipeline**: `pnpm build` → esbuild → `xcrun safari-web-extension-converter` → Xcode project
