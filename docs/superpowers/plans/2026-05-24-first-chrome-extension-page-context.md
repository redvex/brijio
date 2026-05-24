# First Chrome Extension Page Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved first Chrome extension milestone: first-run WebSocket URL setup, toolbar Play/Stop control, and `get_page_context` responses containing the active tab URL and title.

**Architecture:** `clients/extensions/chrome/src/protocol.ts` owns request parsing and response construction, while `clients/extensions/chrome/src/background.ts` owns Chrome action clicks, WebSocket lifecycle, badge state, and active-tab lookup. `clients/extensions/chrome/src/setup.ts` is a small first-run configuration page that saves the WebSocket URL through the background worker.

**Tech Stack:** TypeScript, Chrome Manifest V3, Chrome extension APIs, Node test runner through `tsx`, `tsc`.

---

### Task 1: Protocol Tests And Types

**Files:**

- Create: `clients/extensions/chrome/tsconfig.json`
- Create: `clients/extensions/chrome/src/protocol.test.ts`
- Create: `clients/extensions/chrome/src/protocol.ts`
- Modify: `clients/extensions/chrome/package.json`

- [x] **Step 1: Write failing protocol tests**

Add tests for:

- recognizing a `get_page_context` envelope;
- rejecting unsupported request payloads;
- preserving request IDs in successful responses;
- building structured `page_context_response` errors.

- [x] **Step 2: Run tests to verify red**

Run: `pnpm --filter @browserbridge/chrome-extension test`

Expected: failure because `src/protocol.ts` does not exist yet.

- [x] **Step 3: Implement protocol helpers**

Implement `isGetPageContextEnvelope`, `createPageContextResponse`, and `createPageContextErrorResponse`.

- [x] **Step 4: Run tests to verify green**

Run: `pnpm --filter @browserbridge/chrome-extension test`

Expected: all Chrome extension tests pass.

### Task 2: Background Controller Tests And Runtime

**Files:**

- Create: `clients/extensions/chrome/src/background-controller.test.ts`
- Create: `clients/extensions/chrome/src/background-controller.ts`
- Create: `clients/extensions/chrome/src/background.ts`

- [x] **Step 1: Write failing controller tests**

Add tests for:

- opening setup when the action is clicked without a stored WebSocket URL;
- connecting when the action is clicked with a stored WebSocket URL;
- disconnecting when the action is clicked while connected;
- responding to `get_page_context` with active tab URL and title;
- returning `no_active_tab` when no active tab with URL exists.

- [x] **Step 2: Run tests to verify red**

Run: `pnpm --filter @browserbridge/chrome-extension test`

Expected: failure because `src/background-controller.ts` does not exist yet.

- [x] **Step 3: Implement background controller**

Implement a testable controller that receives adapters for storage, tabs,
runtime setup opening, action badge/title updates, and WebSocket construction.

- [x] **Step 4: Wire Chrome APIs**

Implement `src/background.ts` as the Manifest V3 service worker entry point. It
should create the controller with Chrome API adapters and register
`chrome.action.onClicked`.

- [x] **Step 5: Run tests to verify green**

Run: `pnpm --filter @browserbridge/chrome-extension test`

Expected: all Chrome extension tests pass.

### Task 3: First-Run Setup Page

**Files:**

- Create: `clients/extensions/chrome/src/setup.html`
- Create: `clients/extensions/chrome/src/setup.ts`

- [x] **Step 1: Add setup page**

Create a small extension-owned setup page with one WebSocket URL input, a save
button, and a status message.

- [x] **Step 2: Implement setup script**

On load, request current settings from the background worker. On submit, save
the WebSocket URL through the background worker.

- [x] **Step 3: Run package check**

Run: `pnpm --filter @browserbridge/chrome-extension check`

Expected: TypeScript check passes.

### Task 4: Manifest, Build, And Documentation

**Files:**

- Modify: `clients/extensions/chrome/manifest.json`
- Modify: `clients/extensions/chrome/package.json`
- Modify: `clients/extensions/chrome/README.md`

- [x] **Step 1: Update manifest**

Add the Manifest V3 background service worker, action title, and the `storage`
and `tabs` permissions required by ADR 0005.

- [x] **Step 2: Update package scripts**

Make `build` run `tsc --outDir dist` and copy `manifest.json` and
`src/setup.html` into `dist`. Make `check` run `tsc --noEmit`. Make `test` run
Node tests through `tsx`.

- [x] **Step 3: Update README**

Document local build, install through Chrome "Load unpacked", first-run setup,
Play/Stop toolbar behavior, and the current single-channel local-server
limitation.

- [x] **Step 4: Run verification**

Run:

```sh
pnpm --filter @browserbridge/chrome-extension test
pnpm --filter @browserbridge/chrome-extension check
pnpm --filter @browserbridge/chrome-extension build
pnpm lint:ts
pnpm lint:md
pnpm test
```

Expected: each command exits with code 0.
