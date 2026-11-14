---
type: Reference
title: OpenWiki Quickstart
description: Entry point for the Brijio OpenWiki knowledge base. States what the repository is, how the MCP-WebSocket-extension pieces fit together, and routes readers to the right page by task type.
tags: [quickstart, overview, routing, brijio]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-14T14:46:23.462Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-2b66c8e72b793ad548b86a29
    resource: repo://docs/architecture/decisions/0062-thread-tabid-through-action-stack.md
  - id: openwiki-source-5524638d57e96598fd8e40d4
    resource: repo://packages/shared/src/background-controller.ts
  - id: openwiki-source-c20cbcf46daa07e6332e3f7f
    resource: repo://packages/shared/src/protocol.ts
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-36c61251055ea6d2f82f0b4e
    resource: repo://servers/mcp/src/mcp-server.ts
generated: { by: "openwiki/0.9.0", at: "2026-11-14T14:46:23.462Z" }
---

# OpenWiki Quickstart

Brijio connects remote AI agents to the browser session the user already
controls. Instead of launching a separate browser, cloning sessions, exporting
cookies, or streaming screenshots, Brijio relays short-lived, explicit requests
to the user's authenticated browser and returns structured results to the agent.
The design is intentionally **user-controlled and privacy-first**: the browser
extension connects only after explicit user action, the browser never streams
ambient state, and every read or action is initiated by an explicit MCP tool or
resource request.

This is the entry point for the Brijio OpenWiki knowledge base. It is short on
purpose — it routes you to the dedicated page for each kind of change rather
than duplicating their detail.

## What this repository is

A pnpm TypeScript monorepo for the browser-bridge product, organized into
major domains (see [Major Domains](domains.md) for ownership boundaries):

- `packages/shared` — shared protocol shapes and browser-agnostic page-reading
  and background-controller logic.
- `servers/mcp` — agent-facing MCP tools, resources, prompts, and skills.
- `servers/websocket` — the relay that authenticates and routes requests
  between the MCP server and connected browser extensions.
- `clients/extensions/chrome`, `clients/extensions/safari`,
  `clients/extensions/firefox` — the browser-side bridge packages.

The product framing and non-negotiable invariants live in
[AGENTS.md](../AGENTS.md); the canonical product contract (what is
implemented, planned, or intentionally unsupported) is
[CAPABILITY_MATRIX.md](../docs/project/CAPABILITY_MATRIX.md), and design
<!-- openwiki: broken internal link [../docs/architecture/decisions] file "../docs/architecture/decisions" does not exist. Fix the href or restore the target, then delete this comment. -->

history is in the [ADR directory](../docs/architecture/decisions).

## How the pieces fit together

The runtime path is a single explicit request/response chain — no continuous
streaming:

1. The user manually starts the bridge from the browser extension.
2. The extension authenticates to the WebSocket relay with a pairing token and
   announces browser presence.
3. The MCP server (also a relay client, authenticated with the same token)
   receives a tool call from an agent.
4. The MCP server forwards the request to the relay, targeted by
   `browserInstanceId` and optional `tabId`.
5. The relay delivers the request to the connected extension, which reads or
   acts on the target browser tab and returns a structured result.

Reads, actions, batch operations, and navigation all accept an optional
`tabId` for multi-tab targeting; when `tabId` is omitted, the system falls back
to the active tab. See the full end-to-end path in
[MCP to WebSocket to Extension Flow](architecture/mcp-extension-flow.md) and
the agent-facing surface in [MCP Tool and Skill Surface](architecture/mcp-tool-surface.md).

## Route by task type

Use this map to find the right page for the change you are making.

| If you are changing…                         | Go to                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| Protocol or shared data structures           | [Protocol and Data Model Guide](data-and-protocol.md)                    |
| An MCP tool or skill                         | [MCP Tool and Skill Surface](architecture/mcp-tool-surface.md)           |
| The MCP → relay → extension request path     | [MCP to WebSocket to Extension Flow](architecture/mcp-extension-flow.md) |
| An extension adapter (Chrome/Safari/Firefox) | [Browser Extension Adapters](architecture/extension-adapters.md)         |
| Approval behavior for high-risk actions      | [Action Approval Workflow](workflows/action-approval.md)                 |
| Multi-tab targeting or `tabId` threading     | [Multi-tab Workflow](workflows/multi-tab.md)                             |
| Running, installing, or operating locally    | [Daemon and Runtime Operations](operations/daemon-and-runtime.md)        |
| Verifying a change                           | [Testing Strategy](testing.md)                                           |
| Build, ADR, TDD, or change-order workflows   | [Workflows](workflows.md)                                                |
| Trust boundaries or security posture         | [Security and Trust Model](security.md)                                  |
| Overall layer ownership                      | [Architecture Overview](architecture.md)                                 |

## Sources of truth

- **Executable behavior:** source code and tests.
- **Current product contract:** [CAPABILITY_MATRIX.md](../docs/project/CAPABILITY_MATRIX.md).

<!-- openwiki: broken internal link [../docs/architecture/decisions] file "../docs/architecture/decisions" does not exist. Fix the href or restore the target, then delete this comment. -->

- **Architectural decisions and design history:** [ADR directory](../docs/architecture/decisions).
- **Security intent and trust boundaries:** [Security and Trust Model](security.md) and `docs/security`.
- **Repository navigation and cross-component workflows:** this OpenWiki.
- **Public setup and usage:** the root [README](../README.md) and package
  `README.md` files.

## Notes for future changes

- If you change tool inputs or the extension request path, update the
  architecture page and the multi-tab workflow page together.
- This page is the entrypoint, not the canonical home for detail — keep it
  short and link out.
