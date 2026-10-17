# Files

- [Client-Side Action Approval](action-approval.md) - The client-side approval flow for selected browser-mutating MCP operations: which actions require approval, the actionUUID and approvalRequest protocol, in-memory session grants, denial/timeout/origin-change errors, and why approval state lives only in the extension background.
- [MCP ↔ WebSocket ↔ Extension Flow](mcp-extension-flow.md) - End-to-end runtime path of a single agent request: MCP tool wrapper builds a protocol envelope, WebSocket relay forwards to the extension, shared background controller dispatches to page-reader/action handlers, browser adapter performs tab-level work, and structured result or forwarded error code returns to the agent.
