# BrowserBridge Quick Start

Get BrowserBridge running and make your first tool call in under 5 minutes.

## Prerequisites

- **Node.js** 22 or newer
- **pnpm** 9 or newer
- **Chrome** 116 or newer, or **Safari** (macOS, requires Xcode)

## Step 1: Clone and Install

```sh
git clone https://github.com/redvex/browser-bridge.git
cd browser-bridge
pnpm install
```

Expected output (last few lines):

```text
packages/shared    | Done in 2s
servers/websocket  | Done in 1s
servers/mcp        | Done in 1s
clients/extensions | Done in 1s
Done in 5s
```

## Step 2: Start the Servers

```sh
pnpm dev
```

If this is the first run, `pnpm dev` will:

1. **Create `.env`** from `.env.example` if it doesn't exist.
2. **Generate tokens** — a pairing token for WebSocket auth and an MCP auth token for HTTP bearer auth.
3. **Ask about network access** (localhost only is fine for this walkthrough — press Enter twice to accept the defaults).

Expected output:

```text
No .env found. Creating from template...
Found .env with placeholder tokens.
Allow local network connections (*.local)? (true/false) [false]:
Allow Tailscale connections? (true/false) [false]:
.env updated successfully.
Starting servers...
Waiting for servers to be ready...

🚀 BrowserBridge dev servers ready!

  WebSocket:    ws://localhost:8787
  MCP:         http://localhost:8788/mcp

  Pairing Token:    bb_xxxxxxxxxxxxxxxx
  MCP Auth Token:   mcp_xxxxxxxxxxxxxxxx

  Connect your browser extension using the Pairing Token above.
  Configure your MCP client with the MCP URL and Auth Token.

  Press Ctrl+C to stop all servers.
```

> **Note the two tokens.** You will need both in the next steps.

## Step 3: Build and Load the Browser Extension

BrowserBridge supports Chrome and Safari. Choose your browser and follow the
relevant steps below, then continue to Step 4.

### Chrome

#### Build

In a new terminal (while `pnpm dev` keeps running):

```sh
pnpm --filter @browserbridge/chrome-extension build
```

Or use the Makefile shortcut:

```sh
make chrome
```

Expected output:

```text
> @browserbridge/chrome-extension@0.0.0 build /.../clients/extensions/chrome
> ...
Build complete. Output in dist/.
```

#### Load in Chrome

1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select the `clients/extensions/chrome/dist` directory.

The BrowserBridge icon appears in your toolbar.

### Safari

> **macOS only.** Safari Web Extensions must be wrapped in a native macOS app
> and installed through Xcode.

#### Build and Convert

In a new terminal (while `pnpm dev` keeps running):

```sh
make safari
```

This runs two steps automatically:

1. `pnpm --filter @browserbridge/safari-extension build` — compiles and bundles the extension into `clients/extensions/safari/dist/`.
2. `xcrun safari-web-extension-converter --force --project-location clients/extensions/safari/BrowserBridge clients/extensions/safari/dist` — converts the built extension into an Xcode project at `clients/extensions/safari/BrowserBridge/`.

Expected output (last few lines):

```text
...The Safari Web Extension has been converted and the Xcode project has been created.
```

#### Install in Safari

1. Open `clients/extensions/safari/BrowserBridge/BrowserBridge.xcodeproj` in Xcode.
2. Select the **BrowserBridge** target → **Signing & Capabilities** → set **Team** to your Apple Developer account (or your personal team for local development).
3. Build and run the project (⌘R). This installs the BrowserBridge app and extension.
4. Open Safari → **Settings** → **Extensions**.
5. Enable the BrowserBridge extension and grant the requested permissions.

The BrowserBridge button appears in your Safari toolbar.

## Step 4: Pair the Extension

### Chrome

1. Click the BrowserBridge toolbar icon. The setup page opens.
2. Enter the **WebSocket URL**: `ws://127.0.0.1:8787`
3. Enter the **Pairing Token** from the `pnpm dev` banner (e.g. `bb_xxxxxxxxxxxxxxxx`).
4. Accept or edit the auto-generated browser identity (the defaults are fine).
5. Optionally enable **regular page access** for HTTP/HTTPS pages (needed if you want to interact with regular websites during testing).
6. Click **Save**.
7. Click the BrowserBridge toolbar icon again to **start the bridge**.

### Safari

1. Click the BrowserBridge toolbar button. The popup overlay opens.
2. Enter the **WebSocket URL**: `ws://127.0.0.1:8787`
3. Enter the **Pairing Token** from the `pnpm dev` banner (e.g. `bb_xxxxxxxxxxxxxxxx`).
4. Accept or edit the profile name and browser label (the defaults are fine).
5. Click **Connect**. This saves settings and starts the bridge.

> **Safari difference:** Safari does not have a separate "regular page access"
> toggle. Broad host permissions (`*://*/*`) are granted when you enable the
> extension, so the extension can read any HTTP/HTTPS page by default.

The toolbar badge should show **ON**, confirming the extension is connected to
the WebSocket server.

## Step 5: Make Your First Tool Call

With the servers running and the extension connected, you can call BrowserBridge tools through the MCP HTTP endpoint. Open a new terminal and use `curl`:

### Discover Online Browsers

```sh
curl -s http://127.0.0.1:8788/mcp \
  -H "Authorization: Bearer mcp_xxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_browsers","arguments":{}}}'
```

Replace `mcp_xxxxxxxxxxxxxxxx` with the **MCP Auth Token** from the `pnpm dev` banner.

Expected output:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"ok\":true,\"data\":{\"browsers\":[{\"browserInstanceId\":\"chrome-default-xxxxxxxx\",\"browserName\":\"Chrome\",\"profileName\":\"Default\",\"label\":\"Chrome Default\",\"capabilities\":[\"page_context\",\"page_content\",\"page_actions\"]}]}}"
      }
    ]
  }
}
```

### Read the Current Page

Navigate to any page in Chrome (e.g. `https://example.com`), then:

```sh
curl -s http://127.0.0.1:8788/mcp \
  -H "Authorization: Bearer mcp_xxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"read_current_page","arguments":{"includeContent":true,"maxContentChunks":1}}}'
```

Expected output (truncated):

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"ok\":true,\"data\":{\"context\":{\"url\":\"https://example.com/\",\"title\":\"Example Domain\"},\"content\":[{\"index\":1,\"content\":\"# Example Domain\\n\\n...\",\"truncated\":false}],\"contentTruncated\":false,\"nextContentIndex\":null}}"
      }
    ]
  }
}
```

You just read a real browser page through an AI-facing API. That's the core BrowserBridge value proposition.

## Step 6: Connect an MCP Client

BrowserBridge is compatible with any app that supports the
[MCP streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-03-26/streamable-http).
Once configured, you can ask any supported model to read pages, click links,
fill forms, and perform other browser actions on your behalf — all through your
authenticated browser session.

### Hermes

```sh
hermes mcp add browserbridge \
  --url http://127.0.0.1:8788/mcp \
  --header "Authorization=Bearer YOUR_MCP_AUTH_TOKEN"
```

Then start a new session (`/reset` if already running).

### Claude Desktop

Edit the configuration file:

| OS      | Path                                                              |
| ------- | ----------------------------------------------------------------- |
| macOS   | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%AppData%\Claude\claude_desktop_config.json`                     |
| Linux   | `~/.config/Claude/claude_desktop_config.json`                     |

Or open it from Claude Desktop: **Settings → Developer → Edit Config**.

```json
{
  "mcpServers": {
    "browserbridge": {
      "type": "streamable-http",
      "url": "http://127.0.0.1:8788/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_AUTH_TOKEN"
      }
    }
  }
}
```

Replace `YOUR_MCP_AUTH_TOKEN` with the **MCP Auth Token** from the `pnpm dev`
banner. Restart Claude Desktop after editing.

### Cursor

Edit the global configuration at `~/.cursor/mcp.json`, or create a
project-level `.cursor/mcp.json` in your workspace:

```json
{
  "mcpServers": {
    "browserbridge": {
      "type": "streamable-http",
      "url": "http://127.0.0.1:8788/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_AUTH_TOKEN"
      }
    }
  }
}
```

Reload MCP servers in Cursor after editing (Settings → MCP → refresh, or
restart Cursor).

### VS Code / GitHub Copilot

Add to your VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "browserbridge": {
      "type": "streamable-http",
      "url": "http://127.0.0.1:8788/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_AUTH_TOKEN"
      }
    }
  }
}
```

Or create `.vscode/mcp.json` at the project level:

```json
{
  "servers": {
    "browserbridge": {
      "type": "streamable-http",
      "url": "http://127.0.0.1:8788/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_AUTH_TOKEN"
      }
    }
  }
}
```

### OpenAI Codex CLI

Use the CLI command:

```sh
codex mcp add browserbridge \
  --url http://127.0.0.1:8788/mcp \
  --bearer-token-env-var BROWSERBRIDGE_TOKEN
```

Then set the environment variable before running Codex:

```sh
export BROWSERBRIDGE_TOKEN="YOUR_MCP_AUTH_TOKEN"
```

Or add manually to `~/.codex/config.toml`:

```toml
[mcp_servers.browserbridge]
transport = "streamable_http"
url = "http://127.0.0.1:8788/mcp"
bearer_token_env_var = "BROWSERBRIDGE_TOKEN"
```

### OpenClaw

Edit `~/.openclaw/openclaw.json` (or `openclaw.jsonc`):

```json
{
  "mcp": {
    "servers": {
      "browserbridge": {
        "url": "http://127.0.0.1:8788/mcp",
        "transport": "streamable-http",
        "headers": {
          "Authorization": "Bearer YOUR_MCP_AUTH_TOKEN"
        }
      }
    }
  }
}
```

Or use the CLI:

```sh
openclaw mcp set browserbridge '{
  "url": "http://127.0.0.1:8788/mcp",
  "transport": "streamable-http",
  "headers": {"Authorization": "Bearer YOUR_MCP_AUTH_TOKEN"}
}'
```

Restart the OpenClaw gateway to pick up the new config.

### Using BrowserBridge with Your Agent

Once connected, your agent can use BrowserBridge's 9 tools and 2 resources to
interact with your browser. For example, you could ask:

- _"Read the current page and summarize it"_
- _"Fill out the form on this page with my details"_
- _"Click the submit button on the page I'm viewing"_
- _"Extract all the links from this page"_

The agent reads and acts on the page you have open in your browser, using your
authenticated session. No screenshots or screen sharing — the agent works
directly with the page structure through MCP tool calls.

## Accessing BrowserBridge over Tailscale

If your development machine is on a
[Tailscale](https://tailscale.com/) tailnet, you can let other machines on
your network reach the BrowserBridge MCP server — useful when your AI agent
runs on a different device.

### Quick Setup

1. **Re-run `pnpm dev`** and answer the network prompts:

   ```
   Allow local network connections (*.local)? (true/false) [false]: true
   Allow Tailscale connections? (true/false) [false]: true
   ```

   This sets the following in your `.env`:

   ```sh
   MCP_HTTP_HOST=0.0.0.0                        # bind all interfaces
   MCP_HTTP_ALLOW_TAILSCALE_HOSTS=true           # allow *.ts.net host headers
   ```

2. **Note your Tailscale hostname.** The dev orchestrator reads
   `~/.tailscale-hostname` (if it exists), or falls back to your machine's
   hostname. Your MagicDNS name is typically
   `machine.tailnet.ts.net`.

3. **Configure your MCP client** on the remote machine to use the Tailscale
   URL instead of `127.0.0.1`:

   ```text
   http://machine.tailnet.ts.net:8788/mcp
   ```

   Use the same **MCP Auth Token** from the `pnpm dev` banner.

4. **Pair the extension** using the Tailscale WebSocket URL:

   ```text
   ws://machine.tailnet.ts.net:8787
   ```

That's it. Requests arrive over Tailscale, pass host validation
(`*.ts.net` is allowed), and authenticate with the bearer token as usual.

### Manual Configuration

If you've already run `pnpm dev` and want to enable Tailscale without
re-running the prompts, edit `.env` directly:

```sh
MCP_HTTP_HOST=0.0.0.0
MCP_HTTP_ALLOW_TAILSCALE_HOSTS=true
```

Then restart the servers (`Ctrl+C` and `pnpm dev` again).

### Security Notes

- **Bearer token authentication is always required**, even on Tailscale.
  Host validation is a routing guardrail, not proof of tailnet identity.
- **Bind to the Tailscale interface only** if you want to prevent
  non-Tailscale access. Replace `0.0.0.0` with your machine's Tailscale IP
  (visible in `tailscale status`).
- The WebSocket server also binds to `0.0.0.0` when Tailscale is enabled,
  so the browser extension can connect from any network the machine is on.

## Stopping

- Press **Ctrl+C** in the terminal running `pnpm dev` to stop both servers.
- **Chrome**: Click the BrowserBridge toolbar icon to stop the bridge, or close Chrome.
- **Safari**: Click the BrowserBridge toolbar button and click **Disconnect**, or close Safari.

## Troubleshooting

| Symptom                                | Fix                                                                                                                                                                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev` exits immediately           | Ensure Node.js ≥ 22 and pnpm ≥ 9 are installed.                                                                                                                                  |
| No `.env` created                      | Check file permissions in the project root.                                                                                                                                      |
| Extension badge shows `ERR`            | Verify the WebSocket URL and pairing token match the `pnpm dev` banner. Check the extension's console for WebSocket errors.                                                      |
| `list_browsers` returns empty browsers | The extension must show `ON` badge before tools can route to it.                                                                                                                 |
| Tool call returns `auth_required`      | The MCP Auth Token in the `Authorization: Bearer` header must match `MCP_HTTP_AUTH_TOKEN` in `.env`.                                                                             |
| Tool call returns `timeout`            | The extension is not connected or the target page is a Chrome internal page (`chrome://`, `about:`) which the extension cannot read.                                             |
| Safari: `make safari` fails            | Ensure Xcode is installed. Run `xcode-select --install` if `xcrun` is not found.                                                                                                 |
| Safari: Xcode build fails (signing)    | Open the project in Xcode → select BrowserBridge target → Signing & Capabilities → set Team to your developer account.                                                           |
| Safari: extension not in Settings      | Build and run the BrowserBridge Xcode project first (⌘R). The extension appears in Safari Settings → Extensions after install.                                                   |
| Safari: badge shows `ERR` after wake   | Safari may suspend background scripts under memory pressure. Click Disconnect then Connect to re-establish the WebSocket.                                                        |
| Tailscale: MCP client can't connect    | Ensure `MCP_HTTP_HOST=0.0.0.0` (not `127.0.0.1`) and `MCP_HTTP_ALLOW_TAILSCALE_HOSTS=true` in `.env`. Verify with `tailscale status` that both machines are on the same tailnet. |
| Tailscale: extension won't pair        | Use the Tailscale hostname (`ws://machine.tailnet.ts.net:8787`) not `127.0.0.1` for the WebSocket URL in the extension setup.                                                    |

## Next Steps

- Read the [full README](../README.md) for architecture details and the security model.
- See [ADR 0028](architecture/decisions/0028-mvp-approach.md) for the MVP roadmap.
- Check the extension READMEs for browser-specific details:
  - [Chrome extension](../clients/extensions/chrome/README.md)
  - [Safari extension](../clients/extensions/safari/README.md)
