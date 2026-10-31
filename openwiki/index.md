---
okf_version: "0.2"
---

# Files

- [Architecture Overview](architecture.md) - Brijio runtime architecture: the explicit Agent -> MCP Server -> WebSocket Relay -> Browser Extension -> Browser Session chain, component ownership, and change guidance by layer.
- [Protocol and Data Model Guide](data-and-protocol.md)
- [Major Domains](domains.md) - The major source domains in the Brijio monorepo and their ownership boundaries: shared protocol/logic, WebSocket relay, MCP server, browser extensions, product framing, security, docs/history, and operations.
- [Operations: Daemon, Config, and Health](operations.md)
- [OpenWiki Quickstart](quickstart.md) - Entry point for the Brijio OpenWiki knowledge base. Covers what the repository is, how the MCP-WebSocket-extension pieces fit together, and where to go next by task.
- [Security and Trust Model](security.md) - Brijio security posture: core trust assumptions, security goals, threat classes, explicit non-goals, the client-side action-approval invariant, and change guidance for auth/routing/browser-state exposure.
- [Workflows](workflows.md) - Repo-level development workflows: common pnpm commands, per-domain verification, the AGENTS.md ADR/TDD change workflow, and protocol, browser-targeting, and approval-gated change patterns.

# Directories

- [architecture](architecture/)
- [workflows](workflows/)
