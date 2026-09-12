---
okf_version: "0.2"
---

# Files

- [Architecture Overview](architecture.md) - Brijio runtime architecture: MCP server, WebSocket relay, shared package, and browser extensions. Covers the explicit request/response chain, the full MCP tool surface, and change guidance by layer.
- [Protocol and Data Model Guide](data-and-protocol.md) - Canonical reference for the shared WebSocket protocol: envelope, browser presence and capabilities, tab listing, action and batch requests, open-tab, screenshot, download, and fetch message shapes.
- [Major Domains](domains.md) - The seven major source domains in the Brijio monorepo: shared protocol, WebSocket relay, MCP server, browser extensions, product framing, security, and docs/history.
- [OpenWiki Quickstart](quickstart.md) - Entry point for the Brijio OpenWiki knowledge base. Covers what the repository is, how the MCP-WebSocket-extension chain fits together, and where to go next for each task type.
- [Security and Trust Model](security.md) - Brijio security posture: core trust assumptions, security goals, threat classes, the four trust boundaries, explicit non-goals, the explicit-screenshot-vs-continuous-screenshot boundary, download/fetch risk profile, and change guidance for authentication, routing, and browser-state exposure.
- [Workflows](workflows.md) - Repo-level development workflows: common pnpm commands, verification patterns per domain, protocol and browser-targeting change patterns, AGENTS.md conventions, and the daemon/operations surface.

# Directories

- [architecture](architecture/)
- [workflows](workflows/)
