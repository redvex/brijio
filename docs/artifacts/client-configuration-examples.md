# Client Configuration Examples

## Summary

Brijio exposes an MCP server over HTTP at `http://<host>:8788/mcp`. This document
lists the exact configuration block or command for every supported MCP client,
so you can copy, paste, and connect without guessing at formats.

The quickest path is the CLI:

```sh
brijio --print-config <agent>
```

This resolves tokens from your environment, detects the best reachable URL
(localhost, Tailscale, or mDNS), and prints a ready-to-copy config block.
All examples below assume the defaults:

- **MCP URL**: `http://127.0.0.1:8788/mcp`
- **Auth token**: the value of `MCP_HTTP_AUTH_TOKEN` from your `.env` or
  environment

Replace the URL and token with your own values if you customise ports or run
Brijio on a different host.

---

## Claude Desktop

**File**: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
or `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

```json
{
  "mcpServers": {
    "brijio": {
      "url": "http://127.0.0.1:8788/mcp",
      "headers": {
        "Authorization": "Bearer <MCP_HTTP_AUTH_TOKEN>"
      }
    }
  }
}
```

**CLI shortcut**:

```sh
brijio --print-config claude-desktop
```

---

## Cursor

**File**: `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global)

```json
{
  "mcpServers": {
    "brijio": {
      "url": "http://127.0.0.1:8788/mcp",
      "headers": {
        "Authorization": "Bearer <MCP_HTTP_AUTH_TOKEN>"
      }
    }
  }
}
```

**CLI shortcut**:

```sh
brijio --print-config cursor
```

---

## VS Code + GitHub Copilot

**File**: `.vscode/mcp.json` (project)

```json
{
  "servers": {
    "brijio": {
      "type": "http",
      "url": "http://127.0.0.1:8788/mcp",
      "headers": {
        "Authorization": "Bearer <MCP_HTTP_AUTH_TOKEN>"
      }
    }
  }
}
```

Note: VS Code uses `"servers"` as the top-level key (not `"mcpServers"`) and
requires `"type": "http"`.

**CLI shortcut**:

```sh
brijio --print-config vscode
```

---

## Cline

**Method**: Cline settings UI → MCP Servers → Add server

```json
{
  "mcpServers": {
    "brijio": {
      "url": "http://127.0.0.1:8788/mcp",
      "headers": {
        "Authorization": "Bearer <MCP_HTTP_AUTH_TOKEN>"
      }
    }
  }
}
```

**CLI shortcut**:

```sh
brijio --print-config cline
```

---

## OpenAI Codex CLI

Codex adds MCP servers via its own CLI command, not a config file.

```sh
codex mcp add brijio --url http://127.0.0.1:8788/mcp --bearer-token-env-var MCP_HTTP_AUTH_TOKEN
```

The `--bearer-token-env-var` flag references the environment variable name
rather than embedding the token value, matching Codex's security convention.
Ensure `MCP_HTTP_AUTH_TOKEN` is set in your shell environment for the command
to work at runtime.

**CLI shortcut**:

```sh
brijio --print-config codex
```

---

## Hermes Agent

**File**: `~/.hermes/config.yaml`

```yaml
mcp_servers:
  brijio:
    url: "http://127.0.0.1:8788/mcp"
    headers:
      Authorization: "Bearer <MCP_HTTP_AUTH_TOKEN>"
```

**CLI shortcut**:

```sh
brijio --print-config hermes
```

---

## Claude Code CLI

Claude Code adds MCP servers via its own CLI command, not a config file.

```bash
claude mcp add brijio --transport http --url http://127.0.0.1:8788/mcp --header "Authorization: Bearer <MCP_HTTP_AUTH_TOKEN>"
```

The actual token value is embedded in the command. This adds the server to
your Claude Code MCP config immediately.

**CLI shortcut**:

```sh
brijio --print-config claude-code
```

---

## Gemini CLI

Gemini CLI adds MCP servers via its own CLI command, not a config file.

```bash
gemini mcp add --transport http brijio http://127.0.0.1:8788/mcp --header "Authorization: Bearer <MCP_HTTP_AUTH_TOKEN>"
```

**CLI shortcut**:

```sh
brijio --print-config gemini
```

---

## Windsurf (Codeium)

**File**: `~/.codeium/windsurf/mcp_config.json`

```json
{
  "mcpServers": {
    "brijio": {
      "serverUrl": "http://127.0.0.1:8788/mcp",
      "headers": {
        "Authorization": "Bearer ${env:MCP_HTTP_AUTH_TOKEN}"
      }
    }
  }
}
```

Note: Windsurf uses `serverUrl` instead of `url` for remote HTTP servers, and
supports `${env:VAR_NAME}` interpolation — the token is resolved from your
shell environment at load time, so it never appears as a literal in the config
file.

**CLI shortcut**:

```sh
brijio --print-config windsurf
```

---

## Zed

**File**: `.zed/settings.json` (project) or `~/.config/zed/settings.json` (global)

```json
{
  "context_servers": {
    "brijio": {
      "url": "http://127.0.0.1:8788/mcp",
      "headers": {
        "Authorization": "Bearer <MCP_HTTP_AUTH_TOKEN>"
      }
    }
  }
}
```

Note: Zed uses `context_servers` as the top-level key (not `mcpServers`).

**CLI shortcut**:

```sh
brijio --print-config zed
```

---

## Continue (VS Code / JetBrains)

**File**: `.continue/mcpServers/brijio.yaml` (project)

```yaml
name: Brijio MCP Server
version: 0.0.1
schema: v1
mcpServers:
  - name: brijio
    type: streamable-http
    url: http://127.0.0.1:8788/mcp
    headers:
      Authorization: "Bearer <MCP_HTTP_AUTH_TOKEN>"
```

Note: Continue requires `name`, `version`, and `schema` metadata fields alongside
the `mcpServers` list. The `type` must be `streamable-http`.

**CLI shortcut**:

```sh
brijio --print-config continue
```

---

## Goose

**Not supported.** Goose only supports stdio-based MCP servers. Brijio runs as an
HTTP server and does not plan to support stdio transport (ADR-0023).

As a manual workaround, you can use a stdio-to-HTTP bridge such as
[mcp-proxy](https://github.com/nicholasgasior/mcp-proxy) to bridge between
Goose's stdio interface and Brijio's HTTP endpoint.

**CLI shortcut**:

```sh
brijio --print-config goose
```

---

## Interactive Mode

If you run `brijio --print-config` without an agent name, the CLI presents an
interactive picker:

```text
Which agent are you configuring?

   1. claude-desktop    Claude Desktop app
   2. cursor            Cursor IDE
   3. vscode            VS Code + GitHub Copilot
   4. cline             Cline (VS Code extension)
   5. codex             OpenAI Codex CLI
   6. hermes            Hermes Agent
   7. claude-code       Claude Code CLI
   8. gemini            Gemini CLI
   9. windsurf          Windsurf (Codeium)
  10. zed               Zed editor
  11. continue          Continue (VS Code/JetBrains)
  12. goose             Goose AI agent

Enter a number [1-12]:
```

In non-interactive environments (piped stdin, CI), the default output is the
widest-compatible `mcpServers` JSON envelope, so `brijio --print-config > config.json`
works without interaction.

---

## Replacing Placeholder Values

All examples above use `<MCP_HTTP_AUTH_TOKEN>` as a placeholder. In practice:

| Source                         | How to get the real value                                      |
| ------------------------------ | -------------------------------------------------------------- |
| Auto-generated (ephemeral)     | Printed in the `brijio` startup banner on each run             |
| Environment variable           | `echo $MCP_HTTP_AUTH_TOKEN`                                    |
| `.env` file                    | Look for `MCP_HTTP_AUTH_TOKEN` in `~/.brijio/.env` or `./.env` |
| `--print-config` (recommended) | `brijio --print-config <agent>` prints the resolved value      |

For persistent tokens, set `MCP_HTTP_AUTH_TOKEN` in your `.env` file or
environment. Auto-generated tokens change on every restart.

---

## Network Paths

When Brijio detects alternative network paths, `--print-config` and the startup
banner list them:

| Condition                    | Config URL                         |
| ---------------------------- | ---------------------------------- |
| Tailscale detected           | `http://100.x.x.x:8788/mcp`        |
| mDNS detected (no Tailscale) | `http://<hostname>.local:8788/mcp` |
| Neither                      | `http://127.0.0.1:8788/mcp`        |
| `--dev` mode                 | `http://127.0.0.1:8788/mcp`        |
| `MCP_HTTP_HOST` env var set  | Uses that host                     |

Use `--dev` for local-only development. It binds to `127.0.0.1` and generates
ephemeral tokens, preventing accidental exposure on network interfaces.

---

## Troubleshooting

If your MCP client cannot connect:

1. **Run `brijio --doctor`** — validates config, tokens, port availability,
   and network connectivity in one pass.
2. **Check the startup banner** — confirms both servers started and lists all
   detected network paths.
3. **Verify the auth token** — the token in your client config must match
   `MCP_HTTP_AUTH_TOKEN` exactly (including `Bearer` prefix in some clients).
4. **Check the URL** — if you're connecting from a different machine, use the
   Tailscale or mDNS address instead of `127.0.0.1`.
5. **Review client permissions** — some clients (e.g. Cline) require explicit
   approval before connecting to remote MCP servers.
