---
type: "Reference"
title: "Workflows"
description: "Repo-level development workflows: common pnpm commands, per-domain verification patterns, protocol/tab-targeting/screenshot change patterns, and AGENTS.md ADR/TDD conventions."
tags: [workflows, verification, adr, tdd, monorepo, browser-bridge]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-10T14:14:23.130Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-5a60d3196588e015ba660b7b
    resource: repo://clients/extensions/chrome/package.json
  - id: openwiki-source-0f5d8a945cabdf67f37b9ad7
    resource: repo://clients/extensions/chrome/src/background.ts
  - id: openwiki-source-71a0e8f6d491eb3a2c086e5e
    resource: repo://clients/extensions/safari/package.json
  - id: openwiki-source-b79fbbd921df689b4bbdc82f
    resource: repo://docker-compose.yml
  - id: openwiki-source-2b66c8e72b793ad548b86a29
    resource: repo://docs/architecture/decisions/0062-thread-tabid-through-action-stack.md
  - id: openwiki-source-d9997f65a04e259507c45268
    resource: repo://docs/architecture/decisions/0063-open-tab-action.md
  - id: openwiki-source-79dd91ec51a55e7e78c52ccc
    resource: repo://docs/architecture/decisions/0064-visual-action-verification.md
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-c83ceec2d47257f066951051
    resource: repo://packages/shared/package.json
  - id: openwiki-source-5524638d57e96598fd8e40d4
    resource: repo://packages/shared/src/background-controller.ts
  - id: openwiki-source-ceadb6a3b6b9b72b892f43ce
    resource: repo://servers/mcp/package.json
  - id: openwiki-source-475cb24dac2da48673b37928
    resource: repo://servers/websocket/package.json
generated: { by: "openwiki/0.7.2", at: "2026-10-10T14:14:23.130Z" }
---

# Workflows

This page captures the repo-level workflows that matter most when editing Brijio. It mirrors the conventions in `AGENTS.md` and the top-level `package.json`; treat those sources as authoritative and use this page as a navigable map.

## Common commands

The top-level `package.json` defines the workspace-wide entry points. Package manifests are the authority for package-specific scripts.

- `pnpm build` — build all workspace packages (`pnpm -r build`).
- `pnpm test` — run workspace tests plus repo scripts (`pnpm -r test && node --test scripts/*.test.mjs`).
- `pnpm check` — type-check / validation pass across packages (`pnpm -r check`).
- `pnpm lint` — TypeScript and Markdown linting (`pnpm lint:ts && pnpm lint:md`); `lint:ts` runs `ts-standard`, `lint:md` runs `prettier --check`.
- `pnpm dev` — start the local development helper (`scripts/dev.mjs`).
- `pnpm dev:ws` — run the WebSocket server in watch mode (`tsx watch servers/websocket/src/index.ts`).
- `pnpm dev:mcp` — run the MCP server in watch mode (`tsx watch servers/mcp/src/index.ts`).
- `pnpm token` / `pnpm brijio` — generate a local pairing token (`scripts/brijio-token.mjs`).
- `pnpm serve:test-pages` — build and serve the demo/test-pages site (`scripts/build-pages-site.mjs` then `npx serve`).

Per-package scripts (from each package `package.json`):

- `packages/shared` (`@brijio/shared`): `build`, `check`, `test`, `dev` (placeholder).
- `servers/websocket` (`@brijio/websocket`): `build`, `check`, `test`, `dev`.
- `servers/mcp` (`@brijio/mcp`): `build`, `check`, `test`, `dev`, `prepublishOnly`.
- `clients/extensions/chrome` (`@brijio/chrome-extension`): `build`, `check`, `test`, `pack`, `dev` (placeholder).
- `clients/extensions/safari` (`@brijio/safari-extension`): `build`, `check`, `test`, `dev` (placeholder).

## What to run after making changes

Run the smallest verification set that exercises the modified domain. From `AGENTS.md`:

- shared protocol or page logic: `pnpm --filter @brijio/shared test` and `pnpm --filter @brijio/shared check`.
- relay/routing changes: `pnpm --filter @brijio/websocket test` and `pnpm --filter @brijio/websocket check`.
- MCP tool or resource changes: `pnpm --filter @brijio/mcp test` and `pnpm --filter @brijio/mcp check`.
- Chrome extension changes: `pnpm --filter @brijio/chrome-extension test` and `pnpm --filter @brijio/chrome-extension check`.
- Safari extension changes: `pnpm --filter @brijio/safari-extension test` and `pnpm --filter @brijio/safari-extension check`.

If a change spans several layers, run the workspace-level `pnpm test` and `pnpm check` when practical. Before a PR is ready, match CI with:

```sh
pnpm lint
pnpm build
pnpm test
```

### Docker validation

Use Docker validation only when container or runtime behavior changes, and derive the current profiles and commands from `docker-compose.yml` rather than assuming a profile exists. The compose file defines three profiles:

- `runtime` (the `brijio` service) — combined WebSocket + MCP image exposing `8787` (WS) and `8788` (MCP HTTP at path `/mcp`).
- `legacy-runtime` (the `browserbridge` service, extends `brijio`) — legacy alias.
- `test` (the `test-page` service, `nginx:1.27-alpine`) — serves `clients/test-page` on the configured test-page port.

Start a profile explicitly, e.g. `docker compose --profile runtime up`. The MCP and WebSocket ports/tokens are configurable through the listed environment variables (`WEBSOCKET_*`, `MCP_HTTP_*`, `BRIJIO_PAIRING_TOKEN`, `MCP_HTTP_AUTH_TOKEN`, `BRIJIO_REQUEST_TIMEOUT_MS`).

## Change patterns to watch for

The layered ownership model from `AGENTS.md` is: shared protocol and browser-agnostic behavior in `packages/shared`; relay auth/presence/routing in `servers/websocket`; agent-facing tools/resources/skills in `servers/mcp`; browser-specific integration in `clients/extensions/chrome` and `clients/extensions/safari` with adapters kept thin. When a protocol or browser capability changes, check the full path:

```text
shared protocol -> WebSocket relay -> MCP surface -> shared controller
                -> Chrome adapter -> Safari adapter -> integration tests
```

Keep protocol definitions in `packages/shared` and do not duplicate them; preserve explicit per-call browser and `tabId` targeting and never introduce hidden selected-browser or selected-tab session state.

### Protocol or schema changes

If you change any cross-package message shape, update `packages/shared` first (types, envelope creators, type guards, response parsers) and then propagate the change through the WebSocket relay, the MCP server surface, the shared background controller, and both extension adapters. Add protocol tests in `packages/shared/src/protocol.test.ts` before implementing. Adding or reordering MCP tools shifts tool indices in the `servers/mcp/src/index.test.ts` snapshot — update those indices from the end backwards.

### Browser-targeting changes (`tabId` threading)

Recent ADRs have evolved explicit browser and tab routing. Changes in this area usually require coordinated updates across `packages/shared`, `servers/mcp`, `servers/websocket`, and both extension packages. The relevant ADRs are:

- `docs/architecture/decisions/0060-explicit-tab-listing-and-selection.md` — `list_tabs` and `tabId` selection.
- `docs/architecture/decisions/0062-thread-tabid-through-action-stack.md` — thread `tabId` through the read/action/batch/navigation stack.
- `docs/architecture/decisions/0063-open-tab-action.md` — `open_tab` (see below).
- `docs/architecture/decisions/0064-visual-action-verification.md` — `capture_screenshot` (see below).

When `tabId` is optional, preserve the documented active-tab fallback unless an accepted ADR changes it. Re-read page context after navigation or any mutation that can invalidate short-lived target IDs.

### `open_tab` (ADR 0063, Accepted)

`open_tab` adds an MCP tool plus an `open_tab` / `open_tab_response` protocol message pair, an `openTab` adapter method, and a shared `PageOpenTabAdapter` interface, all implemented on both Chrome and Safari.

Change-pattern checklist when touching this capability:

- **Shared protocol (`packages/shared/src/protocol.ts`):** add the `open_tab` / `open_tab_response` message types, `OpenTabErrorCode` (`unsupported_scheme` | `open_tab_failed` | `timeout`), envelope creators (`createOpenTabEnvelope`, `createOpenTabResponse`, `createOpenTabErrorResponse`), and type guards (`isOpenTabEnvelope`, `isOpenTabResponsePayload`); add `OpenTabResponse | OpenTabErrorResponse` to the `ExtensionResponse` union.
- **Background controller (`packages/shared/src/background-controller.ts`):** add the optional `pageOpenTab?: PageOpenTabAdapter` adapter field and a `handleOpenTabRequest(requestId, url)` handler; when the adapter is undefined, return `not_supported` (same pattern as `tabLister`). Dispatch `isOpenTabEnvelope` messages in `handleSocketMessage`.
- **MCP server (`servers/mcp`):** register the `open_tab` tool in `mcp-server.ts`, add `open-tab-tool.ts` (thin wrapper reusing `parseUrl` + the `unsupportedSchemeResponse` pattern), add `requestOpenTab` to `websocket-client.ts`, and `openNewTab` to `page-actions.ts`.
- **WebSocket server:** no special handling — `open_tab` passes through the standard `selectBrowser` forwarding path like `navigate_to_url`.
- **Extensions:** both `clients/extensions/chrome/src/background.ts` and `clients/extensions/safari/src/background.ts` provide a `pageOpenTab` adapter calling `chrome.tabs.create({ url })` / `browser.tabs.create({ url })` and returning the new tab's `tabId`, `url`, and `title`. URL validation uses the same `isRegularPageUrl()` check as `list_tabs` and `navigate_to_url` (HTTP/HTTPS only). Chrome and Safari parity is required in the same PR.

The response returns immediately after `tabs.create()` resolves; it does not wait for the page to load, so the agent should call `read_current_page` on the new tab to verify. `close_tab` and ownership tracking are deferred (P2.5).

### `capture_screenshot` (ADR 0064, Proposed)

`capture_screenshot` adds an MCP tool returning MCP image content (JPEG) from the **active tab only**. Change-pattern checklist:

- **Shared protocol:** `capture_screenshot` request and `screenshot_response` response types with `dataBase64`, `width`, `height`, `tabId`, `capturedAt`; error codes `capability_not_supported` | `capture_failed` | `no_visible_tab` | `timeout`; add `'screenshot'` to the `BrowserCapability` enum.
- **Background controller (`packages/shared/src/background-controller.ts`):** `PageScreenshotAdapter` interface with `captureScreenshot()` and a `ScreenshotResult` type; wire an optional `pageScreenshot` adapter with a `not_supported` fallback.
- **MCP server:** `screenshot-tool.ts` returning MCP `image` content (`image/jpeg`) directly, with a text block advising vision-capable agents; no temp file. `tabId` is accepted for forward compatibility but for P3.3 only the active tab is captured — a provided `tabId` must match the active tab or the tool errors `invalid_browser_target`.
- **Extensions:** both adapters call `chrome.tabs.captureVisibleTab(undefined, { format: 'jpeg', quality: 80 })` / `browser.tabs.captureVisibleTab(...)`, strip the `data:` prefix, and map permission errors to `capability_not_supported`. The extension announces `'screenshot'` in its `BrowserPresence.capabilities`.

Scope is viewport-only (no full-page stitching) and active-tab-only (background tabs would require user-disruptive focus switching). Full-page capture, annotation, screencast, and policy/redaction controls are out of scope (deferred to P4.5).

### Extension UI or manifest changes

Chrome and Safari have different manifest and runtime constraints (Safari builds separate `dist-ios` / `dist-macos` manifests via `scripts/create-platform-manifest.mjs`; Chrome copies a single `manifest.json`). Check the package README files before changing popup behavior, host permissions, or background lifecycle assumptions. Consider both Chrome and Safari for shared browser behavior and document/test intentional platform differences.

### Demo and docs changes

Demo pages and docs artifacts live under `servers/mcp/demo`, `clients/test-page`, `docs/artifacts`, and `scripts/`. They are useful for validating UX and layout assumptions but are not the main runtime path; the `test` Docker profile serves `clients/test-page` via nginx.

## ADR workflow (from AGENTS.md)

Before implementing, classify the change. An ADR is **required** when a change introduces or alters: a product capability or user-visible behavior; a cross-package protocol or schema; an architectural boundary or ownership decision; authentication, authorization, privacy, storage, or a trust boundary; browser routing, targeting, or lifecycle semantics; or a dependency/framework that materially changes the architecture.

ADR process:

1. Create the ADR as **Proposed** in `docs/architecture/decisions/`, including Mermaid diagrams when architecture or message flow is relevant.
2. Wait for explicit user approval before implementing. A request to implement a feature does not by itself approve the ADR written for that feature.
3. Before assigning a number, list existing ADRs and use the next unused number. **Never reuse an ADR number.**
4. After approval, mark the ADR **Accepted**. If a decision is replaced, record its superseding/superseded relationship. Do not leave an implemented decision marked `Proposed`.

An ADR is usually unnecessary for bug fixes that restore documented/tested behavior, tests for existing behavior, documentation-only corrections, behavior-preserving refactors, narrowly scoped tooling/dependency maintenance, or implementation already covered by an accepted ADR. If a supposedly narrow change requires a new design decision, stop and follow the ADR workflow.

### TDD for behavior changes

For behavior changes, use TDD:

1. Write or adjust a test that fails for the expected reason.
2. Implement the smallest change that makes it pass.
3. Refactor only when necessary and keep the test green.
4. Run the relevant verification commands (see above).

For documentation, configuration, or tooling changes where a failing test is not meaningful, validate with the narrowest applicable formatter, linter, build, or direct inspection.

## Git-history clue for future agents

Recent commits show a strong preference for threading `tabId` explicitly through every layer rather than storing hidden selected-tab session state. Preserve that pattern unless a new ADR says otherwise. The same explicit-targeting discipline now extends to opening tabs (ADR 0063 returns the new `tabId` for immediate targeting) and to visual capture (ADR 0064 accepts a `tabId` but only acts on the active tab for P3.3).

## Related pages

- [Quickstart](quickstart.md)
- [Multi-tab workflow](workflows/multi-tab.md)
- [MCP ↔ WebSocket ↔ extension flow](architecture/mcp-extension-flow.md)
- [Domains](domains.md)
- [Operations](operations.md)
