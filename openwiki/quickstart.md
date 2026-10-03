---
type: "Guide"
title: "OpenWiki Quickstart"
description: "Entry point for the Brijio OpenWiki knowledge base. States what the repository is, how the MCP-WebSocket-extension pieces fit, and routes readers to the architecture, workflow, domain, and security pages by task type."
tags:
  ["quickstart", "routing", "overview", "brijio", "mcp", "browser-extension"]
verified:
  - by: openwiki/0.7.0
    at: 2026-10-03T13:02:39.597Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-0f5d8a945cabdf67f37b9ad7
    resource: repo://clients/extensions/chrome/src/background.ts
  - id: openwiki-source-0ea792c19cab7fadee891dba
    resource: repo://docs/architecture/ARCHITECTURE.md
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-5524638d57e96598fd8e40d4
    resource: repo://packages/shared/src/background-controller.ts
  - id: openwiki-source-40275cb92c3610938f16ade3
    resource: repo://pnpm-workspace.yaml
  - id: openwiki-source-241af4ebfa670c22ce047622
    resource: repo://servers/mcp/src/index.test.ts
  - id: openwiki-source-36c61251055ea6d2f82f0b4e
    resource: repo://servers/mcp/src/mcp-server.ts
  - id: openwiki-source-fc4b25ba659ae4c102750c8d
    resource: repo://servers/mcp/src/websocket-client.ts
  - id: openwiki-source-875036d8e83469fa1fc3f8e3
    resource: repo://servers/websocket/src/server.ts
generated: { by: "openwiki/0.7.0", at: "2026-10-03T13:02:39.597Z" }
---

# OpenWiki Quickstart

Brijio connects remote AI agents to the browser session the user already controls. It is intentionally reactive and privacy-first: the user explicitly starts the bridge, agents must ask for browser state or perform actions through MCP tools, and there is no continuous streaming, mirroring, cookie export, or background surveillance. These invariants are non-negotiable and are spelled out in [AGENTS.md](../AGENTS.md).

This is the Brijio browser-bridge monorepo: a pnpm TypeScript workspace (`pnpm@10`, Node `>=22`) connecting remote AI agents to the user's own browser session via **MCP server → WebSocket relay → browser extension**, with the shared protocol in `packages/shared`:

- `servers/mcp` — agent-facing MCP tools, resources, prompts, and skills.
- `servers/websocket` — state-light relay: pairing-token auth, browser presence, request routing.
- `clients/extensions/chrome` and `clients/extensions/safari` — thin browser adapters around the shared controller. (Firefox is a placeholder only.)
- `packages/shared` — the one shared protocol and browser-agnostic logic everyone imports.

See [Major Domains](domains.md) for ownership boundaries.

## The runtime path in one glance

Every request is an explicit request/response chain, never an ambient stream. The browser stays local and remains the source of truth.

1. The user manually connects the browser extension, which authenticates with a pairing token and announces presence.
2. An agent calls an MCP tool.
3. The MCP server opens a throwaway WebSocket to the relay, authenticates as role `mcp`, and sends one request envelope with explicit `target: { browserInstanceId?, tabId? }`.
4. The relay selects a connected browser from its presence table and forwards the envelope unchanged.
5. The extension's shared background controller dispatches to the matching adapter, threads `tabId` to the tab (active-tab fallback when omitted), and enforces the client-side approval gate for `submit_form`, `download_file`, and `fetch_resource`.
6. The structured result or error relays back by `message.id`; the MCP server forwards original error codes to the agent.

The full chain is detailed in [MCP ↔ WebSocket ↔ Extension Flow](architecture/mcp-extension-flow.md); the protocol shapes in [Protocol and Data Model](data-and-protocol.md).

## The MCP tool surface

The MCP server registers exactly **17 tools**, each accepting optional `browserInstanceId` and `tabId` for per-call targeting (except `open_tab`, which creates a tab and has no `tabId` input):

`list_browsers`, `list_tabs`, `read_current_page`, `click_element`, `fill_input`, `fill_editable`, `set_checked`, `select_options`, `upload_file`, `submit_form`, `navigate_to_url`, `open_tab`, `perform_batch`, `download_status`, `download_file`, `fetch_resource`, `capture_screenshot`.

The surface spans reads, actions, navigation, tabs, batch, downloads, fetch, and screenshot. The current capability contract (implemented, experimental, planned, and intentionally unsupported) is the authority in [docs/project/CAPABILITY_MATRIX.md](../docs/project/CAPABILITY_MATRIX.md); the direction is in [docs/project/ROADMAP.md](../docs/project/ROADMAP.md).

## Task-routing map

Before editing, classify the change and read the matching page first:

| If your task is about...                                     | Read first                                                                          |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Routing, relay, protocol or data-shape changes               | [Architecture](architecture.md) and [Protocol and Data Model](data-and-protocol.md) |
| MCP tool or request/response flow changes                    | [MCP ↔ WebSocket ↔ Extension Flow](architecture/mcp-extension-flow.md)              |
| Tab targeting (`tabId`, multi-tab, `list_tabs` / `open_tab`) | [Multi-tab Workflow](workflows/multi-tab.md)                                        |
| Auth, approval, trust, privacy boundaries                    | [Security and Trust Model](security.md)                                             |
| Dev commands, verification, daemon / operations lifecycle    | [Workflows](workflows.md)                                                           |
| Package ownership — which layer owns what                    | [Major Domains](domains.md)                                                         |

<!-- openwiki: broken internal link [../docs/architecture/decisions] file "../docs/architecture/decisions" does not exist. Fix the href or restore the target, then delete this comment. -->

Most cross-layer changes require an ADR before implementation (a capability, protocol, ownership, auth/routing, browser-lifecycle, or material dependency change). ADRs live in [docs/architecture/decisions](../docs/architecture/decisions); write them as `Proposed` and wait for explicit user approval before implementing.

## Notes for changes

- Keep this page short — it is the routing entry point, not the canonical home for detail. Linked pages hold the depth.
- When tool behavior changes, update its tests, MCP registration, relevant skills, the capability matrix, and the relevant OpenWiki page together.
- If the sources disagree, do not silently choose one — determine what is stale, update it when in scope, and otherwise report it.
