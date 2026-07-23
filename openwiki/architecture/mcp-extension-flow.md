---
type: "Reference"
title: "MCP ↔ WebSocket ↔ Extension Flow"
description: "End-to-end runtime path from MCP tool call through the WebSocket relay to the browser extension and back. Covers tab targeting, canonical source files, and editing guidance."
---

# MCP ↔ WebSocket ↔ Extension Flow

This page describes the runtime path Brijio uses to move an agent request from the MCP server to a browser tab and back.

## Canonical source files

- `servers/mcp/src/mcp-server.ts`
- `servers/mcp/src/page-actions.ts`
- `servers/mcp/src/page-reading-tool.ts`
- `servers/mcp/src/navigate-to-url-tool.ts`
- `servers/mcp/src/open-tab-tool.ts`
- `servers/mcp/src/batch-tool.ts`
- `servers/mcp/src/form-action-tools.ts`
- `servers/websocket/src/server.ts`
- `packages/shared/src/background-controller.ts`
- `packages/shared/src/page-reader.ts`
- `clients/extensions/chrome/src/background.ts`
- `clients/extensions/safari/src/background.ts`

## Request flow

1. An agent calls an MCP tool.
2. The MCP tool builds a protocol envelope and forwards it to the WebSocket server.
3. The WebSocket server relays the request to the connected extension session.
4. The extension background layer hands the request to the shared background controller.
5. The background controller dispatches to page reading, navigation, or action handlers.
6. The browser adapter performs the tab-level work and returns structured results.
7. The response is relayed back through the stack to the agent.

## Tab targeting

Recent changes added explicit `tabId` threading through the stack.

- MCP tool wrappers now accept a per-call `tabId` and include it in protocol messages.
- Shared page-reading and action helpers accept `tabId` and prefer it over the active-tab lookup when present.
- Chrome and Safari background adapters now use the provided tab ID for reads and navigation.

When `tabId` is omitted, the system remains backward compatible and falls back to the active tab.

## Why this exists

Brijio is still designed around explicit requests rather than continuous browser mirroring. This flow keeps the browser local, keeps the extension reactive, and makes it possible to target a specific tab without changing the core privacy model.

## What to watch for when editing this area

- A change to tool inputs usually requires updates in `servers/mcp/src/protocol.ts` and the background controller together.
- Extension adapters must stay in sync with the shared page-reader behavior.
- If a tool should work on a background tab, it must accept `tabId` and not assume the active tab.

## Related docs

- [Multi-tab workflow](../workflows/multi-tab.md)
- [Capability matrix](../../docs/project/CAPABILITY_MATRIX.md)
- [ADR 0062](../../docs/architecture/decisions/0062-thread-tabid-through-action-stack.md)
