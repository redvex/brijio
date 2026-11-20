---
okf_version: "0.2"
---

# Files

- [Architecture Overview](architecture.md) - Brijio runtime architecture: the explicit Agent -> MCP Server -> WebSocket Relay -> Browser Extension -> Browser Session chain, why it exists, and change guidance by layer.
- [Protocol and Data Model Guide](data-and-protocol.md) - Canonical reference for shared data structures and protocol shapes: WebSocket envelope, roles, auth and presence, browser capabilities, tab listing, file uploads, download/fetch status, and error forwarding.
- [Major Domains](domains.md) - The major source domains in the Brijio monorepo and their ownership boundaries: shared protocol/logic, WebSocket relay, MCP server, browser extensions, product framing, security, and docs/history.
- [OpenWiki Quickstart](quickstart.md) - Entry point for the Brijio OpenWiki knowledge base. Explains what the repository is, how the MCP-WebSocket-extension pieces fit together, and routes readers to the architecture, domain, workflow, operations, security, and testing pages by task.
- [Security and Trust Model](security.md) - Brijio security posture: core trust assumptions, security goals, threat classes, explicit non-goals, client-side action approval, browser permissions, and change guidance for authentication, routing, and browser-state exposure.
- [Testing](testing.md) - Testing strategy and harness for Brijio — per-package unit tests co-located with source, an end-to-end integration test harness, demo/marketing layout tests, and TDD + smallest-verification-set conventions from AGENTS.md.
- [Workflows](workflows.md) - Repo-level development workflows: common pnpm commands, verification patterns per domain, protocol and browser-targeting change patterns, and AGENTS.md conventions.

# Directories

- [architecture](architecture/)
- [operations](operations/)
- [workflows](workflows/)
