---
type: "Reference"
title: "Major Domains"
description: "The major source domains in the Brijio monorepo and their ownership boundaries: shared protocol/logic, WebSocket relay, MCP server, browser extensions, product framing, security, docs/history, and operations."
tags: ["domains", "ownership", "architecture", "monorepo"]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-31T14:18:08.591Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-0f5d8a945cabdf67f37b9ad7
    resource: repo://clients/extensions/chrome/src/background.ts
  - id: openwiki-source-fa213a96cd30a09d577d0a92
    resource: repo://clients/extensions/chrome/src/permissions.ts
  - id: openwiki-source-beb468a32961295d57274fd5
    resource: repo://clients/extensions/firefox/README.md
  - id: openwiki-source-151988bbc60a918980820e71
    resource: repo://clients/extensions/safari/src/background.ts
  - id: openwiki-source-b1b279dd38a2cf03093a02f6
    resource: repo://clients/extensions/safari/src/permissions.ts
  - id: openwiki-source-23af01cda0192b6fe464acfc
    resource: repo://clients/extensions/safari/src/placeholder.ts
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
  - id: openwiki-source-1e871ebe65ae85a216285234
    resource: repo://servers/mcp/src/http-server.ts
  - id: openwiki-source-f1f5d8584551c3d42e50d725
    resource: repo://servers/mcp/src/index.ts
  - id: openwiki-source-36c61251055ea6d2f82f0b4e
    resource: repo://servers/mcp/src/mcp-server.ts
  - id: openwiki-source-ee21ae7b3a961f6fa317c79f
    resource: repo://servers/mcp/src/print-config.ts
  - id: openwiki-source-13054dea741b794a82597d0c
    resource: repo://servers/mcp/src/skills.ts
  - id: openwiki-source-48524485166ed3cd7c7732bd
    resource: repo://servers/websocket/src/index.ts
  - id: openwiki-source-875036d8e83469fa1fc3f8e3
    resource: repo://servers/websocket/src/server.ts
generated: { by: "openwiki/0.7.2", at: "2026-10-31T14:18:08.591Z" }
---

# Major Domains

Brijio is a monorepo with a few clear domains. Future agents should keep changes inside the domain that owns the behavior and update cross-domain contracts in the right order. The ownership boundaries below mirror `AGENTS.md` so the code, the agent instructions, and this wiki stay aligned.

## 1. Shared protocol and browser-agnostic logic

**Primary source:** `packages/shared`

This domain owns the data model and reusable logic that both servers and browser extensions depend on. `packages/shared/src/index.ts` re-exports the shared modules, and `packages/shared/src/protocol.ts` is the single source of truth for the protocol shapes (see [Protocol and Data Model Guide](data-and-protocol.md)):

- the WebSocket envelope
- auth and presence messages
- browser capability names
- browser presence metadata
- tab-listing shapes
- staged file upload messages
- download and fetch status shapes

Beyond protocol, the shared package owns page-context extraction (`page-context.ts`), page-content chunking (`page-content.ts`), the background controller that runs the extension connection lifecycle (`background-controller.ts`), page reading (`page-reader.ts`), batch handling, timers, popup helpers, and the logger. Protocol definitions belong here and should not be duplicated elsewhere.

## 2. WebSocket relay

**Primary source:** `servers/websocket`

This service is the transport and routing layer. Its entrypoint `servers/websocket/src/index.ts` reads `WEBSOCKET_HOST`/`WEBSOCKET_PORT` (default `0.0.0.0:8787`) and starts `createWebSocketServer` in `servers/websocket/src/server.ts`. It authenticates clients with the local pairing token (`BRIJIO_PAIRING_TOKEN`), derives a token-scoped key, routes messages between the MCP server and connected browser extensions, and exposes `GET /health`. It is intentionally state-light: browser presence is kept in an in-memory per-scope map and disappears when the socket closes.

## 3. MCP server

**Primary source:** `servers/mcp`

This is the agent-facing surface. `servers/mcp/src/index.ts` derives options from environment and starts the HTTP/MCP server in `servers/mcp/src/http-server.ts`; tool/resource/prompt registrations live in `servers/mcp/src/mcp-server.ts`. It exposes browser resources, tool calls, a session-start prompt, and skills through the Model Context Protocol, uses the WebSocket relay to reach connected browser extensions, and returns structured results to the agent. Skills are loaded from `servers/mcp/skills/` and exposed as `skill://{name}` resources.

This domain also owns the operations surface that runs and inspects the server: the daemon lifecycle in `servers/mcp/src/daemon.ts`, `GET /health` on the MCP server, `--doctor` diagnostics (`doctor.ts`), `--print-config` agent config blocks (`print-config.ts`), and the demo site under `servers/mcp/demo`. Running and inspecting this surface is covered in [Operations: Daemon, Config, and Health](operations.md).

## 4. Browser extensions

**Primary sources:** `clients/extensions/chrome`, `clients/extensions/safari`

These packages implement the browser-side bridge as thin, platform-specific adapters around the shared logic in `packages/shared`. Both instantiate the shared background controller with platform adapters and connect only after explicit user action, authenticate with the relay using the pairing token, announce presence, and answer explicit browser requests. They share the same product rules:

- user-controlled activation
- explicit request/response behavior
- no continuous streaming
- page context before page content
- action targeting through short-lived IDs

Chrome is the first implementation. Safari is a parallel implementation with platform-specific manifests and MV2/MV3 packaging differences; both grant broad host permission at install time rather than via a runtime permission request. Keep adapters thin and keep shared behavior in `packages/shared`; document and test intentional platform differences.

### Firefox is a placeholder only

`clients/extensions/firefox` exists to reserve the client boundary for a future Firefox extension. Firefox support is planned but not implemented; its packaging, permissions, and user-control behavior should be designed in a separate ADR before implementation starts. See `clients/extensions/firefox/README.md` and the Firefox column in `docs/project/CAPABILITY_MATRIX.md`.

## 5. Product and business framing

**Primary sources:** `README.md`, `docs/project/POSITIONING.md`, `docs/project/CAPABILITY_MATRIX.md`

These docs explain what Brijio is for and what it is not. The product is positioned around authenticated browser sessions, privacy, and explicit control, not generic browser automation. The capability matrix is the canonical product contract: it records the status and browser support of every tool, resource, prompt, and skill, and the explicit non-goals (no cookie export, session cloning, continuous screenshots, background surveillance, or credential extraction). When a capability's status or support changes, update the matrix first, then linked references.

## 6. Security and trust

**Primary sources:** `docs/security/THREAT_MODEL.md`, `docs/security/TRUST_BOUNDARIES.md`, `docs/security/SECURITY_GUARANTEES.md`

Security docs explain the trust assumptions behind the bridge and why the project avoids credential export, browser cloning, and ambient browser surveillance. They define the threat actors (malicious agent, compromised relay, network attacker, malicious website) and the architectural mitigations. See [Security and Trust Model](security.md) for the consolidated posture and change guidance.

## 7. Docs and design history

**Primary sources:** `docs/architecture/decisions/*`, `docs/artifacts/*`, `docs/project/*`

The docs tree contains the design history and the current product contract. ADRs under `docs/architecture/decisions/` are especially valuable when changing browser actions, protocol shapes, or connection behavior: create an ADR as `Proposed` for capability, protocol, boundary, auth, or routing changes, and mark it `Accepted` after approval. See [Architecture Overview](architecture.md) for pointers to the most recent architecture-relevant decisions.

## 8. Operations

**Primary sources:** `servers/mcp/src/daemon.ts`, `servers/mcp/src/http-server.ts`, `servers/mcp/src/doctor.ts`, `servers/mcp/src/print-config.ts`, `docker-compose.yml`

This domain covers running and inspecting Brijio rather than changing its behavior. The daemon in `servers/mcp/src/daemon.ts` implements the `brijio` CLI subcommands (`run`, `demo`, `print-config`, `doctor`, `install`, `uninstall`, `start`, `stop`, `restart`, `status`, `logs`) with platform handling for macOS launchd and Linux systemd. Both servers expose `GET /health` (the relay reports connected extensions; the MCP server reports version, uptime, and relay reachability). `--doctor` runs preflight checks, `--print-config` emits ready-to-paste agent config blocks, and `docker-compose.yml` defines the `runtime`, `legacy-runtime`, and `test` profiles. For the full operational surface, see [Operations: Daemon, Config, and Health](operations.md).

## Practical rule for future changes

When a change touches more than one domain, update the shared protocol or ADR first, then the relay/server, then the browser adapters. This keeps the repo's explicit-contract style intact and reduces hidden coupling. From `AGENTS.md`, the cross-layer path to check is:

```text
shared protocol -> WebSocket relay -> MCP surface -> shared controller
                -> Chrome adapter -> Safari adapter -> integration tests
```

Additional rules from `AGENTS.md`:

- Keep protocol definitions in `packages/shared`; do not duplicate them.
- Preserve explicit per-call `browserInstanceId` and `tabId` targeting; do not introduce hidden selected-browser or selected-tab session state.
- When tool behavior changes, update its tests, MCP registration, relevant skills under `servers/mcp/skills`, the capability matrix, and relevant OpenWiki workflow pages.
- Consider both Chrome and Safari for shared browser behavior, and document and test intentional platform differences.
