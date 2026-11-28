---
type: "Reference"
title: "Major Domains"
description: "The major source domains in the Brijio monorepo and their ownership boundaries: shared protocol, WebSocket relay, MCP server, browser extensions, daemon/CLI operations, product framing, security, and docs."
tags:
  [
    domains,
    ownership,
    protocol,
    websocket,
    mcp,
    browser-extension,
    daemon,
    cli,
    security,
  ]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-28T16:38:16.677Z
sources:
  - id: openwiki-source-40f5f962c5456b400be6ed92
    resource: repo://clients/extensions/chrome/README.md
  - id: openwiki-source-beb468a32961295d57274fd5
    resource: repo://clients/extensions/firefox/README.md
  - id: openwiki-source-9b8357af9c7ef75912f57765
    resource: repo://docs/project/CAPABILITY_MATRIX.md
  - id: openwiki-source-265221f77947a8a08e9a018a
    resource: repo://packages/shared/src/index.ts
  - id: openwiki-source-c20cbcf46daa07e6332e3f7f
    resource: repo://packages/shared/src/protocol.ts
  - id: openwiki-source-cde1053eb49eff18dfbe3aeb
    resource: repo://servers/mcp/src/daemon.ts
  - id: openwiki-source-a31d986242ba99fdbb81c244
    resource: repo://servers/mcp/src/doctor.ts
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
generated: { by: "openwiki/0.9.0", at: "2026-11-28T16:38:16.677Z" }
---

# Major Domains

This repository has a few clear domains that future agents should keep separate when making changes. Each domain owns a distinct part of the system and the boundaries between them are deliberate; crossing a boundary usually means changing an explicit contract (the shared protocol or an ADR) before touching the dependents.

## 1. Shared protocol and browser-agnostic logic

**Primary source:** `packages/shared`

This domain owns the data model and reusable logic that both servers and browser extensions depend on. The canonical entry point is `packages/shared/src/index.ts`, which re-exports the main shared modules — protocol, page-content, page-context, background controller, content handler, popup helpers, bridge settings, page reader, logger, and batch handler — so both extensions and the MCP/WebSocket packages depend on one canonical schema rather than duplicating client/server types.

The most important file is `packages/shared/src/protocol.ts`, which defines:

- the WebSocket envelope
- auth and presence messages
- browser capability names
- browser presence metadata
- tab-listing shapes
- staged file upload messages
- download and fetch status shapes

The shared package also contains page-context extraction, page-content chunking, background controller logic, timers, popup helpers, and logger utilities.

## 2. WebSocket relay

**Primary source:** `servers/websocket`

This service is the transport and routing layer. `servers/websocket/src/server.ts` authenticates clients with the local pairing token, scopes presence by a token-derived scope key, tracks browser presence in an in-memory map, and routes messages between the MCP server and connected browser extensions. It is intentionally state-light: presence is runtime-only and disappears when the socket closes, and the relay holds no page content — it only forwards envelopes and tracks presence and pending requests.

## 3. MCP server

**Primary source:** `servers/mcp`

This is the agent-facing surface. `servers/mcp/src/mcp-server.ts` registers the tool and resource surface and translates MCP calls into relay messages, returning structured results to the agent. Tools include the read/navigation tools, write/form action tools, the batch tool, download tools, session-backed fetching, and `capture_screenshot`. It uses the WebSocket relay to reach connected browser extensions. The HTTP boundary is owned by `servers/mcp/src/http-server.ts`.

The server also ships a browser-friendly demo site (`servers/mcp/src/demo-server.ts`, under `servers/mcp/demo`) and skill markdown under `servers/mcp/skills`, each skill directory exposed as an MCP resource.

## 4. Browser extensions

**Primary sources:** `clients/extensions/chrome`, `clients/extensions/safari`

Chrome and Safari are the implemented browser adapters. They differ in API surface and packaging, but share the same product rules through `packages/shared`:

- user-controlled activation
- explicit request/response behavior
- no continuous streaming
- page context before page content
- action targeting through short-lived IDs

Chrome is the first implementation. Safari is a parallel implementation with platform-specific manifests and MV2/MV3 differences, reaching Chrome feature parity using shared logic plus Safari-specific adapters.

**Firefox is a planned stub, not an implemented adapter.** `clients/extensions/firefox/` exists only to reserve the client boundary — it contains a README stating that support is planned but not implemented, and that Firefox packaging, permissions, and user-control behavior should be designed in a separate ADR before implementation starts.

## 5. Daemon and CLI operations

**Primary sources:** `servers/mcp/src/daemon.ts`, `servers/mcp/src/doctor.ts`, `servers/mcp/src/print-config.ts`, `servers/mcp/src/network.ts`, `servers/mcp/src/startup-banner.ts`

Although it lives in the MCP package, the daemon/CLI surface is a distinct operational domain that runs the stack rather than serving agents. The `brijio` (and legacy `browserbridge`) binary at `servers/mcp/bin/brijio.mjs` is the single entry point: it auto-generates `BRIJIO_PAIRING_TOKEN` / `MCP_HTTP_AUTH_TOKEN` when unset, starts both the WebSocket relay and the MCP HTTP server, and manages graceful shutdown.

Beyond plain `run`, the same binary owns the daemon lifecycle and diagnostic commands — `install`, `uninstall`, `start`, `stop`, `restart`, `status`, `logs`, `doctor`, and `print-config` — parsed in `daemon.ts`. `install` provisions a LaunchAgent (macOS) or systemd user unit (Linux) with persisted tokens in `~/.brijio/.env`; `status` probes both `/health` endpoints; `doctor` (`doctor.ts`, ADR-0038) runs preflight checks (config, ports, network, Node version); and `print-config` (`print-config.ts`) emits ready-to-copy blocks for specific agents (Claude Desktop, Codex, Gemini, Hermes, and others).

Network detection (`network.ts`) and the startup banner (`startup-banner.ts`) support the CLI: `network.ts` detects Tailscale, mDNS, and localhost paths so the banner and `--print-config` can print reachable URLs, and `startup-banner.ts` formats that banner (all output goes to stderr so stdout stays clean for piping).

These commands are covered in detail in [Daemon and CLI](operations/daemon-and-cli.md).

## 6. Product and business framing

**Primary sources:** `README.md`, `docs/project/POSITIONING.md`, `docs/project/CAPABILITY_MATRIX.md`

These docs explain what Brijio is for and what it is not. The product is positioned around authenticated browser sessions, privacy, and explicit control, not generic browser automation. `docs/project/CAPABILITY_MATRIX.md` is the canonical product contract, listing every capability, its status (implemented, experimental, planned, intentionally unsupported), and per-browser support (Chrome and Safari implemented; Firefox planned).

## 7. Security and trust

**Primary sources:** `docs/security/THREAT_MODEL.md`, `docs/security/TRUST_BOUNDARIES.md`, `docs/security/SECURITY_GUARANTEES.md`

Security docs explain the trust assumptions behind the bridge and why the project avoids credential export, browser cloning, and ambient browser surveillance.

## 8. Docs and design history

**Primary sources:** `docs/architecture/decisions/*`, `docs/artifacts/*`, `docs/project/*`

The docs tree contains the design history and the current product contract. ADRs are especially valuable when changing browser actions, protocol shapes, or connection behavior.

## Practical rule for future changes

If a change touches more than one domain, update the shared protocol or ADR first, then the relay/server, then the browser adapters. This keeps the repo's explicit-contract style intact and reduces hidden coupling. Operational and lifecycle changes (install, start/stop, doctor, print-config) are the exception: they belong to the daemon/CLI domain in `servers/mcp/src/daemon.ts` and the `brijio` binary, not to the agent-facing MCP surface.
