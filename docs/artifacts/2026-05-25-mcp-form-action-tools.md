# MCP Form Action Tools

## Summary

BrowserBridge now implements ADR 0017 for the MCP form action surface. The MCP
server exposes explicit tools for the ADR 0016 extension action messages that
were previously reachable only through direct WebSocket requests.

## Tools

New MCP tools:

- `fill_editable`
- `set_checked`
- `select_options`
- `submit_form`

Existing MCP tools remain available:

- `read_current_page`
- `click_element`
- `fill_input`

## Behavior

`fill_editable` sends a `perform_action` `write_text` request with a
`{ "kind": "editable", "id": "..." }` target from
`structure.editables[]`.

`set_checked` sends a `perform_action` `set_checked` request for checkbox and
radio controls discovered in `structure.forms[].controls[]`.

`select_options` sends a `perform_action` `select_options` request with option
values observed from page context.

`submit_form` sends a `perform_action` `submit_form` request with a
short-lived form ID.

The MCP layer validates tool input shape, creates the protocol envelope, sends
one WebSocket request, and returns the extension's structured result. Browser
semantics and target validation remain extension responsibilities.

## Verification Coverage

Added test coverage for:

- protocol envelope builders for `write_text` editable targets,
  `set_checked`, `select_options`, and `submit_form`
- action-result parsing for the new result shapes
- WebSocket client routing for each new action
- tool-module input validation and error propagation
- MCP SDK tool discovery and `tools/call` results for the new tools
