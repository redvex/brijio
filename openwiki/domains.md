---
type: Domain map
title: Major Domains
description: The owned source domains of the Brijio monorepo — shared protocol/logic, WebSocket relay, MCP server, browser extensions, product framing, security, and docs/ADR history — and the rule that cross-domain changes propagate shared-protocol -> relay -> MCP surface -> shared controller -> Chrome/Safari adapters -> tests.
tags: [domains, architecture, ownership, cross-domain, brijio]
verified:
  - by: openwiki/0.6.0
    at: 2026-09-26T12:40:26.126Z
sources:
  - id: openwiki-source-dacf7bd89f09b6d1db0c5fa2
    resource: repo://clients/extensions/chrome/manifest.json
  - id: openwiki-source-0f5d8a945cabdf67f37b9ad7
    resource: repo://clients/extensions/chrome/src/background.ts
  - id: openwiki-source-fa213a96cd30a09d577d0a92
    resource: repo://clients/extensions/chrome/src/permissions.ts
  - id: openwiki-source-beb468a32961295d57274fd5
    resource: repo://clients/extensions/firefox/README.md
  - id: openwiki-source-918a0bd56842e75b089b67a5
    resource: repo://clients/extensions/safari/manifest.json
  - id: openwiki-source-70dd1b5e429044bdf703d26f
    resource: repo://clients/extensions/safari/src/background-entry.ts
  - id: openwiki-source-0c22eda9f95dd622fb06ce00
    resource: repo://docs/security/TRUST_BOUNDARIES.md
  - id: openwiki-source-5524638d57e96598fd8e40d4
    resource: repo://packages/shared/src/background-controller.ts
  - id: openwiki-source-265221f77947a8a08e9a018a
    resource: repo://packages/shared/src/index.ts
  - id: openwiki-source-c20cbcf46daa07e6332e3f7f
    resource: repo://packages/shared/src/protocol.ts
  - id: openwiki-source-40275cb92c3610938f16ade3
    resource: repo://pnpm-workspace.yaml
  - id: openwiki-source-cde1053eb49eff18dfbe3aeb
    resource: repo://servers/mcp/src/daemon.ts
  - id: openwiki-source-f1f5d8584551c3d42e50d725
    resource: repo://servers/mcp/src/index.ts
  - id: openwiki-source-36c61251055ea6d2f82f0b4e
    resource: repo://servers/mcp/src/mcp-server.ts
  - id: openwiki-source-875036d8e83469fa1fc3f8e3
    resource: repo://servers/websocket/src/server.ts
generated: { by: "openwiki/0.6.0", at: "2026-09-26T12:40:26.126Z" }
---

# Major Domains

Brijio is a pnpm workspace with three package roots (`packages/*`, `servers/*`, `clients/extensions/*`) that keep distinct concerns in separate domains. Future agents should keep these domains separate when making changes. The workspace declaration is the authoritative list of package roots:

```yaml
packages:
  - "packages/*"
  - "servers/*"
  - "clients/extensions/*"
```

The product is a bridge: an AI agent talks to an MCP server, the MCP server talks over a WebSocket relay to a browser extension, and the extension acts inside the user's authenticated browser session. Each domain below owns a layer of that bridge. The sections give the primary source path, a one-line responsibility, and the key files for each domain.

## 1. Shared protocol and browser-agnostic logic

**Primary source:** `packages/shared`

This domain owns the data model and reusable logic that both servers and browser extensions depend on. Nothing in this package may import from `servers/*` or `clients/*`; the dependency direction is strictly outward (servers and extensions import from shared, never the reverse).

The most important file is `packages/shared/src/protocol.ts`, which defines the WebSocket envelope, auth and presence messages, browser capability names, browser presence metadata, tab-listing shapes, staged file upload messages, and download/fetch status shapes. The package barrel (`packages/shared/src/index.ts`) re-exports every module:

- `protocol.ts` — message envelopes, payload types, capability enum, and envelope constructor/parser helpers.
- `page-context.ts` — DOM extraction of structured page context (landmarks, headings, links, actions, forms, images).
- `page-content.ts` — readable content chunking and markdown rendering helpers.
- `page-reader.ts` — page reading orchestration shared by extensions.
- `background-controller.ts` — `BrijioBackgroundController`, the shared extension background worker that owns connection state, keepalive, reconnect backoff, and dispatches page actions.
- `content-handler.ts` — content-script message handling and stale-context detection (`CONTENT_SCRIPT_VERSION`).
- `batch-handler.ts` — batch request handling shared by extension and server.
- `popup-init.ts`, `popup-messages.ts`, `popup-parsers.ts` — popup UI wiring shared across browser adapters.
- `bridge-settings.ts` — bridge settings normalization and `createBrowserInstanceId`.
- `timers.ts`, `logger.ts`, `content-helpers.ts` — cross-cutting utilities.

## 2. WebSocket relay

**Primary source:** `servers/websocket`

This service is the transport and routing layer. It authenticates clients with the local pairing token and routes messages between the MCP server and connected browser extensions. It is intentionally state-light: presence is runtime-only (an in-memory `Map`) and disappears when the socket closes.

Key files:

- `servers/websocket/src/server.ts` — `createWebSocketServer`, connection lifecycle, auth gate, presence upsert, scope-key routing, pending-request tracking, and the `/health` endpoint.
- `servers/websocket/src/protocol.ts` — relay-local protocol helpers (scope key derivation, envelope parsing).
- `servers/websocket/src/index.ts` — process entrypoint.

The relay owns four responsibilities explicitly:

1. **Auth** — every socket must send an `auth` payload whose token is in the configured pairing-token set before any other message is accepted; otherwise the relay replies `auth_required` or `auth_failed`.
2. **Presence** — extensions announce `browser_presence_announce`; the relay stores a `PresenceRecord` keyed by `scopeKey:browserInstanceId` and serves `list_browsers` directly from this table.
3. **scopeKey routing** — the relay derives a `scopeKey` from the pairing token, so clients that share a token share a routing scope; MCP requests are forwarded only to extension sockets in the same scope.
4. **Pending requests** — for MCP requests with an `id`, the relay records `scopeKey:requestId -> mcpSocket` so the extension's response can be routed back to the originating MCP socket, and cleans those entries up on socket close.

`list_browsers` is answered by the relay itself from its presence table; `list_tabs` and all action requests are forwarded to the selected extension socket via the same `selectBrowser` + `sendJson` path. When more than one browser is online and the request omits `browserInstanceId`, the relay returns `ambiguous_browser_target` rather than guessing.

## 3. MCP server

**Primary source:** `servers/mcp`

This is the agent-facing surface. It exposes browser resources, tool calls, skills, and a session-start prompt through the Model Context Protocol, and it reaches connected browsers via the WebSocket relay (`servers/mcp/src/websocket-client.ts`). The HTTP transport is the Streamable HTTP server (`servers/mcp/src/http-server.ts`); `servers/mcp/src/index.ts` is the process entrypoint that builds options from env and starts it.

The MCP domain owns tools, resources, prompts, skills, the websocket client, the http server, the daemon, doctor, print-config, and the startup banner. Key files:

- `mcp-server.ts` — `createBrijioMcpServer`, which registers every tool, resource, skill resource, and the `brijio-context` prompt.
- Tool modules — `browser-list-tool.ts`, `list-tabs-tool.ts`, `page-reading-tool.ts`, `click-element-tool.ts`, `fill-input-tool.ts`, `navigate-to-url-tool.ts`, `open-tab-tool.ts`, `form-action-tools.ts` (fill_editable, set_checked, select_options, submit_form, upload_file), `batch-tool.ts`, `download-status-tool.ts`, `download-file-tool.ts`, `fetch-resource-tool.ts`, `capture-screenshot-tool.ts`.
- `page-actions.ts`, `page-context.ts` — server-side page-action and page-context request shaping.
- `websocket-client.ts` — the relay client that sends request envelopes and parses action/content/list responses, with timeout and connection-failure handling.
- `skills.ts` — loads skill `SKILL.md` files from `servers/mcp/skills` and exposes them as MCP resources; `buildContextMessage` assembles the `brijio-context` prompt.
- `http-server.ts` — Streamable HTTP transport, health endpoint, origin allow-list, auth-token gating, and per-request approval timeout.
- `daemon.ts` — install/run/start/stop/restart/status/logs lifecycle plus `print-config` and `doctor` commands, including env-file and service-file generation.
- `doctor.ts`, `print-config.ts`, `print-config-commands.ts`, `startup-banner.ts` — diagnostics, config rendering, and the startup banner.
- `demo-server.ts` and the `servers/mcp/demo` site — browser-friendly demo for smoke testing.

The registered tools are: `list_browsers`, `list_tabs`, `read_current_page`, `click_element`, `fill_input`, `fill_editable`, `set_checked`, `select_options`, `submit_form`, `navigate_to_url`, `open_tab`, `perform_batch`, `download_status`, `download_file`, `fetch_resource`, `capture_screenshot`, and `upload_file` (via `form-action-tools`). Action tools accept short-lived Brijio target IDs plus optional `pageContextId`/`visibleContextId` validators; stale IDs return `stale_context` and a navigated page returns `page_navigated`. Registered resources include `browser://page/current`, `browser://page/current/content/{index}`, and one `browser://skill/<name>` resource per skill.

## 4. Browser extensions

**Primary sources:** `clients/extensions/chrome`, `clients/extensions/safari` (shipped); `clients/extensions/firefox` (placeholder only).

These packages implement the browser-side bridge. They differ in API surface and packaging, but share the same product rules and reuse the shared package's `BrijioBackgroundController`, content handler, popup logic, and protocol types.

Shared product rules:

- user-controlled activation (clicking the toolbar action connects/disconnects)
- explicit request/response behavior, no continuous streaming
- page context before page content
- action targeting through short-lived IDs
- page data read as structured context, not executed or evaluated

### Chrome

`clients/extensions/chrome` is the first implementation and the reference adapter. Key files:

- `manifest.json` — MV3, service-worker background, `activeTab`/`scripting`/`storage`/`tabs`/`downloads` permissions, and broad `http://*/*` + `https://*/*` host permissions granted at install time.
- `src/background.ts` — wires `BrijioBackgroundController` to the Chrome API (badge, storage, scripting, downloads), including the `downloads.search`/`downloads.onChanged` download adapter.
- `src/content-script-entry.ts` — content-script entry using the shared content handler.
- `src/popup-entry.ts`, `src/popup.html`, `src/popup.ts` — popup UI wiring.
- `src/permissions.ts` — `isRegularPageUrl`; `hasRegularPageAccess` always returns true because broad host permission is granted at install (ADR 0030/0011).

### Safari

`clients/extensions/safari` is a parallel implementation with platform-specific manifests and MV2/MV3 differences. Key files:

- `manifest.json` — MV2 (`manifest_version: 2`), non-persistent background scripts, `browser_action`, content scripts for `http://*/*` and `https://*/*`, and `*://*/*` permission.
- `src/background.ts`, `src/background-entry.ts` — Safari background wiring (including reconnect-on-wake handling per ADR 0052).
- `src/content-script-entry.ts` — Safari content-script entry.
- `src/popup-entry.ts`, `src/popup.html`, `src/popup.ts` — popup UI.
- `src/permissions.ts` — Safari permission helpers.
- `src/placeholder.ts` — platform placeholder.
- `src/manifest.test.ts` — manifest conformance tests.

### Firefox

`clients/extensions/firefox` is a placeholder only: it contains a `README.md` reserving the client boundary. Firefox packaging, permissions, and user-control behavior must be designed in a separate ADR before implementation starts. The capability matrix (`docs/project/CAPABILITY_MATRIX.md`) tracks Firefox support status.

## 5. Product and business framing

**Primary sources:** `README.md`, `docs/project/POSITIONING.md`, `docs/project/CAPABILITY_MATRIX.md`, `docs/project/ROADMAP.md`

These docs explain what Brijio is for and what it is not. The product is positioned around authenticated browser sessions, privacy, and explicit control, not generic browser automation. `CAPABILITY_MATRIX.md` is the canonical per-browser capability/status table (including Firefox "planned" status).

## 6. Security and trust

**Primary sources:** `docs/security/THREAT_MODEL.md`, `docs/security/TRUST_BOUNDARIES.md`, `docs/security/SECURITY_GUARANTEES.md`

Security docs explain the trust assumptions behind the bridge and why the project avoids credential export, browser cloning, and ambient browser surveillance. The trust boundaries are: Agent ↔ MCP server, MCP server ↔ relay, relay ↔ extension, and extension ↔ browser session. The relay authenticates both sides with the pairing token but does not inspect message payloads; the MCP HTTP transport uses a separate `MCP_HTTP_AUTH_TOKEN`. Brijio never exports cookies, passwords, or MFA codes; TLS is required and end-to-end encryption is planned as defense in depth.

## 7. Docs and design history

**Primary sources:** `docs/architecture/decisions/*`, `docs/artifacts/*`, `docs/project/*`

The docs tree contains the design history and the current product contract. ADRs are especially valuable when changing browser actions, protocol shapes, or connection behavior — the ADR sequence (0001–0064) records the rationale for the relay model, extension action stack, stale-target handling, batch tool, file upload/download awareness, client-side action approval, Safari platform builds, the skill system, the HTTP MCP transport, and the unified release tag. If a change crosses a recorded ADR, update the ADR (or add a new one) before changing the code.

## Practical rule for cross-domain changes

If a change touches more than one domain, update the shared protocol or ADR first, then the relay/server, then the browser adapters (Chrome and Safari in parallel, Firefox remains a placeholder), then tests. This keeps the repo's explicit-contract style intact and reduces hidden coupling. Concretely:

1. **Shared protocol/logic** — change `packages/shared/src/protocol.ts` or the relevant shared module and its tests first; this is the contract both servers and extensions compile against.
2. **Relay/server** — update `servers/websocket` routing/auth and `servers/mcp` tools/resources/websocket-client next.
3. **Shared controller** — if the extension behavior changes, update `packages/shared/src/background-controller.ts` (or content handler) before the browser adapters.
4. **Browser adapters** — wire the shared controller into `clients/extensions/chrome` and `clients/extensions/safari`; keep both manifests and permission modules in sync.
5. **Tests** — run the per-package test suites (e.g. `background-controller.test.ts`, `server.test.ts`, `mcp-server`/`index.test.ts`, extension `background.test.ts`) last to confirm the change did not break an existing contract.

<!-- openwiki: mermaid parse failed and this diagram was converted to a text fence so it does not break rendering. Fix the diagram source and restore the mermaid fence. Parser error: Heuristic: an unescaped angle bracket inside a label breaks rendering; rephrase the label. -->

```text
flowchart TD
    A["Shared protocol + logic<br/>packages/shared"] --> B["WebSocket relay<br/>servers/websocket"]
    A --> C["MCP server surface<br/>servers/mcp"]
    C --> B
    A --> D["Shared controller + content handler<br/>packages/shared background-controller / content-handler"]
    D --> E["Chrome adapter<br/>clients/extensions/chrome"]
    D --> F["Safari adapter<br/>clients/extensions/safari"]
    E --> B
    F --> B
```

Dependency and change-propagation direction across the Brijio domains. Shared logic is the contract; relay and MCP server consume it; browser adapters wire the shared controller into Chrome and Safari and both connect to the relay.
