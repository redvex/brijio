---
type: "Reference"
title: "Workflows"
description: "Repo-level development workflows: common pnpm commands, verification patterns per domain, protocol and browser-targeting change patterns, AGENTS.md conventions, and the daemon/operations surface."
tags:
  [
    "workflows",
    "commands",
    "verification",
    "adr",
    "daemon",
    "docker",
    "operations",
  ]
verified:
  - by: openwiki/0.5.1
    at: 2026-09-12T11:58:23.018Z
sources:
  - id: openwiki-source-5f5b95b3d6a215fa02ceb945
    resource: repo://.env.example
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-5a60d3196588e015ba660b7b
    resource: repo://clients/extensions/chrome/package.json
  - id: openwiki-source-71a0e8f6d491eb3a2c086e5e
    resource: repo://clients/extensions/safari/package.json
  - id: openwiki-source-b79fbbd921df689b4bbdc82f
    resource: repo://docker-compose.yml
  - id: openwiki-source-7b4ede95e0ef0f0c7ae27a30
    resource: repo://docker/s6-rc.d/brijio/run
  - id: openwiki-source-2e02fceb5b2b3279c303cf50
    resource: repo://docker/s6-rc.d/brijio/type
  - id: openwiki-source-ef164ea3a65b380a7d49a801
    resource: repo://docker/s6-rc.d/user/contents.d/brijio
  - id: openwiki-source-bb1ebe868e35e9e500714501
    resource: repo://Dockerfile
  - id: openwiki-source-a31e56605839ce458ceb1d44
    resource: repo://docs/architecture/decisions/0060-explicit-tab-listing-and-selection.md
  - id: openwiki-source-2b66c8e72b793ad548b86a29
    resource: repo://docs/architecture/decisions/0062-thread-tabid-through-action-stack.md
  - id: openwiki-source-d9997f65a04e259507c45268
    resource: repo://docs/architecture/decisions/0063-open-tab-action.md
  - id: openwiki-source-79dd91ec51a55e7e78c52ccc
    resource: repo://docs/architecture/decisions/0064-visual-action-verification.md
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-c83ceec2d47257f066951051
    resource: repo://packages/shared/package.json
  - id: openwiki-source-ae59149c7733dd98fdeaead4
    resource: repo://servers/mcp/bin/brijio.mjs
  - id: openwiki-source-ceadb6a3b6b9b72b892f43ce
    resource: repo://servers/mcp/package.json
  - id: openwiki-source-cde1053eb49eff18dfbe3aeb
    resource: repo://servers/mcp/src/daemon.ts
  - id: openwiki-source-992d2a07a4005674ced4ce70
    resource: repo://servers/mcp/tsup.config.ts
  - id: openwiki-source-475cb24dac2da48673b37928
    resource: repo://servers/websocket/package.json
generated: { by: "openwiki/0.5.1", at: "2026-09-12T11:58:23.018Z" }
---

# Workflows

This page captures the repo-level workflows that matter most when editing Brijio: the commands to run, the verification pattern per domain, the change patterns that span layers, the conventions `AGENTS.md` enforces, and the daemon/operations surface used to run the bridge locally.

## Common commands

The root `package.json` is the authority for top-level commands (it pins `pnpm@10.32.1` and `node >=22.0.0`):

- `pnpm build` — build all workspace packages (`pnpm -r build`)
- `pnpm test` — run workspace tests plus repo-level scripts (`pnpm -r test && node --test scripts/*.test.mjs`)
- `pnpm check` — type-check and validation pass across packages (`pnpm -r check`)
- `pnpm lint` — TypeScript and Markdown linting (`pnpm lint:ts && pnpm lint:md`), where `lint:ts` runs `ts-standard` and `lint:md` runs `prettier --check`
- `pnpm dev` — start the local development helper (`scripts/dev.mjs`), which generates tokens, writes `.env`, and launches both servers with health checks
- `pnpm dev:ws` — run the WebSocket server in watch mode (`tsx watch servers/websocket/src/index.ts`)
- `pnpm dev:mcp` — run the MCP server in watch mode (`tsx watch servers/mcp/src/index.ts`)
- `pnpm token` / `pnpm brijio` — generate a pairing/MCP token via `scripts/brijio-token.mjs`
- `pnpm precommit` — run `scripts/pre-commit`
- `pnpm serve:test-pages` — build and serve the static test-pages site

Each workspace package also defines its own commands. Use the per-package filter form to target one package:

- `@brijio/shared` (`packages/shared`): `build`, `check`, `test` (dev is a no-op stub)
- `@brijio/websocket` (`servers/websocket`): `build`, `check`, `test`, `dev`
- `@brijio/mcp` (`servers/mcp`): `build` (tsup), `check`, `test`, `dev`, `prepublishOnly` (runs `pnpm build`)
- `@brijio/chrome-extension` (`clients/extensions/chrome`): `build`, `check`, `test`, `pack` (dev is a no-op stub)
- `@brijio/safari-extension` (`clients/extensions/safari`): `build`, `check`, `test` (dev is a no-op stub)

## What to run after making changes

Run the smallest verification set that exercises the modified domain:

- shared protocol or page logic: `pnpm --filter @brijio/shared test` and `pnpm --filter @brijio/shared check`
- relay/routing changes: `pnpm --filter @brijio/websocket test` and `pnpm --filter @brijio/websocket check`
- MCP tool or resource changes: `pnpm --filter @brijio/mcp test` and `pnpm --filter @brijio/mcp check`
- Chrome extension changes: `pnpm --filter @brijio/chrome-extension test` and `pnpm --filter @brijio/chrome-extension check`
- Safari extension changes: `pnpm --filter @brijio/safari-extension test` and `pnpm --filter @brijio/safari-extension check`

If a change spans several layers, run the workspace-level `pnpm test` and `pnpm check` when practical. Before a PR is ready, match CI with:

```sh
pnpm lint
pnpm build
pnpm test
```

Use Docker validation only when container or runtime behavior changes, and derive the current profiles and commands from `docker-compose.yml` rather than assuming a profile exists.

## Documentation and agent workflow (`AGENTS.md`)

The root `AGENTS.md` is the contract every coding agent must follow. It classifies changes before editing.

### Sources of truth

Use the source that matches the question: source code and tests for executable behavior; `docs/project/CAPABILITY_MATRIX.md` for the product contract and support status; `docs/architecture/decisions` for design history; `openwiki` for repository navigation and cross-component workflows; `docs/security` for trust boundaries; root and package `README.md` for public setup and usage. If sources disagree, do not silently pick one — determine which is stale and fix or report it.

### Non-negotiable product invariants

The user explicitly starts and stops the bridge; browser state is available only while the user-controlled extension is connected; every read or action is initiated by an explicit MCP tool or resource request. There is no continuous page/DOM/screenshot/history streaming, no silent surveillance, cookie export, credential extraction, session cloning, or MFA interception. Authenticated routing uses explicit request IDs, structured errors, and timeouts; client-side action approval must not be bypassed; browser permissions stay minimal and documented. The extension is reactive — it answers explicit requests and returns structured results, it does not publish ambient state.

### ADR-required vs ADR-not-required

Write an ADR (as `Proposed`, with Mermaid diagrams when architecture or message flow is relevant) **before** implementation when a change introduces or alters: a product capability or user-visible behavior; a cross-package protocol or schema; an architectural boundary or ownership decision; authentication, authorization, privacy, storage, or a trust boundary; browser routing, targeting, or lifecycle semantics; or a dependency/framework that materially changes the architecture. Wait for explicit user approval before implementing; a request to implement a feature does not by itself approve the ADR. Number ADRs with the next unused number (never reuse one), mark `Accepted` after approval, and record superseding relationships.

An ADR is usually **not** required for a bug fix that restores documented/tested behavior, tests for existing behavior, documentation-only corrections, behavior-preserving refactors, narrowly scoped tooling/dependency maintenance, or implementation already covered by an accepted ADR. If a supposedly narrow change requires a new design decision, stop and follow the ADR workflow.

### Implementation (TDD)

For behavior changes, use TDD: write or adjust a test that fails for the expected reason; implement the smallest change that makes it pass; refactor only when necessary and keep the test green; run the relevant verification commands. For documentation, configuration, or tooling changes where a failing test is not meaningful, validate with the narrowest applicable formatter, linter, build, or direct inspection.

### Ownership and cross-layer change rules

- Shared protocol shapes and browser-agnostic behavior belong in `packages/shared`.
- Relay authentication, presence, and routing belong in `servers/websocket`.
- Agent-facing tools, resources, prompts, and skills belong in `servers/mcp`.
- Browser-specific integration belongs in `clients/extensions/chrome` and `clients/extensions/safari`; keep adapters thin and shared behavior shared.

When changing a protocol or browser capability, check the full path:

```text
shared protocol -> WebSocket relay -> MCP surface -> shared controller
                -> Chrome adapter -> Safari adapter -> integration tests
```

Additional rules: keep protocol definitions in `packages/shared` and do not duplicate them; preserve explicit per-call browser and `tabId` targeting and do not introduce hidden selected-browser or selected-tab session state; when `tabId` is optional, preserve the documented active-tab fallback unless an accepted ADR changes it; re-read page context after navigation or a mutation that can invalidate short-lived target IDs; when tool behavior changes, update its tests, MCP registration, relevant skills under `servers/mcp/skills`, the capability matrix, and relevant OpenWiki workflow pages; consider both Chrome and Safari for shared browser behavior and document/test intentional platform differences.

### Coding standards

TypeScript for JavaScript runtime code, matching existing platform/build/doc formats. Prefer readable, explicit code and structured parsers/schemas over ad hoc string handling; avoid unnecessary frameworks, abstractions, and unrelated refactors; return predictable structured results with explicit success data or error codes; add tests around protocol handling, routing, tool behavior, browser adapters, and failure paths; never commit secrets, real tokens, user data, generated credentials, or user-specific configuration.

### Documentation update rules

Update documentation according to what changed: capability/support status → `docs/project/CAPABILITY_MATRIX.md`; architectural decision → `docs/architecture/decisions`; repository navigation or cross-layer workflow → `openwiki`; public setup/commands/configuration → root or package `README.md`; completed feature or operational explanation → `docs/artifacts`; security boundary or guarantee → `docs/security`. Keep documentation linked rather than copying large mutable inventories between files.

### Git and pull requests

Preserve unrelated changes and never revert user work; keep changes focused and do not mix cleanup, formatting, dependencies, or doc rewrites into an unrelated behavior change; use small atomic commits with meaningful messages; stage files explicitly (avoid `git add .` / `git add -A` unless the whole tree is reviewed as PR scope); a commit should be one coherent step (ADR, tests, implementation, documentation, or tooling); use a PR title and description that match the actual goal and scope; report verification results and known limitations in the PR description.

For OpenWiki specifically, always start from `openwiki/quickstart.md`, then follow the domain or architecture page that matches the area you are changing.

## Change patterns to watch for

### Protocol or schema changes

If you change any cross-package message shape, update `packages/shared` first and then propagate the change through the relay, MCP server, and browser adapters. Do not duplicate protocol definitions outside `packages/shared`.

### Browser-targeting changes

Recent ADRs show the repo evolving around explicit browser and tab routing. Changes in this area often require updates across `packages/shared`, `servers/mcp`, `servers/websocket`, and both extension packages. The relevant ADRs are:

- `docs/architecture/decisions/0060-explicit-tab-listing-and-selection.md` — introduces `list_tabs` and per-call `tabId` targeting (stateless, no hidden selected-tab session).
- `docs/architecture/decisions/0062-thread-tabid-through-action-stack.md` — threads `tabId` from MCP tool input all the way to `chrome.tabs.sendMessage(tabId, …)` / `chrome.tabs.update(tabId, …)`, with an active-tab fallback when `tabId` is absent.
- `docs/architecture/decisions/0063-open-tab-action.md` — adds the `open_tab` tool and `open_tab` / `open_tab_response` protocol pair so the agent can create a new tab and receive its `tabId` without destroying the current tab's state.
- `docs/architecture/decisions/0064-visual-action-verification.md` — adds `capture_screenshot`, returning MCP image content (JPEG) from the active tab via `tabs.captureVisibleTab()`.

### Extension UI or manifest changes

Chrome and Safari have different manifest and runtime constraints (different build targets, platform-specific manifest generation for Safari iOS/macOS). Check the package `README.md` files (`clients/extensions/chrome/README.md`, `clients/extensions/safari/README.md`, and `clients/extensions/firefox/README.md`) before changing popup behavior, host permissions, or background lifecycle assumptions.

### Demo and docs changes

The repository contains demo pages and docs artifacts under `servers/mcp/demo`, `clients/test-page`, `docs/artifacts`, and `scripts/`. These are useful for validating UX and layout assumptions, but they are not the main runtime path.

## Git-history clue for future agents

Recent commits and ADRs show a strong preference for threading `tabId` explicitly through every layer rather than storing a hidden selected-tab session state. Preserve that pattern unless a new ADR says otherwise.

## Daemon and operations surface

Brijio ships a combined runtime — the WebSocket relay and the MCP HTTP server run in one process — with two deployment modes: a local daemon managed from the CLI, and a container image run under s6-overlay.

### Local daemon CLI (`servers/mcp/src/daemon.ts`)

The published `brijio` binary (built by tsup from `servers/mcp/bin/brijio.mjs` to `dist/bin/brijio.js`, with `browserbridge` kept as a deprecated alias) parses subcommands via `parseDaemonCommand` and dispatches to the daemon module. The lifecycle commands are:

- `brijio` (no args) — run both servers interactively; auto-generates `BRIJIO_PAIRING_TOKEN` and `MCP_HTTP_AUTH_TOKEN` when unset, mirrors the pairing token to legacy `BROWSERBRIDGE_*` env vars, prints tokens to stdout, and handles SIGINT/SIGTERM shutdown.
- `brijio demo` — run servers with the demo page for quick verification (binds to `127.0.0.1`).
- `brijio --dev` — run mode bound to `127.0.0.1` only.
- `brijio --print-config [agent]` — print MCP client config for an agent.
- `brijio --doctor` — run diagnostic checks.
- `brijio install [--ws-port N] [--mcp-port N]` — install the daemon: write `~/.brijio/.env` (mode `0600`) with generated tokens, write a wrapper binary to `~/.brijio/bin/brijio`, generate a platform service definition, and load/enable it.
- `brijio uninstall` — unload/disable the service and remove the service link (preserves `~/.brijio` config and logs).
- `brijio start` / `brijio stop` / `brijio restart` — control the installed service.
- `brijio status` — report whether the service is loaded and probe the WebSocket (`/health`) and MCP (`/health`) endpoints.
- `brijio logs [--lines N] [--live]` — tail logs (LaunchAgent log file on macOS, `journalctl --user` on Linux; `--live` follows).

The daemon is platform-aware: on macOS it generates a `launchctl` LaunchAgent plist (`com.redvex.brijio`) under `~/Library/LaunchAgents/`; on Linux it generates a systemd user unit (`brijio.service`) under `~/.config/systemd/user/`. `normalizePlatform` restricts install/start/stop to `darwin` and `linux`. Env loading (`loadBrijioEnv`) searches `$BRIJIO_ENV_FILE`, `./.env`, then `~/.brijio/.env`, and `applyBrijioEnv` fills in unset variables without overriding existing ones.

### Container image (Dockerfile + s6-overlay)

The `Dockerfile` builds a single image that runs both servers under s6-overlay. Stage 1 builds the bundled `dist/` output via `pnpm --filter @brijio/mcp build` (tsup bundles workspace deps; `ws`, `zod`, and `@modelcontextprotocol/sdk` stay external). Stage 2 installs only production npm deps (workspace:* stripped) and copies s6 service definitions from `docker/s6-rc.d`. The s6 `brijio` longrun service runs `node dist/bin/brijio.js` from `/app`, and the `user` bundle enables it. Default `ENV` exposes `WEBSOCKET_PORT=8787` and `MCP_HTTP_PORT=8788` (both `EXPOSE`d); tokens auto-generate when empty.

### Compose profiles (`docker-compose.yml`)

`docker-compose.yml` defines two runtime services and one test service, each gated by a profile:

- `brijio` (profile `runtime`) — builds from the `Dockerfile`, maps the WS and MCP ports, and passes through token/timeout env vars.
- `browserbridge` (profile `legacy-runtime`) — extends `brijio` for the deprecated name.
- `test-page` (profile `test`) — an `nginx:1.27-alpine` container serving `clients/test-page` on `${TEST_PAGE_PORT:-8080}`.

Profiles are opt-in, so a plain `docker compose up` starts nothing; pass `--profile runtime` (or `test`) explicitly.

### Configuration variables (`.env.example`)

`.env.example` documents the variables that `pnpm dev`, the daemon install, and the container all consume:

- WebSocket server: `WEBSOCKET_HOST` (default `0.0.0.0`), `WEBSOCKET_PORT` (default `8787`), `BRIJIO_WS_URL` (default `ws://127.0.0.1:8787`), `BRIJIO_REQUEST_TIMEOUT_MS` (default `5000`).
- Tokens: `BRIJIO_PAIRING_TOKEN` (auto-generated by `pnpm dev` or `pnpm token`), `BRIJIO_BROWSER_INSTANCE_ID`. Backwards-compatible `BROWSERBRIDGE_*` aliases are still accepted during the transition.
- MCP HTTP server: `MCP_HTTP_HOST` (default `0.0.0.0`), `MCP_HTTP_PORT` (default `8788`), `MCP_HTTP_PATH` (default `/mcp`), `MCP_HTTP_AUTH_TOKEN` (auto-generated), `MCP_HTTP_ALLOWED_ORIGINS` (comma-separated CORS origins).
- Test page (Docker only): `TEST_PAGE_PORT` (default `8080`).
