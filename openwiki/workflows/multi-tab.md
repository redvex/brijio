---
type: "Reference"
title: "Multi-tab Workflow"
description: "How agents use explicit per-call tabId targeting for reads, actions, batch operations, and navigation. Covers list_tabs, open_tab, and the recommended multi-tab workflow."
---

# Multi-tab Workflow

Brijio now supports explicit per-call tab targeting through `tabId` for the main browser interaction path.

## Canonical source files

- `servers/mcp/skills/using-brijio/SKILL.md`
- `servers/mcp/skills/navigation/SKILL.md`
- `servers/mcp/src/list-tabs-tool.ts`
- `servers/mcp/src/open-tab-tool.ts`
- `servers/mcp/src/page-reading-tool.ts`
- `servers/mcp/src/page-actions.ts`
- `servers/mcp/src/navigate-to-url-tool.ts`
- `servers/mcp/src/batch-tool.ts`
- `packages/shared/src/background-controller.ts`
- `packages/shared/src/page-reader.ts`

## Recommended workflow

1. Call `list_tabs` to discover connected browser tabs.
2. Choose the tab you want to work on.
3. Pass that tab's `tabId` into subsequent read, action, batch, and navigation calls.
4. Keep using the same `tabId` until you intentionally switch tabs.
5. Re-read page context after navigation or other changes that may invalidate the page snapshot.

## Opening new tabs

The `open_tab` tool opens a new browser tab at a given HTTP(S) URL and returns
the new `tabId`. Use it when a workflow requires two pages open simultaneously
(e.g., comparison tasks, cross-referencing) without disrupting the user's
current tab. The returned `tabId` should be passed to all subsequent reads and
actions on the new tab.

Source files:

- `servers/mcp/src/open-tab-tool.ts`
- `servers/mcp/skills/navigation/SKILL.md` (workflow guidance)

## Why this matters

The recent tabId work makes multi-tab behavior explicit instead of implicit. That reduces ambiguity when an extension has more than one connected tab and lets agents keep a stable tab target across a workflow.

## What to watch for when editing this area

- If you change any MCP tool that touches page state, confirm whether it should accept `tabId`.
- Update the `using-brijio` and `navigation` skills together with tool behavior changes.
- Keep the fallback behavior in mind: when no `tabId` is provided, the system uses the active tab.

## Related docs

- [Architecture: MCP ↔ WebSocket ↔ Extension flow](../architecture/mcp-extension-flow.md)
- [Capability matrix](../../docs/project/CAPABILITY_MATRIX.md)
- [Roadmap](../../docs/project/ROADMAP.md)
