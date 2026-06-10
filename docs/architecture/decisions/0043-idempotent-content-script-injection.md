# ADR 0043: Idempotent Content Script Injection

## Status

Accepted

## Context

The Brijio browser extension injects its content script into web pages to extract
page content and perform actions (clicks, fills, etc.). The injection happens via
two mechanisms:

1. **Manifest `content_scripts`** (Safari) — automatic injection on matching URLs
2. **Programmatic `scripting.executeScript`** — called by the background script
   before every `tabs.sendMessage` to ensure the content script is present

Both the Chrome and Safari content-script entries unconditionally register
`browser.runtime.onMessage` listeners and call `registerPageNavigationListener()`
at module scope. When `scripting.executeScript` re-injects the content script into
a page where it was already loaded (e.g. during a click action), this causes:

- **Duplicate `onMessage` listeners** — each injection adds a new listener. With
  multiple listeners, the first `sendResponse` call wins and subsequent ones are
  ignored. If the older (stale) listener responds first, the response may contain
  an outdated `pageContextVersion`.

- **Duplicate `pageshow` listeners** — each injection adds another navigation
  listener, causing `pageContextVersion` to be incremented multiple times per
  navigation event.

- **Reset `pageContextVersion`** — each new module scope starts with
  `let pageContextVersion = 1`, while the old module scope retains its counter
  value. The `sendResponse` from the old listener returns the correct version,
  but the new listener's version starts at 1, creating a mismatch.

This manifested as "Unable to reach the page content script" errors on certain
click actions. Reads worked reliably because the first injection's listener
handled them, but subsequent `executeScript` calls created conflicting listeners
that caused `sendMessage` responses to be silently dropped or overwritten.

## Decision

Add a **module-load guard** to both Chrome and Safari content-script entries.
The guard checks a `globalThis.__brijioContentLoaded` sentinel. On first
injection, the sentinel is set to `true` and listeners are registered. On
subsequent injections (from `scripting.executeScript`), the guard skips the
entire block — preventing duplicate listener registration and avoiding the
`pageContextVersion` reset.

```typescript
if ((globalThis as Record<string, unknown>).__brijioContentLoaded !== true) {
  ;(globalThis as Record<string, unknown>).__brijioContentLoaded = true
  registerPageNavigationListener()
  browser.runtime.onMessage.addListener(/* ... */)
}
```

Using `globalThis` (rather than a module-scoped flag) ensures the sentinel
persists across module re-evaluations in the same page context, since
`scripting.executeScript` creates a new module scope each time.

## Consequences

- **Positive**: Content script re-injection is now idempotent. Click actions
  that previously failed due to duplicate listeners or stale context versions
  now work correctly.

- **Positive**: The `pageContextVersion` remains consistent across
  re-injections, so stale-context detection (`page_navigated` responses)
  continues to work correctly.

- **Positive**: No changes needed to `page-reader.ts` — the background script
  can continue calling `scripting.executeScript` before `sendMessage` as a
  safety measure, and the guard makes it harmless.

- **Neutral**: If the page navigates to a new origin or is completely
  reloaded, the `globalThis` sentinel is reset (new page context), and the
  content script registers fresh listeners as expected.

- **Risk**: If the content script crashes during initialization (before setting
  the sentinel), re-injection will attempt to register listeners again. This
  is the desired fallback behavior — the script gets a fresh chance to
  initialize.