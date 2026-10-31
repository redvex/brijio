---
type: "Reference"
title: "Workflows"
description: "Repo-level development workflows: common pnpm commands, per-domain verification, the AGENTS.md ADR/TDD change workflow, and protocol, browser-targeting, and approval-gated change patterns."
tags:
  ["workflows", "verification", "adr", "tdd", "monorepo", "change-management"]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-31T14:18:08.591Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-d18654b1d472f92852f23b2e
    resource: repo://scripts/brijio-token.mjs
generated: { by: "openwiki/0.7.2", at: "2026-10-31T14:18:08.591Z" }
---

# Workflows

This page captures the repo-level workflows that matter most when editing Brijio. The authoritative rules live in [`AGENTS.md`](../AGENTS.md); this page restates the parts a coding agent needs before, during, and after a change, and routes protocol, browser-targeting, and approval-gated work to the dedicated workflow pages.

## Common commands

The top-level scripts come from `package.json`. Do not invent commands — derive them from the manifest.

- `pnpm build` — recursive build of all workspace packages (`pnpm -r build`).
- `pnpm test` — run workspace tests, then `node --test scripts/*.test.mjs`.
- `pnpm check` — recursive type-check and validation pass (`pnpm -r check`).
- `pnpm lint` — TypeScript lint (`ts-standard`) plus Markdown lint (`prettier --check`).
- `pnpm dev` — one-command local startup helper (`scripts/dev.mjs`); provisions `.env` tokens and starts the WebSocket relay (port 8787) and MCP server (port 8788).
- `pnpm dev:ws` — run the WebSocket server in watch mode (`tsx watch servers/websocket/src/index.ts`).
- `pnpm dev:mcp` — run the MCP server in watch mode (`tsx watch servers/mcp/src/index.ts`).
- `pnpm token` — generate a local pairing token for `BRIJIO_PAIRING_TOKEN` (alias `BROWSERBRIDGE_PAIRING_TOKEN` is still accepted).

Each workspace package also defines its own `build`, `check`, `test`, and (where meaningful) `dev` scripts:

- `packages/shared`: `build`, `check`, `test`, `dev` (dev not implemented yet).
- `servers/websocket`: `build`, `check`, `test`, `dev`.
- `servers/mcp`: `build`, `check`, `test`, `dev`, `prepublishOnly`.
- `clients/extensions/chrome`: `build`, `check`, `test`, `pack` (dev not implemented yet).
- `clients/extensions/safari`: `build`, `check`, `test` (dev not implemented yet).

## What to run after making changes

Run the smallest verification set that exercises the modified domain. Use these per-domain filters verbatim from [`AGENTS.md`](../AGENTS.md):

- Shared package: `pnpm --filter @brijio/shared test` and `pnpm --filter @brijio/shared check`.
- WebSocket relay: `pnpm --filter @brijio/websocket test` and `pnpm --filter @brijio/websocket check`.
- MCP server: `pnpm --filter @brijio/mcp test` and `pnpm --filter @brijio/mcp check`.
- Chrome extension: `pnpm --filter @brijio/chrome-extension test` and `pnpm --filter @brijio/chrome-extension check`.
- Safari extension: `pnpm --filter @brijio/safari-extension test` and `pnpm --filter @brijio/safari-extension check`.

For cross-package changes, run `pnpm test` and `pnpm check`. Before a PR is ready, match CI with:

```sh
pnpm lint
pnpm build
pnpm test
```

Before claiming completion, report exactly what passed and what could not be run.

## Change workflow (ADR and TDD)

Classify the change before editing. This restates the [`AGENTS.md`](../AGENTS.md) change workflow.

### ADR required

Write an ADR **before** implementation, mark it `Proposed`, and wait for explicit user approval before implementing it. A request to implement a feature does not by itself approve the ADR written for that feature. An ADR is required when a change introduces or alters:

- a product capability or intentional user-visible behavior;
- a cross-package protocol or schema;
- an architectural boundary or ownership decision;
- authentication, authorization, privacy, storage, or a trust boundary;
- browser routing, targeting, or lifecycle semantics;
- a dependency or framework that materially changes the architecture.

Before assigning a number, list existing ADRs in `docs/architecture/decisions` and use the next unused number. Never reuse an ADR number. After approval, mark the ADR `Accepted`; if a decision is replaced, record the superseding/superseded relationship. Do not leave an implemented decision marked `Proposed`.

### ADR usually not required

An ADR is normally unnecessary for:

- a bug fix that restores documented or tested behavior;
- tests for existing behavior;
- documentation-only corrections;
- a behavior-preserving refactor;
- narrowly scoped tooling or dependency maintenance;
- implementation already covered by an accepted ADR.

If a supposedly narrow change requires a new design decision, stop and follow the ADR workflow.

### TDD for behavior changes

For behavior changes, use test-driven development:

1. Write or adjust a test that fails for the expected reason.
2. Implement the smallest change that makes it pass.
3. Refactor only when necessary and keep the test green.
4. Run the relevant verification commands from the section above.

For documentation, configuration, or tooling changes where a failing test is not meaningful, validate with the narrowest applicable formatter, linter, build, or direct inspection.

## Ownership and cross-layer changes

Ownership is fixed by layer; keep behavior in its home and keep adapters thin:

- Shared protocol shapes and browser-agnostic behavior belong in `packages/shared`.
- Relay authentication, presence, and routing belong in `servers/websocket`.
- Agent-facing tools, resources, prompts, and skills belong in `servers/mcp`.
- Browser-specific integration belongs in `clients/extensions/chrome` and `clients/extensions/safari`.

When changing a protocol or browser capability, check the full path before claiming done:

```text
shared protocol -> WebSocket relay -> MCP surface -> shared controller
                -> Chrome adapter -> Safari adapter -> integration tests
```

Additional rules from [`AGENTS.md`](../AGENTS.md):

- Keep protocol definitions in `packages/shared`; do not duplicate them.
- Preserve explicit per-call browser and `tabId` targeting. Do not introduce hidden selected-browser or selected-tab session state.
- When `tabId` is optional, preserve the documented active-tab fallback unless an accepted ADR changes it.
- Re-read page context after navigation or a mutation that can invalidate short-lived target IDs.
- Consider both Chrome and Safari for shared browser behavior; document and test intentional platform differences.

## When tool behavior changes

This is the single AGENTS.md checklist that is easiest to miss. When a tool's behavior changes, update all of the following together:

- its tests;
- its MCP registration;
- the relevant skills under `servers/mcp/skills`;
- the capability matrix in [`docs/project/CAPABILITY_MATRIX.md`](../docs/project/CAPABILITY_MATRIX.md);
- the relevant OpenWiki workflow pages (for example [multi-tab](workflows/multi-tab.md) and [data-and-protocol](data-and-protocol.md)).

## Change patterns to watch for

### Protocol or schema changes

If you change any cross-package message shape, update `packages/shared` first and then propagate through the relay, MCP server, and browser adapters. For the canonical envelope, payload types, and capability set, see [data-and-protocol](data-and-protocol.md) rather than restating them here.

### Browser-targeting changes

The repo threads `tabId` explicitly through every layer rather than storing hidden selected-tab session state. Changes in this area usually span `packages/shared`, `servers/mcp`, `servers/websocket`, and both extension packages; see [multi-tab](workflows/multi-tab.md) for the `list_tabs` / `open_tab` workflow and the per-call `tabId` convention. The relevant ADRs are:

- `docs/architecture/decisions/0060-explicit-tab-listing-and-selection.md`
- `docs/architecture/decisions/0062-thread-tabid-through-action-stack.md`
- `docs/architecture/decisions/0063-open-tab-action.md`

### Approval-gated changes

Mutation actions (`submit_form`, `fetch_resource`, `download_file`) are gated by client-side action approval; preserve that gating and do not bypass approval checks. For the mechanics, see the [action-approval](workflows/action-approval.md) workflow page rather than duplicating it. The backing decision is `docs/architecture/decisions/0048-client-side-action-approval.md`.

### Extension UI or manifest changes

Chrome and Safari have different manifest and runtime constraints (the Safari build produces separate iOS and macOS manifests via `scripts/create-platform-manifest.mjs`). Check the package README files before changing popup behavior, host permissions, or background lifecycle assumptions.

## Documentation routing

Update documentation according to what changed:

- Capability or support status: [`docs/project/CAPABILITY_MATRIX.md`](../docs/project/CAPABILITY_MATRIX.md).
- Architectural decision: `docs/architecture/decisions`.
- Repository navigation or cross-layer workflow: `openwiki` (this page, [architecture](architecture.md), [operations](operations.md), and the workflow pages).
- Public setup, commands, or configuration: root or package `README.md`.
- Completed feature or operational explanation: `docs/artifacts`.
- Security boundary or guarantee: `docs/security`.

Keep documentation linked rather than copying large mutable inventories between files.

## Git and PR discipline

From [`AGENTS.md`](../AGENTS.md): keep changes focused and atomic; do not mix cleanup, formatting, dependency, or documentation rewrites into an unrelated behavior change. Stage files explicitly and avoid `git add .` / `git add -A` unless the whole working tree has been confirmed as PR scope. A commit should be one coherent step (ADR, tests, implementation, documentation, or tooling). Report verification results and known limitations in the PR description.
