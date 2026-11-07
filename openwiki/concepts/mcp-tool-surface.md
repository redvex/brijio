---
type: concept
title: MCP Tool and Skill Surface
description: The agent-facing API in servers/mcp — registered MCP tools and resources, the skill system exposed via MCP resources/prompts, the Streamable HTTP transport, and the daemon/CLI lifecycle.
tags: [mcp, tools, skills, http-transport, daemon, cli, browser-automation]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-07T14:40:48.642Z
sources:
  - id: openwiki-source-7638cc7fc5aae38ccc950d09
    resource: repo://docs/architecture/decisions/0023-http-mcp-server-transport.md
  - id: openwiki-source-c840f3fd0b704a3fd503c1e8
    resource: repo://docs/architecture/decisions/0027-mcp-skill-system.md
  - id: openwiki-source-ae59149c7733dd98fdeaead4
    resource: repo://servers/mcp/bin/brijio.mjs
  - id: openwiki-source-ceadb6a3b6b9b72b892f43ce
    resource: repo://servers/mcp/package.json
  - id: openwiki-source-45ccf4ff163f6f2991c87ac1
    resource: repo://servers/mcp/README.md
  - id: openwiki-source-0e2fefeaecdd03cb7671fcf2
    resource: repo://servers/mcp/skills/using-brijio/SKILL.md
  - id: openwiki-source-cde1053eb49eff18dfbe3aeb
    resource: repo://servers/mcp/src/daemon.ts
  - id: openwiki-source-a31d986242ba99fdbb81c244
    resource: repo://servers/mcp/src/doctor.ts
  - id: openwiki-source-1e871ebe65ae85a216285234
    resource: repo://servers/mcp/src/http-server.ts
  - id: openwiki-source-f1f5d8584551c3d42e50d725
    resource: repo://servers/mcp/src/index.ts
  - id: openwiki-source-36c61251055ea6d2f82f0b4e
    resource: repo://servers/mcp/src/mcp-server.ts
  - id: openwiki-source-ac88caafdb9674d72e823a21
    resource: repo://servers/mcp/src/page-context.ts
  - id: openwiki-source-7c07f491a7b95deca63dcedd
    resource: repo://servers/mcp/src/page-reading-tool.ts
  - id: openwiki-source-277297053588f3982c25d153
    resource: repo://servers/mcp/src/print-config-commands.ts
  - id: openwiki-source-ee21ae7b3a961f6fa317c79f
    resource: repo://servers/mcp/src/print-config.ts
  - id: openwiki-source-13054dea741b794a82597d0c
    resource: repo://servers/mcp/src/skills.ts
generated: { by: "openwiki/0.9.0", at: "2026-11-07T14:40:48.642Z" }
---

# MCP Tool and Skill Surface

The `servers/mcp` package is the agent-facing boundary of Brijio. An AI agent
speaks MCP to this server; the server translates each tool call into a Brijio
protocol envelope, relays it over WebSocket to the user's connected browser
extension, and returns the structured result. This page documents the surface
that surface is built from: the registered MCP tools and resources, the skill
system that supplies workflow guidance, the Streamable HTTP transport that
carries MCP traffic, and the `brijio` CLI that runs and manages the whole
stack. The end-to-end relay path (MCP → WebSocket → extension → tab) is traced
separately in [MCP ↔ WebSocket ↔ Extension Flow](../architecture/mcp-extension-flow.md);
per-tool status and browser support live in the
[Capability Matrix](../../docs/project/CAPABILITY_MATRIX.md).

## The MCP server factory

Everything registered against an agent is built in one async factory,
`createBrijioMcpServer` in `servers/mcp/src/mcp-server.ts`. It constructs an
`McpServer` from `@modelcontextprotocol/sdk`, registers the
`tools.listChanged` capability, then registers every tool, both page resources,
one resource per loaded skill, and the `brijio-context` prompt before returning
the server. The factory is async because skill loading reads `SKILL.md` files
from disk at startup (`loadSkills` / `resolveSkillsDir`).

The factory takes an optional `BrijioPageContextConfig` (otherwise built from
environment via `getPageContextConfigFromEnv`). That config carries the
WebSocket URL, pairing token, request timeout, an optional `approvalTimeoutMs`,
and an optional `defaultBrowserInstanceId`. Every tool handler closes over this
single config and forwards it to the shared page-action helpers in
`page-actions.ts`, which build the WebSocket request envelope. Tools never
contain transport or browser logic of their own; they validate input, call a
helper, and stringify the result into a single MCP `text` content block.

## Common input schema: targeting and progressive disclosure

Two optional inputs recur across nearly every tool and encode the two core
targeting/disclosure ideas of the surface.

### Browser and tab targeting

Most tools accept optional `browserInstanceId` and `tabId` (both Zod strings).
These select _which_ browser and _which_ tab a request acts on:

- `browserInstanceId` — when omitted, the WebSocket server auto-routes only
  when exactly one browser is online for the pairing token; with more than one
  browser connected the caller must specify one. A process-wide default can be
  set via `BRIJIO_BROWSER_INSTANCE_ID`, and `getPageContextConfigFromEnv`
  resolves it (with the legacy `BROWSERBRIDGE_BROWSER_INSTANCE_ID` alias). At
  request time the tool-passed value takes precedence over the config default.
- `tabId` — when omitted, tools act on the active foreground tab. Passing an
  explicit `tabId` (discovered via `list_tabs` or returned by `open_tab`)
  targets a specific tab, including background tabs. The multi-tab workflow is
  documented in [Multi-tab Workflow](../workflows/multi-tab.md).

### Progressive disclosure for `read_current_page`

`read_current_page` is the read workhorse and the one tool that implements
explicit progressive disclosure so agents can pull only what they need:

| Parameter           | Default | Constraint       | Meaning                                                                                                               |
| ------------------- | ------- | ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| `includeContent`    | `true`  | boolean          | Whether to fetch readable content chunks at all. `false` returns page context only.                                   |
| `maxContentChunks`  | `1`     | integer 0–10     | How many content chunks to fetch in this call. `0` is equivalent to `includeContent: false`.                          |
| `startContentIndex` | `1`     | positive integer | 1-based index of the first chunk to fetch. Use the `nextContentIndex` from a previous truncated response to continue. |

The tool first fetches page context. If content is requested and available, it
fetches up to `maxContentChunks` chunks starting at `startContentIndex`,
returning `content[]`, a `contentTruncated` flag, and `nextContentIndex`. When
`maxContentChunks` was the limiting factor and the final chunk is still
truncated, `contentTruncated` is `true` and `nextContentIndex` points at the
next 1-based chunk to request. This lets an agent page through a large document
without re-reading context each time. All fields are optional so a minimal call
returns context plus the first chunk.

## Registered MCP tools

`mcp-server.ts` registers the tools below. Each row gives the one-line purpose
from the registration; per-tool status, browser support, and limitations are
deferred to the [Capability Matrix](../../docs/project/CAPABILITY_MATRIX.md).

| Tool                 | Purpose                                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_browsers`      | List browser instances currently online for the configured pairing token.                                                                                      |
| `list_tabs`          | List open tabs for the connected browser instance (tab ID, window ID, title, URL, active, supported; HTTP/HTTPS only).                                         |
| `read_current_page`  | Read current page context and optional readable content chunks (progressive disclosure).                                                                       |
| `navigate_to_url`    | Navigate the browser to an HTTP/HTTPS URL and wait for the page to load.                                                                                       |
| `open_tab`           | Open a new browser tab at an HTTP/HTTPS URL and return its `tabId`.                                                                                            |
| `click_element`      | Click a visible link or button-like action using a short-lived target ID from the latest page context.                                                         |
| `fill_input`         | Write text into a visible form control using short-lived form/control IDs.                                                                                     |
| `fill_editable`      | Write text into a visible contenteditable target using a short-lived editable ID.                                                                              |
| `set_checked`        | Set checkbox state or select a radio option using a short-lived form/control ID.                                                                               |
| `select_options`     | Select option values in a visible single- or multi-select control.                                                                                             |
| `submit_form`        | Submit a visible form by short-lived form ID.                                                                                                                  |
| `perform_batch`      | Execute 1–20 browser actions (click, write_text, set_checked, select_options, upload_file, submit_form) in one request, optionally reading the page afterward. |
| `upload_file`        | Write base64-encoded file content into a visible file input.                                                                                                   |
| `download_status`    | Get browser download status by IDs or all session downloads (reports a `full`/`not_supported` capability).                                                     |
| `download_file`      | Initiate a file download in the browser (Chrome/Firefox via downloads API; Safari fire-and-forget).                                                            |
| `fetch_resource`     | Fetch a URL using the browser's session cookies/auth and stream the response back.                                                                             |
| `capture_screenshot` | Capture a JPEG (quality 80) viewport screenshot of the current tab, returned as base64 image content.                                                          |

Two things are worth noting about how results are shaped:

- **Stale-context guards.** The action tools (`click_element`, `fill_input`,
  `fill_editable`, `set_checked`, `select_options`, `submit_form`,
  `perform_batch`) accept optional `pageContextId` and `visibleContextId`
  fields. If the page has navigated since the last read, the action fails with
  `page_navigated`; if visible form state changed, with `stale_context`. Several
  also accept `expectedText`/`expectedHref`/`expectedRole`/`expectedLabel`
  validators so an agent can defend against clicking or filling a stale element.
  Short-lived IDs (`e5`, `f2`, `a1`, …) expire when the page changes, so the
  canonical workflow is read → choose target → act, then re-read after any
  navigation.
- **`capture_screenshot` returns image content and uses `isError`.** Unlike the
  other tools, which always return a `text` JSON block, a successful screenshot
  returns an `image` content part (base64 JPEG) plus a small `text` metadata
  block, and a failed screenshot sets the MCP `isError` flag on the response.

`perform_batch` deserves a callout because it is the one composition tool. It
takes `actions` (1–20), `continueOnError` (default `false`), optional
`readAfterActions`, and optional `pageContextId`/`visibleContextId`. The outer
MCP result wraps an inner batch outcome: the outer `ok` is the transport
result, the inner `data.ok` is the batch outcome, `data.results[]` carries
per-action results, and `data.aborted` signals that a navigation invalidated
the remaining short-lived IDs. With `continueOnError` enabled, recoverable
per-action element errors are reported in place and later actions continue;
page navigation still aborts the batch. Agents should re-read the page after
any `aborted: true` before retrying.

## Registered MCP resources

The server registers two page resources plus one resource per skill:

- `browser://page/current` (named `current-page-context`) — reads page context
  (URL, title, headings, links, images, forms, actions, editables, content
  availability) via `get_page_context`.
- `browser://page/current/content/{index}` (named `current-page-content`,
  a `ResourceTemplate`) — reads one 1-based normalized content chunk via
  `get_page_content`. The index is parsed by `parsePageContentResourceIndex`,
  which rejects non-positive-integer indices with `invalid_resource_uri`.
- One `skill://brijio/{name}` resource per loaded skill (see the skill system
  below).

The resources share the same WebSocket request path as `read_current_page`;
they exist for resource-first clients, while the tool exists for tool-first
clients.

## The skill system

Skills are workflow guidance, not new capabilities. Adding a skill never adds a
tool or changes tool behavior; it only helps an agent use the existing tools
correctly. The design (ADR 0027) mirrors the Superpowers convention so the
same `SKILL.md` files serve both MCP clients (via resources/prompts) and
plugin-aware runtimes (via plugin manifests).

### Skill files

Each skill is a directory under `servers/mcp/skills/{name}/SKILL.md` with YAML
frontmatter (`name`, `description`) and a markdown body (instructions,
pitfalls, workflows). The shipped skills are:

`using-brijio`, `form-filling`, `data-extraction`, `web-qa` (Tier 1 —
essential); `navigation`, `comparison`, `accessibility` (Tier 2); and
`ecommerce`, `onboarding`, `monitoring` (Tier 3 — specialized).

### Loading and exposure

`servers/mcp/src/skills.ts` provides the loading layer:

- `loadSkills(skillsDir)` reads each subdirectory's `SKILL.md`, parses
  frontmatter, extracts a title from the first H1 and a description from the
  first non-heading paragraph (frontmatter values win when present), and
  returns `BrijioSkill[]` sorted alphabetically by name. A missing skills
  directory or missing `SKILL.md` yields an empty array / skipped entry rather
  than an error.
- `skillResourceUri(name)` builds the deterministic URI `skill://brijio/{name}`
  so agents can construct a resource URI from a skill name without listing.
- `resolveSkillsDir()` resolves the skills directory relative to the module
  (`../skills`), working for both compiled output and TS source.
- `buildContextMessage(summaries)` assembles the text injected by the
  `brijio-context` prompt.

During server initialization, `mcp-server.ts` calls `loadSkills` once and:

1. Registers each skill as an MCP resource at `skill://brijio/{name}` with
   `mimeType: text/markdown`, returning the skill body as the resource text.
2. Registers the `brijio-context` prompt, which returns a single `user` message
   built by `buildContextMessage`. That message tells the agent to call
   `list_browsers` first, explains multi-tab `tabId` targeting, lists every
   skill by name/title/description, and states the key pitfalls (password
   fields return `browser_error`, radios can't be unchecked, readonly/disabled
   inputs return `browser_error`, short-lived IDs expire on page change, never
   auto-submit unless asked, specify `browserInstanceId` when multiple browsers
   are connected).

Because skills are loaded at startup from the filesystem, changing a skill file
requires a server restart. The factory's async signature is a direct
consequence of this disk read.

### Plugin manifests

Three root manifests enable native skill discovery by plugin-aware runtimes —
`.codex-plugin/plugin.json`, `.claude-plugin/plugin.json` (+ `marketplace.json`),
and `.cursor-plugin/plugin.json`. All three point at `./servers/mcp/skills/` so
the `SKILL.md` files remain the single source of truth; the MCP resources and
the plugin manifests read the same files, limiting drift to manifest metadata.

## Streamable HTTP transport (ADR 0023)

The default runtime for `servers/mcp` is MCP over Streamable HTTP, not stdio.
The transport lives in `servers/mcp/src/http-server.ts`; the slim
`servers/mcp/src/index.ts` entrypoint simply calls
`getMcpHttpServerOptionsFromEnv()` and `startBrijioMcpHttpServer(options)`.

### Configuration

`getMcpHttpServerOptionsFromEnv` reads the following environment variables:

| Variable                            | Default      | Notes                                                                                                                                                  |
| ----------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MCP_HTTP_HOST`                     | `0.0.0.0`    | Bind host. The CLI sets `127.0.0.1` in `--dev` and `demo` modes.                                                                                       |
| `MCP_HTTP_PORT`                     | `8788`       | Bind port; invalid values fall back to `8788`.                                                                                                         |
| `MCP_HTTP_PATH`                     | `/mcp`       | MCP endpoint path; normalized to start with `/`.                                                                                                       |
| `MCP_HTTP_AUTH_TOKEN`               | _(required)_ | Bearer token for MCP clients. An empty token throws at config time.                                                                                    |
| `MCP_HTTP_ALLOWED_ORIGINS`          | _(none)_     | Comma-separated allowed origins for browser-based MCP clients sending an `Origin` header. Supports exact matches and `*.suffix` wildcard DNS suffixes. |
| `BRIJIO_MCP_HTTP_TIMEOUT_MS`        | `60000`      | HTTP server `timeout`/`requestTimeout`.                                                                                                                |
| `BRIJIO_APPROVAL_TIMEOUT_BUFFER_MS` | `5000`       | Buffer subtracted from the HTTP timeout to derive `approvalTimeoutMs` (min 1000ms), forwarded to action helpers.                                       |

> **Note on host validation.** ADR 0023 (and ADRs 0025/0026) also specify
> `MCP_HTTP_ALLOWED_HOSTS`, `MCP_HTTP_ALLOW_TAILSCALE_HOSTS`, and
> `MCP_HTTP_ALLOW_LOCAL_HOSTS` for `Host`-header validation, and the README
> documents them. The current `http-server.ts` implements `Origin` validation
> and bearer-token auth but does not yet parse or enforce the `Host`-header
> allow-lists; treat those variables as documented-but-not-enforced until the
> host-validation code lands.

The MCP HTTP token is deliberately separate from the Brijio pairing token used
between MCP, WebSocket, and extension. Backward-compatible aliases for the
WebSocket-side variables are accepted during the transition window
(`BRIJIO_WS_URL` ← `BROWSERBRIDGE_WEBSOCKET_URL`/`BRIJIO_WEBSOCKET_URL`/
`WEBSOCKET_URL`; `BRIJIO_PAIRING_TOKEN` ← `BROWSERBRIDGE_PAIRING_TOKEN`/
`BRIJIO_TOKEN`).

### Request handling

`startBrijioMcpHttpServer` creates a Node `http.Server` and routes every
request through `handleMcpHttpRequest`, which enforces the boundary in order:

1. **Health endpoint.** `GET /health` returns a `McpHealthStatus` JSON body
   (`status`, package `version`, `uptimeSeconds`, WebSocket `url` and
   `status: 'unknown'`) without auth.
2. **Path match.** Requests not matching `MCP_HTTP_PATH` get a `404 not_found`
   JSON error.
3. **CORS preflight.** `OPTIONS` returns `204` with no body.
4. **Origin validation.** If an `Origin` header is present and not in the
   allowed list (exact or `*.suffix` wildcard on the origin's hostname), the
   request gets a `403 forbidden_origin` error. No `Origin` header passes.
5. **Bearer auth.** Requests whose `Authorization` header is not exactly
   `Bearer <MCP_HTTP_AUTH_TOKEN>` get a `401 unauthorized` error and are logged
   at warn level.
6. **Method check.** Only `GET`, `POST`, `DELETE` are accepted; others get
   `405 method_not_allowed`.
7. **MCP handoff.** A fresh `McpServer` is created via
   `createBrijioMcpServer` (passing the resolved page-context config and
   derived `approvalTimeoutMs`), connected to a `StreamableHTTPServerTransport`
   configured with `sessionIdGenerator: undefined` and `enableJsonResponse:
true`, and `transport.handleRequest` drives the response. The server is
   closed in a `finally` block after the request completes.

The transport is deliberately **stateless**: no resumability, no server-side
MCP session persistence, no durable request logs, and no storage of page
content, URLs, form values, or action results in the HTTP layer. Each request
builds and tears down its own `McpServer`, which keeps the design horizontally
scalable and keeps browser data request-scoped.

## Daemon and CLI lifecycle (ADR 0037)

The `brijio` binary (shipped as `bin/brijio.mjs`, also exposed as the
backwards-compatible `browserbridge` alias) is the single entry point for
running and managing Brijio. It starts _both_ long-running processes — the
WebSocket companion (default port `8787`) and the MCP HTTP server (default
port `8788`) — and layers daemon management on top.

### Command parsing and env bootstrap

`parseDaemonCommand` (in `servers/mcp/src/daemon.ts`) turns `process.argv`
into a `DaemonCommand`. The binary applies environment _before_ dispatch:
`loadBrijioEnv` reads `.env` from a fallback chain (`BRIJIO_ENV_FILE` override
→ CWD `.env` → `~/.brijio/.env`), `applyBrijioEnv` fills missing variables,
and any unset `BRIJIO_PAIRING_TOKEN` / `MCP_HTTP_AUTH_TOKEN` are
auto-generated with `crypto.randomBytes(32).toString('base64url')` and
mirrored to legacy `BROWSERBRIDGE_*` aliases. Server modules are imported
dynamically only in run mode so `--doctor` and `--print-config` never pull in
the server stack.

### Commands

| Command                                       | Behavior                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `brijio` _(no args)_                          | Run WebSocket + MCP servers interactively in the foreground; dies with the terminal.                                                                                                                                                                                                                       |
| `brijio --dev`                                | Run mode but force `127.0.0.1` binding for both servers.                                                                                                                                                                                                                                                   |
| `brijio demo`                                 | Run servers plus a static demo page (ADR 0039) for quick stack verification; binds the demo server to `0.0.0.0` and the WS/MCP hosts to `127.0.0.1`. If a daemon is already healthy on the WS port, only the demo server starts.                                                                           |
| `brijio install [--ws-port N] [--mcp-port N]` | Install as a login daemon: create `~/.brijio/`, generate/persist tokens in `~/.brijio/.env` (mode `0o600`, idempotent — existing tokens/ports are preserved), write a binary wrapper to `~/.brijio/bin/brijio`, write a platform service definition, symlink it, and load it. Prints the tokens to stdout. |
| `brijio uninstall`                            | Stop the daemon, remove the service link; preserves `~/.brijio/` (config and logs).                                                                                                                                                                                                                        |
| `brijio start` / `stop` / `restart`           | Wrap `launchctl load`/`unload` (macOS) or `systemctl --user start`/`stop`/`restart` (Linux).                                                                                                                                                                                                               |
| `brijio status`                               | Print a table: daemon loaded, config path, binary path, and health probes of both `/health` endpoints.                                                                                                                                                                                                     |
| `brijio logs [--lines N] [--live]`            | Tail `~/.brijio/brijio.log` (macOS) or `journalctl --user -u brijio.service` (Linux); `--live` follows.                                                                                                                                                                                                    |
| `brijio --print-config [agent]`               | Print a ready-to-paste MCP client config for a named agent; interactive picker if TTY and no agent given; default JSON otherwise.                                                                                                                                                                          |
| `brijio --doctor`                             | Run preflight checks (config, port availability, network detection, Node version) and print a report; exits non-zero on failures.                                                                                                                                                                          |
| `brijio --help` / `-h`                        | Print usage.                                                                                                                                                                                                                                                                                               |

`install` is the only command that writes `~/.brijio/.env`; the lifecycle and
logs commands never modify it. The macOS LaunchAgent uses `RunAtLoad` and
`KeepAlive` (start on login, auto-restart on crash) with `WorkingDirectory` set
to `~/.brijio` and no `EnvironmentVariables` — the `.env` file is the single
source of truth, read by the Node process. The Linux systemd user unit uses
`EnvironmentFile=%h/.brijio/.env`, `Restart=on-failure`, and runs under the
user's session (no `sudo`). Windows is not yet supported.

### `--print-config`

`print-config.ts` knows a fixed set of agents (Claude Desktop, Cursor, VS Code,
Cline, Codex, Hermes, Claude Code, Gemini, Windsurf, Zed, Continue, Goose) with
aliases. `resolveAgentName` maps input to a canonical name; `formatConfig`
dispatches to a per-agent formatter that emits a config block on stdout and a
"where to paste" hint on stderr. CLI-based agents (Codex, Claude Code, Gemini)
get shell-command output; JSON/YAML agents get the appropriate envelope. Goose
is explicitly unsupported (stdio-only) with an instructional message. Network
detection (`network.ts`) picks the best host for the printed URL (Tailscale →
mDNS → localhost), unless `--dev` forces `127.0.0.1`.

### `--doctor`

`doctor.ts` runs four checks: config file presence, MCP and WebSocket port
availability (binding a throwaway socket to detect `EADDRINUSE`), network
detection (Tailscale/mDNS/localhost), and Node version (requires ≥18).
`formatDoctorReport` prints an emoji-tagged report and the process exits
non-zero if any check failed.

### Graceful shutdown

In run mode the binary installs `SIGINT`/`SIGTERM` handlers that close the
WebSocket server, the MCP HTTP runtime, and (if present) the demo server in
parallel before exiting. A `port already in use` (`EADDRINUSE`) startup
failure is caught and turned into a targeted error message pointing to
`--doctor`, port overrides, or stopping the conflicting process.

## Keeping the surface in sync

Per `AGENTS.md`, when a tool's behavior changes you must update its tests, its
MCP registration in `mcp-server.ts`, the relevant `SKILL.md` files, the
[Capability Matrix](../../docs/project/CAPABILITY_MATRIX.md), and the
[Multi-tab Workflow](../workflows/multi-tab.md) page together. The action
tools, `perform_batch`, `read_current_page`'s disclosure parameters, and the
skill resources are the most common things to drift; the `brijio-context`
prompt's pitfalls in `buildContextMessage` should also be reviewed whenever
tool failure semantics (e.g. `browser_error` on password fields, stale-ID
behavior) change.

## Related pages

- [MCP ↔ WebSocket ↔ Extension Flow](../architecture/mcp-extension-flow.md) — the end-to-end relay path this surface feeds into.
- [Data and Protocol](../data-and-protocol.md) — the protocol envelopes the tools translate into.
- [Runtime and Deployment](../operations/runtime-and-deployment.md) — how the servers run in Docker Compose and as daemons.
- [Action Approval](../workflows/action-approval.md) — the `approvalTimeoutMs` path threaded from the HTTP transport into action tools.
- [Multi-tab Workflow](../workflows/multi-tab.md) — `tabId` targeting across reads, actions, batch, and navigation.
