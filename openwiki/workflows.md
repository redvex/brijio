---
type: "Reference"
title: "Workflows"
description: "Repo-level development workflows: common pnpm and Make commands, per-domain verification sets, dev server lifecycle, Docker validation, integration test harness, and AGENTS.md ADR/TDD conventions."
tags: ["workflows", "verification", "docker", "adr", "tdd", "pnpm"]
verified:
  - by: openwiki/0.5.2
    at: 2026-09-19T12:17:06.598Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-5a60d3196588e015ba660b7b
    resource: repo://clients/extensions/chrome/package.json
  - id: openwiki-source-71a0e8f6d491eb3a2c086e5e
    resource: repo://clients/extensions/safari/package.json
  - id: openwiki-source-b79fbbd921df689b4bbdc82f
    resource: repo://docker-compose.yml
  - id: openwiki-source-bb1ebe868e35e9e500714501
    resource: repo://Dockerfile
  - id: openwiki-source-a180663e0e98a6fb1e1d1b2c
    resource: repo://Dockerfile.test
  - id: openwiki-source-2d2ad72255d67982e7f7cdd4
    resource: repo://docs/architecture/decisions/0034-integration-test-harness.md
  - id: openwiki-source-d9997f65a04e259507c45268
    resource: repo://docs/architecture/decisions/0063-open-tab-action.md
  - id: openwiki-source-012f2c78e3b1446dfc35803f
    resource: repo://Makefile
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-40275cb92c3610938f16ade3
    resource: repo://pnpm-workspace.yaml
  - id: openwiki-source-7164859f3d7c069d9fda8e58
    resource: repo://scripts/dev.mjs
  - id: openwiki-source-fcb9077446e355679e57e130
    resource: repo://scripts/pre-commit
  - id: openwiki-source-ceadb6a3b6b9b72b892f43ce
    resource: repo://servers/mcp/package.json
  - id: openwiki-source-67381b0746c338c894e94515
    resource: repo://servers/mcp/src/integration.test.ts
  - id: openwiki-source-475cb24dac2da48673b37928
    resource: repo://servers/websocket/package.json
generated: { by: "openwiki/0.5.2", at: "2026-09-19T12:17:06.598Z" }
---

# Workflows

This page captures the repo-level workflows that matter most when editing
Brijio: the command surface, the verification set per domain, the local dev
server lifecycle, Docker validation, the integration test harness, and the
ADR/TDD conventions enforced by `AGENTS.md`.

## Workspace layout

`pnpm-workspace.yaml` defines the packages that `pnpm -r` recurses over:

```yaml
packages:
  - "packages/*"
  - "servers/*"
  - "clients/extensions/*"
```

The five workspace packages are `@brijio/shared` (`packages/shared`),
`@brijio/websocket` (`servers/websocket`), `@brijio/mcp` (`servers/mcp`),
`@brijio/chrome-extension` (`clients/extensions/chrome`), and
`@brijio/safari-extension` (`clients/extensions/safari`). Dependency edges flow
`shared -> websocket -> mcp` and `shared -> {chrome, safari}`; MCP is the only
package that depends on both `@brijio/shared` and `@brijio/websocket`.

## Common commands

Top-level commands are defined in the root `package.json`. The workspace is
pinned to `pnpm@10.32.1` and requires Node `>=22.0.0`.

| Command                      | What it runs                                                    |
| ---------------------------- | --------------------------------------------------------------- |
| `pnpm build`                 | `pnpm -r build` — build every workspace package                 |
| `pnpm test`                  | `pnpm -r test` then `node --test scripts/*.test.mjs`            |
| `pnpm check`                 | `pnpm -r check` — type-check across packages                    |
| `pnpm lint`                  | `pnpm lint:ts && pnpm lint:md`                                  |
| `pnpm lint:ts`               | `ts-standard "**/*.ts"` (cache under `.cache`)                  |
| `pnpm lint:md`               | `prettier --check "**/*.md"`                                    |
| `pnpm dev`                   | `node scripts/dev.mjs` — start WS + MCP together with env setup |
| `pnpm dev:ws`                | `tsx watch servers/websocket/src/index.ts`                      |
| `pnpm dev:mcp`               | `tsx watch servers/mcp/src/index.ts`                            |
| `pnpm token` / `pnpm brijio` | `node scripts/brijio-token.mjs` — print a pairing token         |
| `pnpm precommit`             | `scripts/pre-commit` — runs `pnpm lint` then `pnpm test`        |
| `pnpm format:md`             | `prettier --write "**/*.md"`                                    |
| `pnpm serve:test-pages`      | build the pages site and serve it for local UX checks           |

Each package also exposes its own `build`, `check`, `test`, and (where
meaningful) `dev` script. Notable per-package scripts:

- `packages/shared`: `test` runs `node --import tsx --test src/**/*.test.ts`;
  `dev` is a placeholder ("not implemented yet").
- `servers/websocket`: `build` and `check` are both `tsc --noEmit` (no emitted
  build artifact); `dev` is `tsx watch src/index.ts`.
- `servers/mcp`: `build` is `tsup` (bundles `dist/`); `prepublishOnly` runs
  `pnpm build`; `dev` is `tsx watch src/index.ts`. This is the only non-private
  package and exposes `bin.brijio`/`bin.browserbridge`.
- `clients/extensions/chrome`: `build` bundles background/content/popup via
  esbuild, copies `manifest.json` + icons, then runs
  `scripts/verify-build-output.mjs`; `pack` zips `dist/`.
- `clients/extensions/safari`: `build` produces `dist-ios` and `dist-macos`
  with platform manifests via `scripts/create-platform-manifest.mjs`, then
  verifies the output.

## What to run after making changes

Per `AGENTS.md`, run the smallest verification set that exercises the modified
domain. Match the filter name to the package `name` in its `package.json`:

| Domain                        | Verification                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| shared protocol or page logic | `pnpm --filter @brijio/shared test` and `pnpm --filter @brijio/shared check`                     |
| relay/routing (websocket)     | `pnpm --filter @brijio/websocket test` and `pnpm --filter @brijio/websocket check`               |
| MCP tool or resource          | `pnpm --filter @brijio/mcp test` and `pnpm --filter @brijio/mcp check`                           |
| Chrome extension              | `pnpm --filter @brijio/chrome-extension test` and `pnpm --filter @brijio/chrome-extension check` |
| Safari extension              | `pnpm --filter @brijio/safari-extension test` and `pnpm --filter @brijio/safari-extension check` |

For cross-package changes, run the workspace-level `pnpm test` and `pnpm check`.
Before a PR is ready, match CI with:

```sh
pnpm lint
pnpm build
pnpm test
```

`scripts/pre-commit` (invoked via `pnpm precommit`) runs `pnpm lint` followed by
`pnpm test`, so it covers the lint gate plus the full test suite.

## Local dev server lifecycle

`pnpm dev` runs `scripts/dev.mjs`, which brings up the WebSocket relay and the
MCP HTTP server together and is the recommended way to run the stack locally
(ADR 0029, one-command startup). Its behavior:

1. **Env setup.** Reads `.env` (created from `.env.example` if missing) and
   classifies it: `placeholders` (token values are the
   `replace-with-generated-token` / `replace-with-generated-mcp-token`
   placeholders), `configured` (both pairing and MCP auth tokens are real), or
   `incomplete`. In `configured` state it prompts to regenerate tokens unless
   `--yes`/`-y` or `CI=true` is set, in which case it keeps existing tokens.
2. **Token generation.** When regeneration is needed it calls
   `generatePairingToken()` and `generateAuthToken()` from
   `scripts/token-utils.mjs` and writes the merged config back to `.env`,
   preserving comments and existing keys.
3. **Compatibility aliases.** `withCompatibilityAliases()` mirrors
   `BRIJIO_*` values onto legacy `BROWSERBRIDGE_*` keys (and vice versa) so
   older configs keep working.
4. **Server spawn.** Spawns both `npx tsx watch servers/websocket/src/index.ts`
   and `npx tsx watch servers/mcp/src/index.ts` with the merged env. Output is
   prefixed `[ws]` / `[mcp]`.
5. **Health checks.** Polls `http://127.0.0.1:8787/health` and
   `http://127.0.0.1:8788/health` (up to 15s, 500ms interval); if either fails
   it shuts down and exits non-zero.
6. **Banner.** On success it prints the WS URL (`ws://localhost:8787`), MCP URL
   (`http://localhost:8788/mcp`), pairing token, and MCP auth token. Tokens are
   masked in the banner only when `maskTokens` is explicitly requested.
7. **Supervision.** Each child is restarted on unexpected exit with a 2s backoff,
   up to `MAX_RESTART_ATTEMPTS` (5) per process; exceeding that exits non-zero.
   `SIGINT`/`SIGTERM` trigger a graceful shutdown (SIGTERM, then SIGKILL after a
   5s grace period).

For single-server watch mode without env setup, use `pnpm dev:ws` or
`pnpm dev:mcp` directly.

## Docker validation

Docker validation is only required when container or runtime behavior changes.
Always derive the current profiles and commands from `docker-compose.yml` — do
not assume a profile exists.

`docker-compose.yml` defines three profiles:

- `runtime` — the `brijio` service, built from `Dockerfile` (combined WS + MCP
  image under s6-overlay). Exposes `8787` (WS) and `8788` (MCP), with env for
  host/port/path, pairing token, MCP auth token, and request timeout.
- `legacy-runtime` — the `browserbridge` service, which `extends: brijio` for
  backward compatibility.
- `test` — a `test-page` service using `nginx:1.27-alpine` serving
  `clients/test-page` as static HTML on port `8080`.

`Dockerfile` is a two-stage build: stage 1 installs with
`pnpm install --filter @brijio/mcp... --frozen-lockfile` and builds the MCP
package with `tsup`; stage 2 copies `dist/` into a `node:22-alpine` image with
s6-overlay and installs only production deps (stripping `workspace:*` first).
`Dockerfile.test` installs the full workspace and runs `pnpm test`, and is the
image the `test` profile references (per ADR 0034). Invoke a profile explicitly,
e.g. `docker compose --profile test up`.

## Integration test harness

ADR 0034 established `servers/mcp/src/integration.test.ts` as the cross-layer
test entrypoint. It is the only test that exercises the full stack end to end:

```text
MCP SDK Client -> StreamableHTTPClientTransport -> MCP HTTP server
  -> WS client -> WS relay -> mock extension (raw WebSocket)
```

The harness starts a real `createWebSocketServer()` (port 0) with a known
pairing token, a real `startBrijioMcpHttpServer()` pointed at that WS server,
and a mock extension that authenticates, announces presence, and answers with
fixture data. It then drives real MCP SDK `Client.callTool()` calls and asserts
end-to-end responses. Coverage includes every tool (`list_browsers`,
`read_current_page`, `click_element`, `fill_input`, `fill_editable`,
`set_checked`, `select_options`, `submit_form`), error flows (unauthenticated
requests, disconnected browser, ambiguous browser target, missing browser
instance), and health endpoints. Because this is the cross-layer gate, run
`pnpm --filter @brijio/mcp test` after any change that touches protocol
routing, presence, auth, or the MCP tool surface.

## Documentation and agent workflow

The root `AGENTS.md` is the authority for how to approach a change:

- **Start here.** Read `openwiki/quickstart.md` first, then follow only the
  architecture, workflow, domain, security, or testing links relevant to the
  task. Use `package.json` and workspace manifests as the authority for runtime
  versions and available commands.
- **ADR before behavior change.** Write an ADR (as `Proposed`, with Mermaid
  diagrams when architecture or message flow is relevant) and wait for explicit
  user approval before implementing changes to: a product capability or
  user-visible behavior; a cross-package protocol or schema; an architectural
  boundary; auth/privacy/storage/trust boundaries; browser routing/targeting/
  lifecycle; or a materially architecture-changing dependency. Number ADRs
  sequentially from the existing list in `docs/architecture/decisions`, never
  reuse a number, and mark accepted decisions `Accepted`.
- **TDD for implementation.** For behavior changes: write/adjust a failing
  test, make the smallest change to pass it, refactor only if necessary while
  keeping the test green, then run the relevant verification commands. For
  docs/config/tooling where a failing test is not meaningful, validate with the
  narrowest applicable formatter, linter, build, or direct inspection.
- **Keep docs current.** Capability/support status goes in
  `docs/project/CAPABILITY_MATRIX.md`; architectural decisions in
  `docs/architecture/decisions`; repo navigation/cross-layer workflow in
  `openwiki`; public setup in root/package `README.md`; completed feature
  explanations in `docs/artifacts`; security boundaries in `docs/security`.
  Prefer linking over copying mutable inventories.
- **Sources of truth.** Executable behavior = source + tests; product contract
  = `CAPABILITY_MATRIX.md`; design history = ADRs; security intent =
  `docs/security`. If sources disagree, determine which is stale and update or
  report it rather than silently picking one.

`AGENTS.md` also records the non-negotiable product invariants (user explicitly
starts/stops the bridge; no ambient streaming or surveillance; every browser
read/action is an explicit MCP request; explicit per-call browser/`tabId`
targeting; preserve user-visible connection state and client-side action
approval; minimal permissions). Treat these as hard constraints on any change.

## Change patterns to watch for

### Protocol or schema changes

Protocol shapes and browser-agnostic behavior belong in `packages/shared`; do
not duplicate them elsewhere. When a cross-package message shape changes,
update `packages/shared` first, then propagate through the full path documented
in `AGENTS.md`:

```text
shared protocol -> WebSocket relay -> MCP surface -> shared controller
                -> Chrome adapter -> Safari adapter -> integration tests
```

When tool behavior changes, also update its tests, MCP registration, relevant
skills under `servers/mcp/skills`, the capability matrix, and relevant OpenWiki
workflow pages.

### Browser-targeting changes

Explicit per-call browser and `tabId` targeting is a hard-won pattern: thread
`tabId` explicitly through every layer rather than introducing hidden
selected-browser or selected-tab session state. When `tabId` is optional,
preserve the documented active-tab fallback unless an accepted ADR changes it.
Re-read page context after navigation or any mutation that can invalidate
short-lived target IDs.

Changes in this area typically span `packages/shared`, `servers/mcp`,
`servers/websocket`, and both extension packages. The relevant ADRs are:

- `0060-explicit-tab-listing-and-selection.md`
- `0062-thread-tabid-through-action-stack.md`
- `0063-open-tab-action.md`

### Extension UI or manifest changes

Chrome and Safari have different manifest and runtime constraints. Chrome
targets `chrome116` and copies a single `manifest.json`; Safari targets
`safari17`, produces separate `dist-ios`/`dist-macos` trees with
platform-specific manifests, and uses `--external:browser` for extension
internals. Consider both extensions for shared browser behavior, and document
and test intentional platform differences. The `Makefile` exposes Safari Xcode
conversion targets (`safari`, `safari-ios`, `safari-macos`, which run
`safari-web-extension-converter` against the built `dist-ios`/`dist-macos`) and
a `chrome` target; `clean` removes all build artifacts including the generated
Xcode projects.

### Demo and docs changes

Demo pages and docs artifacts live under `servers/mcp/demo`,
`clients/test-page`, `docs/artifacts`, and `scripts/`. These are useful for
validating UX and layout assumptions (and `clients/test-page` is what the Docker
`test` profile serves via nginx), but they are not the main runtime path.

## Reporting verification

Before claiming completion, report exactly what passed and what could not be
run, including full failure output where relevant. This expectation is encoded
in `AGENTS.md` and in the PR guidance: use small, atomic commits with messages
that match the actual scope, stage files explicitly (avoid `git add .`), and
note verification results plus any known limitations in the PR description.
