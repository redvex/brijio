---
type: "Reference"
title: "Workflows"
openwiki_generated: true
verified:
  - by: openwiki/0.7.2
    at: 2026-10-17T11:58:52.754Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-5a60d3196588e015ba660b7b
    resource: repo://clients/extensions/chrome/package.json
  - id: openwiki-source-71a0e8f6d491eb3a2c086e5e
    resource: repo://clients/extensions/safari/package.json
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
generated: { by: "openwiki/0.7.2", at: "2026-10-17T11:58:52.754Z" }
---

# Workflows

This page captures the repo-level development workflows that matter when editing
Brijio. It complements the per-area pages: for the runtime request path see
[architecture/mcp-extension-flow.md](architecture/mcp-extension-flow.md), for
`tabId` targeting see [workflows/multi-tab.md](workflows/multi-tab.md), and for
the `brijio` CLI/daemon commands see [operations.md](operations.md) (do not
duplicate it here).

## Command authority

All commands below are derived from `package.json` and the workspace package
manifests. Those manifests are the authority for runtime versions, package-manager
versions, and available scripts — do not copy mutable tool inventories or
repository trees elsewhere.

### Top-level commands

From the root `package.json`:

- `pnpm build` — `pnpm -r build`, build every workspace package recursively.
- `pnpm check` — `pnpm -r check`, type-check / validation across packages.
- `pnpm test` — `pnpm -r test` then `node --test scripts/*.test.mjs`; runs every
  workspace test suite plus repo-level `scripts/*.test.mjs` tests.
- `pnpm lint` — `pnpm lint:ts && pnpm lint:md`; TypeScript standard lint then
  Markdown formatting check.
- `pnpm lint:ts` — `ts-standard "**/*.ts"`.
- `pnpm lint:md` — `prettier --check "**/*.md"`.
- `pnpm format:md` — `prettier --write "**/*.md"`.
- `pnpm dev` — `node scripts/dev.mjs`, the local development helper.
- `pnpm dev:ws` — `tsx watch servers/websocket/src/index.ts`, the WebSocket relay
  in watch mode.
- `pnpm dev:mcp` — `tsx watch servers/mcp/src/index.ts`, the MCP server in watch
  mode.
- `pnpm precommit` — runs `scripts/pre-commit`.
- `pnpm serve:test-pages` — builds and serves the static test-pages site.

### Package-specific scripts

Each workspace package defines its own `build`, `check`, `test`, and where
applicable `dev` and packaging scripts:

- `packages/shared` (`@brijio/shared`): `build`, `check`, `test`, plus a
  placeholder `dev`. `build` compiles with `tsc` then bundles with `esbuild`;
  `test` is `node --import tsx --test src/**/*.test.ts`.
- `servers/websocket` (`@brijio/websocket`): `build`, `check`, `test`, `dev`
  (`tsx watch`). `build` and `check` are both `tsc --noEmit`.
- `servers/mcp` (`@brijio/mcp`): `build` (`tsup`), `check`, `test`, `dev`
  (`tsx watch`), and `prepublishOnly` (`pnpm build`).
- `clients/extensions/chrome` (`@brijio/chrome-extension`): `build` (tsc +
  esbuild per bundle + manifest/icon copy + `verify-build-output`), `check`,
  `test`, `pack` (zip `dist`), and a placeholder `dev`.
- `clients/extensions/safari` (`@brijio/safari-extension`): `build` (tsc +
  esbuild into `dist-ios`/`dist-macos` + platform manifest generation +
  `verify-build-output`), `check`, `test`, and a placeholder `dev`.

## Classify the change before editing

The root `AGENTS.md` requires classifying a change before implementation. The
classification determines whether an ADR is needed and what verification applies.

### ADR required

Write an ADR **before** implementation when a change introduces or alters:

- a product capability or intentional user-visible behavior;
- a cross-package protocol or schema;
- an architectural boundary or ownership decision;
- authentication, authorization, privacy, storage, or a trust boundary;
- browser routing, targeting, or lifecycle semantics;
- a dependency or framework that materially changes the architecture.

### ADR usually not required

An ADR is normally unnecessary for a bug fix that restores documented or tested
behavior, tests for existing behavior, documentation-only corrections, a
behavior-preserving refactor, narrowly scoped tooling or dependency maintenance,
or implementation already covered by an accepted ADR. If a supposedly narrow
change turns out to require a new design decision, stop and follow the ADR
workflow.

### ADR lifecycle and numbering

ADRs live in `docs/architecture/decisions`. Before assigning a number, list the
existing ADRs and use the next unused number; never reuse an ADR number. Create
the ADR as `Proposed`, include Mermaid diagrams when architecture or message flow
is relevant, and wait for explicit user approval before implementing. A request
to implement a feature does not by itself approve the ADR written for it. After
approval, mark the ADR `Accepted`. If a decision is replaced, record the
superseding/superseded relationship. Do not leave an implemented decision marked
`Proposed`.

## Implementation approach

### TDD for behavior changes

For behavior changes, use test-driven development:

1. Write or adjust a test that fails for the expected reason.
2. Implement the smallest change that makes it pass.
3. Refactor only when necessary and keep the test green.
4. Run the relevant verification commands.

### Narrowest validation for docs/config/tooling changes

For documentation, configuration, or tooling changes where a failing test is not
meaningful, validate with the narrowest applicable formatter, linter, build, or
direct inspection — for example `pnpm lint:md` for a Markdown-only change rather
than the full workspace test run.

## Smallest verification set per domain

Run the smallest verification set that exercises the modified domain. Use the
package filter names (the `name` field of each workspace manifest):

- Shared protocol or page logic:
  `pnpm --filter @brijio/shared test` and `pnpm --filter @brijio/shared check`.
- WebSocket relay / routing:
  `pnpm --filter @brijio/websocket test` and `pnpm --filter @brijio/websocket check`.
- MCP tool or resource changes:
  `pnpm --filter @brijio/mcp test` and `pnpm --filter @brijio/mcp check`.
- Chrome extension changes:
  `pnpm --filter @brijio/chrome-extension test` and
  `pnpm --filter @brijio/chrome-extension check`.
- Safari extension changes:
  `pnpm --filter @brijio/safari-extension test` and
  `pnpm --filter @brijio/safari-extension check`.

If a change spans several layers, run the workspace-level `pnpm test` and
`pnpm check` when practical.

## Cross-package and PR verification

For cross-package changes, run `pnpm test` and `pnpm check`. Before a PR is
ready, match CI with:

```sh
pnpm lint
pnpm build
pnpm test
```

Use Docker validation only when container or runtime behavior changes, and derive
the current profiles and commands from `docker-compose.yml`; do not assume a
profile exists. Before claiming completion, report exactly what passed and what
could not be run.

## Change patterns to watch for

### Protocol or schema changes

If you change any cross-package message shape, update `packages/shared` first and
then propagate the change through the relay, MCP server, and browser adapters.
The full path to check, from `AGENTS.md`, is:

```text
shared protocol -> WebSocket relay -> MCP surface -> shared controller
                -> Chrome adapter -> Safari adapter -> integration tests
```

Keep protocol definitions in `packages/shared`; do not duplicate them in the
relay, MCP server, or extensions.

<!-- openwiki: mermaid parse failed and this diagram was converted to a text fence so it does not break rendering. Fix the diagram source and restore the mermaid fence. Parser error: Heuristic: an unescaped angle bracket inside a label breaks rendering; rephrase the label. -->

```text
flowchart LR
    Shared["packages/shared<br/>(protocol + controller)"] --> WS["servers/websocket<br/>(relay)"]
    WS --> MCP["servers/mcp<br/>(tools/skills)"]
    Shared --> Chrome["clients/extensions/chrome"]
    Shared --> Safari["clients/extensions/safari"]
    Chrome --> Tests["integration tests"]
    Safari --> Tests
```

### Browser-targeting and tabId changes

Browser and tab routing changes cross all layers. The repo favors threading
`tabId` explicitly through every layer rather than storing hidden selected-tab
session state — preserve that pattern unless a new accepted ADR says otherwise.
When `tabId` is optional, preserve the documented active-tab fallback. Re-read
page context after navigation or any mutation that can invalidate short-lived
target IDs. The canonical ADRs for this area are
`docs/architecture/decisions/0060-explicit-tab-listing-and-selection.md` and
`docs/architecture/decisions/0062-thread-tabid-through-action-stack.md`; the
agent-facing workflow is documented in [workflows/multi-tab.md](workflows/multi-tab.md).

### Approval-gated action changes

Browser reads and actions are always initiated by an explicit MCP tool or
resource request. The extension is reactive and never publishes ambient browser
state. Preserve user-visible connection state and the configured client-side
action approval flow — do not bypass approval checks, and do not add continuous
page, DOM, screenshot, history, or browser-state streaming. Keep permissions
minimal and document why each browser permission is needed.

### Tool behavior changes

When tool behavior changes, `AGENTS.md` requires updating, in lockstep:

- the tool's tests;
- its MCP registration;
- relevant skills under `servers/mcp/skills`;
- the capability matrix (`docs/project/CAPABILITY_MATRIX.md`);
- the relevant OpenWiki workflow pages.

### Extension UI or manifest changes

Chrome and Safari have different manifest and runtime constraints (e.g. Safari's
non-persistent background context and per-platform manifest generation). Check
the package README files before changing popup behavior, host permissions, or
background lifecycle assumptions, and test intentional platform differences.

## Documentation updates

Update documentation according to what changed, keeping docs linked rather than
copying mutable inventories between files:

- Capability or support status: `docs/project/CAPABILITY_MATRIX.md`.
- Architectural decision: `docs/architecture/decisions`.
- Repository navigation or cross-layer workflow: `openwiki`.
- Security boundary or guarantee: `docs/security`.
- Public setup, commands, or configuration: root or package `README.md`.
- Completed feature or operational explanation: `docs/artifacts`.

## Git and PR hygiene

Preserve unrelated changes and never revert user work. Keep changes focused; do
not mix cleanup, formatting, dependencies, or documentation rewrites into an
unrelated behavior change. Use small, atomic commits with meaningful messages
(one coherent step each: an ADR, tests, implementation, documentation, or
tooling). Stage files explicitly; avoid `git add .` / `git add -A` unless the
whole working tree has been confirmed as PR scope. Use a PR title and description
that match the actual goal and scope, and report verification results and known
limitations in the PR description.
