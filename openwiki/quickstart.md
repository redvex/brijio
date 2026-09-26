---
type: Quickstart
title: OpenWiki Quickstart
description: Entry point for the Brijio OpenWiki knowledge base — what the repository is, the Agent -> MCP server -> WebSocket relay -> browser extension -> browser session chain, and where to go next by task.
tags:
  [quickstart, overview, entry-point, brijio, mcp, websocket, browser-extension]
verified:
  - by: openwiki/0.6.0
    at: 2026-09-26T12:40:26.126Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-beb468a32961295d57274fd5
    resource: repo://clients/extensions/firefox/README.md
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-40275cb92c3610938f16ade3
    resource: repo://pnpm-workspace.yaml
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
generated: { by: "openwiki/0.6.0", at: "2026-09-26T12:40:26.126Z" }
---

# OpenWiki Quickstart

Brijio is a pnpm TypeScript monorepo that bridges remote AI agents to the browser session a user already controls. Instead of launching a separate browser, cloning sessions, exporting cookies, or streaming screenshots, agents collaborate with the user's authenticated browser through explicit requests. The browser remains the source of truth.

## The runtime chain

Every agent action travels a short, explicit request/response path — there is no continuous streaming and no background surveillance:

```text
Agent -> MCP Server (HTTP StreamableHTTP) -> WebSocket Relay -> Browser Extension -> Browser Session
```

1. The user manually connects the browser extension.
2. The agent calls an MCP tool or resource on the MCP server (`servers/mcp`).
3. The MCP server opens a short-lived WebSocket to the relay (`servers/websocket`) and targets a browser (and optionally a tab).
4. The relay forwards the envelope to the connected extension that announced presence for the same pairing token.
5. The extension's shared background controller dispatches the read/action/navigation/download/screenshot work, the browser adapter performs it, and the structured result flows back.

Brijio is intentionally **reactive and privacy-first**: the browser extension connects only after explicit user action, and agents must explicitly ask for browser state or perform actions. There is no continuous page, DOM, screenshot, history, or browser-state streaming, and the project will not add cookie export, session cloning, credential extraction, MFA interception, or silent background surveillance.

## What the repository is

A pnpm workspace (Node ≥ 22, pnpm ≥ 9) with three package roots declared in `pnpm-workspace.yaml`:

- `packages/shared` — the single source of truth for the protocol envelope, presence, capabilities, tab targeting, and browser-agnostic logic (page context, page reader, the shared background controller). Nothing here imports from servers or clients.
- `servers/websocket` — the local relay: pairing-token auth, in-memory presence, scope-key routing, and pending-request correlation between MCP and extension sockets.
- `servers/mcp` — the agent-facing MCP surface: tools, resources, the `brijio-context` prompt, the skills system, the HTTP transport, and the daemon/doctor/banner entrypoints.
- `clients/extensions/chrome` and `clients/extensions/safari` — the shipped browser extensions, which reuse the shared controller and keep only thin platform adapters. **Firefox is a placeholder only** (`clients/extensions/firefox` reserves the boundary; support is planned, not implemented, and requires a separate ADR before implementation).

## Where to go next (routing by task)

| If your task is…                                                          | Read this page                                                                                                  |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| End-to-end runtime flow or changing the request path                      | [architecture/mcp-extension-flow.md](architecture/mcp-extension-flow.md) and [architecture.md](architecture.md) |
| The agent-facing surface — tools, resources, prompts, skills              | [architecture/mcp-tools-and-skills.md](architecture/mcp-tools-and-skills.md)                                    |
| Message shapes, the WebSocket envelope, presence, tabs, downloads         | [data-and-protocol.md](data-and-protocol.md)                                                                    |
| Trust/approval boundaries, threat model, non-goals                        | [security.md](security.md)                                                                                      |
| Build/test commands, ADR/TDD conventions, change patterns                 | [workflows.md](workflows.md)                                                                                    |
| Explicit `tabId` targeting across reads, actions, batch, navigation       | [workflows/multi-tab.md](workflows/multi-tab.md)                                                                |
| Client-side approval for `submit_form`, `fetch_resource`, `download_file` | [workflows/action-approval.md](workflows/action-approval.md)                                                    |
| Local dev, daemon install/start/stop, Docker, env vars, health            | [operations/runtime-and-deployment.md](operations/runtime-and-deployment.md)                                    |
| Domain ownership and cross-layer change propagation                       | [domains.md](domains.md)                                                                                        |

For product framing, capability status, and design history, the external sources of truth are `README.md`, `docs/project/CAPABILITY_MATRIX.md`, `docs/project/ROADMAP.md`, `docs/security/`, and `docs/architecture/decisions/`.

## Notes for future changes

- Keep this page short; it is the entry point, not the canonical home for every detail. Route depth to the pages above.
- If you change tool inputs or the extension request path, update [architecture/mcp-extension-flow.md](architecture/mcp-extension-flow.md) and [workflows/multi-tab.md](workflows/multi-tab.md) together.
- If you add or change an agent-facing tool/resource/skill, update [architecture/mcp-tools-and-skills.md](architecture/mcp-tools-and-skills.md).
- Cross-domain changes propagate `shared protocol -> relay -> MCP surface -> shared controller -> Chrome/Safari adapters -> tests`; see [domains.md](domains.md) for the ownership map.
