---
type: "Reference"
title: "Workflows"
description: "Repo-level development workflows: common pnpm commands, verification patterns per domain, protocol and browser-targeting change patterns, and AGENTS.md conventions."
---

# Workflows

This page captures the repo-level workflows that matter most when editing Brijio.

## Common commands

From `package.json`, the main top-level commands are:

- `pnpm build` — build all workspace packages
- `pnpm test` — run workspace tests plus repo scripts
- `pnpm check` — type-check and validation pass across packages
- `pnpm lint` — TypeScript and Markdown linting
- `pnpm dev` — start the local development helper
- `pnpm dev:ws` — run the WebSocket server in watch mode
- `pnpm dev:mcp` — run the MCP server in watch mode

Package-specific commands are also defined in each package `package.json`:

- `packages/shared`: build, check, test
- `servers/websocket`: build, check, test, dev
- `servers/mcp`: build, check, test, dev, prepublishOnly
- `clients/extensions/chrome`: build, check, test, pack
- `clients/extensions/safari`: build, check, test

## What to run after making changes

Use the smallest verification set that exercises the modified domain:

- shared protocol or page logic: `pnpm --filter @brijio/shared test` and `pnpm --filter @brijio/shared check`
- relay/routing changes: `pnpm --filter @brijio/websocket test` and `pnpm --filter @brijio/websocket check`
- MCP tool or resource changes: `pnpm --filter @brijio/mcp test` and `pnpm --filter @brijio/mcp check`
- Chrome extension changes: `pnpm --filter @brijio/chrome-extension test` and `pnpm --filter @brijio/chrome-extension check`
- Safari extension changes: `pnpm --filter @brijio/safari-extension test` and `pnpm --filter @brijio/safari-extension check`

If a change spans several layers, run the workspace-level `pnpm test` or `pnpm check` when practical.

## Documentation and agent workflow

The root `AGENTS.md` file is important here. It tells future coding agents to:

- write an ADR before implementing a behavior change
- include Mermaid diagrams when the flow is architectural
- use TDD for implementation work
- keep docs current when a project area is complete

For OpenWiki specifically, always start from `openwiki/quickstart.md`, then follow the domain or architecture page that matches the area you are changing.

## Change patterns to watch for

### Protocol or schema changes

If you change any cross-package message shape, update `packages/shared` first and then propagate the change through the relay, MCP server, and browser adapters.

### Browser-targeting changes

Recent commits show the repo has been evolving around explicit browser and tab routing. Changes in this area often require updates across `packages/shared`, `servers/mcp`, `servers/websocket`, and both extension packages.

The most recent ADRs on this theme are:

- `docs/architecture/decisions/0060-explicit-tab-listing-and-selection.md`
- `docs/architecture/decisions/0062-thread-tabid-through-action-stack.md`

### Extension UI or manifest changes

Chrome and Safari have different manifest and runtime constraints. Check the package README files before changing popup behavior, host permissions, or background lifecycle assumptions.

### Demo and docs changes

The repository contains demo pages and docs artifacts under `servers/mcp/demo`, `clients/test-page`, `docs/artifacts`, and `scripts/`. These are useful for validating UX and layout assumptions, but they are not the main runtime path.

## Git-history clue for future agents

Recent commits show a strong preference for threading `tabId` explicitly through every layer rather than storing a hidden selected-tab session state. Preserve that pattern unless a new ADR says otherwise.
