# ADR-0037: Daemon Installation via `npx @redvex/browserbridge install`

## Status

Proposed

## Context

BrowserBridge requires two long-running processes (WebSocket companion on port 8787, MCP server on port 8788). Today, users start them in one of three ways:

1. **`npx @redvex/browserbridge`** — interactive foreground process, dies when the terminal closes
2. **`docker run redvex/browserbridge`** — containerised, survives terminal close but has Docker networking quirks (e.g. `127.0.0.1` binding doesn't work with port mapping)
3. **`pnpm dev`** — development only, not for end users

None of these provide **autostart on login** or **background persistence** without manual sysadmin work. Users who want BrowserBridge always-available must author LaunchAgent plists (macOS) or systemd units (Linux) themselves — a friction point that defeats the zero-config goal from ADR-0035.

### Why not just export env vars in the shell profile?

Shell profile exports (`~/.zshrc`, `~/.bash_profile`) are only visible to interactive terminal sessions. macOS LaunchAgents run via `launchd` in a minimal environment with no shell invocation. Similarly, Linux systemd units don't inherit shell profiles. Environment variables set there are invisible to daemon processes.

### Why not embed secrets in the plist/systemd unit?

Placing tokens in `EnvironmentVariables` inside a LaunchAgent plist works functionally, but the plist file is user-readable plaintext in `~/Library/LaunchAgents/`. On shared machines this leaks credentials. The same applies to systemd `Environment=` directives visible in `/etc/systemd/system/`.

## Decision

### 1. Add `install`, `uninstall`, `status` subcommands

```
npx @redvex/browserbridge          # Run interactively (current behaviour, unchanged)
npx @redvex/browserbridge install   # Install as daemon (LaunchAgent / systemd)
npx @redvex/browserbridge uninstall # Remove the daemon
npx @redvex/browserbridge status    # Check daemon status
```

Optional flags for `install`:

```
--ws-port <port>     # WebSocket port (default: 8787)
--mcp-port <port>    # MCP HTTP port (default: 8788)
```

These write custom ports into `~/.browserbridge/.env` so the daemon starts on the specified ports. Without flags, defaults apply. Re-running `install` with different port values updates the `.env` and restarts the daemon on the new ports.

These are **subcommands**, not flags (`--install`). Server flags (`--port`, `--token`) remain flags when running interactively. Meta-operations on the daemon are actions — the subcommand form is cleaner, avoids collision with server args, and leaves room for future commands (e.g. `logs`, `restart`).

### 2. Configuration directory: `~/.browserbridge/`

```
~/.browserbridge/
├── .env                    # Persistent tokens and config (ports, tokens)
├── .env.example            # Template (written on first install if missing)
└── com.redvex.browserbridge.plist   # macOS only (symlinked or copied to LaunchAgents)
```

The `--install` command:

1. **Creates `~/.browserbridge/`** if it doesn't exist
2. **Generates tokens** via `crypto.randomBytes(32).toString('base64url')` (same algorithm as current auto-generation) and writes them to `~/.browserbridge/.env`
3. **Writes port config** — if `--ws-port` or `--mcp-port` are specified, writes `WEBSOCKET_PORT` and/or `MCP_HTTP_PORT` to `.env`. If not specified, omits them (defaults apply from the Node.js entry point)
4. **If `.env` already exists**, reads existing tokens and ports instead of regenerating — idempotent reinstall preserves configuration. New `--ws-port` / `--mcp-port` flags override existing values in `.env`
5. **Detects the OS** and creates the appropriate service definition:
   - **macOS**: writes a LaunchAgent plist to `~/.browserbridge/com.redvex.browserbridge.plist`, then symlinks/copies it to `~/Library/LaunchAgents/`
   - **Linux**: writes a systemd user unit to `~/.browserbridge/browserbridge.service`, then symlinks to `~/.config/systemd/user/`
6. **Loads the daemon** (`launchctl load` / `systemctl --user enable --now`)
7. **Prints the generated tokens** to stdout with instructions to save them (for MCP client configuration)

### 3. Token persistence via `.env` file

The Node.js entry point currently reads `.env` from the current working directory. Extend this with a fallback chain:

```
1. CWD/.env                    (current behaviour)
2. ~/.browserbridge/.env       (new fallback)
3. BROWSERBRIDGE_ENV_FILE      (explicit override, if set)
```

The plist/systemd unit sets `WorkingDirectory` (macOS) or `WorkingDirectory=` (systemd) to `~/.browserbridge/`, so the daemon always finds its `.env` at startup regardless of where it was launched from.

**Why `.env` in a dedicated directory instead of plist EnvironmentVariables?**

- Tokens are not visible in the plist file (which is user-readable)
- One file to edit for all configuration changes
- Same `.env` works for both daemon and interactive runs
- Easy to rotate tokens: edit `.env` and `restart` the daemon
- No shell profile pollution

### 4. LaunchAgent plist structure (macOS)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.redvex.browserbridge</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/{user}/.browserbridge/bin/browserbridge</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/Users/{user}/.browserbridge</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/Users/{user}/.browserbridge/browserbridge.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/{user}/.browserbridge/browserbridge.log</string>
</dict>
</plist>
```

Key design choices:

- **`RunAtLoad: true`** — starts on login
- **`KeepAlive: true`** — auto-restarts on crash
- **Resolved binary path, not `npx`** — `npx` adds ~2-3s resolution lag on every start. The `install` command resolves the actual binary path at install time and writes it into the plist. If the package is updated (`npm install -g @redvex/browserbridge`), the resolved path stays valid. If installed via npx cache, the installer prints a warning that updates require re-running `install`
- **Log file** — stdout + stderr go to `~/.browserbridge/browserbridge.log`. The `status` command can tail it
- **No `EnvironmentVariables`** — the `.env` file is the single source of truth, read by the Node.js process

### 5. systemd user unit structure (Linux)

```ini
[Unit]
Description=BrowserBridge - AI agent to browser bridge
After=network.target

[Service]
Type=simple
WorkingDirectory=%h/.browserbridge
ExecStart=%h/.browserbridge/bin/browserbridge
Restart=on-failure
RestartSec=5
EnvironmentFile=%h/.browserbridge/.env

[Install]
WantedBy=default.target
```

Key differences from macOS:

- **`EnvironmentFile=`** — systemd natively reads `.env` files. No Node.js fallback needed for systemd users
- **`Restart=on-failure`** — not `always`, to avoid restart loops on config errors
- **User unit, not system** — runs under the user's session, no `sudo` required

### 6. Binary resolution at install time

`npx @redvex/browserbridge` resolves to a cached binary in `~/.npm/_npx/` (ephemeral, may be pruned). The `install` command copies or symlinks the resolved binary to `~/.browserbridge/bin/browserbridge` and records the original path for reference.

Resolution priority:

1. **Global install** — `npm list -g @redvex/browserbridge` → use the global binary directly
2. **npx cache** — resolve via `which browserbridge` or `npx which @redvex/browserbridge` → copy to `~/.browserbridge/bin/`
3. **Fallback** — if neither found, suggest `npm install -g @redvex/browserbridge` first, then re-run `install`

### 7. `uninstall` command

```
npx @redvex/browserbridge uninstall
```

1. Stops the daemon (`launchctl unload` / `systemctl --user stop --disable`)
2. Removes the plist/unit symlink from `~/Library/LaunchAgents/` or `~/.config/systemd/user/`
3. **Does NOT delete `~/.browserbridge/`** — preserves `.env` and logs. Prints a note that the user can `rm -rf ~/.browserbridge` to fully remove

### 8. `status` command

```
npx @redvex/browserbridge status
```

1. Checks if the daemon is loaded (`launchctl list` / `systemctl --user status`)
2. Checks if the process is running (PID check)
3. Checks `.env` token freshness ( warns if auto-generated tokens older than 30 days)
4. Pings both health endpoints (`localhost:8787/health`, `localhost:8788/health`)
5. Prints a unified status table

## Consequences

### Positive

- **One-command onboarding** — `npx @redvex/browserbridge install` and BrowserBridge runs as a persistent daemon started at login
- **Zero-config tokens** — generated on first install, persisted in `.env`, survive reboots
- **No Docker needed for local dev** — avoids Docker networking pitfalls (ADR-0035), native process is simpler and faster
- **Idempotent** — running `install` twice is safe; existing `.env` is preserved
- **Cross-platform** — macOS and Linux covered, Windows could follow with a scheduled task

### Negative

- **Binary path brittleness** — if the user updates the package via npx without re-running `install`, the resolved path may break. Mitigated by global install recommendation
- **Yet another config location** — `~/.browserbridge/` is a new dot directory. Justified by the daemon use case; interactive runs don't need it
- **No Windows support (yet)** — the `install` command would need a third branch for Windows scheduled tasks. Can be added later without changing the `.env` or subcommand design
- **systemd `EnvironmentFile` vs Node.js `.env` parsing** — on Linux, systemd reads `.env` natively; on macOS, the Node.js process reads it. Two different `.env` readers could diverge on format (e.g. quoting, comments). Mitigate by keeping `.env` files simple: `KEY=VALUE` pairs, no comments, no inline quoting

- **Port conflicts** — if another process uses 8787 or 8788, the daemon fails. Mitigated by `--ws-port` and `--mcp-port` flags on `install`, which write custom ports into `.env`. The `status` command also detects and reports port conflicts

### Risks

- **npx cache pruning** — `npx` may prune cached packages after a period of disuse. If the resolved binary was an npx cache copy, the daemon breaks silently. Mitigated by `KeepAlive: true` (restarts), but the process will loop-fail until the user re-runs `install`. Document this risk and recommend global install for production use

## Future work (out of scope)

- **`npx @redvex/browserbridge logs`** — tail the daemon log file
- **`npx @redvex/browserbridge restart`** — unload + load the daemon
- **Windows support** — scheduled task via `schtasks`
- **Token rotation** — `install --rotate-tokens` to regenerate and update `.env`
- **Health monitoring** — watchdog that pings `/health` and restarts on failure
- **Auto-update** — detect new versions and prompt `install` again

## Local development

When working on BrowserBridge from a local checkout, `npx @redvex/browserbridge install` resolves from the npm registry — not the local tree. Three workflows support local development:

### 1. `npm link` (recommended for active development)

```bash
cd /path/to/browser-bridge
pnpm build
cd servers/mcp
npm link
```

This creates a global symlink. `browserbridge install` works from anywhere on the system. Because it's a symlink, rebuilt changes are reflected without re-linking — just `pnpm build` and restart the daemon (`browserbridge restart` or `launchctl unload && launchctl load`).

The `install` command's binary resolution detects this via `which browserbridge` or `readlink`, which resolves the symlink to the local checkout. No special handling needed — it falls under the "global install" resolution path.

### 2. `npm install -g .`

```bash
cd /path/to/browser-bridge/servers/mcp
npm install -g .
```

Copies the built package to global `node_modules`. Works after a build, but requires `npm install -g .` again after each code change. Less convenient than `npm link` for active development but more predictable — no symlink indirection.

### 3. Run the binary directly (no global install)

```bash
node /path/to/browser-bridge/servers/mcp/dist/bin/browserbridge.js install
```

No global install or symlink needed — point directly at the built output. Useful for one-off testing or CI environments. The `install` command writes this absolute path into the LaunchAgent plist, so future daemon starts use the same binary without PATH resolution.

### Binary resolution order (all contexts)

The `install` command resolves the binary in this order:

1. **Global install / npm link** — `which browserbridge` finds it on PATH → use directly, record the resolved real path (following symlinks from `npm link`)
2. **npx cache** — resolve via `npx which @redvex/browserbridge` → copy to `~/.browserbridge/bin/` (warn about cache pruning risk)
3. **Explicit path** — if neither found, suggest the user run `npm install -g @redvex/browserbridge` or `npm link` first, then re-run `install`

For local development, options 1 and 3 both produce a stable binary path that won't break on npx cache pruning.

### Rebuilding after code changes

After `pnpm build` in a local checkout:

- **npm link** — daemon picks up changes on next restart (symlink points to `dist/bin/browserbridge.js` which is overwritten by `pnpm build`)
- **npm install -g .** — must re-run `npm install -g .` then restart the daemon
- **Direct path** — daemon picks up changes on next restart (same as npm link)

The `status` command should print the resolved binary path so users can verify which binary the daemon is running.
