# OpenWiki Quickstart

Brijio connects remote AI agents to the browser session the user already controls. The system is intentionally reactive: the browser extension connects only after explicit user action, and agents must ask for browser state or perform actions through the MCP server.

Start here if you want to understand the repo quickly:

- [Architecture: MCP ↔ WebSocket ↔ extension flow](architecture/mcp-extension-flow.md)
- [Workflow: multi-tab and `tabId` targeting](workflows/multi-tab.md)
- [Capability matrix](../docs/project/CAPABILITY_MATRIX.md)
- [Roadmap](../docs/project/ROADMAP.md)
- [Root README](../README.md)
- [OpenWiki reference in AGENTS.md](../AGENTS.md)

## What this repository is

This is a pnpm TypeScript monorepo for a browser-bridge product:

- `servers/mcp` exposes MCP tools and skills for agents.
- `servers/websocket` relays requests between the MCP server and connected browser extensions.
- `clients/extensions/chrome` and `clients/extensions/safari` implement the browser-side bridge.
- `packages/shared` holds shared protocol and page-reading logic.

The repository’s current direction is captured in the product docs and recent ADRs. The core design is still user-controlled and privacy-first, with no continuous browser streaming or background surveillance.

## How the pieces fit together

The basic runtime path is:

1. The user manually connects the browser extension.
2. The MCP server receives a tool call from an agent.
3. The MCP server forwards the request to the WebSocket relay.
4. The relay delivers the request to the connected extension.
5. The extension reads or acts on the browser tab and returns a structured result.

Recent changes added explicit multi-tab targeting through `tabId` for reads, actions, batch operations, and navigation. When a `tabId` is provided, it is threaded through the MCP tool wrappers, relay protocol, background controller, and browser adapters; when omitted, the system falls back to the active tab.

## Where to go next

- Read [architecture/mcp-extension-flow.md](architecture/mcp-extension-flow.md) for the end-to-end request path and the main source files.
- Read [workflows/multi-tab.md](workflows/multi-tab.md) before changing tab-aware tools or skills.
- Use the capability matrix and roadmap to understand what is implemented, planned, or intentionally unsupported.

## Notes for future changes

- The source of truth for recent multi-tab behavior is ADR 0062 in `docs/architecture/decisions/`.
- If you change tool inputs or the extension request path, update the architecture page and the multi-tab workflow page together.
- Keep this page short; it is the entrypoint, not the canonical home for every detail.
