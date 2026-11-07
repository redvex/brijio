---
type: "Reference"
title: "Development Workflows and Verification"
description: "Repo-level development workflows: common pnpm commands, the per-package verification set to run after changes by domain, the ADR-required change workflow, TDD expectation, and testing strategy including the full-stack integration harness."
tags: [workflows, testing, verification, adr, pnpm, integration-tests]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-07T14:40:48.642Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-5a60d3196588e015ba660b7b
    resource: repo://clients/extensions/chrome/package.json
  - id: openwiki-source-71a0e8f6d491eb3a2c086e5e
    resource: repo://clients/extensions/safari/package.json
  - id: openwiki-source-b79fbbd921df689b4bbdc82f
    resource: repo://docker-compose.yml
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-c83ceec2d47257f066951051
    resource: repo://packages/shared/package.json
  - id: openwiki-source-ceadb6a3b6b9b72b892f43ce
    resource: repo://servers/mcp/package.json
  - id: openwiki-source-67381b0746c338c894e94515
    resource: repo://servers/mcp/src/integration.test.ts
  - id: openwiki-source-475cb24dac2da48673b37928
    resource: repo://servers/websocket/package.json
generated: { by: "openwiki/0.9.0", at: "2026-11-07T14:40:48.642Z" }
---

# Development Workflows and Verification

This page captures the repo-level workflows that matter most when editing Brijio: the commands to run, what to verify after a change, when an ADR is required, the TDD expectation, and the testing strategy that anchors behavior in unit tests per package plus a full-stack integration harness.

## Common commands

The root `package.json` is the authority for runtime and package-manager versions (`node >=22.0.0`, `pnpm@10.32.1`). The main top-level commands are:

- `pnpm build` — build all workspace packages (`pnpm -r build`)
- `pnpm test` — run workspace tests plus repo scripts (`pnpm -r test && node --test scripts/*.test.mjs`)
- `pnpm check` — type-check / validation pass across packages (`pnpm -r check`)
- `pnpm lint` — TypeScript and Markdown linting (`pnpm lint:ts && pnpm lint:md`)
- `pnpm dev` — start the local development helper (`node scripts/dev.mjs`)
- `pnpm dev:ws` — run the WebSocket server in watch mode (`tsx watch servers/websocket/src/index.ts`)
- `pnpm dev:mcp` — run the MCP server in watch mode (`tsx watch servers/mcp/src/index.ts`)
- `pnpm token` — generate a Brijio pairing/MCP token (`node scripts/brijio-token.mjs`)
- `pnpm serve:test-pages` — build and serve the static test-page site locally

Each workspace package defines its own `build`, `check`, `test`, and (where meaningful) `dev` scripts, invoked through `pnpm --filter <pkg> <script>`:

| Package                 | Filter                     | Scripts                                                   |
| ----------------------- | -------------------------- | --------------------------------------------------------- |
| Shared protocol & logic | `@brijio/shared`           | `build`, `check`, `dev` (not implemented), `test`         |
| WebSocket relay         | `@brijio/websocket`        | `build`, `check`, `dev`, `test`                           |
| MCP server              | `@brijio/mcp`              | `build`, `check`, `dev`, `test`, `prepublishOnly`         |
| Chrome extension        | `@brijio/chrome-extension` | `build`, `check`, `dev` (not implemented), `test`, `pack` |
| Safari extension        | `@brijio/safari-extension` | `build`, `check`, `dev` (not implemented), `test`         |

All package tests run through Node's built-in test runner with `tsx` (`node --import tsx --test src/**/*.test.ts`); the MCP server additionally publishes an npm package, hence `prepublishOnly` rebuilds `dist`.

## What to run after making changes

Run the smallest verification set that exercises the modified domain. For each domain, run both the package `test` and `check` scripts:

- **Shared protocol or page logic** — `pnpm --filter @brijio/shared test` and `pnpm --filter @brijio/shared check`
- **Relay / routing changes** — `pnpm --filter @brijio/websocket test` and `pnpm --filter @brijio/websocket check`
- **MCP tool or resource changes** — `pnpm --filter @brijio/mcp test` and `pnpm --filter @brijio/mcp check`
- **Chrome extension changes** — `pnpm --filter @brijio/chrome-extension test` and `pnpm --filter @brijio/chrome-extension check`
- **Safari extension changes** — `pnpm --filter @brijio/safari-extension test` and `pnpm --filter @brijio/safari-extension check`

If a change spans several layers, run the workspace-level `pnpm test` and `pnpm check`. Before a PR is ready, match CI exactly with:

```sh
pnpm lint
pnpm build
pnpm test
```

Use Docker validation only when container or runtime behavior changes, and derive the current profiles and commands from `docker-compose.yml` rather than assuming a profile exists. The compose file currently defines `runtime`, `legacy-runtime`, and `test` profiles — note the `test` profile is the static test-page nginx service, not a containerized test runner.

## Test-driven development for behavior changes

For any behavior change, follow TDD:

1. Write or adjust a test that **fails for the expected reason**.
2. Implement the **smallest change** that makes it pass.
3. **Refactor only when necessary**, and keep the test green.
4. Run the relevant verification commands (above).

For documentation, configuration, or tooling changes where a failing test is not meaningful, validate with the narrowest applicable formatter, linter, build, or direct inspection instead. Before claiming completion, report exactly what passed and what could not be run.

## The ADR-required change workflow

Classify the change before editing. An ADR (Architecture Decision Record) is **required before implementation** when a change introduces or alters any of:

- a product capability or intentional user-visible behavior;
- a cross-package protocol or schema;
- an architectural boundary or ownership decision;
- authentication, authorization, privacy, storage, or a trust boundary;
- browser routing, targeting, or lifecycle semantics;
- a dependency or framework that materially changes the architecture.

ADR workflow rules:

- Create the ADR as `Proposed`, and include **Mermaid diagrams** when architecture or message flow is relevant.
- **Wait for explicit user approval before implementing.** A request to implement a feature does not by itself approve the ADR written for that feature.
- Before assigning a number, list existing ADRs and use the **next unused number**. Never reuse an ADR number.
- After approval, mark the ADR `Accepted`. If a decision is replaced, record its superseding/superseded relationship. Do not leave an implemented decision marked `Proposed`.

An ADR is normally unnecessary for a bug fix that restores documented/tested behavior, tests for existing behavior, documentation-only corrections, behavior-preserving refactors, narrowly scoped tooling or dependency maintenance, or implementation already covered by an accepted ADR. If a supposedly narrow change requires a new design decision, stop and follow the ADR workflow.

ADRs live in `docs/architecture/decisions`. Record the decision there; update `docs/project/CAPABILITY_MATRIX.md` for capability/support status, `docs/security` for security boundaries, and the relevant OpenWiki pages for cross-layer workflow navigation.

## Testing strategy

Brijio's testing strategy is layered: focused unit tests per package, plus a single canonical full-stack integration harness that wires the real servers together.

### Unit tests per package

Each package owns unit tests under `src/**/*.test.ts` run by the Node test runner. The unit tests target protocol handling, routing, tool behavior, browser adapters, and failure paths in isolation. They cover edge cases exhaustively so the integration harness can stay focused on critical end-to-end paths.

### Full-stack integration harness (ADR 0034)

The canonical full-stack test is `servers/mcp/src/integration.test.ts`. It does not mock the network boundaries of the stack — it starts a **real** WebSocket relay server and a **real** MCP HTTP server, connects a mock browser extension over a **real** WebSocket, and drives **real** MCP SDK client tool calls over HTTP. This exercises every code path — auth, routing, presence, and protocol parsing — the same way production does.

The harness assembles the runtime in `startIntegration()`:

1. `createWebSocketServer({ host: '127.0.0.1', port: 0, pairingToken })` — real WS relay on an ephemeral port.
2. `startBrijioMcpHttpServer({ ... pageContextConfig: { websocketUrl, timeoutMs, pairingToken } })` — real MCP HTTP server pointed at that relay.
3. `connectAndAuth()` — a raw `ws` WebSocket connects, authenticates with the pairing token, and announces browser presence (`browser_presence_announce` with capabilities).
4. A real MCP SDK `Client` + `StreamableHTTPClientTransport` issues `client.callTool(...)` against the MCP HTTP endpoint.

<!-- openwiki: mermaid parse failed and this diagram was converted to a text fence so it does not break rendering. Fix the diagram source and restore the mermaid fence. Parser error: Heuristic: an unescaped angle bracket inside a label breaks rendering; rephrase the label. -->

```text
flowchart LR
    Client["MCP SDK Client<br/>(real)"] -->|"HTTP /mcp (Bearer auth)"| Mcp["MCP HTTP Server<br/>(real)"]
    Mcp -->|"WS client → WS server"| Relay["WebSocket Relay<br/>(real)"]
    Relay -->|"routed request"| Ext["Mock Extension<br/>(raw WebSocket)"]
    Ext -.->|"fixture response"| Relay
    Relay -.->|"response"| Mcp
    Mcp -.->|"tool result"| Client
```

The mock extension answers forwarded requests with fixture data — `page_context_response`, `action_result` (for `click`, `write_text`, `set_checked`, `select_options`, `submit_form`), `navigate_to_url_response`, and `page_content_response` — and the WS server itself answers `list_browsers` from presence data rather than forwarding it.

The harness verifies end-to-end responses for the tools and, crucially, exercises **error flows** that unit tests cannot catch across the seam:

- unauthenticated MCP requests are rejected with HTTP 401 (no extension needed);
- `browser_unavailable` when no extension is connected (`read_current_page`, `navigate_to_url`);
- `unsupported_scheme` for an `ftp://` URL, validated before the request reaches the extension;
- the fill → submit form lifecycle round-trip with `formId` tracking.

Because it spins up real TCP listeners and waits for event-loop settling, the integration test is slower than unit tests; it deliberately stays focused on critical paths while unit tests cover exhaustive edge cases. The test infrastructure (helpers for connecting, authenticating, waiting for JSON messages, and parsing the single MCP tool-content text) lives in the same file and reuses the patterns from the WS server and MCP unit tests.

This integration test is the test to keep green when changing anything across the shared protocol → WebSocket relay → MCP surface → extension path.

## Change patterns to watch for

### Cross-layer changes

Brijio's ownership boundaries are: shared protocol shapes and browser-agnostic behavior in `packages/shared`; relay auth, presence, and routing in `servers/websocket`; agent-facing tools/resources/prompts/skills in `servers/mcp`; browser-specific integration in `clients/extensions/chrome` and `clients/extensions/safari` (keep adapters thin and shared behavior shared).

When changing a protocol or browser capability, check the full path:

```text
shared protocol -> WebSocket relay -> MCP surface -> shared controller
                -> Chrome adapter -> Safari adapter -> integration tests
```

Keep protocol definitions in `packages/shared`; do not duplicate them. When tool behavior changes, update its tests, MCP registration, relevant skills under `servers/mcp/skills`, the capability matrix, and relevant OpenWiki workflow pages. Consider both Chrome and Safari for shared browser behavior, and document and test intentional platform differences.

### Browser routing and `tabId`

The repo has converged on threading `tabId` explicitly through every layer rather than storing a hidden selected-tab session state. Preserve **explicit per-call browser and `tabId` targeting**; do not introduce hidden selected-browser or selected-tab session state. When `tabId` is optional, preserve the documented active-tab fallback unless an accepted ADR changes it. Re-read page context after navigation or a mutation that can invalidate short-lived target IDs. The relevant ADRs are `0060-explicit-tab-listing-and-selection.md` and `0062-thread-tabid-through-action-stack.md`.

### Extension UI or manifest changes

Chrome and Safari have different manifest and runtime constraints (e.g. Safari's non-persistent iOS background, platform-specific builds). Check the package README and the relevant platform ADRs before changing popup behavior, host permissions, or background lifecycle assumptions.

## Where to look next

For OpenWiki specifically, start from [Quickstart](quickstart.md), then follow the domain or architecture page that matches the area you are changing — e.g. [MCP-Extension Flow](architecture/mcp-extension-flow.md), [Domains](domains.md), or [Runtime and Deployment](operations/runtime-and-deployment.md).
