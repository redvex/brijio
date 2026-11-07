---
okf_version: "0.2"
---

# Files

- [Architecture Overview](architecture.md) - Brijio runtime architecture: the explicit Agent to MCP Server to WebSocket relay to Browser Extension to Browser Session chain, why it exists, which layer owns which behavior, and change guidance by layer.
- [Protocol and Data Model Guide](data-and-protocol.md) - Canonical reference for the shared data structures and protocol shapes in packages/shared: the WebSocket envelope, roles, auth/presence, browser capabilities, tab listing, page context/content, actions, batch, file uploads, downloads, fetch, screenshots, and forwarded error codes.
- [Major Domains](domains.md) - The seven major source domains of the Brijio monorepo and the cross-domain change rule: update shared protocol/ADR first, then relay/server, then browser adapters and integration tests.
- [OpenWiki Quickstart](quickstart.md) - Entry point for the Brijio OpenWiki knowledge base. Explains what the repository is, states the core reactive model, and routes readers to the right architecture, concept, workflow, or operations page for their task.
- [Security and Trust Model](security.md)
- [Development Workflows and Verification](workflows.md) - Repo-level development workflows: common pnpm commands, the per-package verification set to run after changes by domain, the ADR-required change workflow, TDD expectation, and testing strategy including the full-stack integration harness.

# Directories

- [architecture](architecture/)
- [concepts](concepts/)
- [operations](operations/)
- [workflows](workflows/)
