# Files

- [Client-Side Action Approval Workflow](action-approval.md) - The approval-gated action workflow (ADR 0048): which operations require user approval, the actionUUID/approvalRequest protocol, session-scoped grants, the approval banner UI, and the in-memory-only approval state that clears on disconnect.
- [Multi-tab Workflow](multi-tab.md) - How agents use explicit per-call tabId targeting for reads, actions, batch operations, and navigation — the list_tabs/open_tab/read pattern, active-tab fallback, and re-reading context after navigation.
