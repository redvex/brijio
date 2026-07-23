---
type: "Reference"
title: "Architecture Overview"
description: "Brijio runtime architecture: MCP server, WebSocket relay, shared package, and browser extensions. Covers the explicit request/response chain and change guidance by layer."
---

# Architecture Overview

Brijio’s runtime architecture is a simple explicit chain:

```text
Agent -> MCP Server -> WebSocket Server -> Browser Extension -> Browser Session
```

That chain is described in the root README and in `docs/architecture/ARCHITECTURE.md`. The important property is that the browser remains the source of truth: agents do not get a cloned browser or a continuously streamed view of the page.

## Core components

### MCP server (`servers/mcp`)

The MCP server is the agent-facing API surface. It exposes resources and tools, translates MCP calls into relay messages, and returns structured results to the agent. Its package entrypoint is `servers/mcp/src/index.ts`, with the HTTP/MCP runtime assembled around `src/http-server.ts`.

### WebSocket server (`servers/websocket`)

The WebSocket server is the local relay. It authenticates clients with the pairing token, tracks browser presence, and routes messages to the correct browser instance. Its entrypoint is `servers/websocket/src/index.ts`.

### Shared package (`packages/shared`)

This package contains the protocol and browser-agnostic logic used by both extensions and server-side code. `packages/shared/src/index.ts` re-exports the main shared modules, and `packages/shared/src/protocol.ts` defines the canonical message/data shapes.

### Browser extensions (`clients/extensions/*`)

Chrome and Safari each provide browser-specific adapters around the shared logic. They connect only after explicit user action, authenticate with the relay, announce presence, and answer explicit browser requests.

## Request flow

The typical flow is:

1. The user starts the browser bridge in the extension UI.
2. The extension authenticates to the WebSocket relay with a pairing token.
3. The extension announces browser presence.
4. The agent calls an MCP tool or resource.
5. The MCP server sends a structured request to the relay.
6. The relay forwards the request to the target browser instance.
7. The extension reads browser state or performs an approved action.
8. The structured result flows back through the relay to the MCP server.

This explicit request/response model is a core product boundary. It is reinforced by the security posture in `docs/security/THREAT_MODEL.md` and the capability matrix in `docs/project/CAPABILITY_MATRIX.md`.

## Why this architecture exists

Brijio is intentionally not a remote desktop or browser cloning system. The architecture exists to preserve authenticated sessions, reduce privacy exposure, and keep browser control with the user.

That is why the repo favors:

- short-lived, explicit requests over background monitoring
- shared protocol types over duplicated client/server schemas
- browser-agnostic logic in `packages/shared`
- thin browser-specific adapters at the edges

## Change guidance

When changing architecture, start by deciding which layer owns the behavior:

- protocol and data shape changes usually belong in `packages/shared`
- routing and authentication changes belong in `servers/websocket`
- agent-facing tool/resource changes belong in `servers/mcp`
- browser capability changes belong in the browser extensions and shared adapters

If you add or change a cross-cutting flow, check the relevant ADRs under `docs/architecture/decisions/`, especially the recent tab-targeting decisions (`0060` and `0062`).
