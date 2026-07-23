---
okf_version: "0.1"
---

# Files

- [Architecture Overview](architecture.md) - Brijio runtime architecture: MCP server, WebSocket relay, shared package, and browser extensions. Covers the explicit request/response chain and change guidance by layer.
- [Protocol and Data Model Guide](data-and-protocol.md) - Canonical reference for shared data structures and protocol shapes: WebSocket envelope, browser presence and capabilities, tab listing, file uploads, and download/fetch status.
- [Major Domains](domains.md) - The seven major source domains in the Brijio monorepo: shared protocol, WebSocket relay, MCP server, browser extensions, product framing, security, and docs/history.
- [OpenWiki Quickstart](quickstart.md) - Entry point for the Brijio OpenWiki knowledge base. Covers what the repository is, how the MCP-WebSocket-extension pieces fit together, and where to go next.
- [Security and Trust Model](security.md) - Brijio security posture: core trust assumptions, security goals, threat classes, explicit non-goals, and change guidance for authentication, routing, and browser-state exposure.
- [Workflows](workflows.md) - Repo-level development workflows: common pnpm commands, verification patterns per domain, protocol and browser-targeting change patterns, and AGENTS.md conventions.

# Directories

- [architecture](architecture/)
- [workflows](workflows/)
