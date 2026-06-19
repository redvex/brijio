# Download and Install

Brijio has two parts: a local MCP runtime and a browser extension. The runtime
runs on your machine, and the extension connects only when you explicitly start
the bridge.

## Recommended Setup

Install Brijio as a local background service:

```sh
npx @brijio/mcp install
```

This creates a LaunchAgent on macOS or a systemd user service on Linux. Brijio
generates local tokens and stores configuration in `~/.brijio/.env`.

## Daemon Commands

```sh
npx @brijio/mcp start
npx @brijio/mcp stop
npx @brijio/mcp restart
npx @brijio/mcp status
npx @brijio/mcp logs
npx @brijio/mcp logs --live
npx @brijio/mcp uninstall
```

## Browser Extension

Install the extension from the Chrome web store: [Brijio Chrome Web Extension](https://chromewebstore.google.com/detail/brijio/bcgcclicebnfknbdfpbfadanfplcmfnj)

Build and load the Chrome extension from this repository:

```sh
make chrome
```

Then open Chrome's extension manager, enable developer mode, and load
`clients/extensions/chrome/dist` as an unpacked extension.

Build and load the Safari extension from this repository:

```sh
make safari-macos
open clients/extensions/safari/Brijio-macOS/Brijio/Brijio.xcodeproj
```

Then select `Sign and Capabilities` for both `Brijio` and `Brijio Extension` targets, select your Apple Dev team account and run the `Brijio` target against your Mac.

## Connect The Extension

1. Click the Brijio extension icon.
2. Enter the WebSocket URL, normally `ws://127.0.0.1:8787`.
3. Enter the pairing token from `~/.brijio/.env`.
4. Save the settings.
5. Click **Connect** when you want the browser bridge active.

## Connect An MCP Client

Point your MCP client at the local HTTP endpoint:

```json
{
  "mcpServers": {
    "brijio": {
      "type": "streamableHttp",
      "url": "http://localhost:8788/mcp",
      "headers": {
        "Authorization": "Bearer your-mcp-token"
      }
    }
  }
}
```

The MCP token is also stored in `~/.brijio/.env`.

## Docker

You can also run Brijio with Docker:

```sh
docker run -p 8787:8787 -p 8788:8788 \
  -e BRIJIO_PAIRING_TOKEN=my-pairing-token \
  -e MCP_HTTP_AUTH_TOKEN=my-mcp-token \
  brijio/mcp
```

Expose port `8787` for the browser extension WebSocket connection and port
`8788` for MCP HTTP clients.
