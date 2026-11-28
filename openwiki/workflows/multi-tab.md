---
type: Workflow
title: Multi-tab Workflow
description: How agents use explicit per-call tabId targeting for reads, actions, batch operations, navigation, and screenshots. Covers list_tabs, open_tab, and the recommended multi-tab workflow.
tags: [workflow, multi-tab, tabid, open_tab, list_tabs, screenshot, navigation]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-28T16:38:16.677Z
sources:
  - id: openwiki-source-0f5d8a945cabdf67f37b9ad7
    resource: repo://clients/extensions/chrome/src/background.ts
  - id: openwiki-source-d9997f65a04e259507c45268
    resource: repo://docs/architecture/decisions/0063-open-tab-action.md
  - id: openwiki-source-79dd91ec51a55e7e78c52ccc
    resource: repo://docs/architecture/decisions/0064-visual-action-verification.md
  - id: openwiki-source-5524638d57e96598fd8e40d4
    resource: repo://packages/shared/src/background-controller.ts
  - id: openwiki-source-c20cbcf46daa07e6332e3f7f
    resource: repo://packages/shared/src/protocol.ts
  - id: openwiki-source-9d0286f606200dfc6de654df
    resource: repo://servers/mcp/skills/navigation/SKILL.md
  - id: openwiki-source-0e2fefeaecdd03cb7671fcf2
    resource: repo://servers/mcp/skills/using-brijio/SKILL.md
  - id: openwiki-source-5a3706e1092bd885c9371b8a
    resource: repo://servers/mcp/src/list-tabs-tool.ts
  - id: openwiki-source-36c61251055ea6d2f82f0b4e
    resource: repo://servers/mcp/src/mcp-server.ts
  - id: openwiki-source-5010399594ba6e70492859fd
    resource: repo://servers/mcp/src/open-tab-tool.ts
  - id: openwiki-source-48d3485f346966d1c44c7ea7
    resource: repo://servers/mcp/src/protocol.ts
  - id: openwiki-source-13054dea741b794a82597d0c
    resource: repo://servers/mcp/src/skills.ts
  - id: openwiki-source-fc4b25ba659ae4c102750c8d
    resource: repo://servers/mcp/src/websocket-client.ts
generated: { by: "openwiki/0.9.0", at: "2026-11-28T16:38:16.677Z" }
---

# Multi-tab Workflow

Brijio supports explicit per-call tab targeting through `tabId` for the main
browser interaction path. Every tool that touches a page — reads, actions,
batch operations, and navigation — accepts an optional `tabId` (a string)
that pins the call to a specific browser tab instead of the active foreground
tab. This makes multi-tab behavior explicit and unambiguous when an extension
has more than one connected tab, and lets agents keep a stable tab target
across a whole workflow.

For the full runtime path an individual tool call follows (MCP server →
WebSocket relay → extension adapter → browser tab and back), see
[MCP ↔ WebSocket ↔ Extension Flow](../architecture/mcp-extension-flow.md).
For which actions require user approval regardless of tab, see
[Client-Side Action Approval Workflow](./action-approval.md).

## Canonical source files

- `servers/mcp/src/mcp-server.ts` — tool registration (`list_tabs`, `open_tab`, `capture_screenshot`, `read_current_page`, `navigate_to_url`, `perform_batch`, …) and the shared `tabId` input schema.
- `servers/mcp/src/list-tabs-tool.ts` — `list_tabs` wrapper.
- `servers/mcp/src/open-tab-tool.ts` — `open_tab` wrapper with URL/scheme validation.
- `servers/mcp/src/capture-screenshot-tool.ts` — `capture_screenshot` wrapper (active-tab only).
- `servers/mcp/src/page-actions.ts` — shared action layer that threads `tabId` into each WebSocket request.
- `servers/mcp/src/websocket-client.ts` — `targetEnvelope` adds `tabId` to the request envelope when provided.
- `packages/shared/src/background-controller.ts` — extension-side dispatch (`handleListTabsRequest`, `handleOpenTabRequest`, `handleScreenshotRequest`) and adapter interfaces.
- `servers/mcp/skills/using-brijio/SKILL.md` and `servers/mcp/skills/navigation/SKILL.md` — agent-facing workflow guidance.

## Recommended workflow

1. Call `list_browsers` to confirm a browser is connected (always first; no
   browser means no action). If multiple browsers are connected, note the
   `browserInstanceId`.
2. Call `list_tabs` to discover connected browser tabs, including background
   tabs. Each tab returns a `tabId` (string), `title`, `url`, `active` flag,
   and `supported` flag (only HTTP/HTTPS tabs are supported).
3. Choose the tab you want to work on.
4. Pass that `tabId` into subsequent read, action, batch, and navigation
   calls. Thread the **same** `tabId` through every call until you
   intentionally switch tabs.
5. Re-read page context with `read_current_page` after navigation or any other
   change that may invalidate the page snapshot — element IDs are short-lived
   and expire when the page changes.

```
→ list_browsers
← { browsers: [{ browserInstanceId: "chrome-abc123", name: "Chrome" }] }

→ list_tabs(browserInstanceId: "chrome-abc123")
← { tabs: [
    { tabId: "97212078", title: "Brijio Demo", url: "https://brijio.dev/demo", active: false, supported: true },
    { tabId: "58193042", title: "Google",      url: "https://google.com",      active: true,  supported: true }
  ] }

→ read_current_page(tabId: "97212078")
→ click_element(kind: "link", id: "e5", tabId: "97212078")
→ navigate_to_url(url: "https://example.com", tabId: "97212078")
```

**Important**: `tabId` is a string (e.g. `"97212078"`), not a number. Pass the
exact value returned by `list_tabs` or `open_tab`.

### Active-tab fallback

When no `tabId` is provided, tools operate on the active foreground tab. This
is the right default when there is no tab ambiguity (the user says "do X on
this page"). When the user refers to a specific tab — especially a background
one — call `list_tabs` first and pass the `tabId` to every subsequent call.

### When to use `tabId`

| Scenario                                                      | Use `tabId`?                                           |
| ------------------------------------------------------------- | ------------------------------------------------------ |
| User says "read the Brijio tab" (not the active tab)          | Yes                                                    |
| User refers to a background tab by name or URL                | Yes                                                    |
| User says "do X on the tab I have open"                       | Yes — call `list_tabs` first to find the right `tabId` |
| User says "do X on this page" (no tab ambiguity)              | No — active tab is fine                                |
| Agent opened a tab via `open_tab` and wants to continue on it | Yes — pass the returned `tabId` to subsequent calls    |

## Opening new tabs

The `open_tab` tool opens a new browser tab at a given HTTP(S) URL and returns
the new `tabId`. Use it when a workflow requires two pages open simultaneously
(e.g. comparison tasks, cross-referencing) without disrupting the user's
current tab.

`open_tab` fills the gap between `navigate_to_url` (which navigates the
current tab and destroys page state such as form input or scroll position)
and `fetch_resource` (which retrieves raw HTML without JavaScript rendering).
The agent opens a new tab, reads it, and interacts with it if needed while the
original tab stays untouched. The user sees the new tab appear in their
browser — this is inherently visible and non-destructive, so no extra banner
is needed beyond the existing tab indicator that appears when the agent
targets the new tab with a subsequent action.

### Tool behavior

- Input: `url` (required, HTTP/HTTPS only), `browserInstanceId` (optional).
- Only `http:` and `https:` URLs are accepted; other schemes return
  `unsupported_scheme`.
- Returns `{ tabId, url, title }` where `title` may be empty until the page
  loads.
- The response resolves immediately after `tabs.create()` — it does **not**
  wait for the page to fully load. Call `read_current_page` on the new tab to
  verify it loaded and to get fresh element IDs.
- The new tab may not be the active foreground tab. Always pass the returned
  `tabId` to subsequent calls; omitting it could target the wrong page.

### When to use `open_tab`

- The user asks to "open this in a new tab" or "open a new tab to …".
- You need to keep the current page intact while working on a second page
  (comparing two pages, cross-referencing data from two sources).
- A skill workflow (e.g. comparison) requires two pages open simultaneously in
  the same browser.
- You need a screenshot of a specific page — see [Screenshots](#screenshots).

### When not to use `open_tab`

- You just need to navigate the current tab — use `navigate_to_url` instead
  (it navigates the current tab, which is simpler and less intrusive).
- The user is already on the target page — just `read_current_page`.
- You need to follow a click path on the current page — use `click_element`.

### Errors

| Error Code            | Cause                                                       |
| --------------------- | ----------------------------------------------------------- |
| `unsupported_scheme`  | URL is not `http:` or `https:`                              |
| `open_tab_failed`     | Browser reported an error creating the tab                  |
| `not_supported`       | The connected browser extension does not support `open_tab` |
| `browser_unavailable` | No browser extension connected                              |
| `connection_failed`   | Could not reach the Brijio WebSocket server                 |

### Implementation path

`open_tab` (ADR 0063) mirrors `navigate_to_url` in shape. The MCP tool in
`open-tab-tool.ts` validates the URL and scheme, then calls
`page-actions.openNewTab`, which builds an `open_tab` envelope through
`websocket-client.requestOpenTab`. The WebSocket relay forwards it to the
extension like any other request. The extension's `PageOpenTabAdapter.openTab`
calls `chrome.tabs.create({ url })` (Chrome) or `browser.tabs.create({ url })`
(Safari) and returns the new tab's ID; both browsers implement the same
adapter interface for parity. If no `PageOpenTabAdapter` is provided the
background controller responds with `not_supported`. The agent cannot close
tabs it opens (`close_tab` and tab ownership tracking are deferred to P2.5);
use `list_tabs` to discover tabs that were opened.

## Screenshots

`capture_screenshot` (ADR 0064) captures a viewport-only JPEG (quality 80) of
the **active tab** and returns it as MCP image content for vision-capable
agents.

### Active-tab only by design

`captureVisibleTab` can only capture the visible tab in a window; capturing a
background tab would require switching focus, which is user-disruptive. The
tool therefore operates on the active tab even when `tabId` is provided — the
parameter exists for forward compatibility but the P3.3 implementation
validates that the requested tab is the active one.

**To screenshot a specific tab, the agent should `open_tab` to create a
dedicated tab, then call `capture_screenshot` on it.** This is the
recommended pattern whenever the target page is not already the active
foreground tab.

### Tool behavior

- Input: `browserInstanceId` (optional), `tabId` (optional, must match the
  active tab if provided).
- Returns MCP image content (`type: 'image'`, `mimeType: 'image/jpeg'`) plus a
  JSON text block with `width`, `height`, `tabId`, and `capturedAt`.
- On failure the tool returns an `isError: true` text result with the
  structured error code and message.
- Full-page scroll-stitch is out of scope for P3.3 (deferred to P4.5).

### Errors

| Error Code                 | Cause                                                                        |
| -------------------------- | ---------------------------------------------------------------------------- |
| `capability_not_supported` | Extension provides no `PageScreenshotAdapter`, or a runtime permission error |
| `capture_failed`           | `captureVisibleTab` failed for a non-permission reason                       |
| `no_visible_tab`           | No visible tab in the current window                                         |
| `timeout`                  | Capture did not complete in time                                             |

## Where `tabId` is threaded

Each tool normalizes its optional `tabId` input and passes it to
`page-actions`, which resolves it against `config.defaultTabId` when omitted
and hands it to `requestBrijio`. `targetEnvelope` then adds `tabId` to the
request envelope's `target` field only when it is defined, so the active-tab
default is encoded as an absent target rather than a sentinel. This applies
uniformly to reads (`read_current_page`, `read_resource`), navigation
(`navigate_to_url`, `open_tab`), clicks/fills/forms (`click_element`,
`fill_input`, `fill_editable`, `set_checked`, `select_options`, `submit_form`,
`upload_file`), `perform_batch`, `download_status`, `download_file`,
`fetch_resource`, `list_tabs`, and `capture_screenshot`.

## What to watch for when editing this area

- If you change any MCP tool that touches page state, confirm whether it
  should accept `tabId` and thread it through `page-actions` and
  `websocket-client`.
- Update the `using-brijio` and `navigation` skills together with tool
  behavior changes — they are the agent-facing workflow guidance.
- Keep the fallback behavior in mind: when no `tabId` is provided, the system
  uses the active tab.
- After navigation on a targeted tab, re-read that same tab to get fresh
  element IDs — navigation invalidates the previous page snapshot.
- `capture_screenshot` remains active-tab only; do not relax that constraint
  without addressing the focus-switching disruption it exists to avoid.

## Related docs

- [MCP ↔ WebSocket ↔ Extension Flow](../architecture/mcp-extension-flow.md) —
  the end-to-end runtime path each tool call follows, including screenshot
  capture and error-code forwarding.
- [Client-Side Action Approval Workflow](./action-approval.md) — which actions
  require user approval regardless of which tab they target.
- [Data and Protocol](../data-and-protocol.md) — the `open_tab` /
  `open_tab_response` and `capture_screenshot` / `screenshot_response`
  protocol message pairs.
