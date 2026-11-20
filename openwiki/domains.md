---
type: "Reference"
title: "Major Domains"
description: "The major source domains in the Brijio monorepo and their ownership boundaries: shared protocol/logic, WebSocket relay, MCP server, browser extensions, product framing, security, and docs/history."
tags: ["domains", "ownership", "architecture", "monorepo"]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-20T16:42:52.757Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-5a60d3196588e015ba660b7b
    resource: repo://clients/extensions/chrome/package.json
  - id: openwiki-source-beb468a32961295d57274fd5
    resource: repo://clients/extensions/firefox/README.md
  - id: openwiki-source-71a0e8f6d491eb3a2c086e5e
    resource: repo://clients/extensions/safari/package.json
  - id: openwiki-source-ddecf2e5550aae0caa3b51ed
    resource: repo://docs/architecture/decisions/0019-safari-web-extension-and-shared-extension-package.md
  - id: openwiki-source-f69a2741957d0592c2779376
    resource: repo://docs/architecture/decisions/0051-safari-platform-specific-builds.md
  - id: openwiki-source-a31e56605839ce458ceb1d44
    resource: repo://docs/architecture/decisions/0060-explicit-tab-listing-and-selection.md
  - id: openwiki-source-2b66c8e72b793ad548b86a29
    resource: repo://docs/architecture/decisions/0062-thread-tabid-through-action-stack.md
  - id: openwiki-source-d9997f65a04e259507c45268
    resource: repo://docs/architecture/decisions/0063-open-tab-action.md
  - id: openwiki-source-79dd91ec51a55e7e78c52ccc
    resource: repo://docs/architecture/decisions/0064-visual-action-verification.md
  - id: openwiki-source-9b8357af9c7ef75912f57765
    resource: repo://docs/project/CAPABILITY_MATRIX.md
  - id: openwiki-source-a427fd56d2e816788e10b541
    resource: repo://docs/project/POSITIONING.md
  - id: openwiki-source-aae624fcff023b16e3665555
    resource: repo://docs/security/SECURITY_GUARANTEES.md
  - id: openwiki-source-cbad6d495fc481cc62e88aef
    resource: repo://docs/security/THREAT_MODEL.md
  - id: openwiki-source-0c22eda9f95dd622fb06ce00
    resource: repo://docs/security/TRUST_BOUNDARIES.md
  - id: openwiki-source-c83ceec2d47257f066951051
    resource: repo://packages/shared/package.json
  - id: openwiki-source-40275cb92c3610938f16ade3
    resource: repo://pnpm-workspace.yaml
  - id: openwiki-source-ceadb6a3b6b9b72b892f43ce
    resource: repo://servers/mcp/package.json
  - id: openwiki-source-475cb24dac2da48673b37928
    resource: repo://servers/websocket/package.json
generated: { by: "openwiki/0.9.0", at: "2026-11-20T16:42:52.757Z" }
---

# Major Domains

This repository has a few clear domains that future agents should keep separate when making changes. The workspace groups them under `packages/*`, `servers/*`, and `clients/extensions/*` (see `pnpm-workspace.yaml`), and [AGENTS.md](../AGENTS.md) is the authority for which layer owns what. Each runtime domain links to a dedicated architecture deep-dive on [Architecture](architecture.md); cross-domain change ordering is summarized at the end.

## 1. Shared protocol and browser-agnostic logic

**Primary source:** `packages/shared` (`@brijio/shared`) — see [Shared Package](architecture/shared-package.md).

This domain owns the data model and reusable logic that both servers and browser extensions depend on. The most important file is `packages/shared/src/protocol.ts`, which defines:

- the WebSocket envelope
- auth and presence messages
- browser capability names
- browser presence metadata
- tab-listing shapes
- staged file upload messages
- download and fetch status shapes

The shared package also contains page-context extraction, page-content chunking, background controller logic, timers, popup helpers, and logger utilities. Protocol shapes must live here and not be duplicated in the servers or adapters.

## 2. WebSocket relay

**Primary source:** `servers/websocket` (`@brijio/websocket`) — see [WebSocket Relay](architecture/websocket-relay.md).

This service is the transport and routing layer. It authenticates clients with the local pairing token and routes messages between the MCP server and connected browser extensions. It is intentionally state-light: presence is runtime-only and disappears when the socket closes. Relay authentication, presence, and routing belong here.

## 3. MCP server

**Primary source:** `servers/mcp` (`@brijio/mcp`) — see [MCP Server](architecture/mcp-server.md).

This is the agent-facing surface. It exposes browser resources, tool calls, prompts, and skills through the Model Context Protocol. It uses the WebSocket relay to reach connected browser extensions and returns structured results to the agent. Agent-facing tools, resources, prompts, and skills belong here.

The server also ships a browser-friendly demo site under `servers/mcp/demo` and skill markdown under `servers/mcp/skills`.

## 4. Browser extensions

**Primary sources:** `clients/extensions/chrome`, `clients/extensions/safari` — see [Browser Extensions](architecture/browser-extensions.md).

These packages implement the browser-side bridge. They differ in API surface and packaging, but share the same product rules:

- user-controlled activation
- explicit request/response behavior
- no continuous streaming
- page context before page content
- action targeting through short-lived IDs

**Chrome** is the first implementation. **Safari** is a parallel implementation with platform-specific manifests and MV2/MV3 differences: its build emits separate `dist-ios` and `dist-macos` bundles and generates platform manifests via `scripts/create-platform-manifest.mjs`. **Firefox** is a placeholder only — `clients/extensions/firefox` contains just a `README.md` reserving the client boundary, and Firefox packaging, permissions, and user-control behavior must be designed in a separate ADR before implementation starts. Browser-specific integration belongs in the extension adapters; keep adapters thin and share behavior through `packages/shared`.

## 5. Product and business framing

**Primary sources:** [README.md](../README.md), `docs/project/POSITIONING.md`, `docs/project/CAPABILITY_MATRIX.md`.

These docs explain what Brijio is for and what it is not. The product is positioned around authenticated browser sessions, privacy, and explicit control, not generic browser automation. `docs/project/CAPABILITY_MATRIX.md` is the canonical product contract and support-status source; `docs/project/ROADMAP.md` tracks direction.

## 6. Security and trust

**Primary sources:** `docs/security/THREAT_MODEL.md`, `docs/security/TRUST_BOUNDARIES.md`, `docs/security/SECURITY_GUARANTEES.md` — see [Security](security.md).

Security docs explain the trust assumptions behind the bridge and why the project avoids credential export, browser cloning, and ambient browser surveillance. They are the authority for security intent and trust boundaries.

## 7. Docs and design history

**Primary sources:** `docs/architecture/decisions/*`, `docs/artifacts/*`, `docs/project/*`.

The docs tree contains the design history and the current product contract. ADRs under `docs/architecture/decisions/` are especially valuable when changing browser actions, protocol shapes, or connection behavior; `docs/artifacts/` holds completed feature and operational explanations. Recent ADRs set the current direction for tab handling and visual verification:

- [0060 — Explicit tab listing and selection](../docs/architecture/decisions/0060-explicit-tab-listing-and-selection.md)
- [0062 — Thread tabId through action stack](../docs/architecture/decisions/0062-thread-tabid-through-action-stack.md)
- [0063 — Open tab action](../docs/architecture/decisions/0063-open-tab-action.md)
- [0064 — Visual action verification](../docs/architecture/decisions/0064-visual-action-verification.md)

## Practical rule for future changes

If a change touches more than one domain, update the shared protocol or ADR first, then the relay/server, then the browser adapters. This keeps the repo’s explicit-contract style intact and reduces hidden coupling. [AGENTS.md](../AGENTS.md) states the full cross-layer path to check:

```text
shared protocol -> WebSocket relay -> MCP surface -> shared controller
                -> Chrome adapter -> Safari adapter -> integration tests
```

Additional cross-layer rules: preserve explicit per-call browser and `tabId` targeting (no hidden selected-browser or selected-tab session state); re-read page context after navigation or a mutation that can invalidate short-lived target IDs; and when tool behavior changes, update its tests, MCP registration, relevant skills, the capability matrix, and relevant OpenWiki workflow pages (see [Workflows](workflows.md)).
