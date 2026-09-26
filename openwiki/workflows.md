---
type: "Reference"
title: "Development Workflows"
description: "Repo-level development workflows: common pnpm commands, per-package verification commands, the AGENTS.md ADR/TDD conventions, and change patterns to watch (protocol/schema, browser-targeting, extension UI/manifest, demo/docs)."
tags: [workflows, commands, verification, adr, tdd, change-patterns, brijio]
verified:
  - by: openwiki/0.6.0
    at: 2026-09-26T12:40:26.126Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-5a60d3196588e015ba660b7b
    resource: repo://clients/extensions/chrome/package.json
  - id: openwiki-source-71a0e8f6d491eb3a2c086e5e
    resource: repo://clients/extensions/safari/package.json
  - id: openwiki-source-b79fbbd921df689b4bbdc82f
    resource: repo://docker-compose.yml
  - id: openwiki-source-992a62d4a0e989fc2da546d0
    resource: repo://docs/architecture/decisions/0048-client-side-action-approval.md
  - id: openwiki-source-a31e56605839ce458ceb1d44
    resource: repo://docs/architecture/decisions/0060-explicit-tab-listing-and-selection.md
  - id: openwiki-source-2b66c8e72b793ad548b86a29
    resource: repo://docs/architecture/decisions/0062-thread-tabid-through-action-stack.md
  - id: openwiki-source-012f2c78e3b1446dfc35803f
    resource: repo://Makefile
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-c83ceec2d47257f066951051
    resource: repo://packages/shared/package.json
  - id: openwiki-source-40275cb92c3610938f16ade3
    resource: repo://pnpm-workspace.yaml
  - id: openwiki-source-ceadb6a3b6b9b72b892f43ce
    resource: repo://servers/mcp/package.json
  - id: openwiki-source-475cb24dac2da48673b37928
    resource: repo://servers/websocket/package.json
generated: { by: "openwiki/0.6.0", at: "2026-09-26T12:40:26.126Z" }
---

# Development Workflows

This page captures the repo-level workflows that matter most when editing Brijio: the commands to run, the conventions to follow from `AGENTS.md`, and the cross-layer change patterns that tend to bite when they are ignored. Use it as the practical companion to the [Major Domains](domains.md) ownership map.

## Common commands

The workspace is a pnpm monorepo (`packageManager: pnpm@10.32.1`) with three package roots declared in `pnpm-workspace.yaml` (`packages/*`, `servers/*`, `clients/extensions/*`). The top-level commands in `package.json` are:

- `pnpm build` — `pnpm -r build` across all workspace packages.
- `pnpm test` — `pnpm -r test` plus `node --test scripts/*.test.mjs` (repo scripts).
- `pnpm check` — `pnpm -r check`, type-check across packages.
- `pnpm lint` — `pnpm lint:ts && pnpm lint:md` (ts-standard + prettier `--check` on Markdown).
- `pnpm dev` — runs `scripts/dev.mjs`, the local one-command development helper.
- `pnpm dev:ws` — `tsx watch servers/websocket/src/index.ts`, the WebSocket relay in watch mode.
- `pnpm dev:mcp` — `tsx watch servers/mcp/src/index.ts`, the MCP server in watch mode.
- `pnpm token` — `node scripts/brijio-token.mjs`, generate a pairing token (alias: `pnpm brijio`).
- `pnpm format:md` — `prettier --write "**/*.md"`.
- `pnpm serve:test-pages` — builds and serves the test-page site (`.pages-site`) for validating UX/layout.

The `Makefile` mirrors the common targets (`build`, `check`, `test`, `lint`, `clean`) and adds Safari/Chrome packaging helpers (`safari`, `safari-ios`, `safari-macos`, `chrome`). The Safari targets build the extension then run `xcrun safari-web-extension-converter` to produce Xcode projects; `clean` removes generated `dist` trees and the converted Safari projects.

## Per-package verification commands

Use `pnpm --filter <package>` to scope work to one domain. Each package defines `build`, `check`, and `test`; some add `dev` or packaging steps:

| Package (filter name)      | Path                        | Scripts                                           |
| -------------------------- | --------------------------- | ------------------------------------------------- |
| `@brijio/shared`           | `packages/shared`           | `build`, `check`, `test` (and a stub `dev`)       |
| `@brijio/websocket`        | `servers/websocket`         | `build`, `check`, `test`, `dev`                   |
| `@brijio/mcp`              | `servers/mcp`               | `build`, `check`, `test`, `dev`, `prepublishOnly` |
| `@brijio/chrome-extension` | `clients/extensions/chrome` | `build`, `check`, `test`, `pack`                  |
| `@brijio/safari-extension` | `clients/extensions/safari` | `build`, `check`, `test`                          |

All `test` scripts run the Node test runner with tsx: `node --import tsx --test src/**/*.test.ts` (the Safari package quotes the glob). `check` is `tsc --noEmit` in every package; `build` differs per package (tsc+esbuild for shared, tsup for MCP, multi-bundle esbuild for the extensions).

To run the relevant narrowest set after a change, use the matching pair:

```sh
pnpm --filter @brijio/shared      test && pnpm --filter @brijio/shared      check
pnpm --filter @brijio/websocket   test && pnpm --filter @brijio/websocket   check
pnpm --filter @brijio/mcp         test && pnpm --filter @brijio/mcp         check
pnpm --filter @brijio/chrome-extension test && pnpm --filter @brijio/chrome-extension check
pnpm --filter @brijio/safari-extension test && pnpm --filter @brijio/safari-extension check
```

For changes that span several layers, run the workspace-level `pnpm test` and `pnpm check` when practical.

## The AGENTS.md change workflow

`AGENTS.md` is the contract for how changes are classified, designed, and verified. Follow it before editing:

1. **Start here**: read [OpenWiki quickstart](quickstart.md), follow only the architecture/domain/security/workflow links relevant to the task, inspect the working tree to preserve unrelated user changes, and read the package manifest and tests for the area being changed.
2. **Classify the change** before editing.

### ADR required

Write an ADR (as `Proposed`, with Mermaid diagrams when architecture or message flow is relevant) and wait for explicit user approval before implementing when a change introduces or alters:

- a product capability or intentional user-visible behavior;
- a cross-package protocol or schema;
- an architectural boundary or ownership decision;
- authentication, authorization, privacy, storage, or a trust boundary;
- browser routing, targeting, or lifecycle semantics;
- a dependency or framework that materially changes the architecture.

Before assigning a number, list existing ADRs and use the next unused number; never reuse an ADR number. After approval, mark the ADR `Accepted`; if superseded, record the superseding/superseded relationship. Do not leave an implemented decision marked `Proposed`.

### ADR usually not required

An ADR is normally unnecessary for: a bug fix that restores documented or tested behavior; tests for existing behavior; documentation-only corrections; a behavior-preserving refactor; narrowly scoped tooling or dependency maintenance; and implementation already covered by an accepted ADR. If a supposedly narrow change actually requires a new design decision, stop and follow the ADR workflow.

### Implementation: TDD for behavior changes

For behavior changes, use TDD:

1. Write or adjust a test that fails for the expected reason.
2. Implement the smallest change that makes it pass.
3. Refactor only when necessary and keep the test green.
4. Run the relevant verification commands.

For documentation, configuration, or tooling changes where a failing test is not meaningful, validate with the narrowest applicable formatter, linter, build, or direct inspection.

## Ownership and the cross-layer change path

Brijio is a bridge: agent → MCP server → WebSocket relay → browser extension → browser tab. Each layer is owned by one domain:

- Shared protocol shapes and browser-agnostic behavior belong in `packages/shared` (nothing here may import from `servers/*` or `clients/*`).
- Relay authentication, presence, and routing belong in `servers/websocket`.
- Agent-facing tools, resources, prompts, and skills belong in `servers/mcp`.
- Browser-specific integration belongs in `clients/extensions/chrome` and `clients/extensions/safari`; keep adapters thin and shared behavior shared.

When changing a protocol or browser capability, check the full path before considering the change done:

```text
shared protocol -> WebSocket relay -> MCP surface -> shared controller
                -> Chrome adapter -> Safari adapter -> integration tests
```

`AGENTS.md` adds rules that matter for safe edits: keep protocol definitions in `packages/shared` and do not duplicate them; preserve explicit per-call browser and `tabId` targeting and do not introduce hidden selected-browser or selected-tab session state; when `tabId` is optional, preserve the documented active-tab fallback unless an accepted ADR changes it; re-read page context after navigation or a mutation that can invalidate short-lived target IDs; when tool behavior changes, update its tests, MCP registration, the relevant skills under `servers/mcp/skills`, the capability matrix, and relevant OpenWiki workflow pages; consider both Chrome and Safari for shared browser behavior and document and test intentional platform differences.

## Change patterns to watch for

### Protocol or schema changes start in packages/shared

If you change any cross-package message shape, update `packages/shared` first (its barrel `src/index.ts` re-exports every module), then propagate the change through the relay, MCP server, shared controller, and browser adapters. Do not duplicate protocol definitions in `servers/*` or `clients/*`.

### Browser-targeting changes span four packages

Targeting (`browserInstanceId`, `tabId`) is threaded explicitly through every layer rather than stored as session state. A change here usually touches `packages/shared`, `servers/mcp`, `servers/websocket`, and both extension packages at once. The relevant detailed workflow is [Multi-tab Workflow](workflows/multi-tab.md). The recent ADRs on this theme are:

- `docs/architecture/decisions/0060-explicit-tab-listing-and-selection.md` — adds `list_tabs` and a per-call `tabId` parameter to every tab tool.
- `docs/architecture/decisions/0062-thread-tabid-through-action-stack.md` — threads `tabId` from MCP tool input through the relay and the `BrijioBackgroundController` down to `chrome.tabs.sendMessage(tabId, …)` / `chrome.tabs.update(tabId, …)`, with an active-tab fallback.
- `docs/architecture/decisions/0063-open-tab-action.md` — the `open_tab` tool for new tabs.
- `docs/architecture/decisions/0064-visual-action-verification.md` — visual verification of actions on the controlled tab.

### Extension UI or manifest changes differ between Chrome and Safari

Chrome and Safari have different manifest formats, background lifecycle assumptions, and build outputs. The Chrome build bundles to a single `dist/` with `manifest.json` copied in, targets `chrome116`, and offers a `pack` zip step. The Safari build produces separate `dist-ios` and `dist-macos` trees with platform manifests generated by `scripts/create-platform-manifest.mjs`, targets `safari17`, marks `browser` external, and is later converted to Xcode projects by the `Makefile` Safari targets. Check the package README files and the build scripts before changing popup behavior, host permissions, or background lifecycle assumptions (e.g. iOS Safari non-persistent background, per ADR 0050).

### Action-approval and high-risk tool changes

Browser-mutating actions route through the client-side action-approval boundary (ADR 0048). Changes that touch approval, `actionUUID` assignment, or `approvalRequest` routing affect the MCP websocket-client, the relay, the shared controller, and the extension banner injection. See the [Action Approval workflow](workflows/action-approval.md) for the detailed flow before editing this area, and do not bypass approval checks.

### Demo and docs changes

The repository contains demo pages and docs artifacts under `servers/mcp/demo`, `clients/test-page`, `docs/artifacts`, and `scripts/`. These are useful for validating UX and layout assumptions (and are served by `pnpm serve:test-pages` or the `docker-compose.yml` `test` profile), but they are not the main runtime path.

## CI-matching pre-PR verification

Before a PR is ready, match CI with the narrowest set that still covers the change, escalating to the full set for cross-package work:

```sh
pnpm lint
pnpm build
pnpm test
```

Use Docker validation only when container or runtime behavior changes, and derive the current profiles and commands from `docker-compose.yml` rather than assuming a profile exists. That file defines three Compose profiles: `runtime` (the `brijio` service, the combined WebSocket+MCP image exposing ports 8787 and 8788), `legacy-runtime` (the `browserbridge` alias extending the base service), and `test` (an `nginx` container serving `clients/test-page`).

Before claiming completion, report exactly what passed and what could not be run.

## Git-history clue for future agents

Recent commits and ADRs show a strong preference for threading `tabId` explicitly through every layer rather than storing hidden selected-tab session state. Preserve that pattern unless a new ADR says otherwise.
