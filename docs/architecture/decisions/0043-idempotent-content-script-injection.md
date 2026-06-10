# ADR 0043: Idempotent Content Script Communication

## Status

Accepted

## Context

The Brijio browser extension injects its content script into web pages to
extract page content and perform actions (clicks, fills, etc.). The injection
happens via two mechanisms:

1. **Manifest `content_scripts`** (Safari) — automatic injection on matching URLs
2. **Programmatic `scripting.executeScript`** (Chrome) — called by the background
   script to inject the content script on demand

Previously, the background script called `scripting.executeScript` before
**every** `tabs.sendMessage` call, even on Safari where the manifest already
injects the content script. This caused three problems:

1. **Duplicate `onMessage` listeners** — each re-injection created a new module
   scope with a new `onMessage` listener, while the old listener remained
   registered. With multiple listeners, the first `sendResponse` call wins and
   subsequent ones are silently ignored. If the old (stale) listener responded
   first, its `pageContextVersion` might not match the current context.

2. **Duplicate `pageshow` listeners** — each re-injection added another
   navigation counter increment listener, causing `pageContextVersion` to
   increase multiple times per navigation event.

3. **Reset `pageContextVersion`** — each new module scope started with
   `let pageContextVersion = 1`, while the old module scope retained its
   counter value. This created context-version mismatches between read and
   action requests.

This manifested as "Unable to reach the page content script" errors on certain
click actions. Reads worked (the first injection's listener responded
correctly), but subsequent `executeScript` calls created conflicting listeners
that caused `sendMessage` responses to be lost or overwritten.

## Decision

Two changes address these problems:

### 1. Try-first messaging pattern (page-reader.ts)

Instead of calling `executeScript` before every `sendMessage`, the background
script now **tries `sendMessage` first**. If the content script is already
loaded (e.g. via manifest `content_scripts` on Safari), this succeeds without
any side effects. Only if `sendMessage` returns `undefined` (no listener
responded) does the background script fall back to `executeScript` +
`sendMessage` to inject the content script on demand (e.g. for Chrome which
uses programmatic injection).

This eliminates unnecessary re-injections on Safari and prevents the
duplicate-listener and version-reset problems for the common case.

### 2. Listener replacement in content-script-entry.ts

For the case where `executeScript` does re-inject the content script (Chrome's
first injection, or Safari fallback), each content-script entry now stores its
`onMessage` listener reference on `globalThis.__brijioOnMessageListener`. On
re-injection, the new module removes the previous injection's listener via
`removeListener(globalThis.__brijioOnMessageListener)` before adding its own.

This ensures at most one `onMessage` listener is active per page, and that
listener's `pageContextVersion` matches the current module scope.

## Consequences

- **Positive**: Content script re-injection is now safe. Click actions that
  previously failed due to duplicate listeners or stale context versions now
  work correctly.

- **Positive**: The try-first pattern avoids unnecessary `executeScript` calls
  on Safari, improving performance and reducing side effects.

- **Positive**: The `pageContextVersion` remains consistent across the page
  lifecycle for the active listener, so stale-context detection continues to
  work correctly.

- **Positive**: Chrome's programmatic injection still works — when `sendMessage`
  returns `undefined` (no content script loaded), `executeScript` + `sendMessage`
  provides the fallback.

- **Neutral**: If the page navigates to a new origin or is completely reloaded,
  `globalThis` is reset (new page context), and the content script registers
  fresh listeners as expected.

- **Risk**: If the content script crashes during initialization (before setting
  `globalThis.__brijioOnMessageListener`), re-injection will register a new
  listener without removing the old one. This is acceptable because a crashed
  content script's listener is inert.
