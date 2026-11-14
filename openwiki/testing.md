---
type: testing
title: Testing Strategy
description: How Brijio is tested across packages — Node built-in test suites, shared protocol/controller/content tests, the MCP tool and full-stack WS+MCP integration harness, and per-browser extension tests with injected fakes.
tags: [testing, node-test, integration-tests, mcp, websocket, browser-extension]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-14T14:46:23.462Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-5a60d3196588e015ba660b7b
    resource: repo://clients/extensions/chrome/package.json
  - id: openwiki-source-2c7bf30788b7f25c26d00188
    resource: repo://clients/extensions/chrome/src/background.test.ts
  - id: openwiki-source-aaf85f8033ade13f30887183
    resource: repo://clients/extensions/safari/src/background.test.ts
  - id: openwiki-source-2d2ad72255d67982e7f7cdd4
    resource: repo://docs/architecture/decisions/0034-integration-test-harness.md
  - id: openwiki-source-c83ceec2d47257f066951051
    resource: repo://packages/shared/package.json
  - id: openwiki-source-5dc53cc4a67596ec1c70a8e2
    resource: repo://packages/shared/src/background-controller.test.ts
  - id: openwiki-source-d8fb338cf9ae3af48b409cf5
    resource: repo://packages/shared/src/batch-handler.test.ts
  - id: openwiki-source-c654d94d920c4eb0a95d78fc
    resource: repo://packages/shared/src/content-handler.test.ts
  - id: openwiki-source-9e22dfaa77107b2e54466cfd
    resource: repo://packages/shared/src/page-context.test.ts
  - id: openwiki-source-a45f9ce10ca00a4fe1bb0a5a
    resource: repo://packages/shared/src/page-reader.test.ts
  - id: openwiki-source-0430d83fb2c6c8acd8d7246c
    resource: repo://packages/shared/src/protocol-batch.test.ts
  - id: openwiki-source-47829117d4de7af6d4650069
    resource: repo://packages/shared/src/protocol.test.ts
  - id: openwiki-source-ceadb6a3b6b9b72b892f43ce
    resource: repo://servers/mcp/package.json
  - id: openwiki-source-8a61c46af4f1e5d9e2e115eb
    resource: repo://servers/mcp/src/batch-tool.test.ts
  - id: openwiki-source-5766be9fdca091bba2930898
    resource: repo://servers/mcp/src/click-element-tool.test.ts
  - id: openwiki-source-873c302d62ef04a488b05db2
    resource: repo://servers/mcp/src/fill-input-tool.test.ts
  - id: openwiki-source-46bc08e6dcfee2f46e44bec4
    resource: repo://servers/mcp/src/form-action-tools.test.ts
  - id: openwiki-source-241af4ebfa670c22ce047622
    resource: repo://servers/mcp/src/index.test.ts
  - id: openwiki-source-67381b0746c338c894e94515
    resource: repo://servers/mcp/src/integration.test.ts
  - id: openwiki-source-25c995206683788914e5f0b8
    resource: repo://servers/mcp/src/protocol.test.ts
  - id: openwiki-source-bdc89ae687954f18387846a0
    resource: repo://servers/mcp/src/websocket-client.test.ts
  - id: openwiki-source-475cb24dac2da48673b37928
    resource: repo://servers/websocket/package.json
  - id: openwiki-source-64765eb2f737cdcfaf151c2a
    resource: repo://servers/websocket/src/server.test.ts
generated: { by: "openwiki/0.9.0", at: "2026-11-14T14:46:23.462Z" }
---

# Testing Strategy

Brijio is a TypeScript monorepo whose tests are written almost entirely with
Node's built-in test runner. There are no per-package test frameworks or custom
harness libraries; the strategy favors small, co-located suites that run fast
and stay close to the code they cover, plus one full-stack integration test that
wires real servers together. This page summarizes what each test area covers
and how to run it; it does not reproduce test bodies. For the cross-component
paths these tests exercise, see [workflows](workflows.md) and
[Extension Adapters](architecture/extension-adapters.md).

## Test stack and layout

Every runtime package uses the same stack:

- **Runner:** Node's built-in [`node:test`](https://nodejs.org/api/test.html)
  with `describe`/`it` and `node:assert/strict`.
- **TypeScript execution:** tests are imported through `tsx`
  (`node --import tsx --test src/**/*.test.ts`), so sources run without a
  separate build step.
- **Co-location:** each `*.test.ts` sits next to the module it covers under
  `src/`.
- **Invocation:** per-package `test` scripts run through `pnpm --filter`, e.g.
  `pnpm --filter @brijio/shared test`. TypeScript correctness uses a paired
  `check` script (`tsc --noEmit`).

The `node --test` glob picks up every `*.test.ts` in a package's `src/`, so a
single command runs the whole package's suite. Shared helpers and fixture data
live inside the test files themselves (e.g. fake adapters and message
factories) rather than in a separate fixtures directory.

## Verification commands

The smallest verification set per domain is defined in [AGENTS.md](../AGENTS.md).
For a change scoped to one package, run that package's `test` and `check`:

| Domain           | Test command                                  | Check command                                  |
| ---------------- | --------------------------------------------- | ---------------------------------------------- |
| Shared package   | `pnpm --filter @brijio/shared test`           | `pnpm --filter @brijio/shared check`           |
| WebSocket relay  | `pnpm --filter @brijio/websocket test`        | `pnpm --filter @brijio/websocket check`        |
| MCP server       | `pnpm --filter @brijio/mcp test`              | `pnpm --filter @brijio/mcp check`              |
| Chrome extension | `pnpm --filter @brijio/chrome-extension test` | `pnpm --filter @brijio/chrome-extension check` |
| Safari extension | `pnpm --filter @brijio/safari-extension test` | `pnpm --filter @brijio/safari-extension check` |

For cross-package changes — anything touching the shared protocol, the relay,
or the MCP surface — run `pnpm test` and `pnpm check` across the workspace.
Before a PR, match CI with `pnpm lint`, `pnpm build`, and `pnpm test`.
Docker validation is only for container/runtime changes and is driven by
`docker-compose.yml` profiles; do not assume a profile exists.

## Shared package (`packages/shared`)

The shared package owns protocol shapes and browser-agnostic logic, so its
tests are the broadest and most protocol-focused.

### Protocol and batch

`protocol.test.ts` covers the shared Brijio envelope builders and parsers
(`createAuthEnvelope`, presence envelopes, page-context/page-content envelopes,
action-result and screenshot envelopes, the `is*Envelope` type guards, and
`parseBrijioEnvelope`). It round-trips builder output through the parser and
asserts exact envelope shapes. `protocol-batch.test.ts` separately covers the
batch protocol — `createPerformBatchEnvelope`, `createBatchResultResponse`, the
`isPerformBatchEnvelope` guard for mixed action types, and `continueOnError`
handling.

### Background controller

`background-controller.test.ts` is the largest suite and exercises
`BrijioBackgroundController` end to end through a `createHarness()` that
injects **fake adapters** rather than any real browser or socket. The fake
harness supplies `FakeStorageAdapter`, `FakeSetupAdapter`, `FakeActionAdapter`,
`FakePageReaderAdapter`/`FakePageActionAdapter`/`FakePageBatchAdapter`/
`FakePageNavigationAdapter`, an optional `FakeDownloadAdapter`,
`FakeTabListerAdapter`, `FakeApprovalAdapter`, a `FakeSocketFactory` whose
sockets can be `.open()`ed and fed `.receive()`d messages, and a
`FakeTimersAdapter`. Coverage includes:

- **Connection lifecycle:** opening setup when no URL/token is stored,
  connecting on action click, authenticating on socket open, announcing
  presence, and the full `disconnected → connecting → connected → reconnecting`
  state machine with badge/title changes.
- **Reconnect semantics:** exponential backoff scheduling, attempt counting,
  cancellation on manual reconnect, reset on success, and the rule that
  user-initiated disconnect never triggers reconnect.
- **Request dispatch:** `get_page_context`, `get_page_content` chunking,
  `perform_action` (click, write_text, set_checked, select_options,
  submit_form), `navigate_to_url` (including `unsupported_scheme` and
  `navigation_failed`), `perform_batch` (success, partial failure, aborted,
  and approval interactions), and `list_tabs` (with a `not_supported` fallback
  when no tab lister is available).
- **Approval gating:** `submit_form`, `download_file`, and `fetch_resource`
  require approval before execution; the suite covers approve, `approval_denied`,
  `approval_timeout` with banner dismissal, `approve_session` reuse for the
  same origin and action type, and `approval_origin_changed` when the active
  origin changes mid-flow. Approval paths are also tested inside `perform_batch`
  (continue-after-deny, partial results on timeout, session reuse).
- **Pending-request tracking** in connection status and keepalive behavior.

### Content handling and page context

`content-handler.test.ts` drives `handleContentRequest` against DOM documents
built with `linkedom`'s `parseHTML`. It covers extraction
(`extract_page_context`, `extract_page_content` with invalid-index errors),
every action target kind (clicking links/buttons/menuitems/tabs/summary,
writing text to inputs/textareas/contenteditable, checkbox/radio/option
selection, form submission, file upload), disabled/readonly/unsupported
control error codes, and the `stale_context` validation system —
`expectedText`/`expectedHref`/`expectedRole`/`expectedLabel` checks, the
`pageContextVersion` counter, and `visibleContextId` invalidation when forms
change. `page-context.test.ts` covers the lower-level `extractPageContext`,
`extractPageContent`, and `computeVisibleContextId` extraction primitives.

### Page reader

`page-reader.test.ts` tests the active-tab read/action path
(`readActiveTabPage`, `performActiveTabAction`, `performActiveTabBatch`) using a
`makeDeps()` helper that injects fake `ActiveTabDeps` — fake `tabs.query`/
`tabs.sendMessage` and `scripting.executeScript`, plus an `isRegularPageUrl`
predicate. It asserts the `ok`/error-code result shapes (`no_active_tab`,
`content_script_unavailable`, `regular_page_permission_required`) and that
content requests are forwarded to the injected tab messenger, so it runs with
no real browser.

`batch-handler.test.ts` covers `batchActionToContentRequest` conversion and
`executeBatch` — single/multiple actions, abort-on-error vs. `continueOnError`,
the rule that page navigation always aborts even with `continueOnError=true`,
`readAfterActions` appending page context, and the `page_navigated` error code
for aborted entries.

## WebSocket relay (`servers/websocket`)

`server.test.ts` starts a real `createWebSocketServer()` on an ephemeral port
(port `0`) with a known pairing token and additional tokens, and drives it with
raw `ws` WebSocket clients. Coverage is grouped into two `describe` blocks:

- **`GET /health`:** enriched health JSON with status, version, uptime, and an
  `extensions` object (count + browsers array); `getStatus()` reflects
  connected extensions and drops them after disconnect.
- **Authenticated browser routing:** `auth_required` for pre-auth messages,
  `auth_failed` for invalid tokens, the server-initiated presence request after
  extension auth, token-scoped browser listing (extensions on different tokens
  are invisible to each other), `list_tabs` forwarding, default routing to the
  only online browser, response routing back to the requesting MCP connection,
  `ambiguous_browser_target` when multiple browsers are online, explicit
  `browserInstanceId` routing with `browser_unavailable` for a missing
  instance, keepalive acceptance, and presence removal on disconnect.

`protocol.test.ts` covers the relay's `createScopeKey` helper, asserting it
produces stable, non-raw-token scope keys.

## MCP server (`servers/mcp`)

### HTTP server and lifecycle (`index.test.ts`)

`index.test.ts` starts a real MCP HTTP server backed by a mocked WebSocket layer
(a raw `ws` `WebSocketServer`) and drives it with the official MCP SDK
`Client` + `StreamableHTTPClientTransport`. It covers the `/health` endpoint,
rejection of unauthenticated HTTP requests, origin allow-listing, the full MCP
lifecycle (`initialize`, resource discovery, `ping`), the `browser://page/current`
and `browser://page/current/content/{index}` resources (rich context and
paginated content), and structured tool errors for invalid page-content
indexes and invalid tool inputs.

### Tool unit tests

Each tool has its own focused suite, typically validating **input validation**
and **result shaping** against a mocked `request*` WebSocket-client function:

- `browser-list-tool.test.ts` — presence-record shaping.
- `click-element-tool.test.ts` — target-kind/ID validation, expected-text/href/role passthrough and validation, passthrough of `stale_context` errors and WebSocket/browser errors without rewriting.
- `fill-input-tool.test.ts` — empty form/control IDs, non-string text, valid fill, error passthrough.
- `form-action-tools.test.ts` — non-boolean `checked`, non-array option values, `set_checked`/`select_options` success shaping.
- `batch-tool.test.ts` — the most thorough validator: non-array/empty/oversized (>20) action arrays, invalid action types, non-object/null actions, non-boolean `continueOnError`/`readAfterActions`, non-number `pageContextId`, non-string/empty `browserInstanceId`, plus valid single and mixed-type batches and error propagation.
- `navigate-to-url-tool.test.ts` and `page-reading-tool.test.ts` — navigation and page-reading tool input/result behavior.
- `list-tabs-tool.test.ts` — tab list shaping.

### Protocol helpers

`protocol.test.ts` covers the MCP-side envelope builders and parsers
(`createGetPageContextEnvelope`, action envelopes, `parseActionResultEnvelope`,
`parsePageContextEnvelope`/`parsePageContentEnvelope`, navigation/open-tab
parsers, `parseRouterErrorEnvelope`, `unsupportedSchemeResponse`, and
extension-specific error-code parsing). `protocol-batch.test.ts` covers
`createPerformBatchEnvelope` and `parseBatchResultEnvelope`.

### WebSocket client

`websocket-client.test.ts` tests the MCP→relay client (`requestPageContext`,
`requestClickElement`, `requestFillInput`, `requestBrowserList`,
`requestNavigateToUrl`, etc.) against a raw `WebSocketServer`, asserting that
the client authenticates before sending requests and routes responses back to
callers.

### Other MCP suites

`daemon.test.ts` covers CLI subcommand parsing, env-file loading, install
planning (token creation, port writing, secret-free service definitions), and
macOS/Linux lifecycle and log commands. `print-config.test.ts`,
`doctor.test.ts`, `skills.test.ts`, `startup-banner.test.ts`, `network.test.ts`,
and `http-server.test.ts` cover their respective utilities.

## Full-stack integration test

`servers/mcp/src/integration.test.ts` is the single end-to-end suite. It exists
because unit tests mock the WebSocket layer and therefore cannot catch
regressions in auth, routing, presence, and protocol parsing across the real
stack; its rationale is recorded in
[ADR-0034](../docs/architecture/decisions/0034-integration-test-harness.md).

The harness (`startIntegration`) does the following for each test:

1. Starts a **real `createWebSocketServer()`** on port `0` with a known pairing
   token (`integration-test-token`).
2. Starts a **real `startBrijioMcpHttpServer()`** on port `0` pointing its
   `pageContextConfig` at that WS server, with a known MCP auth token.
3. Connects a **fake extension** over a raw `ws` WebSocket, authenticates,
   announces presence (`browserInstanceId: 'chrome-int'`, label
   `'Chrome Integration'`, capability list), and installs a message handler
   that responds to forwarded requests with fixture data (page context, page
   content, action results, navigation results). `list_browsers` is answered
   by the WS server itself from presence data, so it is not forwarded.
4. Drives an **MCP SDK `Client` over `StreamableHTTPClientTransport`** to make
   real tool calls through HTTP → MCP server → WS client → WS server → extension.

Coverage (one `it` per path) includes: rejection of unauthenticated MCP
requests (`401`), `list_browsers` returning the presence-registered browser,
`read_current_page`, `click_element`, `fill_input`, `fill_editable`,
`set_checked`, `select_options`, `submit_form`, a fill-then-submit form
lifecycle round-trip, `navigate_to_url`, the `unsupported_scheme` short-circuit
for an `ftp://` URL (which returns without hitting the extension), and
`browser_unavailable` when no extension is connected. The suite keeps event
loop settling cheap with small `setTimeout` delays (e.g. 50ms for presence
propagation), matching the existing test patterns.

## Browser extension tests

The Chrome and Safari extensions each have their own `background.test.ts` (and
`content*.test.ts`, `popup.test.ts`, `permissions.test.ts`). These run under
`node:test` with **injected fake browser APIs** so they need no real browser:

- The Chrome suite mocks `chrome.*` (tabs query/create/sendMessage/update,
  action badge, storage) and tests `createChromeApprovalAdapter`,
  `createMessageHandler`, `navigateActiveTabToUrl`, and `tabLister`.
- The Safari suite constructs mock `browser.*` interfaces (action,
  `storage.local`, etc.) and tests `SafariActionBadge`, `SafariStorageAdapter`,
  `SafariSetupAdapter`, `SafariPageReaderAdapter`,
  `SafariPageNavigationAdapter`, `createSafariApprovalAdapter`,
  `SafariWebSocketConnection`, and `tabLister`.

Both adapters delegate shared behavior to `@brijio/shared`'s
`BrijioBackgroundController`; the per-platform tests focus on the thin adapter
glue and platform-specific API differences. Because Chrome and Safari differ,
each platform owns its own suite rather than sharing one — see
[Extension Adapters](architecture/extension-adapters.md) for the platform split.
