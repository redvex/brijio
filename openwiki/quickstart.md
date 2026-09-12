---
type: Reference
title: OpenWiki Quickstart
description: Entry point for the Brijio OpenWiki knowledge base. Covers what the repository is, how the MCP-WebSocket-extension chain fits together, and where to go next for each task type.
tags: [quickstart, overview, architecture, workflow, routing]
verified:
  - by: openwiki/0.5.1
    at: 2026-09-12T11:58:23.018Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-a2371d6362e5db4bc834ad03
    resource: repo://CLAUDE.md
  - id: openwiki-source-beb468a32961295d57274fd5
    resource: repo://clients/extensions/firefox/README.md
  - id: openwiki-source-d9997f65a04e259507c45268
    resource: repo://docs/architecture/decisions/0063-open-tab-action.md
  - id: openwiki-source-79dd91ec51a55e7e78c52ccc
    resource: repo://docs/architecture/decisions/0064-visual-action-verification.md
  - id: openwiki-source-9b8357af9c7ef75912f57765
    resource: repo://docs/project/CAPABILITY_MATRIX.md
  - id: openwiki-source-5524638d57e96598fd8e40d4
    resource: repo://packages/shared/src/background-controller.ts
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-36c61251055ea6d2f82f0b4e
    resource: repo://servers/mcp/src/mcp-server.ts
  - id: openwiki-source-0e497abc3e4b543baa3c63c2
    resource: repo://servers/mcp/src/page-actions.ts
generated: { by: "openwiki/0.5.1", at: "2026-09-12T11:58:23.018Z" }
---

# OpenWiki Quickstart

Brijio connects remote AI agents to the browser session the user already controls. The system is intentionally reactive: the browser extension connects only after explicit user action, and agents must ask for browser state or perform actions through the MCP server. There is no continuous streaming, no cookie export, and no background surveillance.

## What this repository is

This is a pnpm TypeScript monorepo for a user-controlled browser-bridge product:

- `servers/mcp` exposes the agent-facing MCP tool surface and skills.
- `servers/websocket` is the local relay that authenticates clients, tracks browser presence, and routes messages between the MCP server and connected browser extensions.
- `clients/extensions/chrome` and `clients/extensions/safari` are the implemented browser-side bridges; `clients/extensions/firefox` is a placeholder, planned but not yet implemented.
- `packages/shared` holds the shared protocol (`protocol.ts`), the browser-agnostic `BrijioBackgroundController`, page-reading logic, and batch/content handlers used by both extensions and server-side code.

The repository's current direction is captured in `docs/project/CAPABILITY_MATRIX.md` (the canonical product contract and support status) and in the ADRs under `docs/architecture/decisions/`. The most recent ADRs are **0063 (open-tab)** — adds the `open_tab` tool so the agent can create a new tab without destroying current page state — and **0064 (screenshot)** — adds the `capture_screenshot` tool returning a viewport JPEG for visual action verification. The core design remains user-controlled and privacy-first.

## How the pieces fit together

The runtime is one explicit, short-lived request/response chain. No data flows without an explicit MCP tool call; the browser never streams screenshots, DOM updates, or history.

```text
Agent → MCP Server → WebSocket Relay → Browser Extension → Browser Session
```

In short: the user manually connects the browser extension; an agent calls an MCP tool; the MCP server authenticates to the relay and sends a targeted WebSocket envelope; the relay forwards it to the selected connected extension; the extension reads or acts on the (optionally `tabId`-targeted) browser tab and returns a structured result that travels back through the same sockets to the agent. See [Architecture: MCP ↔ WebSocket ↔ Extension flow](architecture/mcp-extension-flow.md) for the full end-to-end path and the source files that own each step.

`tabId` is threaded through the whole stack so the agent can act on a specific background tab without disturbing the active one; when omitted, the system falls back to the active foreground tab. `open_tab` is the exception — it creates a tab and returns the new `tabId` rather than targeting one.

## Canonical agent instructions

`AGENTS.md` is the canonical agent-instructions file. It defines the change workflow (ADR-required vs ADR-not-required), the non-negotiable product invariants (explicit user control, no streaming, no credential extraction), ownership and cross-layer change rules, coding standards, documentation-update rules, and the verification pattern to run after edits. `CLAUDE.md` points back to it. When making any change, start from this quickstart, then follow the domain or architecture page that matches the area being changed.

## Where to go next (task-routing map)

The MCP server exposes **17 tools** registered in `servers/mcp/src/mcp-server.ts`: `list_browsers`, `list_tabs`, `read_current_page`, `click_element`, `fill_input`, `fill_editable`, `set_checked`, `select_options`, `upload_file`, `submit_form`, `perform_batch`, `navigate_to_url`, `open_tab`, `download_status`, `download_file`, `fetch_resource`, and `capture_screenshot`. Chrome and Safari are implemented; Firefox is a planned placeholder not yet built — see `docs/project/CAPABILITY_MATRIX.md` for the browser-support contract.

| If your task is about…                                                                                                                                              | Read this page                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| The end-to-end request path from MCP tool call through the relay to the extension and back                                                                          | [Architecture: MCP ↔ WebSocket ↔ Extension flow](architecture/mcp-extension-flow.md) |
| The high-level component model, the full 17-tool surface, and change guidance by layer                                                                              | [Architecture Overview](architecture.md)                                             |
| Tab targeting (`list_tabs`, `open_tab`), `capture_screenshot`, and the recommended multi-tab workflow                                                               | [Multi-tab Workflow](workflows/multi-tab.md)                                         |
| WebSocket envelope, browser presence, capabilities, tab listing, action/batch/open-tab/screenshot/download/fetch message shapes                                     | [Protocol and Data Model Guide](data-and-protocol.md)                                |
| Trust boundaries, threat classes, the explicit-vs-continuous screenshot boundary, and the download/fetch risk profile                                               | [Security and Trust Model](security.md)                                              |
| The seven source domains (shared protocol, WebSocket relay, MCP server, browser extensions, product framing, security, docs/history) and how to keep changes scoped | [Major Domains](domains.md)                                                          |
| pnpm commands, per-domain verification, protocol/browser-targeting change patterns, ADR conventions, and the daemon/operations surface                              | [Workflows](workflows.md)                                                            |

## Notes for future changes

- The source of truth for recent tab-targeting behavior is ADR 0062; for `open_tab` it is ADR 0063; for `capture_screenshot` it is ADR 0064 — all under `docs/architecture/decisions/`.
- If you change tool inputs or the extension request path, update the architecture page and the multi-tab workflow page together.
- Keep this page short; it is the entrypoint, not the canonical home for every detail. Point to the deeper pages above for specifics.
