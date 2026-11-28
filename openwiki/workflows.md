---
type: "Reference"
title: "Workflows"
description: "Repo-level development workflows: common pnpm and Make commands, per-package verification patterns, protocol and browser-targeting change patterns, daemon/CLI pointers, and AGENTS.md conventions."
tags:
  [
    workflows,
    verification,
    adr,
    tdd,
    protocol,
    browser-targeting,
    makefile,
    package-scripts,
  ]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-28T16:38:16.677Z
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
  - id: openwiki-source-012f2c78e3b1446dfc35803f
    resource: repo://Makefile
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-ceadb6a3b6b9b72b892f43ce
    resource: repo://servers/mcp/package.json
  - id: openwiki-source-475cb24dac2da48673b37928
    resource: repo://servers/websocket/package.json
generated: { by: "openwiki/0.9.0", at: "2026-11-28T16:38:16.677Z" }
---

# Workflows

This page captures the repo-level workflows that matter most when editing Brijio. For the operational surface of the running daemon (install, start, stop, doctor, print-config), see [Daemon and CLI Operations](./operations/daemon-and-cli.md); for the agent-facing multi-tab workflow, see [Multi-tab Workflow](./workflows/multi-tab.md).

## Common commands

The root `package.json` defines the workspace-wide scripts. `pnpm` (pinned to `pnpm@10.32.1`) is the package manager; Node `>=22.0.0` is required.

- `pnpm build` — `pnpm -r build`, build all workspace packages
- `pnpm test` — `pnpm -r test` plus `node --test scripts/*.test.mjs` repo scripts
- `pnpm check` — `pnpm -r check`, type-check and validation pass across packages
- `pnpm lint` — `pnpm lint:ts && pnpm lint:md` (ts-standard for `**/*.ts`, prettier `--check` for `**/*.md`)
- `pnpm dev` — `node scripts/dev.mjs`, start the local development helper
- `pnpm dev:ws` — `tsx watch servers/websocket/src/index.ts`, WebSocket server in watch mode
- `pnpm dev:mcp` — `tsx watch servers/mcp/src/index.ts`, MCP server in watch mode

Package-specific scripts come from each package `package.json`:

- `packages/shared` (@brijio/shared): build, check, dev, test
- `servers/websocket` (@brijio/websocket): build, check, dev, test
- `servers/mcp` (@brijio/mcp): build, check, dev, test, prepublishOnly
- `clients/extensions/chrome` (@brijio/chrome-extension): build, check, dev, test, pack
- `clients/extensions/safari` (@brijio/safari-extension): build, check, dev, test

The `dev` script is a placeholder ("… not implemented yet") for `shared`, `chrome`, and `safari`; use the workspace `pnpm dev:ws` / `pnpm dev:mcp` for server-side watch mode instead.

## Makefile targets

The root `Makefile` mirrors the common scripts and adds platform-specific build targets:

- `make build`, `make check`, `make test`, `make lint` — delegate to the matching `pnpm` commands
- `make chrome` — `pnpm --filter @brijio/chrome-extension build`
- `make safari` — build the Safari extension and convert it into both iOS and macOS Xcode projects via `xcrun safari-web-extension-converter` (`make safari-ios`, `make safari-macos`)
- `make clean` — `pnpm -r clean` plus removal of generated `dist`/`dist-ios`/`dist-macos` and Xcode project directories

The Safari Xcode conversion sets a fixed bundle identifier (`uk.co.redvex.Brijio`) and a manual code-sign style; run it on macOS where `xcrun` is available.

## What to run after making changes

Use the smallest verification set that exercises the modified domain:

- Shared protocol or page logic: `pnpm --filter @brijio/shared test` and `pnpm --filter @brijio/shared check`
- Relay/routing changes: `pnpm --filter @brijio/websocket test` and `pnpm --filter @brijio/websocket check`
- MCP tool or resource changes: `pnpm --filter @brijio/mcp test` and `pnpm --filter @brijio/mcp check`
- Chrome extension changes: `pnpm --filter @brijio/chrome-extension test` and `pnpm --filter @brijio/chrome-extension check`
- Safari extension changes: `pnpm --filter @brijio/safari-extension test` and `pnpm --filter @brijio/safari-extension check`

If a change spans several layers, run the workspace-level `pnpm test` or `pnpm check` when practical. Before a PR is ready, match CI with:

```sh
pnpm lint
pnpm build
pnpm test
```

Use Docker validation only when container or runtime behavior changes, and derive the current profiles and commands from `docker-compose.yml`; do not assume a profile exists.

## Change patterns to watch for

### Protocol or schema changes

If you change any cross-package message shape, update `packages/shared` first and then propagate the change through the relay, MCP server, and browser adapters. Keep protocol definitions in `packages/shared`; do not duplicate them. The full propagation path to check is:

```text
shared protocol -> WebSocket relay -> MCP surface -> shared controller
                -> Chrome adapter -> Safari adapter -> integration tests
```

### Browser-targeting changes

The repo targets explicit browser and tab routing with per-call targeting rather than hidden session state. Changes in this area often require updates across `packages/shared`, `servers/mcp`, `servers/websocket`, and both extension packages. When `tabId` is optional, preserve the documented active-tab fallback unless an accepted ADR changes it, and re-read page context after navigation or a mutation that can invalidate short-lived target IDs.

The most recent ADRs on this theme are:

- `docs/architecture/decisions/0060-explicit-tab-listing-and-selection.md`
- `docs/architecture/decisions/0062-thread-tabid-through-action-stack.md`

ADR 0060 introduces explicit tab listing and an optional `tabId` parameter on every MCP tool input; ADR 0062 threads `tabId` through the extension action stack so the background controller resolves a specific tab by ID instead of falling back to the active foreground tab.

### Approval-gated actions

Some browser actions require client-side user approval. When a change touches approval-gated actions, approval metadata, session-scoped grants, or the approval banner flow, follow the dedicated workflow: [Action Approval](./workflows/action-approval.md). Do not bypass approval checks.

### Extension UI or manifest changes

Chrome and Safari have different manifest and runtime constraints. Check the package README files before changing popup behavior, host permissions, or background lifecycle assumptions. Consider both Chrome and Safari for shared browser behavior, and document and test intentional platform differences.

### Demo and docs changes

The repository contains demo pages and docs artifacts under `servers/mcp/demo`, `clients/test-page`, `docs/artifacts`, and `scripts/`. These are useful for validating UX and layout assumptions, but they are not the main runtime path.

## Documentation and agent workflow

The root `AGENTS.md` file governs how coding agents work in this repo. Its key rules:

- **ADR-first.** Write an ADR (marked `Proposed`, with the next unused number) before implementing any change that introduces or alters a product capability, cross-package protocol/schema, architectural boundary, auth/privacy/trust boundary, browser routing/targeting/lifecycle semantics, or a materially architecture-changing dependency. Wait for explicit user approval, then mark it `Accepted`; never reuse an ADR number. A request to implement a feature does not by itself approve the ADR written for that feature.
- **TDD for behavior changes.** Write or adjust a failing test for the expected reason, implement the smallest change that makes it pass, and refactor only while the test stays green. For docs/config/tooling where a failing test is not meaningful, validate with the narrowest applicable formatter, linter, build, or direct inspection.
- **Mermaid diagrams.** Include Mermaid diagrams when the flow is architectural or involves message flow.
- **Keep docs current.** Update capability matrix, ADRs, OpenWiki pages, and package READMEs to match what changed; keep documentation linked rather than copying mutable inventories between files.

AGENTS.md also codifies the product invariants (user explicitly starts/stops the bridge; no ambient streaming or surveillance; explicit per-call `browserInstanceId`/`tabId` targeting; minimal, documented permissions). Preserve these unless an accepted ADR changes them.

For OpenWiki navigation specifically, start from `openwiki/quickstart.md`, then follow the domain or architecture page that matches the area being changed (see [Domains](./domains.md) and the [MCP-extension flow](./architecture/mcp-extension-flow.md)).

## Git-history note

The repository strongly prefers threading `tabId` explicitly through every layer rather than storing a hidden selected-tab session state. Preserve that pattern unless a new ADR says otherwise.
