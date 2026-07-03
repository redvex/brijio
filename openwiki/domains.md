# Major Domains

This repository has a few clear domains that future agents should keep separate when making changes.

## 1. Shared protocol and browser-agnostic logic

**Primary source:** `packages/shared`

This domain owns the data model and reusable logic that both servers and browser extensions depend on. The most important file is `packages/shared/src/protocol.ts`, which defines:

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

This service is the transport and routing layer. It authenticates clients with the local pairing token and routes messages between the MCP server and connected browser extensions. It is intentionally state-light: presence is runtime-only and disappears when the socket closes.

## 3. MCP server

**Primary source:** `servers/mcp`

This is the agent-facing surface. It exposes browser resources, tool calls, and skills through the Model Context Protocol. It uses the WebSocket relay to reach connected browser extensions and returns structured results to the agent.

The server also ships a browser-friendly demo site under `servers/mcp/demo` and skill markdown under `servers/mcp/skills`.

## 4. Browser extensions

**Primary sources:** `clients/extensions/chrome`, `clients/extensions/safari`

These packages implement the browser-side bridge. They differ in API surface and packaging, but share the same product rules:

- user-controlled activation
- explicit request/response behavior
- no continuous streaming
- page context before page content
- action targeting through short-lived IDs

Chrome is the first implementation. Safari is a parallel implementation with platform-specific manifests and MV2/MV3 differences.

## 5. Product and business framing

**Primary sources:** `README.md`, `docs/project/POSITIONING.md`, `docs/project/CAPABILITY_MATRIX.md`

These docs explain what Brijio is for and what it is not. The product is positioned around authenticated browser sessions, privacy, and explicit control, not generic browser automation.

## 6. Security and trust

**Primary sources:** `docs/security/THREAT_MODEL.md`, `docs/security/TRUST_BOUNDARIES.md`, `docs/security/SECURITY_GUARANTEES.md`

Security docs explain the trust assumptions behind the bridge and why the project avoids credential export, browser cloning, and ambient browser surveillance.

## 7. Docs and design history

**Primary sources:** `docs/architecture/decisions/*`, `docs/artifacts/*`, `docs/project/*`

The docs tree contains the design history and the current product contract. ADRs are especially valuable when changing browser actions, protocol shapes, or connection behavior.

## Practical rule for future changes

If a change touches more than one domain, update the shared protocol or ADR first, then the relay/server, then the browser adapters. This keeps the repo’s explicit-contract style intact and reduces hidden coupling.
