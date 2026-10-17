---
type: "Reference"
title: "Major Domains"
description: "The major source domains and their ownership boundaries: shared protocol/browser-agnostic logic, WebSocket relay, MCP server, browser extensions, product framing, security/trust, docs/history, and the operations/CLI lifecycle."
tags: ["domains", "architecture", "boundaries", "ownership"]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-17T11:58:52.754Z
sources:
  - id: openwiki-source-beb468a32961295d57274fd5
    resource: repo://clients/extensions/firefox/README.md
  - id: openwiki-source-5d11880ae09ec95b124fce6d
    resource: repo://docs/architecture/decisions/0021-local-pairing-presence-routing.md
  - id: openwiki-source-2b66c8e72b793ad548b86a29
    resource: repo://docs/architecture/decisions/0062-thread-tabid-through-action-stack.md
  - id: openwiki-source-9b8357af9c7ef75912f57765
    resource: repo://docs/project/CAPABILITY_MATRIX.md
  - id: openwiki-source-a427fd56d2e816788e10b541
    resource: repo://docs/project/POSITIONING.md
  - id: openwiki-source-cbad6d495fc481cc62e88aef
    resource: repo://docs/security/THREAT_MODEL.md
  - id: openwiki-source-265221f77947a8a08e9a018a
    resource: repo://packages/shared/src/index.ts
  - id: openwiki-source-c20cbcf46daa07e6332e3f7f
    resource: repo://packages/shared/src/protocol.ts
  - id: openwiki-source-ae59149c7733dd98fdeaead4
    resource: repo://servers/mcp/bin/brijio.mjs
  - id: openwiki-source-cde1053eb49eff18dfbe3aeb
    resource: repo://servers/mcp/src/daemon.ts
  - id: openwiki-source-a31d986242ba99fdbb81c244
    resource: repo://servers/mcp/src/doctor.ts
  - id: openwiki-source-1e871ebe65ae85a216285234
    resource: repo://servers/mcp/src/http-server.ts
  - id: openwiki-source-36c61251055ea6d2f82f0b4e
    resource: repo://servers/mcp/src/mcp-server.ts
  - id: openwiki-source-0659ad40ad11a3d8ac2d12fe
    resource: repo://servers/mcp/src/network.ts
  - id: openwiki-source-ee21ae7b3a961f6fa317c79f
    resource: repo://servers/mcp/src/print-config.ts
  - id: openwiki-source-5bc72e6946e4ebd3ab1afe08
    resource: repo://servers/mcp/src/startup-banner.ts
  - id: openwiki-source-875036d8e83469fa1fc3f8e3
    resource: repo://servers/websocket/src/server.ts
generated: { by: "openwiki/0.7.2", at: "2026-10-17T11:58:52.754Z" }
---

# Major Domains

Brijio is a monorepo organized around a small number of explicit domains. Keeping these domains separate is what lets the relay, the MCP server, and the browser adapters evolve independently behind a shared protocol. When a change crosses a boundary, the order of edits matters (see the [practical rule](#practical-rule-for-cross-domain-changes) below); when it does not, each domain can be changed in isolation.

## 1. Shared protocol and browser-agnostic logic

**Primary source:** `packages/shared/src`

This domain owns the data model and reusable logic that both servers and browser extensions depend on. It is the one place a protocol change should land, because every other domain consumes it through the package barrel `packages/shared/src/index.ts`.

The core contract lives in `packages/shared/src/protocol.ts`, which defines the WebSocket envelope (`BrijioEnvelope`), the two roles (`extension`, `mcp`), auth and presence payloads, the `BrowserCapability` set, browser presence metadata, tab-listing shapes, staged file upload messages, and download/fetch status shapes. Because capability names and message types originate here, adding a new browser action touches this domain before any tool, relay route, or extension handler.

Beyond the protocol, the shared package owns browser-agnostic implementation that both extension adapters build on: page-context extraction (`page-context.ts`), paginated page-content chunking (`page-content.ts`, `page-reader.ts`), background controller logic (`background-controller.ts`), content-script message handling (`content-handler.ts`), batch handling (`batch-handler.ts`), bridge settings, popup helpers, timers, and the logger.

## 2. WebSocket relay

**Primary source:** `servers/websocket/src`

The relay is the transport and routing layer. `servers/websocket/src/server.ts` authenticates clients with the local pairing token (from `BRIJIO_PAIRING_TOKEN`, with `additionalPairingTokens` allowed), scopes connections by a key derived from the token, routes messages between the MCP server role and connected browser-extension roles, and tracks browser presence.

It is intentionally state-light: presence is held in runtime maps (`presence`, `pendingRequests`) and disappears when a socket closes. There is no durable store and no content inspection requirement — the relay forwards envelopes rather than interpreting their payloads. A `/health` endpoint reports version, uptime, and the currently connected browser instances.

## 3. MCP server

**Primary source:** `servers/mcp/src`

This is the agent-facing surface. `servers/mcp/src/mcp-server.ts` builds the `McpServer` instance that exposes browser resources (e.g. `browser://page/current` and the paginated `browser://page/current/content/{index}` template), tool calls (`list_browsers`, `list_tabs`, `click_element`, `fill_input`, form actions, `navigate_to_url`, `open_tab`, `read_current_page`, batch, download/fetch, screenshot), skill resources, and the `brijio-context` session-start prompt. Tools delegate to tool modules in this directory, which in turn call `servers/mcp/src/websocket-client.ts` to reach a connected browser through the relay.

The MCP server is served over HTTP. `servers/mcp/src/http-server.ts` wraps the MCP `StreamableHTTPServerTransport`, enforces the `MCP_HTTP_AUTH_TOKEN`, exposes `/health`, and configures request/approval timeouts from env. The package also ships a browser-friendly demo site under `servers/mcp/demo` (served by `demo-server.ts`) and skill markdown under `servers/mcp/skills`.

## 4. Browser extensions

**Primary sources:** `clients/extensions/chrome`, `clients/extensions/safari`

These packages implement the browser-side bridge — the background service worker, content-script entry, and popup that talk to the relay and perform on-page actions. They differ in API surface and packaging (manifests, MV2/MV3 differences, Safari platform-specific builds), but they share logic from `packages/shared` and follow the same product rules:

- **User-controlled activation** — the user starts and stops the bridge; nothing happens in the background.
- **Explicit request/response** — actions are discrete, agent-initiated, and return a single result.
- **No continuous streaming** — there is no persistent data feed from the browser.
- **Page context before page content** — structured context is gathered and disclosed before full page content is read.
- **Short-lived ID targeting** — actions target tabs/elements through short-lived identifiers rather than stable handles.

Chrome is the first and reference implementation. Safari is a parallel implementation with platform-specific manifests and lifecycle behavior (e.g. non-persistent background on iOS, reconnect-on-wake). A `clients/extensions/firefox` directory reserves the client boundary for a future Firefox extension but is intentionally unimplemented — Firefox packaging and user-control behavior must be designed in a separate ADR first.

## 5. Product and business framing

**Primary sources:** `README.md`, `docs/project/POSITIONING.md`, `docs/project/CAPABILITY_MATRIX.md`

These docs define what Brijio is for and what it is deliberately not. `POSITIONING.md` frames the product around authenticated browser sessions the user already controls, privacy, and explicit control rather than generic browser automation. `CAPABILITY_MATRIX.md` is the canonical product contract: it enumerates every capability, its status (implemented / experimental / planned / intentionally unsupported), browser support, and explicit out-of-scope boundaries. When adding or constraining a capability, this matrix is the cross-domain source of truth that should be kept consistent with the protocol and tools.

## 6. Security and trust

**Primary sources:** `docs/security/THREAT_MODEL.md`, `docs/security/TRUST_BOUNDARIES.md`, `docs/security/SECURITY_GUARANTEES.md`

Security docs explain the trust assumptions behind the bridge and the mitigations that shape the other domains: explicit request/response and no streaming by design, user-controlled connection, progressive disclosure, least-privilege extension permissions, content that is read rather than evaluated, token-based auth on all transports, and user-controlled/self-hostable relay infrastructure. The threat model enumerates malicious-agent, compromised-relay, network-attacker, and malicious-website actors. Changes that weaken any of these guarantees belong in this domain as an ADR or doc update before they reach code.

## 7. Docs and design history

**Primary sources:** `docs/architecture/decisions/*`, `docs/artifacts/*`, `docs/project/*`

The docs tree holds the design history and the current product contract. ADRs under `docs/architecture/decisions/` are the record of why protocol shapes, browser actions, connection behavior, transport choices, and daemon/install design look the way they do; they are especially valuable when changing browser actions, protocol shapes, or connection behavior. ADRs are numbered (e.g. `0021-local-pairing-presence-routing`, `0038-one-command-local-runtime-polish`, `0048-client-side-action-approval`, `0062-thread-tabid-through-action-stack`) and several decisions are referenced directly from source comments, tying code back to rationale.

## 8. Operations and CLI lifecycle

**Primary sources:** `servers/mcp/src/daemon.ts`, `servers/mcp/src/doctor.ts`, `servers/mcp/src/print-config.ts`, `servers/mcp/src/network.ts`, `servers/mcp/src/startup-banner.ts`, `servers/mcp/bin/brijio.mjs`

This domain owns the `brijio` command-line entry point and the local lifecycle of running the bridge — everything that happens outside the MCP/WebSocket request path. It is what users invoke via `npx @brijio/mcp` or the installed `brijio`/legacy `browserbridge` binary.

`servers/mcp/bin/brijio.mjs` is the combined entry point: it loads env (`loadBrijioEnv`/`applyBrijioEnv`), auto-generates `BRIJIO_PAIRING_TOKEN` and `MCP_HTTP_AUTH_TOKEN` when unset and mirrors renamed legacy env vars for compatibility, parses the command via `parseDaemonCommand`, and dispatches to the server stack only in `run`/`demo` mode (server modules are imported dynamically so `--doctor` and `--print-config` never trigger the full server cascade).

The domain provides four kinds of operations, implemented across these files:

- **Daemon lifecycle** (`daemon.ts`): `install`, `uninstall`, `start`, `stop`, `restart`, `status`, and `logs` (`--live`). Install generates the pairing/auth tokens, writes `~/.brijio/.env` (mode `0o600`), a `bin/brijio` wrapper, and a platform service definition — a macOS launchd plist (`com.redvex.brijio`) or a systemd user unit (`brijio.service`) — then loads/enables it. The daemon supports `darwin` and `linux`; other platforms are explicitly unsupported. Status probes the WebSocket and MCP `/health` endpoints.
- **Diagnostics** (`doctor.ts`, `network.ts`): `--doctor` runs preflight checks (config presence, MCP/WebSocket port availability, network detection, Node version) and exits non-zero on failures. `network.ts` detects Tailscale (100.64.0.0/10 CGNAT range), mDNS, and localhost paths to choose the most reachable host.
- **Config generation** (`print-config.ts`, `print-config-commands.ts`): `--print-config [agent]` emits a ready-to-paste MCP client config for a known agent (Claude Desktop, Cursor, VS Code, Codex, Gemini, etc.); interactive selection when a TTY is present, JSON otherwise. It uses detected network paths to pick the best MCP/WS URL.
- **Startup banner** (`startup-banner.ts`): formats the "Brijio ready" banner with reachable URLs and token provenance (user-provided vs auto-generated/ephemeral). All banner output goes to stderr so stdout stays clean for piping; in `--dev` mode it forces `127.0.0.1` and skips network detection.

The entry point also coordinates graceful shutdown on `SIGINT`/`SIGTERM`, closing the WebSocket server, MCP runtime, and demo server together. Because this domain wires env defaults and server startup, changes to runtime configuration, ports, or tokens land here before they reach the server domain.

## Practical rule for cross-domain changes

If a change touches more than one domain, update the shared protocol or an ADR first, then the relay/server, then the browser adapters. This keeps the repo's explicit-contract style intact and reduces hidden coupling:

1. **Protocol/ADR first** — change `packages/shared/src/protocol.ts` (or record an ADR) so the contract is explicit before any consumer is edited.
2. **Relay/server** — update `servers/websocket` routing and the `servers/mcp` tool/resource definitions to match the new contract.
3. **Browser adapters** — finally update the Chrome and Safari extension handlers that implement the new capability or shape.

Security guarantees ([domain 6](#6-security-and-trust)) and the product contract ([domain 5](#5-product-and-business-framing)) act as cross-cutting constraints: a change that affects trust boundaries or capability scope should be reflected in those docs as part of the same change, not as an afterthought.
