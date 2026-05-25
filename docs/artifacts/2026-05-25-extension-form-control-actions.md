# Extension Form Control Actions

## Summary

BrowserBridge now implements ADR 0016 for the Chrome extension action surface.
The extension can perform additional explicit form-control actions over the
existing `perform_action` WebSocket protocol while the user-started bridge is
active.

## Behavior

Supported action types:

- `click`
- `write_text`
- `set_checked`
- `select_options`
- `submit_form`

`write_text` now supports visible text/value-entry controls:

- `textarea`
- implicit text inputs
- `text`, `search`, `email`, `url`, `tel`, `number`
- `date`, `time`, `datetime-local`, `month`, `week`
- `color`, `range`
- plain text replacement for visible contenteditable targets discovered in page
  context

`set_checked` supports checkboxes and selecting radio options. Radio buttons are
selected by setting one option to `checked: true`; clearing a radio directly is
not supported.

`select_options` supports single-select and multi-select controls using option
values exposed in page context.

`submit_form` resolves a visible form by short-lived form ID and uses
`requestSubmit()` so browser validation and submit events are preserved.

## Page Context

Page context now includes additional metadata for form actions:

- `readonly` for readonly controls.
- `checked` for checkbox and radio controls.
- `multiple` and `options` for select controls.
- `structure.editables[]` for visible contenteditable text targets.
- visible `input[type="reset"]` in `structure.actions[]` so reset remains a
  deliberate click action instead of a new reset protocol.

BrowserBridge still does not expose current text values for text inputs,
password fields, textareas, or contenteditable elements.

## Security Boundary

The extension still acts only after an explicit WebSocket request while the
user-controlled bridge is connected. Targets are short-lived IDs from explicit
page context reads.

The implementation intentionally excludes:

- password fields
- file inputs
- hidden controls
- CSS selectors, XPath, label queries, coordinates, keyboard simulation, paste,
  hover, drag, and multi-step automation
- rich HTML insertion into contenteditable surfaces
- storage of page content, written text, selected values, or action history

## Verification

Added test coverage for:

- new `perform_action` protocol variants
- page-context readonly, checked, select option, reset action, and editable
  metadata
- background routing for `set_checked`, `select_options`, and `submit_form`
- extended `write_text` input support
- contenteditable writes
- checkbox and radio checked-state changes
- select option updates and missing-option errors
- form submission through `requestSubmit()`
