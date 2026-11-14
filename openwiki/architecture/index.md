# Files

- [Browser Extension Adapters](extension-adapters.md) - The Chrome, Safari, and Firefox adapter contracts that wrap the shared BrijioBackgroundController through platform-specific ActiveTabDeps, approval, tab-listing, screenshot, download, and open-tab seams.
- [MCP to WebSocket to Extension Flow](mcp-extension-flow.md) - End-to-end runtime path from an MCP tool call through the WebSocket relay to the browser extension and back, covering tab targeting, request IDs, timeouts, approval gating, error forwarding, and canonical source files.
- [MCP Tool and Skill Surface](mcp-tool-surface.md) - The agent-facing MCP surface exposed by the Brijio MCP server: registered tools, page-context/content resources, the brijio-context prompt, the skills system, common targeting inputs, structured results, and error forwarding.
