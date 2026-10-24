---
type: "Reference"
title: "Workflows"
description: "Repo-level development workflows: common pnpm commands, per-domain verification, protocol and browser-targeting change patterns, the ADR/TDD workflow from AGENTS.md, and OpenWiki navigation."
tags:
  [
    "workflows",
    "commands",
    "verification",
    "adr",
    "tdd",
    "protocol",
    "browser-targeting",
    "openwiki",
  ]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-24T12:27:27.124Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-5a60d3196588e015ba660b7b
    resource: repo://clients/extensions/chrome/package.json
  - id: openwiki-source-71a0e8f6d491eb3a2c086e5e
    resource: repo://clients/extensions/safari/package.json
  - id: openwiki-source-a31e56605839ce458ceb1d44
    resource: repo://docs/architecture/decisions/0060-explicit-tab-listing-and-selection.md
  - id: openwiki-source-2b66c8e72b793ad548b86a29
    resource: repo://docs/architecture/decisions/0062-thread-tabid-through-action-stack.md
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-c83ceec2d47257f066951051
    resource: repo://packages/shared/package.json
  - id: openwiki-source-ceadb6a3b6b9b72b892f43ce
    resource: repo://servers/mcp/package.json
  - id: openwiki-source-475cb24dac2da48673b37928
    resource: repo://servers/websocket/package.json
generated: { by: "openwiki/0.7.2", at: "2026-10-24T12:27:27.124Z" }
---

# Workflows

This page captures the repo-level workflows that matter most when editing Brijio. It is a reference and navigation aid; the runtime flow and tab-targeting mechanics live in [Architecture: MCP ↔ WebSocket ↔ extension flow](architecture/mcp-extension-flow.md) and [Multi-tab workflow](workflows/multi-tab.md). For the domain map, see [Major Domains](domains.md); for trust boundaries, see [Security and Trust Model](security.md).

## Common commands

The root `package.json` is the authority for package-manager and Node versions and for the top-level scripts. Derive commands from it rather than from copied tool inventories. Current top-level scripts:

- `pnpm build` — build all workspace packages (`pnpm -r build`)
- `pnpm test` — run workspace tests plus repo scripts (`pnpm -r test && node --test scripts/*.test.mjs`)
- `pnpm check` — type-check and validation pass across packages (`pnpm -r check`)
- `pnpm lint` — TypeScript and Markdown linting (`pnpm lint:ts && pnpm lint:md`)
- `pnpm lint:ts` — TypeScript lint via `ts-standard`
- `pnpm lint:md` — Markdown format check via `prettier --check`
- `pnpm dev` — start the local development helper
- `pnpm dev:ws` — run the WebSocket server in watch mode
- `pnpm dev:mcp` — run the MCP server in watch mode
- `pnpm token` — run the local pairing-token helper

Package-specific commands are defined in each workspace package manifest. Current per-package scripts:

- `@brijio/shared` (`packages/shared`): `build`, `check`, `dev`, `test`
- `@brijio/websocket` (`servers/websocket`): `build`, `check`, `dev`, `test`
- `@brijio/mcp` (`servers/mcp`): `build`, `check`, `dev`, `test`, `prepublishOnly`
- `@brijio/chrome-extension` (`clients/extensions/chrome`): `build`, `pack`, `check`, `dev`, `test`
- `@brijio/safari-extension` (`clients/extensions/safari`): `build`, `check`, `dev`, `test`

A `clients/extensions/firefox` directory exists with a README only; it is not yet a built workspace package and has no package scripts.

## What to run after making changes

Run the smallest verification set that exercises the modified domain, using the `@brijio/*` package filters:

| Change area                   | Verification commands                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| Shared protocol or page logic | `pnpm --filter @brijio/shared test` and `pnpm --filter @brijio/shared check`                     |
| Relay/routing changes         | `pnpm --filter @brijio/websocket test` and `pnpm --filter @brijio/websocket check`               |
| MCP tool or resource changes  | `pnpm --filter @brijio/mcp test` and `pnpm --filter @brijio/mcp check`                           |
| Chrome extension changes      | `pnpm --filter @brijio/chrome-extension test` and `pnpm --filter @brijio/chrome-extension check` |
| Safari extension changes      | `pnpm --filter @brijio/safari-extension test` and `pnpm --filter @brijio/safari-extension check` |

If a change spans several layers, run the workspace-level `pnpm test` and `pnpm check`. Before a PR is ready, match CI with:

```sh
pnpm lint
pnpm build
pnpm test
```

Use Docker validation only when container or runtime behavior changes, and derive profiles and commands from `docker-compose.yml` rather than assuming a profile exists. Before claiming completion, report exactly what passed and what could not be run.

## Change workflow from AGENTS.md

The root `AGENTS.md` is the authoritative guide for future coding agents. It opens by directing agents to the [OpenWiki quickstart](quickstart.md) and to follow only the architecture, workflow, domain, security, or testing links relevant to the task, then to read the package manifest and tests for the area being changed. Sources of truth are ranked: executable behavior from source and tests; the product contract from `docs/project/CAPABILITY_MATRIX.md`; design history from `docs/architecture/decisions`; security intent from `docs/security`; and public setup from the root and package `README.md` files. When these disagree, do not silently pick one — determine what is stale and update or report it.

### ADR required

Write an ADR before implementation when a change introduces or alters any of:

- a product capability or intentional user-visible behavior;
- a cross-package protocol or schema;
- an architectural boundary or ownership decision;
- authentication, authorization, privacy, storage, or a trust boundary;
- browser routing, targeting, or lifecycle semantics;
- a dependency or framework that materially changes the architecture.

Create the ADR as `Proposed`, include Mermaid diagrams when architecture or message flow is relevant, and wait for explicit user approval before implementing. A request to implement a feature does not by itself approve the ADR written for that feature. Before assigning a number, list existing ADRs in `docs/architecture/decisions` and use the next unused number; never reuse an ADR number. After approval, mark the ADR `Accepted`, and if a decision is replaced, record the superseding or superseded relationship. Do not leave an implemented decision marked `Proposed`.

### ADR usually not required

An ADR is normally unnecessary for a bug fix that restores documented or tested behavior, tests for existing behavior, documentation-only corrections, a behavior-preserving refactor, narrowly scoped tooling or dependency maintenance, or implementation already covered by an accepted ADR. If a supposedly narrow change requires a new design decision, stop and follow the ADR workflow.

### Implementation: TDD

For behavior changes, use test-driven development:

1. Write or adjust a test that fails for the expected reason.
2. Implement the smallest change that makes it pass.
3. Refactor only when necessary and keep the test green.
4. Run the relevant verification commands.

For documentation, configuration, or tooling changes where a failing test is not meaningful, validate with the narrowest applicable formatter, linter, build, or direct inspection.

### Documentation

Update documentation to match what changed: capability or support status in `docs/project/CAPABILITY_MATRIX.md`; architectural decisions in `docs/architecture/decisions`; repository navigation or cross-layer workflow in `openwiki`; public setup, commands, or configuration in the root or package `README.md`; completed-feature or operational explanation in `docs/artifacts`; security boundaries in `docs/security`. Keep docs linked rather than copying large mutable inventories between files.

## Change patterns to watch for

### Protocol or schema changes

Protocol shapes and browser-agnostic behavior belong in `packages/shared`; do not duplicate them elsewhere. When a cross-package message shape changes, update `packages/shared` first and then propagate through the relay, MCP server, and browser adapters in this order:

```text
shared protocol -> WebSocket relay -> MCP surface -> shared controller
                -> Chrome adapter -> Safari adapter -> integration tests
```

### Browser-targeting and tab routing changes

Browser routing, targeting, and lifecycle changes often span `packages/shared`, `servers/mcp`, `servers/websocket`, and both extension packages. The repo's direction is explicit per-call targeting rather than hidden selected-tab session state: thread `tabId` through every layer (MCP tool input → `page-actions.ts` → WebSocket envelope `target.tabId` → `BrijioBackgroundController` → shared `page-reader.ts` → `chrome.tabs.get`/`sendMessage`), with a documented active-tab fallback when `tabId` is absent. Re-read page context after navigation or a mutation that can invalidate short-lived target IDs. The ADRs that establish this pattern are:

- `docs/architecture/decisions/0060-explicit-tab-listing-and-selection.md` — `list_tabs` tool, per-call `tabId` parameter, `TabInfo` shape.
- `docs/architecture/decisions/0062-thread-tabid-through-action-stack.md` — threading `tabId` end-to-end through the extension layer.

When tool behavior changes, update its tests, MCP registration, relevant skills under `servers/mcp/skills`, the capability matrix, and the relevant OpenWiki workflow pages. Consider both Chrome and Safari for shared browser behavior, and document and test intentional platform differences.

### Extension UI or manifest changes

Chrome and Safari have different manifest and runtime constraints (e.g. Safari's non-persistent iOS background and platform-specific builds). Check the package `README.md` files before changing popup behavior, host permissions, or background lifecycle assumptions.

### Demo and docs changes

The repository contains demo pages and docs artifacts under `servers/mcp/demo`, `clients/test-page`, `docs/artifacts`, and `scripts/`. These are useful for validating UX and layout assumptions but are not the main runtime path.

## OpenWiki navigation

The repository has a generated `openwiki/` evidence index. It is optional just-in-time context, not required startup reading:

- Do not enumerate, preload, or search wikis at task start. Use retrieval when the user asks for it, when unfamiliar architecture or dependency behavior materially affects the task, or when source inspection leaves an important uncertainty — then stop once the question is grounded.
- When OpenWiki retrieval tools are available, use `openwiki_search` for just-in-time context and `openwiki_read` for complete relevant sections. Use `openwiki_list_workspaces` or `openwiki_list_wikis` only when workspace membership itself must be discovered. If `openwiki_search` returns `workspace_required`, ask which listed workspace to use and retry with its ID.
- If the retrieval tools are unavailable, read `openwiki/quickstart.md` and follow its links to the relevant pages.
- Treat source code and tests as authoritative. A brief's unknowns and review items are verification gaps, not automatic requirements. Prefer the narrowest quiet validation that proves the changed behavior and preserve complete failure output.
- The scheduled OpenWiki GitHub Actions workflow refreshes the repository wiki. Do not hand-edit generated OpenWiki pages unless explicitly asked; prefer updating source code and docs and letting OpenWiki regenerate.
