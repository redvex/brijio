---
type: "Reference"
title: "Workflows"
description: "Repo-level development workflows: top-level and per-package pnpm commands, the smallest-verification-set principle and CI-matching set, shared-protocol-first change order, and ADR/TDD conventions from AGENTS.md."
tags: [workflows, build, test, ci, adr, tdd, verification, monorepo]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-14T14:46:23.462Z
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
  - id: openwiki-source-40275cb92c3610938f16ade3
    resource: repo://pnpm-workspace.yaml
  - id: openwiki-source-7164859f3d7c069d9fda8e58
    resource: repo://scripts/dev.mjs
  - id: openwiki-source-ceadb6a3b6b9b72b892f43ce
    resource: repo://servers/mcp/package.json
  - id: openwiki-source-475cb24dac2da48673b37928
    resource: repo://servers/websocket/package.json
generated: { by: "openwiki/0.9.0", at: "2026-11-14T14:46:23.462Z" }
---

# Workflows

This page captures the repo-level development workflows that matter when
editing Brijio: the commands to run, the smallest verification set per domain,
the shared-protocol-first change order, the ADR/TDD conventions, and how
browser-targeting, extension, and demo/docs changes differ. It deliberately
defers the test strategy to [Testing Strategy](testing.md) and local runtime
to [Daemon and Runtime Operations](operations/daemon-and-runtime.md).

## Workspace layout

`pnpm-workspace.yaml` declares three workspace globs, so the packages that
matter for routing changes are `packages/*`, `servers/*`, and
`clients/extensions/*`. Each workspace package owns its own `build`, `check`,
`test`, and (where relevant) `dev` scripts; the root scripts delegate to them
with `pnpm -r`.

## Top-level commands

From the root `package.json`, the main commands are:

| Command        | What it does                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------- |
| `pnpm build`   | `pnpm -r build` — build every workspace package                                                     |
| `pnpm check`   | `pnpm -r check` — type-check (`tsc --noEmit`) across packages                                       |
| `pnpm test`    | `pnpm -r test && node --test scripts/*.test.mjs` — package suites plus repo-level scripts           |
| `pnpm lint`    | `pnpm lint:ts && pnpm lint:md` — `ts-standard` over `**/*.ts` and `prettier --check` over `**/*.md` |
| `pnpm dev`     | `node scripts/dev.mjs` — one-command local startup (see below)                                      |
| `pnpm dev:ws`  | `tsx watch servers/websocket/src/index.ts` — WebSocket server watch mode                            |
| `pnpm dev:mcp` | `tsx watch servers/mcp/src/index.ts` — MCP server watch mode                                        |
| `pnpm token`   | `node scripts/brijio-token.mjs` — generate a pairing/auth token                                     |

`pnpm dev` is the orchestrator described in ADR 0029: it configures `.env`,
spawns both servers under `tsx watch`, health-checks `/health` on both, and
supervises them with restart backoff. For the full lifecycle and environment
keys, see [Daemon and Runtime Operations](operations/daemon-and-runtime.md).

The `Makefile` mirrors the build/check/test/lint targets and adds Safari
conversion targets (`safari`, `safari-ios`, `safari-macos`) that run
`safari-web-extension-converter` against the built Safari extension, plus
`chrome` and `clean`. These are release/packaging conveniences, not part of the
everyday verification loop.

## Per-package filter commands

Each workspace package defines its own scripts; run them through
`pnpm --filter <name>` to scope work to one domain:

| Package                 | `pnpm --filter` name       | Scripts                                           |
| ----------------------- | -------------------------- | ------------------------------------------------- |
| Shared protocol & logic | `@brijio/shared`           | `build`, `check`, `dev`* , `test`                 |
| WebSocket relay         | `@brijio/websocket`        | `build`, `check`, `dev`, `test`                   |
| MCP server              | `@brijio/mcp`              | `build`, `check`, `dev`, `test`, `prepublishOnly` |
| Chrome extension        | `@brijio/chrome-extension` | `build`, `check`, `dev`*, `test`, `pack`          |
| Safari extension        | `@brijio/safari-extension` | `build`, `check`, `dev`*, `test`                  |

\*`dev` is a placeholder (`echo "… dev workflow is not implemented yet"`) in
`@brijio/shared` and both extension packages; use the root `pnpm dev` for local
server startup and the package `build`/`check`/`test` scripts for extension
work.

All runtime tests use Node's built-in `node:test` runner via
`node --import tsx --test src/**/*.test.ts`, so no separate build step is
needed to run a suite. See [Testing Strategy](testing.md) for what each
suite covers.

## What to run after making changes

### Smallest verification set

The guiding principle from `AGENTS.md` is: run the smallest verification set
that covers the change. For a change scoped to one package, run that
package's `test` and `check`:

| Domain                       | Test                                          | Check                                          |
| ---------------------------- | --------------------------------------------- | ---------------------------------------------- |
| Shared protocol / page logic | `pnpm --filter @brijio/shared test`           | `pnpm --filter @brijio/shared check`           |
| WebSocket relay / routing    | `pnpm --filter @brijio/websocket test`        | `pnpm --filter @brijio/websocket check`        |
| MCP tool / resource / skill  | `pnpm --filter @brijio/mcp test`              | `pnpm --filter @brijio/mcp check`              |
| Chrome extension             | `pnpm --filter @brijio/chrome-extension test` | `pnpm --filter @brijio/chrome-extension check` |
| Safari extension             | `pnpm --filter @brijio/safari-extension test` | `pnpm --filter @brijio/safari-extension check` |

For cross-package changes — anything touching the shared protocol, the relay,
or the MCP surface — run the workspace-level `pnpm test` and `pnpm check`.

### CI-matching set

Before a PR is ready, match CI with:

```sh
pnpm lint
pnpm build
pnpm test
```

This is the authoritative pre-merge set from `AGENTS.md`. The individual
package checks above are for fast inner-loop feedback; this trio is what CI
runs.

### Docker validation

Use Docker validation **only** when container or runtime behavior changes.
Profiles and commands come from `docker-compose.yml` and must not be assumed
to exist. Current profiles are `runtime` (the combined `brijio` image), a
`legacy-runtime` alias (`browserbridge` extending `brijio`), and `test`
(an `nginx` test-page server). Derive the active profile from the file each
time; do not hard-code one into a workflow. Containerized runtime is
documented in [Daemon and Runtime Operations](operations/daemon-and-runtime.md).

Before claiming completion, report exactly what passed and what could not be
run — this is an explicit `AGENTS.md` requirement.

## ADR workflow

`AGENTS.md` requires classifying a change before editing and writing an ADR
when a change introduces or alters a product capability, a cross-package
protocol or schema, an architectural boundary or ownership decision,
authentication/authorization/privacy/storage or a trust boundary, browser
routing/targeting/lifecycle semantics, or a dependency that materially
changes the architecture.

ADR mechanics:

- Create the ADR as **Proposed**, include Mermaid diagrams when architecture or
  message flow is relevant, and wait for explicit user approval before
  implementing. A request to implement a feature does not by itself approve
  the ADR written for it.
- Before assigning a number, list existing ADRs in
  `docs/architecture/decisions` and use the next unused number. **Never reuse
  an ADR number.** (Note: the repo currently has duplicate-numbered files from
  earlier history, e.g. two `0036` and `0037` entries; the rule is still to
  pick the next unused number when adding new ones.)
- After approval, mark the ADR **Accepted**. If a decision is replaced, record
  its superseding/superseded relationship. Do not leave an implemented decision
  marked `Proposed`.

ADR usually **not** required: a bug fix that restores documented/tested
behavior, tests for existing behavior, documentation-only corrections, a
behavior-preserving refactor, narrowly scoped tooling/dependency maintenance,
or implementation already covered by an accepted ADR. If a supposedly narrow
change requires a new design decision, stop and follow the ADR workflow.

## TDD for behavior changes

For behavior changes, `AGENTS.md` mandates TDD:

1. Write or adjust a test that fails for the expected reason.
2. Implement the smallest change that makes it pass.
3. Refactor only when necessary and keep the test green.
4. Run the relevant verification commands (see above).

For documentation, configuration, or tooling changes where a failing test is
not meaningful, validate with the narrowest applicable formatter, linter,
build, or direct inspection instead of forcing a test.

## Change patterns to watch for

### Shared-protocol-first

Shared protocol shapes and browser-agnostic behavior belong in
`packages/shared`; relay behavior in `servers/websocket`; agent-facing tools,
resources, prompts, and skills in `servers/mcp`; browser-specific integration
in `clients/extensions/chrome` and `clients/extensions/safari` with adapters
kept thin. Protocol definitions must not be duplicated.

For any protocol or schema change, update `packages/shared` **first**, then
propagate through the full path documented in `AGENTS.md`:

```text
shared protocol -> WebSocket relay -> MCP surface -> shared controller
                -> Chrome adapter -> Safari adapter -> integration tests
```

When tool behavior changes, also update its tests, MCP registration, relevant
skills under `servers/mcp/skills`, `docs/project/CAPABILITY_MATRIX.md`, and
the relevant OpenWiki pages.

### Browser-targeting changes

Browser and tab routing changes span `packages/shared`, `servers/mcp`,
`servers/websocket`, and both extension packages, and Chrome/Safari parity must
be preserved in the same change. The repository's strong convention
(ADRs 0060–0063) is to thread `tabId` explicitly through every layer as
**per-call, stateless targeting** — never a hidden selected-tab session state.
When `tabId` is optional, preserve the documented active-tab fallback unless
an accepted ADR changes it, and re-read page context after navigation or any
mutation that can invalidate short-lived target IDs. See
[Multi-tab Workflow](workflows/multi-tab.md) for the targeting workflow.

### Extension UI or manifest changes

Chrome and Safari have different manifest and runtime constraints. Check the
package READMEs before changing popup behavior, host permissions, or
background lifecycle assumptions, and consider both browsers for shared
behavior — document and test intentional platform differences. For the
adapter boundary, see [Extension Adapters](architecture/extension-adapters.md).

### Demo and docs changes

Demos and docs artifacts (e.g. `servers/mcp/demo`, `clients/test-page`,
`docs/artifacts`) are non-runtime: they validate UX and layout assumptions
but are not part of the main runtime path. Documentation updates should match
what changed: capability/support status → `docs/project/CAPABILITY_MATRIX.md`;
architectural decision → `docs/architecture/decisions`; repository navigation
or cross-layer workflow → `openwiki`; public setup/config → root or package
`README.md`; completed feature explanation → `docs/artifacts`; security
boundary → `docs/security`. Keep docs linked rather than copying mutable
inventories between files.

## Git and PR conventions

`AGENTS.md` also sets git discipline that affects these workflows: preserve
unrelated changes and never revert user work; keep changes focused (do not mix
cleanup, formatting, dependencies, or documentation rewrites into an
unrelated behavior change); use small atomic commits where each commit is one
coherent step (ADR, tests, implementation, documentation, or tooling); stage
files explicitly (avoid `git add .` / `git add -A` unless the whole tree is
confirmed as PR scope); and use a PR title and description that match the
actual goal, reporting verification results and known limitations.
