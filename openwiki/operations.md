---
type: "Reference"
title: "CLI and Daemon Operations"
openwiki_generated: true
verified:
  - by: openwiki/0.7.2
    at: 2026-10-17T11:58:52.754Z
sources:
  - id: openwiki-source-5f5b95b3d6a215fa02ceb945
    resource: repo://.env.example
  - id: openwiki-source-b79fbbd921df689b4bbdc82f
    resource: repo://docker-compose.yml
  - id: openwiki-source-9aac2742ba1acf0d7cd75259
    resource: repo://docs/architecture/decisions/0033-health-endpoints-and-structured-logging.md
  - id: openwiki-source-5c8534c89d86035d00bad39c
    resource: repo://docs/architecture/decisions/0037-daemon-install-via-npx.md
  - id: openwiki-source-cc5ff58992397a1726de3014
    resource: repo://docs/architecture/decisions/0038-one-command-local-runtime-polish.md
  - id: openwiki-source-1669ed9d0aafe9214762e96c
    resource: repo://packages/shared/src/logger.ts
  - id: openwiki-source-ae59149c7733dd98fdeaead4
    resource: repo://servers/mcp/bin/brijio.mjs
  - id: openwiki-source-ceadb6a3b6b9b72b892f43ce
    resource: repo://servers/mcp/package.json
  - id: openwiki-source-6c2f9bc7e6e794893feef9dc
    resource: repo://servers/mcp/src/daemon.test.ts
  - id: openwiki-source-cde1053eb49eff18dfbe3aeb
    resource: repo://servers/mcp/src/daemon.ts
  - id: openwiki-source-a31d986242ba99fdbb81c244
    resource: repo://servers/mcp/src/doctor.ts
  - id: openwiki-source-1e871ebe65ae85a216285234
    resource: repo://servers/mcp/src/http-server.ts
  - id: openwiki-source-41b88888ea43adb9aef6d876
    resource: repo://servers/mcp/src/network.test.ts
  - id: openwiki-source-0659ad40ad11a3d8ac2d12fe
    resource: repo://servers/mcp/src/network.ts
  - id: openwiki-source-277297053588f3982c25d153
    resource: repo://servers/mcp/src/print-config-commands.ts
  - id: openwiki-source-594bf8b18b34c223d8f406cb
    resource: repo://servers/mcp/src/print-config.test.ts
  - id: openwiki-source-ee21ae7b3a961f6fa317c79f
    resource: repo://servers/mcp/src/print-config.ts
  - id: openwiki-source-1e108210b1b1d1b270970b35
    resource: repo://servers/mcp/src/startup-banner.test.ts
  - id: openwiki-source-5bc72e6946e4ebd3ab1afe08
    resource: repo://servers/mcp/src/startup-banner.ts
  - id: openwiki-source-875036d8e83469fa1fc3f8e3
    resource: repo://servers/websocket/src/server.ts
generated: { by: "openwiki/0.7.2", at: "2026-10-17T11:58:52.754Z" }
---

# CLI and Daemon Operations

The `brijio` binary is the single entry point for both interactive server runs and
daemon lifecycle management. It starts the WebSocket companion (port 8787 by
default) and the MCP HTTP server (port 8788 by default) in one process, and also
exposes subcommands for installing the runtime as a persistent OS-managed
daemon, generating ready-to-copy MCP client config, and running preflight
diagnostics. A legacy `browserbridge` binary alias points at the same module and
emits a deprecation warning.

## Command Set

`parseDaemonCommand` dispatches `process.argv.slice(2)` into a typed
`DaemonCommand`. The top-level dispatch in `bin/brijio.mjs` then routes each
command to its handler and `process.exit`s on completion.

| Command                                           | Effect                                                                                                                     |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `brijio` (or `brijio run`)                        | Start WS + MCP servers interactively in the foreground.                                                                    |
| `brijio --dev`                                    | Same as `run`, but binds both servers to `127.0.0.1` and tags tokens as ephemeral.                                         |
| `brijio demo`                                     | Start the full WS + MCP stack plus a static demo page server for quick end-to-end verification.                            |
| `brijio --print-config [agent]`                   | Print a ready-to-copy MCP client config block for the given agent (stdout) with a where-to-paste hint (stderr), then exit. |
| `brijio --doctor`                                 | Run preflight diagnostics and exit `0` (all pass) or `1` (any fail). Starts no servers.                                    |
| `brijio install [--ws-port N] [--mcp-port N]`     | Generate tokens, write `~/.brijio/.env`, write a launchd/systemd service definition, and load/start the daemon.            |
| `brijio uninstall`                                | Stop and disable the daemon, remove the service link; preserves `~/.brijio/` config and logs.                              |
| `brijio start` / `brijio stop` / `brijio restart` | Wrap `launchctl`/`systemctl --user` to control the installed daemon without touching `.env`.                               |
| `brijio status`                                   | Print a status table: daemon loaded flag, config/binary paths, and WS/MCP health probes.                                   |
| `brijio logs [--lines N] [--live]`                | Tail `~/.brijio/brijio.log` (macOS) or `journalctl --user -u brijio.service` (Linux); `--live` follows.                    |
| `brijio --help` / `brijio -h`                     | Print the usage text from `usage()`.                                                                                       |

`--dev` is extracted from the args before subcommand parsing, so it combines with
`run`-style invocations (`brijio --dev --port 8789` parses as
`{ name: 'run', args: ['--port', '8789'], dev: true }`). Unknown args that are
not recognised subcommands fall through to `run` mode, preserving any
server-level flags the WebSocket/MCP servers accept.

## Run/Demo Lifecycle

The `bin/brijio.mjs` entry point orchestrates startup for `run` and `demo`:

<!-- openwiki: mermaid parse failed and this diagram was converted to a text fence so it does not break rendering. Fix the diagram source and restore the mermaid fence. Parser error: Heuristic: a semicolon inside a label breaks rendering; rephrase the label. -->

```text
flowchart TD
    Start["brijio / brijio demo / brijio --dev"] --> Env["Load .env and apply env vars"]
    Env --> Parse["Parse command"]
    Parse -->|"run / --dev"| DevCheck{"--dev or demo?"}
    DevCheck -->|"yes"| SetLocal["Force WEBSOCKET_HOST / MCP_HTTP_HOST = 127.0.0.1"]
    DevCheck -->|"no"| Defaults["Apply host/port defaults 0.0.0.0 / 8787 / 8788 /mcp"]
    SetLocal --> Demo{"demo mode?"}
    Defaults --> Demo
    Demo -->|"yes, daemon already up"| DemoOnly["Start demo page server only (skip WS/MCP)"]
    Demo -->|"no daemon"| StartServers["Start WebSocket server + MCP HTTP server"]
    Demo -->|"no, not demo"| StartServers
    StartServers --> Ports{"EADDRINUSE?"}
    Ports -->|"yes"| PortErr["Print actionable port-in-use message, exit 1"]
    Ports -->|"no"| Banner["Format startup banner, write to stderr"]
    DemoOnly --> Banner
    Banner --> Ready["Ready; wait for SIGINT/SIGTERM"]
    Ready --> Shutdown["Graceful shutdown: close WS, MCP, demo"]
```

Both server modules are imported **dynamically** and only when `run`/`demo`
mode is actually reached. `--doctor` and `--print-config` exit before that
import cascade, so they never load the full server stack. This keeps the
diagnostic/config path fast and avoids triggering server-side effects.

In `demo` mode, the entry point first probes `http://127.0.0.1:<wsPort>/health`;
if a daemon is already running there, it starts only the demo page server and
sets `demoAttachedToExistingDaemon`, which the banner uses to omit WS/MCP URLs
and tokens (those belong to the daemon process, not this foreground run).

## Env and Config Loading

`loadBrijioEnv` resolves `.env` from the first available candidate in priority
order:

1. `BRIJIO_ENV_FILE` (explicit override)
2. `cwd/.env`
3. `~/.brijio/.env`

`applyBrijioEnv` copies loaded values into `process.env` only when the existing
env var is unset/empty — explicit environment wins over file. The `bin/brijio.mjs`
entry then derives the effective pairing and auth tokens:

- `BRIJIO_PAIRING_TOKEN` (with backwards-compatible `BROWSERBRIDGE_PAIRING_TOKEN`
  and `BRIJIO_TOKEN` aliases) is auto-generated via
  `randomBytes(32).toString('base64url')` when unset, and the resolved value is
  mirrored to both the new and legacy env var names.
- `MCP_HTTP_AUTH_TOKEN` is auto-generated the same way when unset. The MCP HTTP
  server hard-requires it — `getMcpHttpServerOptionsFromEnv` throws if it is
  empty.

Default ports and host bindings are applied just before server startup:
`WEBSOCKET_HOST`/`WEBSOCKET_PORT` default to `0.0.0.0`/8787,
`MCP_HTTP_HOST`/`MCP_HTTP_PORT` default to `0.0.0.0`/8788,
`MCP_HTTP_PATH` defaults to `/mcp`. `--dev` and `demo` override both hosts to
`127.0.0.1`. The `.env.example` documents the same keys plus the
BrowserBridge aliases and the `TEST_PAGE_PORT` (Docker-only, not started by
`pnpm dev`).

## Daemon Install (launchd / systemd)

`install` writes persistent, OS-managed service definitions under `~/.brijio/`
and loads the daemon. The platform model supports `darwin` (launchd) and
`linux` (systemd); other platforms throw from `normalizePlatform`.

<!-- openwiki: mermaid parse failed and this diagram was converted to a text fence so it does not break rendering. Fix the diagram source and restore the mermaid fence. Parser error: Heuristic: a semicolon inside a label breaks rendering; rephrase the label. -->

```text
flowchart TD
    Cmd["brijio install --ws-port N --mcp-port N"] --> Plan["planDaemonInstall"]
    Plan --> Dir["Create ~/.brijio/ and ~/.brijio/bin/"]
    Plan --> Env["Read existing .env or {} ; fill BRIJIO_PAIRING_TOKEN and MCP_HTTP_AUTH_TOKEN if absent ; apply --ws-port / --mcp-port"]
    Env --> WriteEnv["Write .env chmod 0600 ; write .env.example if missing"]
    WriteEnv --> Wrapper["Write ~/.brijio/bin/brijio shell wrapper exec node <realBinary>"]
    Wrapper --> Service{"platform?"}
    Service -->|"darwin"| Plist["Write com.redvex.brijio.plist, symlink to ~/Library/LaunchAgents/"]
    Service -->|"linux"| Unit["Write brijio.service, symlink to ~/.config/systemd/user/"]
    Plist --> Load["launchctl unload (best-effort) then load"]
    Unit --> Load2["systemctl --user daemon-reload then enable --now"]
    Load --> Done["Return plan with env + paths"]
    Load2 --> Done
```

Key invariants:

- **Tokens are never embedded in the plist/unit.** `planDaemonInstall` writes
  them to `~/.brijio/.env` (chmod `0600`) only; the macOS plist has no
  `EnvironmentVariables` and the Linux unit references them via
  `EnvironmentFile=%h/.brijio/.env`. This is verified by a test asserting the
  systemd unit contains no token value.
- **Idempotent reinstall.** If `.env` already exists, existing
  `BRIJIO_PAIRING_TOKEN`/`MCP_HTTP_AUTH_TOKEN` are preserved; only absent
  values are generated. Passing new `--ws-port`/`--mcp-port` overrides the
  ports in `.env`, while omitting a flag leaves the existing port intact.
- **macOS plist** sets `RunAtLoad: true`, `KeepAlive: true`, a
  `WorkingDirectory` of `~/.brijio`, and routes both stdout and stderr to
  `~/.brijio/brijio.log`.
- **Linux unit** uses `Type=simple`, `Restart=on-failure` (not `always`, to
  avoid restart loops on config errors), and `WantedBy=default.target`.

`uninstall` stops/disables the daemon, removes the symlink, but leaves
`~/.brijio/` intact and prints a note for full removal (`rm -rf ~/.brijio`).
`start`/`stop`/`restart` wrap `launchctl load`/`unload` (macOS) or
`systemctl --user start|stop|restart brijio.service` (Linux) and never modify
`.env`. `status` loads the env to resolve ports, checks the loaded state via
`launchctl list`/`systemctl --user is-active`, and probes both health
endpoints, returning a `DaemonStatus` formatted by `formatStatus`.

## Doctor Preflight Diagnostics

`brijio --doctor` runs `runDoctorChecks` and prints `formatDoctorReport`. It
starts no servers and exits `1` if any check is `fail`. Checks:

| Check                          | Status logic                                                                                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Config                         | `pass` if a config path is found and readable; `warn` if no path was detected or the file is missing (env/auto-generated config still works). |
| MCP HTTP port / WebSocket port | `pass` if `net.createServer().listen(port)` succeeds; `fail` with `EADDRINUSE` guidance if another process binds it.                          |
| Network                        | `pass` listing detected signals (Tailscale IP, mDNS hostname, `127.0.0.1`); `warn` if detection throws.                                       |
| Node.js                        | `fail` if `process.version` major is below 18; otherwise `pass`.                                                                              |

The report uses ✅/❌/⚠️ icons per check and a summary line: "All checks
passed" when no failures and no warnings, or counts of issues/warnings
otherwise.

## Network Path Detection

`detectNetworkPaths` probes three signals and picks a `bestHost`:

1. **Tailscale CLI** — runs `tailscale status --json` with a 2-second timeout.
   On success it parses `TailscaleIPs` and prefers the first address in the
   Tailscale CGNAT range (`100.64.0.0/10`, i.e. first octet `100`, second
   octet `64–127`).
2. **Tailscale interface fallback** — `detectTailscaleInterface` scans
   `os.networkInterfaces()` for a `100.64.0.0/10` IPv4 address, used when the
   CLI is not in `PATH` but the machine still has a Tailscale IP.
3. **mDNS** — `detectMdns` resolves `<hostname>.local` via `dns.resolve`;
   native on macOS, requires avahi/systemd-resolved on Linux. Fails gracefully
   to `null`.

`bestHost` priority is **Tailscale > mDNS > localhost** (`127.0.0.1`). The
`NetworkPaths.addresses` array carries `Local`, `Tailscale`, and `mDNS`
entries for display; the banner iterates them and the doctor lists each signal
on its own detail line.

## `--print-config` Agent Config Generation

`brijio --print-config [agent]` prints a ready-to-copy MCP client config block
to **stdout** and a short where-to-paste hint to **stderr**, so
`brijio --print-config <agent> > config.json` yields a clean file. The handler
resolves the effective `mcpUrl`/`wsUrl` from the config pipeline plus
`detectNetworkPaths().bestHost`, unless `--dev` forces `127.0.0.1`.
`authTokenEnvVar` is the constant `MCP_HTTP_AUTH_TOKEN`, and `isEphemeral` is
true when the auth token was auto-generated (not user-provided).

`resolveAgentName` is case-insensitive and accepts aliases. Twelve agents are
supported, each with a pure formatter in `print-config.ts`/`print-config-commands.ts`:

| `--print-config <agent>` | Aliases  | Format / location                                                                                  |
| ------------------------ | -------- | -------------------------------------------------------------------------------------------------- |
| `claude-desktop`         | `claude` | `mcpServers` JSON → `claude_desktop_config.json`                                                   |
| `cursor`                 | `cur`    | `mcpServers` JSON → `.cursor/mcp.json` or `~/.cursor/mcp.json`                                     |
| `vscode`                 | `vs`     | `servers` JSON with `type: "http"` → `.vscode/mcp.json`                                            |
| `cline`                  | —        | `mcpServers` JSON → Cline settings UI                                                              |
| `codex`                  | —        | `codex mcp add ... --bearer-token-env-var` (references env var, not literal token)                 |
| `hermes`                 | —        | YAML → `~/.hermes/config.yaml` `mcp_servers`                                                       |
| `claude-code`            | `code`   | `claude mcp add --transport http --header` shell command                                           |
| `gemini`                 | —        | `gemini mcp add --transport http --header` shell command                                           |
| `windsurf`               | —        | `mcpServers` with `serverUrl` + `${env:VAR}` interpolation → `~/.codeium/windsurf/mcp_config.json` |
| `zed`                    | —        | `context_servers` JSON → `.zed/settings.json` or `~/.config/zed/settings.json`                     |
| `continue`               | —        | YAML (`name`/`version`/`schema`/`mcpServers`) → `.continue/mcpServers/brijio.yaml`                 |
| `goose`                  | —        | Instructional "not supported" message (Goose is stdio-only; Brijio is HTTP-only)                   |

The CLI-based agents (`codex`, `claude-code`, `gemini`) emit shell commands
rather than config files; `codex` uses `--bearer-token-env-var` to match
Codex's security convention of never embedding secrets in config, while
`claude-code` and `gemini` embed the literal `Bearer` header value. When no
agent is given, the entry point prints a numbered interactive prompt via
`formatInteractivePrompt` if `stdin.isTTY`; otherwise it falls back to
`formatDefaultJson` (the widest-compatible `mcpServers` envelope) so the
command is safe in pipes and CI.

## Startup Banner

`formatStartupBanner` builds the post-startup banner. It is written to
`process.stderr` by `bin/brijio.mjs`, leaving stdout clean for piping. When
`dev` is false it calls `detectNetworkPaths()` best-effort and lists all
reachable addresses (Local, Tailscale, mDNS) with their WS and MCP URLs;
when `dev` is true it forces `127.0.0.1` and skips network detection. The
banner annotates each token with ` [ephemeral]` when it was auto-generated
(not user-provided), prints a warning that ephemeral tokens change on restart,
and shows the `--dev` indicator when active. In `demoAttachedToExistingDaemon`
mode it prints only the demo page URL plus a note that the daemon is already
running.

## Health Endpoints and Structured Logging

Per ADR-0033, both servers expose `GET /health` and emit single-line JSON logs
to stderr via `createLogger` from `@brijio/shared` (`packages/shared/src/logger.ts`).

- **WS server** health returns `status`, `version` (from `package.json`),
  `uptimeSeconds`, and an `extensions` object with a `count` and the connected
  browser instance IDs/labels.
- **MCP HTTP server** health returns `status`, `version`, `uptimeSeconds`, and a
  `websocket` object with the configured WS URL and a `status` of `"unknown"`
  (the probe is lightweight and reports `unknown` rather than blocking on a
  full WS handshake). The MCP `/health` route is handled before auth/path
  checks; the MCP path itself requires a `Bearer` token and supports
  `GET`/`POST`/`DELETE` only.

`createLogger` serializes a `LogEntry` (`timestamp`, `level`, `message`,
`service`, plus extra context) with `JSON.stringify` + `process.stderr.write`,
with no external logging dependency. Stderr is chosen so logs do not interfere
with MCP stdio transport or HTTP response pipes.

## Docker

`docker-compose.yml` defines three profiles under the `brijio` service image:

- `runtime` — the `brijio` service exposing WS and MCP ports with env defaults.
- `legacy-runtime` — a `browserbridge` service that `extends` the `brijio`
  service.
- `test` — a `test-page` nginx service serving `clients/test-page` on
  `TEST_PAGE_PORT` (default `8080`).

The compose environment maps the same `WEBSOCKET_*`/`MCP_HTTP_*`/token env vars
with `.env`-style `${VAR:-default}` interpolation, so the same configuration
keys used by the CLI also drive the containerized runtime.

## Security Notes

- **Tokens must not be committed.** `.env.example` ships placeholders
  (`replace-with-generated-token`, `replace-with-generated-mcp-token`);
  `pnpm dev` and `install` generate real tokens via
  `crypto.randomBytes(32).toString('base64url')`.
- **Auto-generated tokens are ephemeral.** They change on every restart unless
  persisted in `.env`. The banner flags whether each token was user-provided
  (no `[ephemeral]` annotation) or auto-generated.
- **Daemon tokens live in `~/.brijio/.env` (chmod `0600`), not in the plist/unit.**
  The macOS plist contains no `EnvironmentVariables`; the Linux unit uses
  `EnvironmentFile=`. This keeps secrets out of the user-readable
  `~/Library/LaunchAgents/` or `~/.config/systemd/` paths.
- **`--print-config` emits real token values to stdout** (not placeholders),
  because the intent is interactive copy-paste. In CI/Docker contexts where
  stdout is logged, pass explicit env vars and redirect to a file.
- **BrowserBridge aliases are accepted during the transition** for
  `BROWSERBRIDGE_PAIRING_TOKEN`, `BROWSERBRIDGE_WEBSOCKET_URL`, and
  `BROWSERBRIDGE_REQUEST_TIMEOUT_MS`; the new `BRIJIO_*` names take
  precedence when both are set.
