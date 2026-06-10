# ADR 0043: Idempotent Content Script Injection

## Status

Accepted

## Context

The Brijio browser extension injects its content script into web pages to
extract page content and perform actions (clicks, fills, etc.). The injection
happens via two mechanisms:

1. **Manifest `content_scripts`** (Safari) — automatic injection on matching URLs
2. **Programmatic `scripting.executeScript`** (Chrome) — called by the background
   script to inject the content script on demand

The background script previously called `scripting.executeScript` before
**every** `tabs.sendMessage` call. This caused three problems:

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

Use **listener replacement** in the content-script-entry files to make
re-injection safe. The background script continues to call `executeScript`
before every `sendMessage` (ensuring the latest content script code is always
loaded), but the content script now replaces its previous listener instead of
accumulating duplicates.

### Listener replacement (content-script-entry.ts)

Each content-script entry stores its `onMessage` listener reference on
`globalThis.__brijioOnMessageListener`. On re-injection, the new module removes
the previous injection's listener via `browser.runtime.onMessage.removeListener()`
before adding its own.

This ensures at most one `onMessage` listener is active per page, and that
listener's `pageContextVersion` matches the current module scope.

### Rejected alternatives

- **Try-first messaging**: Send `sendMessage` first, only call `executeScript`
  if no listener responds. This avoids re-injection when the manifest already
  loaded the content script (Safari). **Rejected** because the manifest-injected
  content script may be stale (e.g. after an extension update where Safari
  hasn't reloaded the extension bundle). By always calling `executeScript`, we
  ensure the latest content script code is loaded, while listener replacement
  prevents the duplicate-listener problem.

- **GlobalThis sentinel guard**: Set `globalThis.__brijioContentLoaded = true` on
  first injection and skip re-registration on subsequent injections. **Rejected**
  because when `executeScript` creates a new module scope, the guard prevents
  the new module from registering its listener, but the old module scope's
  listener may have been destroyed by the re-injection, leaving no active
  listener at all.

## Consequences

- **Positive**: Content script re-injection is now safe. The duplicate-listener
  and version-reset bugs are eliminated.

- **Positive**: `executeScript` before every `sendMessage` ensures the latest
  content script code is always loaded, even after extension updates.

- **Positive**: The `pageContextVersion` remains consistent across the page
  lifecycle for the active listener, so stale-context detection continues to
  work correctly.

- **Neutral**: `executeScript` is called before every action, adding a small
  overhead. This is acceptable because `executeScript` with an already-loaded
  content script is a fast no-op in most browser implementations.

- **Risk**: If the content script crashes during initialization (before setting
  `globalThis.__brijioOnMessageListener`), re-injection will register a new
  listener without removing the old one. This is acceptable because a crashed
  content script's listener is inert.
