---
okf_version: "0.2"
---

# Files

- [Architecture Overview](architecture.md) - Brijio runtime architecture — the explicit Agent -> MCP server (StreamableHTTP) -> WebSocket relay -> browser extension -> browser session chain, the four core components, core invariants, and change guidance by layer.
- [Protocol and Data Model Guide](data-and-protocol.md) - Canonical reference for the shared data structures and protocol shapes that cross the relay, MCP server, and browser extensions: the WebSocket envelope, presence and capabilities, tab listing, action and batch payloads, file-upload staging, download/fetch and screenshot results, and forwarded error codes.
- [Major Domains](domains.md) - The owned source domains of the Brijio monorepo — shared protocol/logic, WebSocket relay, MCP server, browser extensions, product framing, security, and docs/ADR history — and the rule that cross-domain changes propagate shared-protocol -> relay -> MCP surface -> shared controller -> Chrome/Safari adapters -> tests.
- [OpenWiki Quickstart](quickstart.md) - Entry point for the Brijio OpenWiki knowledge base — what the repository is, the Agent -> MCP server -> WebSocket relay -> browser extension -> browser session chain, and where to go next by task.
- [Security and Trust Model](security.md) - Brijio security posture: core trust assumptions, security goals, four threat classes, architectural mitigations, approval-gated high-risk tools, credential-extraction boundaries, explicit non-goals, and change guidance.
- [Development Workflows](workflows.md) - Repo-level development workflows: common pnpm commands, per-package verification commands, the AGENTS.md ADR/TDD conventions, and change patterns to watch (protocol/schema, browser-targeting, extension UI/manifest, demo/docs).

# Directories

- [architecture](architecture/)
- [operations](operations/)
- [workflows](workflows/)
