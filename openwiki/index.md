---
okf_version: "0.2"
---

# Files

- [Architecture Overview](architecture.md) - Brijio runtime architecture — the Agent → MCP Server → WebSocket relay → Browser extension → Browser session chain, core component ownership, and cross-layer change guidance.
- [Protocol and Data Model Guide](data-and-protocol.md) - Canonical reference for the WebSocket envelope, auth/presence, browser capabilities, tab listing, page context/content models, form control state, action and batch messages, file uploads, downloads/fetch, screenshots, and action error codes.
- [Major Domains](domains.md) - The major source domains in the Brijio monorepo and their ownership boundaries, so agents keep changes scoped and respect the shared-protocol-first change order.
- [OpenWiki Quickstart](quickstart.md) - Entry point for the Brijio OpenWiki knowledge base. States what the repository is, how the MCP-WebSocket-extension pieces fit together, and routes readers to the right page by task type.
- [Security and Trust Model](security.md) - Brijio security posture: core trust assumptions, security goals, threat classes, explicit non-goals, the client-side action approval trust boundary, and change guidance for authentication, routing, and browser-state exposure.
- [Testing Strategy](testing.md) - How Brijio is tested across packages — Node built-in test suites, shared protocol/controller/content tests, the MCP tool and full-stack WS+MCP integration harness, and per-browser extension tests with injected fakes.
- [Workflows](workflows.md) - Repo-level development workflows: top-level and per-package pnpm commands, the smallest-verification-set principle and CI-matching set, shared-protocol-first change order, and ADR/TDD conventions from AGENTS.md.

# Directories

- [architecture](architecture/)
- [operations](operations/)
- [workflows](workflows/)
