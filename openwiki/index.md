---
okf_version: "0.2"
---

# Files

- [Architecture Overview](architecture.md) - Brijio runtime architecture: the Agent -> MCP Server -> WebSocket Relay -> Browser Extension -> Browser Session chain, core components, request/response flow, and change guidance by layer.
- [Protocol and Data Model Guide](data-and-protocol.md) - Canonical reference for shared data structures and protocol shapes: WebSocket envelope, auth and presence, browser capabilities, tab listing, file uploads, download/fetch status, and screenshots.
- [Major Domains](domains.md) - The seven major source domains in the Brijio monorepo and their ownership boundaries, so agents keep changes scoped to the correct layer.
- [OpenWiki Quickstart](quickstart.md) - Entry point for the Brijio OpenWiki knowledge base. Frames what the repository is, how the MCP-WebSocket-extension pieces fit, and routes readers to the correct deeper page by task type.
- [Security and Trust Model](security.md)
- [Workflows](workflows.md) - Repo-level development workflows: common pnpm and Make commands, per-domain verification sets, dev server lifecycle, Docker validation, integration test harness, and AGENTS.md ADR/TDD conventions.

# Directories

- [architecture](architecture/)
- [workflows](workflows/)
