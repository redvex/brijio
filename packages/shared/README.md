# @browserbridge/shared

Shared TypeScript types and protocol message schemas for BrowserBridge.

This package is the source of truth for messages exchanged between:

- `servers/websocket`
- `servers/mcp`
- `clients/extensions/chrome`

Initial schema work should cover:

- `extension_connected`
- `get_status`
- `status_response`
- `get_page_context`
- `page_context_response`
- `perform_action`
- `action_result`
- `error`

Do not duplicate protocol definitions in server or client packages. Add shared
types here first, then consume them from the runtime packages.
