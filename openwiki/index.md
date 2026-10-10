---
okf_version: "0.2"
---

# Files

- [Architecture Overview](architecture.md) - Brijio runtime architecture: the Agent -> MCP server -> WebSocket relay -> browser extension -> browser session chain, the four owned systems, and which layer owns which behavior.
- [Protocol and Data Model Guide](data-and-protocol.md) - Canonical reference for the shared protocol shapes in packages/shared: WebSocket envelope with explicit per-call tabId targeting, browser presence and capabilities, tab listing, open_tab, capture_screenshot, file uploads, download/fetch status, and the structured ToolResult error model.
- [Major Domains](domains.md) - The owned source domains of the Brijio monorepo (shared protocol/logic, WebSocket relay, MCP server, browser extensions, product framing, security, docs/history) and the practical rule for cross-domain changes.
- [Operations: Daemon, CLI, and Health](operations.md) - How Brijio is run and operated as a service: the brijio CLI command surface, daemon install lifecycle, env/config resolution, health endpoints, diagnostics, startup banner, and Docker deployment.
- [OpenWiki Quickstart](quickstart.md) - Entry point for the Brijio OpenWiki knowledge base. Covers what the repository is, how the MCP-WebSocket-extension pieces fit together, the tool surface, and where to go next by task.
- [Security and Trust Model](security.md) - Brijio security posture: trust assumptions, security goals, threat classes, explicit non-goals, client-side action approval, and the explicit-only screenshot boundary.
- [Workflows](workflows.md) - Repo-level development workflows: common pnpm commands, per-domain verification patterns, protocol/tab-targeting/screenshot change patterns, and AGENTS.md ADR/TDD conventions.

# Directories

- [architecture](architecture/)
- [workflows](workflows/)
