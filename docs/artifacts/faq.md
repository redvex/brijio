# FAQ

## Does Brijio continuously stream browser data?

No. Brijio is request-driven. The browser extension responds to explicit MCP
tool calls while the user-controlled bridge is connected. It does not publish a
continuous page snapshot in the background.

## When is the browser connected?

Only after you click **Connect** in the extension. Clicking **Disconnect** closes
the WebSocket connection and stops browser access.

## Does Brijio require a cloud account?

No. The first implementation is local-first. The MCP runtime and WebSocket
server run on your machine or network, and the browser extension connects to
that runtime.

## What can an agent do through Brijio?

An agent can request page context, read page content, click visible targets,
fill inputs, submit forms, navigate to URLs, and inspect or start supported
downloads through explicit MCP tools.

## Can Brijio access every browser page?

No. Browser and extension restrictions still apply. Brijio rejects unsupported
schemes such as browser-internal pages, extension pages, and local files.

## How does Brijio choose a browser?

The runtime can list online browser instances. If exactly one browser is
connected, tools can route automatically. If multiple browsers are connected,
the caller can provide a browser instance ID.

## Where are tokens stored?

The daemon stores local configuration in `~/.brijio/.env`. The extension stores
its connection settings locally in browser storage.

## Is page content stored by Brijio?

No persistent page-content storage is part of the current design. Page content
is returned to the requesting MCP client for the explicit request that asked for
it.
