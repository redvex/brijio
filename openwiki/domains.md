---
type: "Reference"
title: "Major Domains"
description: "The major source domains in the Brijio monorepo and their ownership boundaries, so agents keep changes scoped and respect the shared-protocol-first change order."
tags: [domains, ownership, architecture, navigation]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-14T14:46:23.462Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-dacf7bd89f09b6d1db0c5fa2
    resource: repo://clients/extensions/chrome/manifest.json
  - id: openwiki-source-beb468a32961295d57274fd5
    resource: repo://clients/extensions/firefox/README.md
  - id: openwiki-source-918a0bd56842e75b089b67a5
    resource: repo://clients/extensions/safari/manifest.json
  - id: openwiki-source-4d09410afcbfa31fdd6833ec
    resource: repo://clients/extensions/safari/README.md
  - id: openwiki-source-2b66c8e72b793ad548b86a29
    resource: repo://docs/architecture/decisions/0062-thread-tabid-through-action-stack.md
  - id: openwiki-source-ddb891893094959f285c6239
    resource: repo://docs/artifacts/client-side-action-approval.md
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
  - id: openwiki-source-c20cbcf46daa07e6332e3f7f
    resource: repo://packages/shared/src/protocol.ts
  - id: openwiki-source-9330fd97faba923ccd9421c6
    resource: repo://servers/mcp/demo/index.html
  - id: openwiki-source-9d0286f606200dfc6de654df
    resource: repo://servers/mcp/skills/navigation/SKILL.md
  - id: openwiki-source-36c61251055ea6d2f82f0b4e
    resource: repo://servers/mcp/src/mcp-server.ts
  - id: openwiki-source-875036d8e83469fa1fc3f8e3
    resource: repo://servers/websocket/src/server.ts
generated: { by: "openwiki/0.9.0", at: "2026-11-14T14:46:23.462Z" }
---

# Major Domains

This repository has a few clear domains that future agents should keep
separate when making changes. Each domain below lists its primary source path
and a one-line ownership responsibility. This page is a navigational/ownership
map; for architecture and protocol detail see the related pages at the end.

## 1. Shared protocol and browser-agnostic logic

**Primary source:** `packages/shared`

Ownership: the data model and reusable logic that both servers and browser
extensions depend on, kept browser-agnostic so adapters stay thin.

The central file is `packages/shared/src/protocol.ts`, which defines the
WebSocket envelope, auth and presence messages, browser capability names,
browser presence metadata, tab-listing shapes, staged file upload messages,
and download/fetch status shapes. The shared package also contains
page-context extraction, page-content chunking, the adapter-driven background
controller, content-script handlers, timers, popup helpers, and logger
utilities. Protocol shapes must live here and not be duplicated in servers or
adapters.

## 2. WebSocket relay

**Primary source:** `servers/websocket`

Ownership: the transport and routing layer that authenticates clients with the
local pairing token and forwards messages between the MCP server and connected
browser extensions.

It is intentionally state-light: presence is runtime-only and disappears when
the socket closes. Relay authentication, presence, and routing belong here.

## 3. MCP server

**Primary source:** `servers/mcp`

Ownership: the agent-facing surface that exposes browser resources, tool calls,
prompts, and skills through the Model Context Protocol, reaching connected
browser extensions via the WebSocket relay and returning structured results to
the agent.

The server also ships a browser-friendly demo site under `servers/mcp/demo`
and skill markdown under `servers/mcp/skills` (e.g. navigation, data-extraction,
form-filling, web-qa, accessibility, monitoring). Tool behavior changes must
update the tool's tests, MCP registration, relevant skills, the capability
matrix, and relevant OpenWiki workflow pages.

## 4. Browser extensions

**Primary sources:** `clients/extensions/chrome`, `clients/extensions/safari`

Ownership: the browser-side bridge that wires shared protocol/controller logic
to platform-specific WebExtension APIs, keeping adapters thin and shared
behavior in `@brijio/shared`.

Chrome is the first implementation (MV3 service worker, `chrome.*` namespace).
Safari is a parallel implementation (MV2 background page, `browser.*`
namespace, text-only badge, broad host permissions at install time). They
differ in API surface and packaging, but share the same product rules:

- user-controlled activation
- explicit request/response behavior
- no continuous streaming
- page context before page content
- action targeting through short-lived IDs

**Firefox is currently a placeholder:** `clients/extensions/firefox` contains
only a README reserving the client boundary. Firefox packaging, permissions,
and user-control behavior should be designed in a separate ADR before any
implementation starts.

## 5. Product and business framing

**Primary sources:** `README.md`, `docs/project/POSITIONING.md`,
`docs/project/CAPABILITY_MATRIX.md`

Ownership: the product contract that explains what Brijio is for and what it is
not — authenticated browser sessions, privacy, and explicit control rather
than generic browser automation. `CAPABILITY_MATRIX.md` is the authority for
current product contract and support status and must be updated when
capabilities or support status change.

## 6. Security and trust

**Primary sources:** `docs/security/THREAT_MODEL.md`,
`docs/security/TRUST_BOUNDARIES.md`, `docs/security/SECURITY_GUARANTEES.md`

Ownership: the trust assumptions and guarantees behind the bridge, and why the
project avoids credential export, session cloning, ambient browser
surveillance, and continuous streaming.

## 7. Docs and design history

**Primary sources:** `docs/architecture/decisions/*`, `docs/artifacts/*`,
`docs/project/*`

Ownership: the design history and current product contract. The numbered ADRs
under `docs/architecture/decisions` are the authority for architectural
decisions and design history, and are especially valuable when changing
browser actions, protocol shapes, or connection behavior. Completed feature or
operational explanations live under `docs/artifacts`.

## Practical rule for future changes

If a change touches more than one domain, update the shared protocol or an ADR
first, then the WebSocket relay and/or MCP server, then the browser adapters.
This keeps the repo's explicit-contract style intact and reduces hidden
coupling. When changing a protocol or browser capability, check the full path
from AGENTS.md:

```text
shared protocol -> WebSocket relay -> MCP surface -> shared controller
                -> Chrome adapter -> Safari adapter -> integration tests
```

Additional rules to respect:

- Keep protocol definitions in `packages/shared`; do not duplicate them.
- Consider both Chrome and Safari for shared browser behavior; document and
  test intentional platform differences.
- Preserve explicit per-call browser and `tabId` targeting; do not introduce
  hidden selected-browser or selected-tab session state.
- When `tabId` is optional, preserve the documented active-tab fallback unless
  an accepted ADR changes it.
- Re-read page context after navigation or a mutation that can invalidate
  short-lived target IDs.

## Related pages

- [Architecture](architecture.md)
- [Extension Adapters](architecture/extension-adapters.md)
- [Data and Protocol](data-and-protocol.md)
- [Daemon and Runtime](operations/daemon-and-runtime.md)
- [Security](security.md)
- [Testing](testing.md)
