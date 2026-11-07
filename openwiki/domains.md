---
type: "Reference"
title: "Major Domains"
description: "The seven major source domains of the Brijio monorepo and the cross-domain change rule: update shared protocol/ADR first, then relay/server, then browser adapters and integration tests."
tags: ["domains", "architecture", "ownership", "navigation"]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-07T14:40:48.642Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-beb468a32961295d57274fd5
    resource: repo://clients/extensions/firefox/README.md
  - id: openwiki-source-4d09410afcbfa31fdd6833ec
    resource: repo://clients/extensions/safari/README.md
  - id: openwiki-source-b7358bac5e08b21894e5a4c3
    resource: repo://docs/architecture/decisions/0001-initial-project-skeleton.md
  - id: openwiki-source-9b8357af9c7ef75912f57765
    resource: repo://docs/project/CAPABILITY_MATRIX.md
  - id: openwiki-source-cbad6d495fc481cc62e88aef
    resource: repo://docs/security/THREAT_MODEL.md
  - id: openwiki-source-0c22eda9f95dd622fb06ce00
    resource: repo://docs/security/TRUST_BOUNDARIES.md
  - id: openwiki-source-c20cbcf46daa07e6332e3f7f
    resource: repo://packages/shared/src/protocol.ts
  - id: openwiki-source-45ccf4ff163f6f2991c87ac1
    resource: repo://servers/mcp/README.md
  - id: openwiki-source-7d51d72f7d5ff18de3dc5015
    resource: repo://servers/websocket/README.md
generated: { by: "openwiki/0.9.0", at: "2026-11-07T14:40:48.642Z" }
---

# Major Domains

This repository has a few clear domains that future agents should keep separate when making changes. This page is a navigation/orientation summary; defer detail to the dedicated concept and architecture pages.

## 1. Shared protocol and browser-agnostic logic

**Primary source:** `packages/shared`

Ownership: define the data model and reusable logic that both servers and browser extensions depend on, so protocol shapes are never duplicated.

The most important file is `packages/shared/src/protocol.ts`, which defines the WebSocket envelope, auth and presence messages, browser capability names, browser presence metadata, tab-listing shapes, staged file upload messages, and download and fetch status shapes. The shared package also contains page-context extraction, page-content chunking, the background controller that drives both adapters, content/batch handlers, timers, popup helpers, and the logger.

<!-- openwiki: broken internal link [../concepts/browser-adapters.md] file "../concepts/browser-adapters.md" does not exist. Fix the href or restore the target, then delete this comment. -->

See [Browser Adapters](../concepts/browser-adapters.md) for how the shared controller is reused across browser packages.

## 2. WebSocket relay

**Primary source:** `servers/websocket`

Ownership: act as the transport and routing layer that authenticates clients with the local pairing token and routes messages between the MCP server and connected browser extensions.

<!-- openwiki: broken internal link [../architecture/websocket-relay.md] file "../architecture/websocket-relay.md" does not exist. Fix the href or restore the target, then delete this comment. -->

It is intentionally state-light: presence is runtime-only and is removed when the socket closes. The relay never holds page URL, title, content, or DOM state. Invalid JSON, auth failures, unsupported messages, missing browsers, and invalid or ambiguous targets all return structured errors. See [WebSocket Relay](../architecture/websocket-relay.md).

## 3. MCP server

**Primary source:** `servers/mcp`

Ownership: expose the agent-facing surface — browser resources, tool calls, and skills through the Model Context Protocol — and reach connected browser extensions through the WebSocket relay.

<!-- openwiki: broken internal link [../concepts/mcp-tool-surface.md] file "../concepts/mcp-tool-surface.md" does not exist. Fix the href or restore the target, then delete this comment. -->

It uses the WebSocket relay to reach connected browser extensions and returns structured results to the agent. The server also ships a browser-friendly demo site under `servers/mcp/demo` and skill markdown under `servers/mcp/skills`. See [MCP Tool Surface](../concepts/mcp-tool-surface.md).

## 4. Browser extensions

**Primary sources:** `clients/extensions/chrome`, `clients/extensions/safari`

Ownership: implement the browser-side bridge as thin adapters that delegate shared behavior to `packages/shared`, keeping platform differences isolated.

Chrome is the first implementation; Safari is a parallel implementation with platform-specific manifests and MV2/MV3 differences. Both share the same product rules:

- user-controlled activation
- explicit request/response behavior
- no continuous streaming
- page context before page content
- action targeting through short-lived IDs

`clients/extensions/firefox` exists only as a reserved boundary: Firefox support is planned but not implemented, and its packaging, permissions, and user-control behavior must be designed in a separate ADR before implementation starts.

## 5. Product and business framing

**Primary sources:** `docs/project/CAPABILITY_MATRIX.md`, `docs/project/POSITIONING.md`, `docs/project/ROADMAP.md`

Ownership: explain what Brijio is for and what it is not, and record current capability and support status.

The product is positioned around authenticated browser sessions, privacy, and explicit control, not generic browser automation. The capability matrix is the authority for current product contract and per-platform support status.

## 6. Security and trust

**Primary sources:** `docs/security/THREAT_MODEL.md`, `docs/security/TRUST_BOUNDARIES.md`, `docs/security/SECURITY_GUARANTEES.md`

<!-- openwiki: broken internal link [../security.md] file "../security.md" does not exist. Fix the href or restore the target, then delete this comment. -->

Ownership: document the trust assumptions behind the bridge and why the project avoids credential export, browser cloning, and ambient browser surveillance. See [Security](../security.md).

## 7. Docs and design history

**Primary sources:** `docs/architecture/decisions/*`, `docs/artifacts/*`, `docs/project/*`

Ownership: record the design history and accepted architectural decisions. ADRs are especially valuable when changing browser actions, protocol shapes, or connection behavior; an ADR is required before implementation when a change alters a capability, protocol, boundary, or trust assumption.

## Practical rule for future changes

If a change touches more than one domain, update the shared protocol or ADR first, then the relay/server, then the browser adapters and integration tests. The full cross-layer path to check, from `AGENTS.md`, is:

```text
shared protocol -> WebSocket relay -> MCP surface -> shared controller
                -> Chrome adapter -> Safari adapter -> integration tests
```

<!-- openwiki: broken internal link [../architecture.md] file "../architecture.md" does not exist. Fix the href or restore the target, then delete this comment. -->

When changing a protocol or browser capability, walk every step of this path: keep protocol definitions in `packages/shared` (never duplicate them), preserve explicit per-call `browserInstanceId` and `tabId` targeting (no hidden selected-browser or selected-tab session state), and update the relevant tests, MCP registration, skills, capability matrix, and OpenWiki pages. This keeps the repo's explicit-contract style intact and reduces hidden coupling. See [Architecture](../architecture.md) for the end-to-end layout.
