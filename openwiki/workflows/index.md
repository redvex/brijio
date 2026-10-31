# Files

- [Client-Side Action Approval](action-approval.md) - How approval-gated browser actions (submit_form, fetch_resource, download_file) thread actionUUID and approvalRequest from the MCP server through the extension, hold in-memory approval state, time out before the HTTP request deadline, and never bypass the user.
- [Multi-tab Workflow](multi-tab.md) - How agents use explicit per-call tabId targeting for reads, actions, batch operations, and navigation, plus the list_tabs and open_tab tools and the recommended multi-tab workflow.
