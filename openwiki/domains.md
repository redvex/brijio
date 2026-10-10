---
type: "Reference"
title: "Major Domains"
description: "The owned source domains of the Brijio monorepo (shared protocol/logic, WebSocket relay, MCP server, browser extensions, product framing, security, docs/history) and the practical rule for cross-domain changes."
tags: [domains, ownership, cross-layer-changes, monorepo]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-10T14:14:23.130Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-0f5d8a945cabdf67f37b9ad7
    resource: repo://clients/extensions/chrome/src/background.ts
  - id: openwiki-source-beb468a32961295d57274fd5
    resource: repo://clients/extensions/firefox/README.md
  - id: openwiki-source-70dd1b5e429044bdf703d26f
    resource: repo://clients/extensions/safari/src/background-entry.ts
  - id: openwiki-source-151988bbc60a918980820e71
    resource: repo://clients/extensions/safari/src/background.ts
  - id: openwiki-source-a31e56605839ce458ceb1d44
    resource: repo://docs/architecture/decisions/0060-explicit-tab-listing-and-selection.md
  - id: openwiki-source-d9997f65a04e259507c45268
    resource: repo://docs/architecture/decisions/0063-open-tab-action.md
  - id: openwiki-source-79dd91ec51a55e7e78c52ccc
    resource: repo://docs/architecture/decisions/0064-visual-action-verification.md
  - id: openwiki-source-9b8357af9c7ef75912f57765
    resource: repo://docs/project/CAPABILITY_MATRIX.md
  - id: openwiki-source-aae624fcff023b16e3665555
    resource: repo://docs/security/SECURITY_GUARANTEES.md
  - id: openwiki-source-0c22eda9f95dd622fb06ce00
    resource: repo://docs/security/TRUST_BOUNDARIES.md
  - id: openwiki-source-5524638d57e96598fd8e40d4
    resource: repo://packages/shared/src/background-controller.ts
  - id: openwiki-source-265221f77947a8a08e9a018a
    resource: repo://packages/shared/src/index.ts
  - id: openwiki-source-c20cbcf46daa07e6332e3f7f
    resource: repo://packages/shared/src/protocol.ts
  - id: openwiki-source-ae59149c7733dd98fdeaead4
    resource: repo://servers/mcp/bin/brijio.mjs
  - id: openwiki-source-d0197860041da5ce4f4f84ca
    resource: repo://servers/mcp/skills/form-filling/SKILL.md
  - id: openwiki-source-cde1053eb49eff18dfbe3aeb
    resource: repo://servers/mcp/src/daemon.ts
  - id: openwiki-source-01678f317faa698807d433aa
    resource: repo://servers/mcp/src/demo-server.ts
  - id: openwiki-source-36c61251055ea6d2f82f0b4e
    resource: repo://servers/mcp/src/mcp-server.ts
  - id: openwiki-source-48d3485f346966d1c44c7ea7
    resource: repo://servers/mcp/src/protocol.ts
  - id: openwiki-source-13054dea741b794a82597d0c
    resource: repo://servers/mcp/src/skills.ts
  - id: openwiki-source-7dcd7530e87d043a15f1c7af
    resource: repo://servers/websocket/src/protocol.ts
  - id: openwiki-source-875036d8e83469fa1fc3f8e3
    resource: repo://servers/websocket/src/server.ts
generated: { by: "openwiki/0.7.2", at: "2026-10-10T14:14:23.130Z" }
---

# Major Domains

Brijio is a pnpm TypeScript monorepo split across a few clear domains. Future agents should keep these domains separate when making changes, because each one owns a distinct responsibility and a distinct set of contracts. The workspace globs in `pnpm-workspace.yaml` (`packages/*`, `servers/*`, `clients/extensions/*`) define where each domain lives.

The four executable domains — shared protocol/logic, the WebSocket relay, the MCP server, and the browser extensions — map directly onto the runtime chain documented in [Architecture Overview](architecture.md). The remaining domains are documentation and product framing that constrain how the executable domains may change. For a deeper reference on the data shapes that cross these domains, see [Protocol and Data Model Guide](data-and-protocol.md).

## 1. Shared protocol and browser-agnostic logic

**Primary source:** `packages/shared`

This domain owns the data model and reusable logic that both servers and browser extensions depend on. The single source of truth for protocol shapes is `packages/shared/src/protocol.ts`, which defines:

- the `WebSocketEnvelope` / `BrijioEnvelope` routing envelope with optional per-call `target.browserInstanceId` and `target.tabId`
- `BrijioRole` (`extension` | `mcp`) and the `AuthPayload` / `AuthSuccessPayload` pairing-token handshake
- `BrowserCapability` names and `BrowserPresence` metadata that extensions announce to the relay
- tab-listing shapes (`TabInfo`, `list_tabs` / `tab_list_response`)
- staged file-upload, download, and fetch status shapes
- the page-context, page-content chunking, and result/error envelopes used across reads and actions

Beyond protocol types, the shared package owns browser-agnostic behavior: page-context extraction (`page-context.ts`), page-content chunking (`page-content.ts`), the extension-side background controller (`background-controller.ts`), batch handling, timers, popup helpers, and the logger. Both browser extensions import these as `@brijio/shared` rather than re-implementing them.

Per the AGENTS.md ownership rule, protocol definitions live in `packages/shared` only and must not be duplicated. The MCP server keeps its own envelope builders, parsers, and result types in `servers/mcp/src/protocol.ts`, but those import the canonical types from `@brijio/shared`.

## 2. WebSocket relay

**Primary source:** `servers/websocket`

This service is the transport and routing layer. `servers/websocket/src/server.ts` authenticates clients with the local pairing token, maintains a per-scope presence table, and routes messages between the MCP server and connected browser extensions. It is intentionally state-light: presence is runtime-only and is deleted from the in-memory map when the socket closes. It re-exports the canonical envelope helpers from `@brijio/shared` and only adds `createScopeKey` (a SHA-256 hash of the token) to scope presence per pairing token.

A few requests are answered directly from the relay rather than forwarded: `list_browsers` is answered from the in-memory presence table, while `list_tabs` and all browser reads/actions are forwarded to the selected extension. `browserInstanceId` (and, for forwarded actions, `tabId`) is preserved end to end; there is no hidden selected-browser or selected-tab session state.

## 3. MCP server

**Primary source:** `servers/mcp`

This is the agent-facing surface. `servers/mcp/src/mcp-server.ts` assembles the `McpServer` and uses the WebSocket relay (via `servers/mcp/src/websocket-client.ts`) to reach connected browser extensions, returning structured results to the agent. Results use a predictable envelope — `{ ok: true, data }` or `{ ok: false, error: { code, message } }` — so failures carry explicit error codes rather than exceptions.

The current tool set, registered in `mcp-server.ts`:

- `list_browsers`, `list_tabs`
- `read_current_page`
- `click_element`, `fill_input`, `fill_editable`, `set_checked`, `select_options`, `submit_form`, `upload_file`
- `navigate_to_url`, `open_tab` (ADR 0063), `perform_batch`
- `download_status`, `download_file`, `fetch_resource`
- `capture_screenshot` (ADR 0064), the only tool that returns MCP image content rather than text

Resources:

- `browser://page/current` (named `current-page-context`) and `browser://page/current/content/{index}` (named `current-page-content`) for progressive disclosure — structured context first, content chunks on request.
- `skill://brijio/{name}` resources, one per skill under `servers/mcp/skills` (mime `text/markdown`).

Prompts:

- `brijio-context`, which injects connected-browser guidance, multi-tab targeting notes, the skill list, and key pitfalls into the agent's session.

Skills: `servers/mcp/src/skills.ts` loads each skill directory's `SKILL.md` at server startup, parses optional frontmatter, and exposes every skill both as an MCP resource and summarized in the `brijio-context` prompt. The ten skills under `servers/mcp/skills` are: `accessibility`, `comparison`, `data-extraction`, `ecommerce`, `form-filling`, `monitoring`, `navigation`, `onboarding`, `using-brijio`, and `web-qa`. The skills system is part of the MCP server surface, so changes to agent-facing workflow guidance belong in `servers/mcp` rather than the protocol.

The MCP server also owns operational and CLI code that ships in the `@brijio/mcp` package and the `brijio` binary: `daemon.ts` (daemon install/start/stop/status and env loading), `doctor.ts` (`brijio --doctor` preflight checks), `print-config.ts` (`--print-config` agent config formatters), `startup-banner.ts` (the stderr startup banner), and `demo-server.ts` (the `brijio demo` static demo site under `servers/mcp/demo`). See [Workflows](workflows.md) for the commands and verification patterns around these; the daemon, doctor, and print-config pieces are also referenced by ADR 0037 and ADR 0038.

## 4. Browser extensions

**Primary sources:** `clients/extensions/chrome`, `clients/extensions/safari`

These packages implement the browser-side bridge. Both instantiate the shared `BrijioBackgroundController` from `@brijio/shared` with thin platform-specific adapters (action badge, storage, page reader, navigation, download, approval, tab lister, WebSocket connection), so shared behavior stays shared and only the platform edge differs.

They differ in API surface and packaging but share the same product rules:

- user-controlled activation (manual connect/disconnect, no background auto-connect)
- explicit request/response behavior (no continuous streaming)
- page context before page content (progressive disclosure)
- action targeting through short-lived IDs that expire on navigation or DOM change
- explicit per-call `browserInstanceId` and `tabId` targeting

Chrome (`clients/extensions/chrome`) is the first implementation and uses the `chrome.*` namespace, MV3, and runtime `optional_host_permissions`. Safari (`clients/extensions/safari`) is a parallel implementation: per ADR 0019 and ADR 0051 it uses the `browser.*` namespace, MV2 background scripts, platform-specific persistence, and text-only badges. The Safari entrypoint lives in `clients/extensions/safari/src/background-entry.ts`, which wires the Safari adapters into the shared controller.

Firefox (`clients/extensions/firefox`) is a placeholder only — it contains just a README reserving the client boundary. Support is planned but not implemented; Firefox packaging, permissions, and user-control behavior should be designed in a separate ADR before implementation starts. Chrome and Safari are the two real implementations; both share `@brijio/shared` logic with thin platform adapters.

## 5. Product and business framing

**Primary sources:** `README.md`, `docs/project/POSITIONING.md`, `docs/project/CAPABILITY_MATRIX.md`

These docs explain what Brijio is for and what it is not. The product is positioned around authenticated browser sessions, privacy, explicit control, and remote-agent compatibility — not generic browser automation. `docs/project/CAPABILITY_MATRIX.md` is the canonical product contract: it lists every capability, its status, browser support, known limitations, and what is explicitly out of scope (cookie export, session cloning, continuous streaming, browser recording). Extension READMEs, the MCP surface, and roadmap documents should use the same capability names defined there; when capabilities change, update the matrix first, then update linked references.

## 6. Security and trust

**Primary sources:** `docs/security/THREAT_MODEL.md`, `docs/security/TRUST_BOUNDARIES.md`, `docs/security/SECURITY_GUARANTEES.md`

Security docs explain the trust assumptions behind the bridge and why the project avoids credential export, browser cloning, ambient browser surveillance, and continuous streaming. The trust-boundaries document defines the boundaries (Agent ↔ MCP server, MCP server ↔ relay, relay ↔ extension, extension ↔ browser session) and notes that the relay authenticates but does not need to inspect payloads. See [Security and Trust Model](security.md) for the OpenWiki summary.

## 7. Docs and design history

**Primary sources:** `docs/architecture/decisions/*`, `docs/artifacts/*`, `docs/project/*`

The docs tree contains the design history and the current product contract. ADRs under `docs/architecture/decisions/` (now through ADR 0064) are especially valuable when changing browser actions, protocol shapes, or connection behavior — recent tab-targeting and tool-surface decisions include ADR 0060 (explicit tab listing/selection), ADR 0062 (thread `tabId` through the action stack), ADR 0063 (`open_tab`), and ADR 0064 (`capture_screenshot`). `docs/project/CAPABILITY_MATRIX.md` is the product contract for what is implemented, planned, or intentionally unsupported.

## Practical rule for future changes

If a change touches more than one domain, update the shared protocol or ADR first, then the relay/server, then the browser adapters. Concretely, for a protocol or browser-capability change that cuts across layers, check the full path:

```text
shared protocol -> WebSocket relay -> MCP surface -> shared controller
                -> Chrome adapter -> Safari adapter -> integration tests
```

This keeps the repo's explicit-contract style intact and reduces hidden coupling. It also matches the AGENTS.md ownership rule: keep protocol definitions in `packages/shared` and do not duplicate them; preserve explicit per-call `browserInstanceId` and `tabId` targeting; re-read page context after navigation or any mutation that can invalidate short-lived target IDs; and when tool behavior changes, update its tests, MCP registration, relevant skills, the capability matrix, and the related OpenWiki pages.
