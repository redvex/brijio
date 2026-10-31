---
type: Reference
title: OpenWiki Quickstart
description: Entry point for the Brijio OpenWiki knowledge base. Covers what the repository is, how the MCP-WebSocket-extension pieces fit together, and where to go next by task.
tags: [brijio, quickstart, routing, overview]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-31T14:18:08.591Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-beb468a32961295d57274fd5
    resource: repo://clients/extensions/firefox/README.md
  - id: openwiki-source-9b8357af9c7ef75912f57765
    resource: repo://docs/project/CAPABILITY_MATRIX.md
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-40275cb92c3610938f16ade3
    resource: repo://pnpm-workspace.yaml
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
generated: { by: "openwiki/0.7.2", at: "2026-10-31T14:18:08.591Z" }
---

# OpenWiki Quickstart

Brijio connects remote AI agents to the browser session the user already controls. The system is intentionally reactive: the browser extension connects only after explicit user action, and agents must ask for browser state or perform actions through explicit MCP tool or resource requests. There is no continuous page, DOM, screenshot, history, or browser-state streaming.

Start here if you want to understand the repo quickly; then follow the routing map below by task area.

- [Architecture: MCP ↔ WebSocket ↔ extension flow](architecture/mcp-extension-flow.md)
- [Major domains](domains.md)
- [Capability matrix](../docs/project/CAPABILITY_MATRIX.md)
- [Roadmap](../docs/project/ROADMAP.md)
- [Root README](../README.md)
- [Agent instructions and non-negotiable invariants](../AGENTS.md)

## What this repository is

This is a pnpm TypeScript monorepo (pnpm `10.32.1`, Node `>=22`) for a user-controlled browser-bridge product. The workspace packages are:

- `servers/mcp` — exposes MCP tools, resources, prompts, and skills for agents.
- `servers/websocket` — relays authenticated requests between the MCP server and connected browser extensions; owns presence and routing.
- `clients/extensions/chrome` and `clients/extensions/safari` — the browser-side bridge, sharing logic from `@brijio/shared` with thin per-platform adapters.
- `clients/extensions/firefox` — a placeholder reserving the client boundary; not yet implemented.
- `packages/shared` — shared protocol shapes and page-reading logic.

Do not copy the capability matrix or mutable file trees here; the [capability matrix](../docs/project/CAPABILITY_MATRIX.md) is the single source of truth for what is implemented, planned, or intentionally unsupported, and the [roadmap](../docs/project/ROADMAP.md) captures direction.

## How the pieces fit together

The basic runtime path is:

1. The user manually connects the browser extension (no background auto-connect).
2. The MCP server receives a tool call from an agent.
3. The MCP server forwards the request to the WebSocket relay.
4. The relay delivers the request to the connected extension.
5. The extension reads or acts on the browser tab and returns a structured result.

The extension is reactive: it answers explicit requests and returns structured results; it does not publish ambient browser state. Per-call `tabId` targeting is threaded through the MCP tool wrappers, relay protocol, background controller, and browser adapters; when `tabId` is omitted, the system falls back to the active tab.

## Where to go next

Route by the task you are performing:

| Task                                                                                       | Read first                                                                                                        |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Understand the end-to-end request path and main source files                               | [Architecture overview](architecture.md) · [MCP ↔ WebSocket ↔ extension flow](architecture/mcp-extension-flow.md) |
| Change tab-aware tools, reads, actions, batch, or navigation                               | [Multi-tab workflow](workflows/multi-tab.md)                                                                      |
| Change an approval-gated browser action (`submit_form`, `fetch_resource`, `download_file`) | [Client-side action approval workflow](workflows/action-approval.md)                                              |
| Run, configure, or inspect the daemon, health, or diagnostics                              | [Operations](operations.md)                                                                                       |
| Change auth, routing, or browser-state exposure                                            | [Security and trust model](security.md)                                                                           |
| Find the major source domains and ownership boundaries                                     | [Major domains](domains.md)                                                                                       |
| Use common `pnpm` commands, per-domain verification, or ADR/TDD conventions                | [Workflows](workflows.md)                                                                                         |
| Understand the shared protocol and data model                                              | [Protocol and data model guide](data-and-protocol.md)                                                             |

## Notes for future changes

- Treat [AGENTS.md](../AGENTS.md) as the authority for the non-negotiable invariants: user-controlled bridge activation, explicit request/response model, no streaming or background surveillance, and configured client-side action approval that must not be bypassed.
- Architectural decisions live in `docs/architecture/decisions`; check existing ADRs before changing a protocol, capability, or trust boundary, and follow the ADR workflow in AGENTS.md.
- If you change tool inputs or the extension request path, update the relevant architecture and workflow pages together.
- Keep this page short; it is the entrypoint, not the canonical home for every detail.
