---
okf_version: "0.2"
---

# Files

- [Architecture Overview](architecture.md) - Brijio runtime architecture: the MCP server, WebSocket relay, shared package, and browser extensions, the explicit request/response chain, why this architecture exists, and per-layer change guidance.
- [Protocol and Data Model Guide](data-and-protocol.md) - Canonical OpenWiki reference for the shared Brijio protocol shapes: the WebSocket envelope, auth and presence, browser capabilities, tab targeting, page context/content, downloads, fetch, screenshot, action approval, and error-code forwarding.
- [Major Domains](domains.md) - The major source domains in the Brijio monorepo and their ownership boundaries, so agents keep changes in the right layer and update shared contracts before dependents.
- [OpenWiki Quickstart](quickstart.md) - Entry point for the Brijio OpenWiki knowledge base. States what the repository is, how the MCP-WebSocket-extension pieces fit, and routes readers to the architecture, workflow, domain, and security pages by task type.
- [Security and Trust Model](security.md) - Brijio security posture: core trust assumptions, security goals, threat classes, the client-side action-approval control, explicit non-goals, and change guidance for auth/routing/browser-state exposure.
- [Workflows](workflows.md) - Repo-level development and operations workflows: common pnpm commands, per-domain verification sets, the daemon/operations lifecycle, protocol and browser-targeting change patterns, and AGENTS.md conventions.

# Directories

- [architecture](architecture/)
- [workflows](workflows/)
