# Files

- [Browser Action and Tool Catalog](browser-actions.md) - The agent-facing MCP tool, resource, and prompt surface of Brijio: read tools, action tools, batch, upload, download, fetch, screenshot, and the shared error-code model agents see.
- [Multi-tab Workflow](multi-tab.md) - How agents target specific browser tabs with per-call tabId: list_tabs to discover tabs, threading tabId into reads/actions/navigation, open_tab to create new tabs, and re-reading after navigation. Covers the active-tab fallback and where tabId is currently dropped.
