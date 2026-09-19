---
type: Reference
title: OpenWiki Quickstart
description: Entry point for the Brijio OpenWiki knowledge base. Frames what the repository is, how the MCP-WebSocket-extension pieces fit, and routes readers to the correct deeper page by task type.
tags: [quickstart, overview, routing, brijio]
verified:
  - by: openwiki/0.5.2
    at: 2026-09-19T12:17:06.598Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-beb468a32961295d57274fd5
    resource: repo://clients/extensions/firefox/README.md
  - id: openwiki-source-79dd91ec51a55e7e78c52ccc
    resource: repo://docs/architecture/decisions/0064-visual-action-verification.md
  - id: openwiki-source-9b8357af9c7ef75912f57765
    resource: repo://docs/project/CAPABILITY_MATRIX.md
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-5524638d57e96598fd8e40d4
    resource: repo://packages/shared/src/background-controller.ts
  - id: openwiki-source-c20cbcf46daa07e6332e3f7f
    resource: repo://packages/shared/src/protocol.ts
  - id: openwiki-source-40275cb92c3610938f16ade3
    resource: repo://pnpm-workspace.yaml
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-fc4b25ba659ae4c102750c8d
    resource: repo://servers/mcp/src/websocket-client.ts
  - id: openwiki-source-875036d8e83469fa1fc3f8e3
    resource: repo://servers/websocket/src/server.ts
generated: { by: "openwiki/0.5.2", at: "2026-09-19T12:17:06.598Z" }
---

# OpenWiki Quickstart

Brijio connects remote AI agents to the browser session a user already controls.
Instead of launching a separate browser, cloning sessions, exporting cookies, or
streaming screenshots, Brijio routes **explicit, per-call requests** through a
local relay to a user-started browser extension. The canonical runtime chain is:

```text
Agent -> MCP Server -> WebSocket Relay -> Browser Extension -> Browser Session
```

The browser remains the source of truth. The extension is reactive: it answers
explicit requests and returns structured results; it never publishes ambient
browser state. Every read or action is initiated by an explicit MCP tool or
resource call, targeted per-call at a specific `browserInstanceId` and optional
`tabId`, and answered with structured success data or a typed error.

## What this repository is

A pnpm TypeScript monorepo (workspace pinned to `pnpm@10.32.1`, Node `>=22.0.0`)
with three package roots — `packages/*`, `servers/*`, `clients/extensions/*`:

- `packages/shared` — shared protocol shapes and browser-agnostic logic
  (`protocol.ts`, `background-controller.ts`, page readers, handlers). Protocol
  definitions live here and must not be duplicated.
- `servers/websocket` — the local relay: pairing-token auth, in-memory browser
  presence, and request routing between MCP and extension sockets.
- `servers/mcp` — the agent-facing MCP surface: tools, resources, a prompt, and
  the skills catalog under `servers/mcp/skills`.
- `clients/extensions/chrome` and `clients/extensions/safari` — thin platform
  adapters over the shared background controller (Chrome MV3, Safari MV2).
- `clients/extensions/firefox` — a placeholder only; Firefox is planned, not
  implemented, and needs a separate ADR before implementation.

The product contract (what is implemented, planned, or intentionally
unsupported per browser) lives in `docs/project/CAPABILITY_MATRIX.md`; do not
copy that mutable inventory here.

## How the pieces fit together

The runtime path for a single request:

1. The user manually connects the browser extension (no background auto-connect).
2. The MCP server receives a tool/resource call from an agent.
3. The MCP relay client opens a **per-request** WebSocket, authenticates with the
   pairing token, and sends the targeted envelope.
4. The relay selects the target browser by `browserInstanceId` and forwards the
   message (preserving `target.tabId`) to the connected extension.
5. The extension's shared background controller reads or acts on the targeted tab
   and returns a structured result, routed back through the relay to the waiting
   MCP socket, which closes after the round trip.

Targeting is stateless and per-call: `browserInstanceId` and `tabId` are passed
on each request, with no session-level "selected browser" or "selected tab". When
`tabId` is omitted, every layer falls back to the active foreground tab.

## Where to go next (task-routing map)

Follow only the link relevant to the task:

| If your task is…                                                                                             | Read this page                                                         |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Understanding the runtime chain, core components, or layer-level change guidance                             | [Architecture Overview](architecture.md)                               |
| Tracing one request end-to-end (MCP → relay → extension → tab), tab targeting, or screenshot/action dispatch | [MCP ↔ WebSocket ↔ Extension Flow](architecture/mcp-extension-flow.md) |
| Changing a protocol shape, envelope, payload, or data model                                                  | [Protocol and Data Model Guide](data-and-protocol.md)                  |
| Scoping a change to the right layer or understanding domain ownership                                        | [Major Domains](domains.md)                                            |
| Trust boundaries, auth, action approval, or what is intentionally withheld                                   | [Security and Trust Model](security.md)                                |
| Commands, per-domain verification, dev lifecycle, Docker, ADR/TDD conventions                                | [Workflows](workflows.md)                                              |
| Using or changing tab-aware tools (`list_tabs`, `open_tab`, `tabId` threading)                               | [Multi-tab Workflow](workflows/multi-tab.md)                           |

External sources of truth (not owned by OpenWiki):

- Current capability/support status and intentional boundaries:
  `docs/project/CAPABILITY_MATRIX.md`.
- Product direction: `docs/project/ROADMAP.md`.
- Architectural decisions and history: `docs/architecture/decisions`.
- Security intent: `docs/security`.
- Agent conventions and invariants: `AGENTS.md`.

## Notes before changing anything

- **Cross-layer change path** (from `AGENTS.md`): when a protocol or browser
  capability changes, check the whole path in order —
  `shared protocol -> WebSocket relay -> MCP surface -> shared controller ->
Chrome adapter -> Safari adapter -> integration tests`. Protocol definitions
  belong in `packages/shared` and must not be duplicated.
- **Non-negotiable invariants**: the user starts/stops the bridge; no continuous
  streaming or background surveillance; no cookie export, session cloning,
  credential extraction, or MFA interception; every browser read/action is
  initiated by an explicit MCP request; preserve per-call `browserInstanceId` and
  `tabId` targeting; preserve client-side action approval; keep permissions
  minimal. Password fields return `browser_error` on fill attempts.
- **Process**: use TDD for behavior changes; write an ADR (marked `Proposed`,
  with diagrams when flow is relevant) before implementing a
  behavior/protocol/trust-boundary change and wait for approval before
  implementing; keep documentation linked rather than copying mutable
  inventories. When tool behavior changes, update its tests, MCP registration,
  relevant skills, the capability matrix, and the relevant OpenWiki pages
  together.
- Keep this page short — it is the entrypoint, not the canonical home for every
  detail. Deeper pages own the specifics.
