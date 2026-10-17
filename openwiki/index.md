---
okf_version: "0.2"
---

# Files

- [Architecture Overview](architecture.md) - Brijio runtime architecture: the Agent→MCP→WebSocket→Extension→Browser chain, the four owned components, why the design rejects cloning and streaming, and which layer owns a given change.
- [Protocol and Data Model Guide](data-and-protocol.md) - Canonical reference for shared protocol shapes in packages/shared/src/protocol.ts: the WebSocket envelope, roles, auth and presence, browser capabilities, explicit per-call tabId targeting, staged file uploads, download/fetch status, screenshot capture, and the forwarded error-code model.
- [Major Domains](domains.md) - The major source domains and their ownership boundaries: shared protocol/browser-agnostic logic, WebSocket relay, MCP server, browser extensions, product framing, security/trust, docs/history, and the operations/CLI lifecycle.
- [CLI and Daemon Operations](operations.md)
- [OpenWiki Quickstart](quickstart.md) - Entry point for the Brijio OpenWiki knowledge base. States what the repo is, how the MCP-WebSocket-extension pieces fit, the user-controlled/privacy-first invariants, and routes readers to the architecture, workflow, operations, and security pages by task type.
- [Security and Trust Model](security.md) - Brijio security posture: trust assumptions, security goals, threat classes and mitigations, explicit non-goals, client-side action approval, minimal browser permissions, and change guidance for authentication, routing, and browser-state exposure.
- [Workflows](workflows.md)

# Directories

- [architecture](architecture/)
- [workflows](workflows/)
