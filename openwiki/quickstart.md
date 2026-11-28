---
type: "Reference"
title: "OpenWiki Quickstart"
description: "Entry point for the Brijio OpenWiki knowledge base. A short task-routing map to architecture, protocol, workflow, operations, and security pages, plus a one-paragraph summary of what the repository is."
verified:
  - by: openwiki/0.9.0
    at: 2026-11-28T16:38:16.677Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-beb468a32961295d57274fd5
    resource: repo://clients/extensions/firefox/README.md
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-5524638d57e96598fd8e40d4
    resource: repo://packages/shared/src/background-controller.ts
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
generated: { by: "openwiki/0.9.0", at: "2026-11-28T16:38:16.677Z" }
---

# OpenWiki Quickstart

Brijio connects remote AI agents to the browser session the user already
controls. The system is intentionally reactive: the browser extension connects
only after explicit user action, and agents must ask for browser state or
perform actions through the MCP server. This page is the task-routing map —
keep it short and follow the link that matches the task area.

## What this repository is

This is a **pnpm TypeScript monorepo** (`packageManager: pnpm@10.32.1`,
`engines.node: >=22.0.0`) for a browser-bridge product. The pieces are:

- `servers/mcp` — the MCP server that exposes agent-facing tools and skills,
  and the single `brijio` binary that starts the WebSocket server and MCP
  server together.
- `servers/websocket` — the WebSocket relay that authenticates and routes
  requests between the MCP server and connected browser extensions.
- `packages/shared` — shared protocol shapes and browser-agnostic,
  page-reading logic.
- `clients/extensions/chrome` and `clients/extensions/safari` — the
  browser-side bridge, sharing logic from `@brijio/shared`.
- `clients/extensions/firefox` — a **planned, not implemented** stub that only
  reserves the client boundary; see its README and the capability matrix before
  starting work there.

The core design is user-controlled and privacy-first: no continuous browser
streaming, no background surveillance, no cookie export or session cloning.

## Task-routing map

Pick the page that matches the task area:

- **Understanding the runtime** — [Architecture Overview](architecture.md)
  (component ownership and the Agent → MCP → WebSocket → Extension → Browser
  chain) and [MCP ↔ WebSocket ↔ Extension Flow](architecture/mcp-extension-flow.md)
  (end-to-end request path, tab targeting, screenshot capture, error
  forwarding). For content extraction specifically, see
  [Browser Content Extraction Pipeline](architecture/browser-content-pipeline.md).
- **Protocol and data shapes** — [Protocol and Data Model Guide](data-and-protocol.md)
  (WebSocket envelope, auth/presence, tab listing, file uploads,
  download/fetch status, screenshot messages, action approval, error codes).
- **Working with tabs** — [Multi-tab Workflow](workflows/multi-tab.md)
  (per-call `tabId` targeting for reads, actions, batch operations,
  navigation, and screenshots).
- **Approval-gated actions** — [Client-Side Action Approval Workflow](workflows/action-approval.md)
  (`actionUUID` generation, approval request to the extension popup, user
  approve/deny/timeout, result propagation back to the agent).
- **Running the server / CLI** — [Daemon and CLI Operations](operations/daemon-and-cli.md)
  (install/uninstall as systemd/launchd services, start/stop/restart/status/logs,
  `doctor`, `print-config`, env-file loading, network detection, startup
  banner). The screenshot tool is one of the MCP tools documented through the
  architecture pages rather than here.
- **Security and trust** — [Security and Trust Model](security.md) (trust
  assumptions, threat classes, explicit non-goals, client-side action approval
  as a security boundary, screenshot privacy).
- **Source-domain boundaries** — [Major Domains](domains.md) for who owns
  what across the monorepo.
- **Repo-level development workflows** — [Workflows](workflows.md) (common
  `pnpm` commands, per-domain verification, protocol and browser-targeting
  change patterns, AGENTS.md conventions).

## How the pieces fit together

The basic runtime path is:

1. The user manually connects the browser extension.
2. The MCP server receives a tool call from an agent.
3. The MCP server forwards the request to the WebSocket relay.
4. The relay delivers the request to the connected extension.
5. The extension reads or acts on the browser tab and returns a structured
   result.

Reads and actions are targeted through explicit per-call `tabId`; when
omitted, the system falls back to the active tab. A small hardcoded set of
actions (`submit_form`, `fetch_resource`, `download_file`) require
client-side user approval before execution; everything else runs without a
prompt.

## Authorities and sources of truth

- [AGENTS.md](../AGENTS.md) is the **agent-instruction authority** — read it
  before changing the repository and treat its non-negotiable product
  invariants as binding.
- [docs/project/CAPABILITY_MATRIX.md](../docs/project/CAPABILITY_MATRIX.md) is
  the **product-contract authority** for what is implemented, planned, or
  intentionally unsupported.
- For executable behavior, source code and tests are the source of truth; for
  architectural decisions and design history, see `docs/architecture/decisions`.
- If these sources disagree, do not silently choose one — determine which is
  stale, update the discrepancy when it is in scope, and otherwise report it.

## Notes for future changes

- If you change tool inputs or the extension request path, update the
  [architecture page](architecture.md) and the
  [multi-tab workflow page](workflows/multi-tab.md) together.
- If you change approval-gated actions or the approval protocol, update the
  [action-approval workflow page](workflows/action-approval.md).
- If you change CLI commands or daemon lifecycle, update the
  [daemon and CLI operations page](operations/daemon-and-cli.md).
- Keep this page short; it is the entry point, not the canonical home for
  every detail.
