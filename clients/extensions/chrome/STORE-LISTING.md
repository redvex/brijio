# Chrome Web Store Listing

## Name

BrowserBridge

## Short Description (132 chars max)

Connect AI agents to the browser session you already control — privacy-first, no shared credentials.

## Detailed Description

BrowserBridge connects AI agents to the browser session you already control.

Instead of launching a separate browser, cloning sessions, or exporting cookies — BrowserBridge lets agents collaborate with the browser you're already using. The result is faster, safer, and more privacy-friendly access to the authenticated web.

### How it works

1. **Start the server** — No cloning or building needed. Run BrowserBridge with a single command:

   Using npx (recommended for local use):

   ```
   npx @redvex/browserbridge
   ```

   Using Docker:

   ```
   docker run -p 8787:8787 -p 8788:8788 giannimazza/browserbridge
   ```

   Both commands start the WebSocket relay (port 8787) and MCP server (port 8788). Auto-generated auth tokens are printed on startup — copy them for the next steps.

2. **Connect your browser** — Enter the server URL and pairing token in the extension popup
3. **Connect your AI agent** — Configure your MCP client (Claude Desktop, Hermes, etc.) with the server URL (`http://localhost:8788/mcp`) and the MCP auth token printed on startup. Agents then read page context, click elements, fill forms, and submit data — only when you're connected

### Key features

- **Authenticated browser first** — Use the browser session you're already logged into. No cookie export, no session cloning.
- **Remote agent friendly** — Works with any MCP-compatible AI agent: Claude Desktop, Codex, Hermes, OpenClaw, cloud-hosted agents.
- **Privacy by design** — The browser does not continuously stream data. Agents must explicitly request information.
- **Progressive disclosure** — Agents receive structured context first, then content when requested. No massive DOM dumps.
- **Human in control** — The extension only connects when you explicitly start it. Disconnect anytime.
- **Auto-reconnect** — If the connection drops, BrowserBridge automatically reconnects with exponential backoff.

### What it doesn't do

- ❌ Continuously stream screenshots or DOM
- ❌ Share your credentials with remote services
- ❌ Run silently in the background
- ❌ Store your browsing data externally

### Requirements

- A running BrowserBridge server (Docker or npm). See https://github.com/redvex/browser-bridge for setup instructions.
- An MCP-compatible AI agent configured to connect to the BrowserBridge MCP server.

### Permissions explained

- **activeTab** — Access the current tab when the extension is active
- **scripting** — Inject content scripts for page interaction (click, fill, form operations)
- **storage** — Store connection settings (server URL, pairing token)
- **tabs** — Query tab information (URL, title) for page context
- **host_permissions (http/https)** — Required for content script injection on all pages you browse. The extension only reads page data when you're actively connected — never silently.

### Open Source

BrowserBridge is open source under AGPLv3. View the source code at https://github.com/redvex/browser-bridge

## Category

Productivity

## Language

English

## Privacy Policy URL

https://browserbridge.redvex.io/privacy

## Homepage URL

https://github.com/redvex/browser-bridge
