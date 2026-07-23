---
type: "Reference"
title: "Protocol and Data Model Guide"
description: "Canonical reference for shared data structures and protocol shapes: WebSocket envelope, browser presence and capabilities, tab listing, file uploads, and download/fetch status."
---

# Protocol and Data Model Guide

This page is the canonical OpenWiki home for the main shared data structures and protocol shapes.

## The canonical envelope

`packages/shared/src/protocol.ts` defines the main message envelope used across the relay and browser clients:

- `WebSocketEnvelope` — `type: 'message'`, optional `id`, optional `target`, and a `payload`
- `BrijioRole` — `extension` or `mcp`
- `AuthPayload` / `AuthSuccessPayload`
- `BrowserPresenceRequestPayload` / `BrowserPresenceAnnouncePayload`

The envelope is intentionally simple and explicit. Targeting information is carried in the envelope rather than hidden in session state.

## Browser presence and capabilities

The shared protocol also defines:

- `BrowserPresence` — browser instance identity, labels, connection timestamps, and supported capabilities
- `BrowserCapability` — named browser feature flags such as `page_context`, `page_content`, `click`, `fill_input`, `navigate`, `batch`, `upload_file`, `download_status`, `download_file`, and `fetch_resource`

These shapes are used by the WebSocket relay and the MCP-facing browser discovery flows.

## Tab listing and tab targeting

The current protocol includes tab-awareness primitives introduced by the explicit tab-selection work:

- `TabInfo` — opaque `tabId`, `windowId`, title, URL, active state, and supported flag
- `ListTabsRequestPayload`
- `TabListResponsePayload` / `TabListErrorResponsePayload`

The important design choice here is that tab targeting is explicit and per-call. The repo does not use hidden session-level “selected tab” state.

## File uploads and download/fetch status

The shared protocol also defines message types for:

- staged file upload start/chunk/complete/ack/error flows
- `DownloadInfo` and `FetchResourceInfo`
- `DownloadStatusRequest` / `DownloadStatusResponse` / `DownloadStatusErrorResponse`

These are part of the browser-action surface, even when a specific product area is still expanding.

## Why this file matters

If you are changing anything that crosses package boundaries, start by checking `packages/shared/src/protocol.ts`. That file is the source of truth for:

- envelope shape
- auth and presence
- tab identity
- browser capabilities
- download and file-upload routing

Changing those shapes without updating the relay, MCP server, and extensions will usually break interoperability.

## Related source files

- `packages/shared/src/protocol.ts`
- `packages/shared/src/index.ts`
- `docs/architecture/decisions/0060-explicit-tab-listing-and-selection.md`
- `docs/architecture/decisions/0062-thread-tabid-through-action-stack.md`
