---
type: Concept
title: Testing
description: Testing strategy and harness for Brijio — per-package unit tests co-located with source, an end-to-end integration test harness, demo/marketing layout tests, and TDD + smallest-verification-set conventions from AGENTS.md.
tags:
  [testing, tdd, integration-tests, unit-tests, layout-tests, verification, ci]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-20T16:42:52.757Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-2c7bf30788b7f25c26d00188
    resource: repo://clients/extensions/chrome/src/background.test.ts
  - id: openwiki-source-aaf85f8033ade13f30887183
    resource: repo://clients/extensions/safari/src/background.test.ts
  - id: openwiki-source-2d2ad72255d67982e7f7cdd4
    resource: repo://docs/architecture/decisions/0034-integration-test-harness.md
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-5dc53cc4a67596ec1c70a8e2
    resource: repo://packages/shared/src/background-controller.test.ts
  - id: openwiki-source-c654d94d920c4eb0a95d78fc
    resource: repo://packages/shared/src/content-handler.test.ts
  - id: openwiki-source-47829117d4de7af6d4650069
    resource: repo://packages/shared/src/protocol.test.ts
  - id: openwiki-source-2c28a177ee4bf70995d6e8f3
    resource: repo://scripts/demo-shared-layout.test.mjs
  - id: openwiki-source-0e4f52f025d9f9d2f378b6de
    resource: repo://scripts/dev.test.mjs
  - id: openwiki-source-896016c0ad71c63e4d24a516
    resource: repo://scripts/marketing-site.test.mjs
  - id: openwiki-source-595110f2279e3995b776692c
    resource: repo://scripts/navigation-layout.test.mjs
  - id: openwiki-source-b20407a1346ffbb988e668f9
    resource: repo://scripts/parse-download-layout.test.mjs
  - id: openwiki-source-ddf36a8041dd17686196e807
    resource: repo://scripts/read-respond-layout.test.mjs
  - id: openwiki-source-6f8b581727bf84227556c9a2
    resource: repo://scripts/tooling.test.mjs
  - id: openwiki-source-8a61c46af4f1e5d9e2e115eb
    resource: repo://servers/mcp/src/batch-tool.test.ts
  - id: openwiki-source-5766be9fdca091bba2930898
    resource: repo://servers/mcp/src/click-element-tool.test.ts
  - id: openwiki-source-6c2f9bc7e6e794893feef9dc
    resource: repo://servers/mcp/src/daemon.test.ts
  - id: openwiki-source-5a26585dab5b354201042fee
    resource: repo://servers/mcp/src/doctor.test.ts
  - id: openwiki-source-46bc08e6dcfee2f46e44bec4
    resource: repo://servers/mcp/src/form-action-tools.test.ts
  - id: openwiki-source-241af4ebfa670c22ce047622
    resource: repo://servers/mcp/src/index.test.ts
  - id: openwiki-source-67381b0746c338c894e94515
    resource: repo://servers/mcp/src/integration.test.ts
  - id: openwiki-source-594bf8b18b34c223d8f406cb
    resource: repo://servers/mcp/src/print-config.test.ts
  - id: openwiki-source-cf0a99949586e8a89ddb7d82
    resource: repo://servers/mcp/src/protocol-batch.test.ts
  - id: openwiki-source-f6b088e2981f8515a4ff267b
    resource: repo://servers/mcp/src/skills.test.ts
  - id: openwiki-source-bdc89ae687954f18387846a0
    resource: repo://servers/mcp/src/websocket-client.test.ts
  - id: openwiki-source-64765eb2f737cdcfaf151c2a
    resource: repo://servers/websocket/src/server.test.ts
generated: { by: "openwiki/0.9.0", at: "2026-11-20T16:42:52.757Z" }
---

# Testing

Brijio uses a layered test strategy that mirrors its package boundaries. Each package owns **co-located** unit tests (`*.test.ts`), the `servers/mcp` package owns a full-stack **integration test harness**, repo-level **layout/UX tests** live under `scripts/*.test.mjs`, and every behavior change follows the TDD + smallest-verification-set conventions in `AGENTS.md`.

## Test runners and file layout

### Per-package unit tests (Node `--test` / vitest-style)

Unit tests are written with `node:test` (`describe`, `it`, `assert/strict`) and live next to the source file they exercise as `<name>.test.ts`. The repository uses Node's built-in test runner (`node --test`), not Jest or Vitest, but the co-location style mirrors vitest conventions.

| Package                    | Test files                                                                                                                                                                                                                                                                                                                                                                                                                                             | Source files                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `@brijio/shared`           | `protocol.test.ts`, `background-controller.test.ts`, `content-handler.test.ts`, `page-context.test.ts`, `page-reader.test.ts`, `batch-handler.test.ts`, `popup-init.test.ts`, `bridge-settings.test.ts`, `logger.test.ts`, `timers.test.ts`                                                                                                                                                                                                            | `packages/shared/src/*.ts`                    |
| `@brijio/websocket`        | `server.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                       | `servers/websocket/src/server.ts`             |
| `@brijio/mcp`              | `index.test.ts`, `protocol.test.ts`, `protocol-batch.test.ts`, `websocket-client.test.ts`, `daemon.test.ts`, `doctor.test.ts`, `print-config.test.ts`, `skills.test.ts`, `page-context.test.ts`, `batch-tool.test.ts`, `browser-list-tool.test.ts`, `click-element-tool.test.ts`, `fill-input-tool.test.ts`, `form-action-tools.test.ts`, `navigate-to-url-tool.test.ts`, `page-reading-tool.test.ts`, `list-tabs-tool.test.ts`, `integration.test.ts` | `servers/mcp/src/*.ts`                        |
| `@brijio/chrome-extension` | `background.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                   | `clients/extensions/chrome/src/background.ts` |
| `@brijio/safari-extension` | `background.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                   | `clients/extensions/safari/src/background.ts` |

### Repo-level layout and tooling tests (`scripts/*.test.mjs`)

Repo-level `.mjs` tests run with `node --test` and validate cross-cutting concerns that no single package owns:

| File                                     | Concern                                                                                                                      |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `scripts/read-respond-layout.test.mjs`   | Shared read/respond demo shell (CSS, DOM hooks, SPA loader stripping) across `clients/test-page` and `servers/mcp/demo` HTML |
| `scripts/demo-shared-layout.test.mjs`    | Standalone demo shell consistency across read/parse/actions/downloads views                                                  |
| `scripts/navigation-layout.test.mjs`     | Actions single-flow navigation demo layout                                                                                   |
| `scripts/parse-download-layout.test.mjs` | Parse/download demo layout CSS synchronization                                                                               |
| `scripts/mobile-demo-layout.test.mjs`    | Mobile layout ordering and visibility                                                                                        |
| `scripts/marketing-site.test.mjs`        | Marketing site hero, routes, and demo-nav composition                                                                        |
| `scripts/release-workflow.test.mjs`      | Release workflow steps                                                                                                       |
| `scripts/tooling.test.mjs`               | Repo tooling: lint scripts, ts-standard project, PR validation workflow, pre-commit hook                                     |
| `scripts/dev.test.mjs`                   | `dev.mjs` helpers (env template, config generation, banner, health check)                                                    |
| `scripts/brijio-token.test.mjs`          | Token utility script                                                                                                         |

The root `test` script wires them together: `pnpm -r test && node --test scripts/*.test.mjs` — package tests run first via `pnpm -r`, then repo scripts run via `node --test`.

## The integration test harness

ADR-0034 introduced `servers/mcp/src/integration.test.ts` to exercise the **full stack** that unit tests cannot cover alone. Where `index.test.ts` mocks the WebSocket layer, the integration test wires a **real** `createWebSocketServer()` + `startBrijioMcpHttpServer()` together and connects a mock browser extension over a real WebSocket.

<!-- openwiki: mermaid parse failed and this diagram was converted to a text fence so it does not break rendering. Fix the diagram source and restore the mermaid fence. Parser error: Heuristic: an unescaped angle bracket inside a label breaks rendering; rephrase the label. -->

```text
flowchart LR
  SDK["MCP SDK Client<br/>+ StreamableHTTPClientTransport"] -->|"HTTP POST /mcp"| HTTP["Real MCP HTTP server"]
  HTTP -->|"forwards tool calls"| WSClient["MCP WebSocket client"]
  WSClient -->|"real TCP"| WSServer["Real WS relay server"]
  WSServer -->|"routes by presence"| Ext["Mock extension<br/>(raw WebSocket)"]
  Ext -->|"fixture responses"| WSServer
  WSServer -->|"action_result / page_context_response"| WSClient
  WSClient --> HTTP
  HTTP --> SDK
```

### What it verifies

The harness starts a real WebSocket server (port 0) with a known pairing token, a real MCP HTTP server pointed at it, and a mock extension that authenticates and announces presence. It then drives the official MCP SDK client (`Client` + `StreamableHTTPClientTransport`) through every tool and error path:

- **Auth boundary**: unauthenticated MCP requests are rejected with HTTP 401.
- **`list_browsers`**: returns presence-registered browsers (`chrome-int` / `Chrome Integration`).
- **`read_current_page`**: returns fixture page context (`https://example.com/`, title `Integration Test`) through the full stack.
- **`click_element`**, **`fill_input`**, **`fill_editable`**, **`set_checked`**, **`select_options`, **`submit_form**: each tool routes a `perform_action`envelope to the extension and parses the returned`action_result`.
- **Form lifecycle**: fill → submit round-trip with `formId` tracking.
- **`navigate_to_url`**: routes and returns navigation timing; `ftp://` URLs fail with `unsupported_scheme` without hitting the extension.
- **Error paths**: `browser_unavailable` when no extension is connected; disconnected extension handling.
- **Health endpoints**: WS `/health` and MCP `/health` return enriched status.

### Injectable transports

The harness avoids real browser/relay dependencies by **injecting** request-function overrides. `page-actions` and `page-context` accept a `requestPageContext` / `requestPerformBatch` / etc. option, and the integration test supplies fixture-returning implementations. The mock extension answers each forwarded request type with canned data (`createPageContext`, `handleActionMessage`), so the full TCP path is exercised without a real Chrome/Safari instance.

```typescript
// servers/mcp/src/integration.test.ts
async function startIntegration(options: { skipExtension?: boolean }) {
  const wsServer = await createWebSocketServer({ host: '127.0.0.1', port: 0, pairingToken, ... })
  const runtime = await startBrijioMcpHttpServer({ host: '127.0.0.1', port: 0, path: '/mcp', authToken, pageContextConfig: { websocketUrl: wsServer.url, ... } })
  if (!options.skipExtension) {
    const extension = await connectAndAuth(wsServer.url)
    // extension announces presence and wires handleExtensionRequest for fixture responses
  }
  return { wsServer, runtime, extension }
}
```

## TDD and verification conventions

`AGENTS.md` mandates TDD for behavior changes and the smallest verification set that covers the change:

1. **Write or adjust a test that fails for the expected reason.**
2. **Implement the smallest change that makes it pass**
3. **Refactor only when necessary and keep the test green**
4. **Run the relevant verification commands**

### Smallest verification set per package

| Change area                  | Commands                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| Shared protocol / page logic | `pnpm --filter @brijio/shared test` + `pnpm --filter @brijio/shared check`                     |
| Relay / routing              | `pnpm --filter @brijio/websocket test` + `pnpm --filter @brijio/websocket check`               |
| MCP tool / resource          | `pnpm --filter @brijio/mcp test` + `pnpm --filter @brijio/mcp check`                           |
| Chrome extension             | `pnpm --filter @brijio/chrome-extension test` + `pnpm --filter @brijio/chrome-extension check` |
| Safari extension             | `pnpm --filter @brijio/safari-extension test` + `pnpm --filter @brijio/safari-extension check` |
| Cross-package change         | `pnpm test` + `pnpm check`                                                                     |
| Demo / marketing HTML or CSS | `node --test scripts/*.test.mjs` (the matching layout test)                                    |

### Pre-PR CI match

Before a PR is ready, match CI with:

```sh
pnpm lint
pnpm build
pnpm test
```

- `pnpm lint` = `pnpm lint:ts` (`ts-standard`) + `pnpm lint:md` (`prettier --check`)
- `pnpm build` = `pnpm -r build`
- `pnpm test` = `pnpm -r test && node --test scripts/*.test.mjs`

Docker validation is used only when container or runtime behavior changes; the `docker-compose.yml` `test` profile (ADR-0034) builds from the monorepo root and runs `pnpm test` in a clean container.

### Reporting

Before claiming completion, report exactly what passed and what could not be run. Preserve complete failure output — truncated assertions are a verification gap, not a green light.

## Unit test patterns by layer

### Shared protocol (`packages/shared/src/protocol.test.ts`)

Tests envelope creation and parsing for every Brijio message type: `auth`, `browser_presence_request`/`announce`, `get_page_context`, `get_page_content`, `perform_action` (click, write_text, set_checked, select_options, submit_form), `navigate_to_url`, `open_tab`, `capture_screenshot`, `list_tabs`, `perform_batch`, plus error envelopes and `parseBrijioEnvelope` JSON validation. These are pure-data tests with no I/O.

### Background controller (`packages/shared/src/background-controller.test.ts`)

The largest shared unit test file. Uses a harness pattern (`createHarness`) with mock adapters for `StorageAdapter`, `SetupAdapter`, `ApprovalAdapter`, `PageReaderAdapter`, `PageActionAdapter`, `PageNavigationAdapter`, `PageBatchAdapter`, `DownloadAdapter`, and `TabListerAdapter`. Exercises:

- Action click → setup open when no WebSocket URL stored
- Socket lifecycle: connect, auth, presence announce, disconnect
- Message routing: `get_page_context` / `perform_action` / `perform_batch` forwarded to adapters
- Approval flow: user-approved session continuation and rejection
- Batch handler integration with `continueOnError` and `readAfterActions`

### Content handler (`packages/shared/src/content-handler.test.ts`)

Uses `linkedom` `parseHTML` to provide a real DOM. Tests `extract_page_context` (headings, landmarks, links, forms, preview) and `extract_page_content` (chunked content, `invalid_index` for unavailable chunks, payload byte limits).

### WebSocket relay (`servers/websocket/src/server.test.ts`)

Real `createWebSocketServer()` on port 0. Tests `/health` enriched status, auth-before-messages (`auth_required`), invalid-token rejection (`auth_failed`), presence request after extension auth, presence-driven `getStatus()`, disconnected-extension exclusion, and browser routing. Uses raw `WebSocket` clients and `waitForJsonMessage` helpers.

### MCP HTTP server (`servers/mcp/src/index.test.ts`)

Uses the real MCP SDK client + `StreamableHTTPClientTransport` against a mocked WebSocket layer (`WebSocketServer` raw, not the full relay). Tests health endpoint, unauthenticated 401, forbidden origin 403, the official MCP lifecycle (`initialize`, `resources/list`, `ping`), tool registration, and tool-call routing through the mock.

### MCP protocol helpers (`servers/mcp/src/protocol.test.ts`)

Mirrors the shared protocol tests but for the MCP-server-specific envelope helpers (`createClickElementEnvelope`, `parseActionResultEnvelope`, `unsupportedSchemeResponse`, etc.) and result-data type guards (`isNavigateToUrlResultData`, `isOpenTabResultData`).

### Batch protocol (`servers/mcp/src/protocol-batch.test.ts`)

Tests `createPerformBatchEnvelope` and `parseBatchResultEnvelope`: action arrays, `pageContextId`/`continueOnError`/`readAfterActions` options, partial-failure parsing with `aborted` flags, trailing read-after-actions page context.

### WebSocket client (`servers/mcp/src/websocket-client.test.ts`)

Uses a raw `WebSocketServer` to verify the client-side request functions (`requestPageContext`, `requestClickElement`, `requestFillInput`, …) authenticate before sending, match responses by request ID, and handle error envelopes.

### Daemon and config CLI (`servers/mcp/src/daemon.test.ts`, `print-config.test.ts`, `doctor.test.ts`)

`daemon.test.ts` parses `install`/`start`/`stop`/`restart`/`logs` subcommands, `--ws-port`/`--mcp-port` validation, `--print-config` agent aliases, `--dev` flag, `--doctor`. `print-config.test.ts` resolves agent names (`claude` → `claude-desktop`, `cur` → `cursor`) and formats JSON for 12 supported agents. `doctor.test.ts` formats pass/fail/warn check reports with detail lines.

### MCP tools (`servers/mcp/src/*.test.ts` per tool)

Each tool test injects a request function (`requestSetChecked`, `requestPerformBatch`, …) and asserts input validation and response parsing. For example `form-action-tools.test.ts` rejects non-boolean `checked`, `batch-tool.test.ts` rejects non-array actions, empty arrays, arrays over 20, and invalid action types; `click-element-tool.test.ts` covers target shape validation and `target_not_found`/`page_navigated` errors.

### Skills (`servers/mcp/src/skills.test.ts`)

Tests `loadSkills` (empty array for missing dir, SKILL.md frontmatter parsing), `extractTitle`/`extractDescription`, `resolveSkillsDir`, and `skillResourceUri` with temp directories.

### Browser extensions (`clients/extensions/{chrome,safari}/src/background.test.ts`)

Both Chrome and Safari tests mock the platform API (`chrome.*` / `browser.*`) and a `BrijioBackgroundController` to verify:

- Action click opens setup when no URL stored; connects when URL present
- Socket open triggers auth + presence announce
- `navigateActiveTabToUrl` uses `tabs.update` / `tabs.create` fallback
- `tabLister` reports open tabs
- Approval adapter routes `approve_session` / `reject_session`

Safari-specific adapters (`SafariStorageAdapter`, `SafariPageReaderAdapter`, `SafariPageNavigationAdapter`, `SafariWebSocketConnection`, `SafariActionBadge`) are tested against the `browser.*` mock.

## Layout/UX test patterns

Layout tests read fixture HTML and CSS files and assert with regex matches that the shared demo shell is consistent across the `clients/test-page` and `servers/mcp/demo` roots:

- `read-respond-layout.test.mjs` — read/respond view uses `data-view="read"`, two-column grid, `.demo-layout.css` link, no inline `<style>`, SPA loader strips external shell before embedding.
- `demo-shared-layout.test.mjs` — every demo view (read/parse/actions/downloads) has matching `data-view`, columns, and visual hooks (`browser-title`, `address-pill`, `browser-hero`, `browser-grid`); shared stylesheet has no stale merged CSS.
- `navigation-layout.test.mjs` — actions view single-flow layout, right column full-width not sticky.
- `parse-download-layout.test.mjs` — parse view full-column table grid; download view two-column file grid; CSS synchronized across both roots.
- `mobile-demo-layout.test.mjs` — TOC `order: -1`, stories `order: 2`, form `order: 3`, no `display: none` on mobile accordions.
- `marketing-site.test.mjs` — marketing routes (`home`/`install`/`privacy`/`faq`), demo nav dropdown, home hero two-column composition, topbar visible on demo routes.

These tests guard against regressions when demo HTML or shared CSS is edited and ensure the marketing site keeps the approved composition.

## See also

- [Integration test harness (ADR-0034)](../docs/architecture/decisions/0034-integration-test-harness.md)
- [Workflows](workflows.md) — per-package commands and change patterns
- [MCP server architecture](architecture/mcp-server.md)
- [Shared package architecture](architecture/shared-package.md)
- [WebSocket relay architecture](architecture/websocket-relay.md)
- [Browser extensions architecture](architecture/browser-extensions.md)
