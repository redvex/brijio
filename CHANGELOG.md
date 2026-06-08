# Changelog

All notable changes to Brijio are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Server packages and browser extensions use **independent versioning** — extension releases are tagged separately (`ext-chrome-v*`, `ext-safari-v*`) from server releases (`v*`).

## [Unreleased]

### Changed

- Renamed the project from Brijio to Brijio for current public branding.
- Renamed the publishable MCP runtime package from `@brijio/mcp` to `@brijio/mcp`.
- Added the preferred `brijio` CLI binary while keeping `brijio` as a backwards-compatible alias for the transition window.
- Added `BRIJIO_*` environment variables while preserving `BRIJIO_*` aliases.

## [ext-chrome-v0.1.0] - 2026-06-03

Initial Chrome Web Store submission.

### Added

**Chrome Extension** (`@brijio/chrome-extension`)

- Extension icons (16, 32, 48, 128, 256, 512) for Chrome Web Store
- Manifest production-ready with description, icons, and version
- `pack` script for creating submission ZIP from dist/
- Privacy policy for Chrome Web Store listing
- Store listing description and assets
- Independent versioning from server packages (ADR 0036)

[ext-chrome-v0.1.0]: https://github.com/brijio/mcp/releases/tag/ext-chrome-v0.1.0

## [0.1.0] - 2026-06-02

First official release of Brijio — a user-controlled bridge between
browser extensions and AI agents via the Model Context Protocol.

### Added

**WebSocket Relay Server** (`@brijio/websocket`)

- Single-channel echo and pub/sub WebSocket server (ADR 0002)
- Peer forwarding — routes MCP requests to connected browser extensions
  and relays responses back (ADR 0006)
- Token-based pairing and authentication with scoped routing (ADR 0021)
- Extension keepalive handling at debug level
- `GET /health` endpoint with version, uptime, and connected extension details
- Structured JSON logging via `@brijio/shared` logger
- Per-request observability: request routing, browser targeting, error events

**MCP Server** (`@brijio/mcp`)

- MCP page context resource and reading tool (ADRs 0007, 0009, 0010)
- Rich paginated page content extraction (ADRs 0008, 0009)
- `read_current_page` tool — page context + optional content chunks
- `click_element` tool (ADRs 0012, 0013)
- `fill_input` tool (ADRs 0014, 0015)
- `fill_editable` tool for contenteditable targets
- `set_checked` and `select_options` tools (ADRs 0016, 0017)
- `submit_form` tool
- `list_browsers` tool — answered by WS server from presence data, not
  forwarded to extensions
- HTTP transport mode with Bearer auth (ADR 0023)
- Tailscale-friendly and local-domain-friendly host allowances (ADRs 0025, 0026)
- Tier 1/2/3 skill system with resources, prompts, and plugin manifests
  (ADRs 0027, 0028)
- `GET /health` endpoint with version, uptime, and WebSocket reachability
- Structured logging via shared logger
- Request-level observability: tool calls, resource reads, prompt invocations
- Per-request WebSocket connections to the relay server

**Shared Package** (`@brijio/shared`)

- Shared protocol types, message schemas, and envelope factories
- Structured JSON logger (`createLogger`) writing to stderr
- Token generation utilities
- Protocol type guards (`isAuth*`, `isBrowserPresence*`, `isKeepalive*`, etc.)
- Connection status type and popup UI helpers
- Page reader and content handler helpers

**Chrome Extension**

- Chrome extension bridge client with popup configuration (ADRs 0005, 0030)
- Page context extraction, DOM actions (click, fill, form controls)
- Regular page host permissions model (ADR 0011)
- Extension status UX: last error display, auto-reconnect, in-flight spinner
  (ADR 0032)

**Safari Extension**

- Safari Web Extension package scaffolding (ADR 0019)
- Permissions module with broad host access at install time
- Content script, background script with Safari-specific adapters
- Popup UI for connection management and pairing settings (ADRs 0020, 0024)
- Shared extension code extraction between Chrome and Safari (ADR 0031)

**Infrastructure & DX**

- PR validation GitHub Actions: lint + build/test workflows (ADRs 0003, 0004)
- TypeScript and Markdown lint tooling (`ts-standard`, Prettier)
- One-command startup with dev orchestrator (ADR 0029)
- `Dockerfile.test` and `docker-compose` test profile for CI validation
- Integration test harness: full WS + MCP stack with Docker CI (ADR 0034)
- `.env.example` with documented fields
- Quickstart tutorial documentation

### Project

- Source-available non-commercial license (AGPL-3.0-only) (ADR 0018)
- 34 Architecture Decision Records covering all major design choices
- Monorepo structure: `packages/shared`, `servers/websocket`, `servers/mcp`,
  `clients/extensions/{chrome,safari}`

[0.1.0]: https://github.com/brijio/mcp/releases/tag/v0.1.0
