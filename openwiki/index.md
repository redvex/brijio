---
okf_version: "0.2"
---

# Files

- [Architecture Overview](architecture.md) - Brijio runtime architecture: MCP server, WebSocket relay, shared package, and browser extensions. Covers the explicit request/response chain and change guidance by layer.
- [Protocol and Data Model Guide](data-and-protocol.md) - Canonical reference for the shared WebSocket protocol shapes: envelope, roles, auth, browser presence and capabilities, tab listing, page reading, actions, batch, navigation, file uploads, and download/fetch status.
- [Major Domains](domains.md) - The major source domains in the Brijio monorepo (shared protocol, WebSocket relay, MCP server, browser extensions, product framing, security, docs/history) and the cross-domain change ordering rule.
- [OpenWiki Quickstart](quickstart.md) - Entry point for the Brijio OpenWiki knowledge base. Covers what the repository is, the MCP-WebSocket-extension runtime path, and a task-routing map into the rest of the wiki.
- [Security and Trust Model](security.md) - Brijio security posture: core trust assumptions, security goals, trust boundaries, threat classes, explicit non-goals, and change guidance for authentication, routing, and browser-state exposure.
- [Workflows](workflows.md) - Repo-level development workflows: common pnpm commands, per-domain verification, protocol and browser-targeting change patterns, the ADR/TDD workflow from AGENTS.md, and OpenWiki navigation.

# Directories

- [architecture](architecture/)
- [workflows](workflows/)
