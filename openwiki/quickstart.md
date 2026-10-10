---
type: "Reference"
title: "OpenWiki Quickstart"
description: "Entry point for the Brijio OpenWiki knowledge base. Covers what the repository is, how the MCP-WebSocket-extension pieces fit together, the tool surface, and where to go next by task."
tags: ["quickstart", "routing", "brijio", "mcp", "overview"]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-10T14:14:23.130Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
generated: { by: "openwiki/0.7.2", at: "2026-10-10T14:14:23.130Z" }
---

# OpenWiki Quickstart

Brijio connects remote AI agents to the browser session the user already controls — no cookie export, no session cloning, no separate browser. The repository is a pnpm TypeScript monorepo, currently at **v0.3.0**, where the browser remains the source of truth and every interaction is explicit and user-started.

This page is the entry point. It states the invariants, names the pieces, and routes you to the page that owns each area of detail. Keep it short; it is not the canonical home for any one topic.

## Non-negotiable invariants

These come from `AGENTS.md` and frame every page in this wiki:

- **Explicit user start/stop.** The user manually connects and disconnects the browser bridge; nothing happens in the background.
- **Reactive extension, no continuous streaming.** The extension answers explicit requests and returns structured results. It does not publish ambient page, DOM, screenshot, history, or browser state. Keepalive messages carry no browser state.
- **Explicit per-call targeting.** Every read or action is initiated by an explicit MCP tool request and carries an explicit `browserInstanceId`, and where relevant an explicit per-call `tabId`. When `tabId` is omitted the system falls back to the active tab; there is no hidden selected-browser or selected-tab session state.
- **Progressive disclosure.** Return structured context first, then larger content or visual data only when requested.
- **Client-side approval for sensitive actions.** `submit_form`, `fetch_resource`, and `download_file` require client-side approval before the extension executes them; approval grants are in-memory only and cleared on disconnect/reload. Do not bypass approval checks.
- **Minimal, documented permissions.** Keep browser permissions minimal and document why each is needed.

Source: [AGENTS.md non-negotiable invariants](../AGENTS.md).

## How the pieces fit together

The runtime path is a four-layer chain owned by four workspace packages:

```text
Agent  ->  MCP Server (servers/mcp)  ->  WebSocket Relay (servers/websocket)  ->  Browser Extension (clients/extensions/*)  ->  Browser Tab
```

- `packages/shared` owns the shared protocol shapes and browser-agnostic page-reading logic.
- `servers/mcp` exposes the agent-facing MCP tools, resources, prompts, and skills, and is the WebSocket relay client.
- `servers/websocket` owns relay authentication, presence, and request routing between MCP server and extension.
- `clients/extensions/chrome` and `clients/extensions/safari` implement the browser-side bridge; adapters stay thin and shared behavior stays shared.

The basic request flow is:

1. The user manually connects the extension, which authenticates with a local pairing token and announces browser presence.
2. An agent invokes an MCP tool on the MCP server.
3. The MCP server forwards the request to the WebSocket relay with explicit `browserInstanceId`/`tabId` targeting.
4. The relay routes the request to the connected extension.
5. The extension reads or acts on the targeted tab and returns a structured result (or structured error) back up the chain.

For the end-to-end path, tab targeting, and the canonical source files per layer, see [MCP ↔ WebSocket ↔ Extension Flow](architecture/mcp-extension-flow.md). For the top-level architecture and which layer owns which behavior, see [Architecture Overview](architecture.md).

## Tool surface and task routing

The MCP server registers the tools below. Each entry points to the page that owns the surrounding concern. Tool input/output shapes live in [Protocol and Data Model Guide](data-and-protocol.md); the canonical product contract and support status live in [Capability Matrix](../docs/project/CAPABILITY_MATRIX.md).

| Tool                 | Task                                                                                                         | Go to                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `list_browsers`      | List browser instances online for the configured pairing token                                               | [Architecture Overview](architecture.md)                               |
| `list_tabs`          | List open tabs for a connected browser (tab ID, window, title, URL, active, supported)                       | [Multi-tab Workflow](workflows/multi-tab.md)                           |
| `read_current_page`  | Read page context and optional paginated readable content for a tab                                          | [Protocol and Data Model Guide](data-and-protocol.md)                  |
| `navigate_to_url`    | Navigate a tab to an HTTP/HTTPS URL; returns final URL/title/status                                          | [Multi-tab Workflow](workflows/multi-tab.md)                           |
| `open_tab`           | Open a new tab to an HTTP/HTTPS URL; returns the new `tabId` for subsequent targeting                        | [Multi-tab Workflow](workflows/multi-tab.md)                           |
| `click_element`      | Click a visible link or action by short-lived target ID                                                      | [MCP ↔ WebSocket ↔ Extension Flow](architecture/mcp-extension-flow.md) |
| `fill_input`         | Write text into a visible form control (password/readonly/disabled blocked)                                  | [MCP ↔ WebSocket ↔ Extension Flow](architecture/mcp-extension-flow.md) |
| `fill_editable`      | Write text into a visible contenteditable target                                                             | [MCP ↔ WebSocket ↔ Extension Flow](architecture/mcp-extension-flow.md) |
| `set_checked`        | Set checkbox state or select a radio option                                                                  | [MCP ↔ WebSocket ↔ Extension Flow](architecture/mcp-extension-flow.md) |
| `select_options`     | Select option values in a single- or multi-select control                                                    | [MCP ↔ WebSocket ↔ Extension Flow](architecture/mcp-extension-flow.md) |
| `submit_form`        | Submit a visible form — **client-side approval required**                                                    | [Security and Trust Model](security.md)                                |
| `perform_batch`      | Run up to 20 explicit actions sequentially with per-action results and optional trailing read                | [Multi-tab Workflow](workflows/multi-tab.md)                           |
| `upload_file`        | Upload base64 file content into a visible file input                                                         | [MCP ↔ WebSocket ↔ Extension Flow](architecture/mcp-extension-flow.md) |
| `download_status`    | Query browser download status (Safari reports `not_supported`)                                               | [Operations: Daemon, CLI, and Health](operations.md)                   |
| `download_file`      | Initiate a file download — **client-side approval required**                                                 | [Security and Trust Model](security.md)                                |
| `fetch_resource`     | Fetch a URL with browser credentials — **client-side approval required**, Safari/CORS returns `cors_blocked` | [Security and Trust Model](security.md)                                |
| `capture_screenshot` | Capture a viewport JPEG (quality 80) of the active tab; explicit only, no auto-capture                       | [Security and Trust Model](security.md)                                |

Notes on targeting and screenshots:

- `tabId` is optional on tab-aware tools; when omitted the system targets the active tab. Screenshot capture is **active-tab only** because `captureVisibleTab()` can only capture the visible tab of a window — to screenshot a specific page, `open_tab` it first. See [Multi-tab Workflow](workflows/multi-tab.md).
- Target IDs from `read_current_page` are short-lived and expire on navigation or DOM mutation; re-read page context after any mutation before retrying. See [Protocol and Data Model Guide](data-and-protocol.md).

## Where to go next by topic

- **Runtime architecture and ownership boundaries** — [Architecture Overview](architecture.md).
- **End-to-end request path, tab targeting, screenshots, source files per layer** — [MCP ↔ WebSocket ↔ Extension Flow](architecture/mcp-extension-flow.md).
- **Protocol envelopes, auth/presence, browser/tab listing, `open_tab`, `capture_screenshot`, upload/download/fetch status, structured `ToolResult` errors** — [Protocol and Data Model Guide](data-and-protocol.md).
- **Source domains and the cross-domain change rule** — [Major Domains](domains.md).
- **Running Brijio as a service: `brijio` daemon lifecycle (`install`/`start`/`stop`/`restart`/`status`/`logs`), health endpoints, `--print-config` and `--doctor` diagnostics, startup banner, `demo` command** — [Operations: Daemon, CLI, and Health](operations.md).
- **Trust assumptions, threat classes, non-goals, client-side approval, the explicit-only screenshot boundary** — [Security and Trust Model](security.md).
- **Repo development workflows: pnpm commands, per-domain verification, protocol/tab-targeting/screenshot change patterns, ADR/TDD conventions** — [Workflows](workflows.md).
- **Explicit per-call `tabId` targeting for reads, actions, batch, and navigation; `list_tabs`/`open_tab`; the active-tab-only screenshot constraint** — [Multi-tab Workflow](workflows/multi-tab.md).

For raw product framing, see the [root README](../README.md) and [Capability Matrix](../docs/project/CAPABILITY_MATRIX.md). For agent conventions, ADR workflow, and verification commands, see [AGENTS.md](../AGENTS.md).

## Notes for future changes

<!-- openwiki: broken internal link [../docs/architecture/decisions] file "../docs/architecture/decisions" does not exist. Fix the href or restore the target, then delete this comment. -->

- The latest ADRs are **0063 (open_tab)** and **0064 (capture_screenshot / visual action verification)**; ADR 0064 is still `Proposed`. The full decision history lives in [`docs/architecture/decisions`](../docs/architecture/decisions).
- When you change a protocol shape or browser capability, check the full cross-layer path and update the affected wiki pages together: shared protocol → WebSocket relay → MCP surface → shared controller → Chrome adapter → Safari adapter → integration tests. See [Major Domains](domains.md) and [Workflows](workflows.md).
- Keep this page an entry point. Add detail to the topic page that owns it, then link here.
