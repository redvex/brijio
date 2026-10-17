---
type: "Reference"
title: "OpenWiki Quickstart"
description: "Entry point for the Brijio OpenWiki knowledge base. States what the repo is, how the MCP-WebSocket-extension pieces fit, the user-controlled/privacy-first invariants, and routes readers to the architecture, workflow, operations, and security pages by task type."
tags: ["quickstart", "overview", "routing", "monorepo", "invariants"]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-17T11:58:52.754Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-9b8357af9c7ef75912f57765
    resource: repo://docs/project/CAPABILITY_MATRIX.md
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
generated: { by: "openwiki/0.7.2", at: "2026-10-17T11:58:52.754Z" }
---

# OpenWiki Quickstart

Brijio connects remote AI agents to the browser session the user already
controls. Instead of launching a separate browser, cloning sessions, exporting
cookies, or streaming screenshots, it routes **explicit, short-lived requests**
to the user's authenticated browser and returns **structured** results to the
agent. The browser remains the source of truth; the extension is reactive, not a
background publisher of ambient state.

This page is the entry point for the OpenWiki knowledge base. It states what the
repository is, summarizes the non-negotiable invariants, and routes you to the
page that matches your task. It does not duplicate the detail of those pages.

## What this repository is

This is a pnpm TypeScript monorepo for the Brijio browser-bridge product.
`package.json` and the workspace package manifests are the authority for runtime
versions, the package-manager version, and available commands; do not copy
mutable tool inventories or file trees into documentation. The four owned
components are:

- `packages/shared` — shared protocol shapes and browser-agnostic page-reading
  logic. Protocol definitions live here and must not be duplicated.
- `servers/websocket` — the relay that authenticates, tracks presence, and
  routes requests between the MCP server and connected browser extensions.
- `servers/mcp` — the agent-facing surface: MCP tools, resources, the
  `brijio-context` prompt, and skill documents under `servers/mcp/skills/`.
- `clients/extensions/chrome` and `clients/extensions/safari` — the
  browser-side bridge; keep adapters thin and keep shared behavior shared.

The authoritative product contract and support status is
[docs/project/CAPABILITY_MATRIX.md](../docs/project/CAPABILITY_MATRIX.md); it is
the source of truth for what is implemented, experimental, planned, and
intentionally unsupported. Design history and architectural decisions live in
[docs/architecture/decisions/](../docs/architecture/decisions/).

## Non-negotiable invariants

From [AGENTS.md](../AGENTS.md), these constraints are binding on every change:

- The user explicitly starts and stops the browser bridge; browser state is
  available only while the user-controlled extension is connected.
- Every browser read or action is initiated by an explicit MCP tool or resource
  request. There is no continuous page, DOM, screenshot, history, or
  browser-state streaming, and no silent background surveillance, cookie
  export, credential extraction, session cloning, or MFA interception.
- Requests carry explicit request IDs, structured errors, and timeouts; page
  content is not persisted unless an accepted ADR requires it.
- Client-side action approval must not be bypassed — it is enforced inside the
  extension, not the MCP server.
- Keep per-call browser and `tabId` targeting explicit; do not introduce hidden
  selected-browser or selected-tab session state, and preserve the documented
  active-tab fallback when `tabId` is omitted.

## How the pieces fit together

The runtime is a single explicit chain:

```text
Agent -> MCP Server -> WebSocket Relay -> Browser Extension -> Browser Session
```

One request cycle: the extension authenticates and announces presence; an agent
makes an MCP tool call; the MCP wrapper builds a protocol envelope; the relay
forwards it to the connected extension; the extension background controller
dispatches to a page-reader or action handler; the browser adapter performs the
tab-level work; and a structured result (or a forwarded error code) returns along
the same path. See [Architecture: MCP ↔ WebSocket ↔ Extension
flow](architecture/mcp-extension-flow.md) for the full trace.

## Where to go next

Route by task type:

| If your task is…                                                                              | Start at                                                               |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Understanding the runtime chain, layer ownership, or why cloning/streaming are rejected       | [Architecture Overview](architecture.md)                               |
| Tracing one request end-to-end through MCP, the relay, and the extension                      | [MCP ↔ WebSocket ↔ Extension flow](architecture/mcp-extension-flow.md) |
| The client-side approval flow for browser-mutating actions                                    | [Client-Side Action Approval](architecture/action-approval.md)         |
| The canonical protocol and data shapes (envelope, presence, tabId, uploads, error codes)      | [Protocol and Data Model Guide](data-and-protocol.md)                  |
| The agent-facing MCP tool, resource, prompt, and skill catalog                                | [Browser Action and Tool Catalog](workflows/browser-actions.md)        |
| Multi-tab targeting with `list_tabs` and `tabId` threading                                    | [Multi-tab Workflow](workflows/multi-tab.md)                           |
| Building, testing, or classifying a change (ADR-required vs not, TDD)                         | [Workflows](workflows.md)                                              |
| Source-domain boundaries and which layer owns a given change                                  | [Major Domains](domains.md)                                            |
| CLI/daemon lifecycle: `brijio run`, install/uninstall, start/stop, `doctor`, `--print-config` | [CLI and Daemon Operations](operations.md)                             |
| Trust assumptions, threat classes, non-goals, and security change guidance                    | [Security and Trust Model](security.md)                                |

For the product contract and support status, read
[docs/project/CAPABILITY_MATRIX.md](../docs/project/CAPABILITY_MATRIX.md). For
design history, browse [docs/architecture/decisions/](../docs/architecture/decisions/).
If these sources disagree, do not silently choose one — determine whether the
code or documentation is stale and report or fix the discrepancy.
