---
type: "Reference"
title: "Workflows"
description: "Repo-level development workflows: common pnpm commands, verification patterns per domain, protocol and browser-targeting change patterns, and AGENTS.md conventions."
tags: [workflows, development, pnpm, verification, adr, tdd, change-patterns]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-20T16:42:52.757Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-5a60d3196588e015ba660b7b
    resource: repo://clients/extensions/chrome/package.json
  - id: openwiki-source-71a0e8f6d491eb3a2c086e5e
    resource: repo://clients/extensions/safari/package.json
  - id: openwiki-source-012f2c78e3b1446dfc35803f
    resource: repo://Makefile
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-c83ceec2d47257f066951051
    resource: repo://packages/shared/package.json
  - id: openwiki-source-ceadb6a3b6b9b72b892f43ce
    resource: repo://servers/mcp/package.json
  - id: openwiki-source-475cb24dac2da48673b37928
    resource: repo://servers/websocket/package.json
generated: { by: "openwiki/0.9.0", at: "2026-11-20T16:42:52.757Z" }
---

# Workflows

This page captures the repo-level development workflows that matter most when
editing Brijio. It is about _how a developer works in the repository_ — the
commands to run, the change patterns to follow, and the conventions to respect.
Runtime configuration and daemon deployment live in
[Runtime and Deployment](operations/runtime-and-deployment.md); the layered
test strategy lives in [Testing](testing.md); the multi-tab targeting model
lives in [Multi-tab Workflow](workflows/multi-tab.md).

The authority for runtime versions, package-manager version, and available
commands is `package.json` and the workspace package manifests, not this page.
Use the commands here as a convenience map derived from those manifests.

## Common top-level commands

The repo is a pnpm (declared `pnpm@10.32.1`, engine `pnpm >=9.0.0`) TypeScript
monorepo requiring Node `>=22.0.0`. Top-level scripts defined in `package.json`:

- `pnpm build` — `pnpm -r build`, build every workspace package recursively.
- `pnpm check` — `pnpm -r check`, type-check / validation across packages.
- `pnpm test` — `pnpm -r test && node --test scripts/*.test.mjs`, run every
  package test suite plus the repo-level `scripts/*.test.mjs` tests.
- `pnpm lint` — `pnpm lint:ts && pnpm lint:md`; `lint:ts` runs `ts-standard`
  over all `*.ts`, `lint:md` runs `prettier --check` over all `*.md`.
- `pnpm format:md` — `prettier --write` over all `*.md`.
- `pnpm dev` — `node scripts/dev.mjs`, the interactive development orchestrator
  (see [Runtime and Deployment](operations/runtime-and-deployment.md)).
- `pnpm dev:ws` — `tsx watch servers/websocket/src/index.ts`, the WebSocket
  relay in watch mode.
- `pnpm dev:mcp` — `tsx watch servers/mcp/src/index.ts`, the MCP server in
  watch mode.
- `pnpm token` (alias `pnpm brijio`) — `node scripts/brijio-token.mjs`,
  generate a local pairing token.
- `pnpm serve:test-pages` — build the `.pages-site` demo/marketing site and
  serve it.
- `pnpm precommit` — `scripts/pre-commit`.

`pnpm build`, `pnpm check`, and `pnpm test` use `pnpm -r` recursion, so they
also work for cross-package runs. The `Makefile` mirrors several of these
(`build`, `check`, `test`, `lint`, `clean`) and adds Safari Xcode conversion
targets (`safari`, `safari-ios`, `safari-macos`) and a `chrome` build target for
platform-specific packaging; use the Make targets when producing installable
Safari/Chrome artifacts rather than for routine verification.

### Per-package commands

Each workspace package defines its own `build`, `check`, `test`, and `dev`
scripts (Chrome also has `pack`). Use `pnpm --filter <pkg> <script>` to run one
package in isolation:

| Package                     | npm name                   | Scripts                                           |
| --------------------------- | -------------------------- | ------------------------------------------------- |
| `packages/shared`           | `@brijio/shared`           | `build`, `check`, `dev`, `test`                   |
| `servers/websocket`         | `@brijio/websocket`        | `build`, `check`, `dev`, `test`                   |
| `servers/mcp`               | `@brijio/mcp`              | `build`, `check`, `dev`, `test`, `prepublishOnly` |
| `clients/extensions/chrome` | `@brijio/chrome-extension` | `build`, `check`, `dev`, `test`, `pack`           |
| `clients/extensions/safari` | `@brijio/safari-extension` | `build`, `check`, `dev`, `test`                   |

The extension `dev` scripts currently print "not implemented yet" — the live
watch workflow for extensions is not scripted, so iterate by rebuilding
(`pnpm --filter @brijio/<ext> build`) and reloading the unpacked extension.
Tests run via Node's built-in runner (`node --import tsx --test ...`); the
full test layout is documented in [Testing](testing.md).

## Smallest verification set after a change

`AGENTS.md` requires running the smallest verification set that covers the
change, not the whole suite. Map the modified domain to its package and run
both its `test` and `check` scripts:

- Shared protocol / page logic — `pnpm --filter @brijio/shared test` and
  `pnpm --filter @brijio/shared check`.
- Relay / routing / presence / auth — `pnpm --filter @brijio/websocket test`
  and `pnpm --filter @brijio/websocket check`.
- MCP tools / resources / skills — `pnpm --filter @brijio/mcp test` and
  `pnpm --filter @brijio/mcp check`.
- Chrome extension — `pnpm --filter @brijio/chrome-extension test` and
  `pnpm --filter @brijio/chrome-extension check`.
- Safari extension — `pnpm --filter @brijio/safari-extension test` and
  `pnpm --filter @brijio/safari-extension check`.

For changes spanning several layers, run the workspace-level `pnpm test` and
`pnpm check` when practical. Before a PR is ready, match CI by running, in
order, `pnpm lint`, `pnpm build`, `pnpm test`. Report exactly what passed and
what could not be run in the PR description.

Use Docker validation only when container or runtime behavior changes, and
derive the current profiles and commands from `docker-compose.yml` rather than
assuming a profile exists.

## Change workflow from AGENTS.md

`AGENTS.md` is the authoritative source for the conventions below. Always
start there for behavior, protocol, or boundary changes.

### Classify before editing

Classify a change before touching code. An **ADR is required** when a change
introduces or alters a product capability or user-visible behavior, a
cross-package protocol or schema, an architectural boundary or ownership
decision, authentication/authorization/privacy/storage or a trust boundary,
browser routing/targeting/lifecycle semantics, or a dependency that materially
changes the architecture. An ADR is **usually not required** for a bug fix
that restores documented/tested behavior, tests for existing behavior,
documentation-only corrections, behavior-preserving refactors, narrowly scoped
tooling/dependency maintenance, or anything already covered by an accepted ADR.

### ADR lifecycle

Write the ADR as `Proposed`, include Mermaid diagrams when architecture or
message flow is relevant, and **wait for explicit user approval before
implementing**. A request to implement a feature does not by itself approve the
ADR written for it. Before assigning a number, list existing ADRs in
`docs/architecture/decisions` and use the next unused number; never reuse an
ADR number. After approval, mark it `Accepted`. If a decision is replaced,
record the superseding/superseded relationship. **Never leave an implemented
decision marked `Proposed`.**

### Implementation (TDD)

For behavior changes, follow TDD:

1. Write or adjust a test that fails for the expected reason.
2. Implement the smallest change that makes it pass.
3. Refactor only when necessary and keep the test green.
4. Run the relevant verification commands from the section above.

For documentation, configuration, or tooling changes where a failing test is
not meaningful, validate with the narrowest applicable formatter, linter,
build, or direct inspection instead.

## Ownership and cross-layer change patterns

`AGENTS.md` fixes ownership per layer:

- **Shared protocol shapes and browser-agnostic behavior** belong in
  `packages/shared`. Do not duplicate protocol definitions elsewhere.
- **Relay authentication, presence, and routing** belong in `servers/websocket`.
- **Agent-facing tools, resources, prompts, and skills** belong in
  `servers/mcp`.
- **Browser-specific integration** belongs in `clients/extensions/chrome` and
  `clients/extensions/safari`; keep adapters thin and push shared behavior into
  `packages/shared`.

When a change touches a protocol or browser capability, check the full path
end to end:

```text
shared protocol -> WebSocket relay -> MCP surface -> shared controller
                -> Chrome adapter -> Safari adapter -> integration tests
```

### Protocol or schema changes

Update `packages/shared` **first**, then propagate the change through the
relay, MCP server, and both browser adapters. Keep the protocol definitions in
`packages/shared` only — do not re-declare message shapes in the relay or
extensions.

### Browser-targeting changes

Multi-tab targeting is a deliberate, ADR-backed design direction. Explicit
per-call `tabId` is threaded through the MCP tool wrappers, relay protocol,
background controller, and browser adapters; when `tabId` is omitted the
system falls back to the active tab. **Do not introduce hidden selected-tab
session state.** When `tabId` is optional, preserve the documented active-tab
fallback unless an accepted ADR changes it. See
[Multi-tab Workflow](workflows/multi-tab.md) for the targeting model and the
canonical source files, and re-read page context after navigation or any
mutation that can invalidate short-lived target IDs.

The most recent ADRs on this theme are:

- `docs/architecture/decisions/0060-explicit-tab-listing-and-selection.md`
- `docs/architecture/decisions/0062-thread-tabid-through-action-stack.md`
- `docs/architecture/decisions/0063-open-tab-action.md`

### Extension UI or manifest changes

Chrome and Safari have different manifest and runtime constraints (MV3 vs the
Safari platform-specific builds, iOS non-persistent background, reconnect-on-wake).
Check the package `README` files and relevant ADRs
(`0050-ios-safari-non-persistent-background`, `0051-safari-platform-specific-builds`,
`0052-safari-client-reconnect-on-wake`) before changing popup behavior, host
permissions, or background lifecycle assumptions. Build the Safari platform
artifacts through the `Makefile` `safari` targets, which run the converter with
the project's bundle identifier and signing settings.

### When tool behavior changes

Update, together, the tool's tests, its MCP registration, any relevant skills
under `servers/mcp/skills`, `docs/project/CAPABILITY_MATRIX.md`, and the
relevant OpenWiki workflow pages. Consider both Chrome and Safari for shared
browser behavior, and document and test intentional platform differences.

## Documentation updates

Update documentation according to what actually changed, and keep it linked
rather than copied:

- Capability or support status — `docs/project/CAPABILITY_MATRIX.md`.
- Architectural decision — `docs/architecture/decisions` (the ADR above).
- Repository navigation or cross-layer workflow — `openwiki`.
- Public setup, commands, or configuration — root or package `README.md`.
- Completed feature or operational explanation — `docs/artifacts`.
- Security boundary or guarantee — `docs/security`.

## Git and pull requests

Keep changes focused; do not mix cleanup, formatting, dependencies, or
documentation rewrites into an unrelated behavior change. Preserve unrelated
user changes and never revert user work. Use small, atomic commits with
meaningful messages, each representing one coherent step (ADR, tests,
implementation, documentation, or tooling). Stage files explicitly and avoid
`git add .` / `git add -A` unless the whole working tree has been reviewed as
PR scope. Match the PR title and description to the actual goal and scope, and
report verification results plus any known limitations there.
