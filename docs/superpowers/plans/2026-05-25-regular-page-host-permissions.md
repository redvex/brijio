# Regular Page Host Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users explicitly grant BrowserBridge access to regular
`http://` and `https://` pages so page reads do not depend only on the
temporary `activeTab` grant.

**Architecture:** Add a small Chrome permission helper module for regular-page
origins, wire optional host permissions into the manifest, expose a setup-page
button that requests those permissions from a user gesture, and improve
background page-read errors when injection fails on regular pages without host
permission.

**Tech Stack:** TypeScript, Chrome Manifest V3 APIs, Node test runner,
linkedom for DOM-oriented tests where needed.

---

### Task 1: ADR And Permission Helper Tests

**Files:**

- Modify: `docs/architecture/decisions/0011-regular-page-host-permissions-for-chrome-extension.md`
- Create: `clients/extensions/chrome/src/permissions.test.ts`
- Create: `clients/extensions/chrome/src/permissions.ts`

- [x] **Step 1: Mark ADR 0011 accepted**

Change status from `Proposed` to `Accepted`.

- [x] **Step 2: Write failing permission helper tests**

Add tests for:

- `regularPageOrigins` equals `['http://*/*', 'https://*/*']`;
- `isRegularPageUrl()` accepts only HTTP and HTTPS URLs;
- `hasRegularPageAccess()` calls `chrome.permissions.contains`;
- `requestRegularPageAccess()` calls `chrome.permissions.request`.

- [x] **Step 3: Run tests and verify red**

Run: `pnpm --filter @browserbridge/chrome-extension test`

Expected: fails because `permissions.ts` does not exist yet.

- [x] **Step 4: Implement helper and verify green**

Implement the helper functions in `permissions.ts`.

Run: `pnpm --filter @browserbridge/chrome-extension test`

Expected: tests pass.

### Task 2: Manifest And Background Error Handling

**Files:**

- Modify: `clients/extensions/chrome/manifest.json`
- Modify: `clients/extensions/chrome/src/protocol.ts`
- Modify: `clients/extensions/chrome/src/background.ts`
- Modify: `clients/extensions/chrome/src/background-controller.test.ts`

- [x] **Step 1: Add failing protocol/controller tests**

Add `regular_page_permission_required` as an expected page read error code and
test that the controller forwards it in `page_context_response` or
`page_content_response`.

- [x] **Step 2: Add optional host permissions**

Add `optional_host_permissions` with `http://*/*` and `https://*/*` to
`manifest.json`.

- [x] **Step 3: Improve background injection failure mapping**

When `chrome.scripting.executeScript` or `chrome.tabs.sendMessage` fails for a
regular URL, call `hasRegularPageAccess(chrome.permissions)`. If false, return
`regular_page_permission_required`; otherwise keep `content_script_unavailable`.

- [x] **Step 4: Run tests and build**

Run:

```sh
pnpm --filter @browserbridge/chrome-extension test
pnpm --filter @browserbridge/chrome-extension build
```

Expected: both pass.

### Task 3: Setup UI And Documentation

**Files:**

- Modify: `clients/extensions/chrome/src/setup.html`
- Modify: `clients/extensions/chrome/src/setup.ts`
- Modify: `clients/extensions/chrome/README.md`
- Create: `docs/artifacts/2026-05-25-regular-page-host-permissions.md`

- [x] **Step 1: Add setup UI control**

Add a button to request regular page access from the setup page.

- [x] **Step 2: Wire setup permission request**

Use `requestRegularPageAccess()` from the setup page button and show granted or
denied status text.

- [x] **Step 3: Document behavior**

Update the Chrome extension README and add an artifact describing optional
regular-page permissions, unsupported pages, and verification.

- [x] **Step 4: Run final verification**

Run:

```sh
pnpm --filter @browserbridge/chrome-extension test
pnpm --filter @browserbridge/chrome-extension build
pnpm lint:ts
pnpm lint:md
pnpm test
```

Expected: all commands pass.
