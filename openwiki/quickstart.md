---
type: "Reference"
title: "OpenWiki Quickstart"
description: "Entry point for the Brijio OpenWiki knowledge base. Explains what the repository is, states the core reactive model, and routes readers to the right architecture, concept, workflow, or operations page for their task."
tags: ["quickstart", "navigation", "routing", "brijio"]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-07T14:40:48.642Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-9b8357af9c7ef75912f57765
    resource: repo://docs/project/CAPABILITY_MATRIX.md
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
generated: { by: "openwiki/0.9.0", at: "2026-11-07T14:40:48.642Z" }
---

# OpenWiki Quickstart

Brijio connects remote AI agents to the browser session a user already controls.
It is a pnpm TypeScript monorepo that bridges agents to a live, authenticated
browser through an explicit request/response chain — without launching a
separate browser, cloning sessions, exporting cookies, or streaming
screenshots.

## Core reactive model

The system is intentionally reactive, not a background feed:

- The browser extension connects **only after explicit user action** (the user
  starts the bridge from the extension popup). It does not auto-attach or stay
  connected silently in the background.
- Agents must **ask for browser state or perform actions through the MCP
  server**. There is no continuous streaming of screenshots, page updates, DOM
  changes, or browser history, and no background surveillance.
- Browser state is available only while the user-controlled extension is
  connected; every read or action is initiated by an explicit MCP tool or
  resource request and answered with a structured result.

These are non-negotiable product invariants from `AGENTS.md`; the
[Security and Trust Model](security.md) records the corresponding non-goals
(no cookie export, session cloning, credential extraction, MFA interception, or
ambient surveillance).

## How the pieces fit together

The runtime path of a single request is:

```text
Agent -> MCP Server -> WebSocket Relay -> Browser Extension -> Browser Session
```

1. The user manually connects the browser extension, authenticating with the
   local pairing token.
2. An agent calls an MCP tool or resource on the MCP server.
3. The MCP server forwards the request to the WebSocket relay.
4. The relay routes the request to the connected extension by browser instance
   (and, per call, by `tabId`).
5. The extension reads or acts on the live browser tab and returns a structured
   result back up the chain.

The four source pieces backing this chain:

- `servers/mcp` — exposes MCP tools, resources, prompts, and skills for agents.
- `servers/websocket` — relays requests between the MCP server and connected
  browser extensions; authenticates with the local pairing token and tracks
  runtime-only presence.
- `clients/extensions/chrome` and `clients/extensions/safari` — the
  browser-side bridge, thin adapters over shared logic; `clients/extensions/firefox`
  is a reserved, unimplemented boundary.
- `packages/shared` — the shared protocol envelope and browser-agnostic logic
  (page reading, the background controller that drives both adapters).

## Sources of truth

- **Product contract:** [Capability Matrix](../docs/project/CAPABILITY_MATRIX.md)
  and [Roadmap](../docs/project/ROADMAP.md) — what is implemented, planned,
  experimental, or intentionally unsupported.

<!-- openwiki: broken internal link [../docs/architecture/decisions] file "../docs/architecture/decisions" does not exist. Fix the href or restore the target, then delete this comment. -->

- **Design history:** [ADR decisions](../docs/architecture/decisions) — an ADR
  is required before implementing changes to a capability, protocol, boundary,
  auth/routing, or trust assumption.
- **Security intent:** [Security and Trust Model](security.md) and
  `docs/security/*`.
- **Executable behavior:** source code and tests are the authority; if docs
  disagree with code, treat the discrepancy rather than silently choosing one.

## Task-routing map

Find your task, then read the linked page(s) before changing code.

| If your task is…                                                                                                                             | Read this first                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Understanding the end-to-end request path (agent call → relay → extension → response)                                                        | [MCP ↔ WebSocket ↔ Extension Flow](architecture/mcp-extension-flow.md)          |
| Relay auth, pairing tokens, browser presence, and message routing                                                                            | [WebSocket Relay: Auth, Presence, and Routing](architecture/websocket-relay.md) |
| High-level architecture and per-layer ownership                                                                                              | [Architecture Overview](architecture.md)                                        |
| The agent-facing MCP tools, resources, skills, prompts, HTTP transport, daemon/CLI lifecycle                                                 | [MCP Tool and Skill Surface](concepts/mcp-tool-surface.md)                      |
| How Chrome and Safari extensions wrap the shared controller, platform differences (MV2/MV3, `browser.*` vs `chrome.*`, persistence, capture) | [Browser Extension Adapters](concepts/browser-adapters.md)                      |
| Changing tab-aware tools or anything using per-call `tabId` targeting                                                                        | [Multi-tab Workflow](workflows/multi-tab.md)                                    |
| Approval-gated actions, the `actionUUID`/`approvalRequest` protocol, session-scoped grants                                                   | [Client-Side Action Approval Workflow](workflows/action-approval.md)            |
| Running Brijio: one-command startup, env vars/token generation, Docker, daemon install                                                       | [Runtime, Configuration, and Deployment](operations/runtime-and-deployment.md)  |
| Knowing which source domain you are touching and the cross-layer change order                                                                | [Major Domains](domains.md)                                                     |
| Shared protocol/data shapes (envelope, roles, presence, capabilities, tabs, action results)                                                  | [Protocol and Data Model Guide](data-and-protocol.md)                           |
| Repo-level dev workflows, per-package verification, ADR change workflow, test strategy                                                       | [Development Workflows and Verification](workflows.md)                          |

## Before you change anything

1. Read this page, then only the links relevant to your task.
2. Inspect the working tree and preserve unrelated user changes.
3. Read the package manifest and tests for the area being changed.
4. If the change touches multiple domains, update the shared protocol or ADR
   **first**, then the relay/server, then the browser adapters and integration
   tests — the full path to check is documented in [Major Domains](domains.md)
   and `AGENTS.md`.
5. For behavior changes, use TDD and run the per-package verification set in
   [Development Workflows and Verification](workflows.md).

Keep this page short — it is the routing entry point, not the canonical home
for details.
