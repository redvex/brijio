---
type: "Reference"
title: "Browser Action and Tool Catalog"
description: "The agent-facing MCP tool, resource, and prompt surface of Brijio: read tools, action tools, batch, upload, download, fetch, screenshot, and the shared error-code model agents see."
tags:
  [
    "mcp",
    "tools",
    "browser-actions",
    "catalog",
    "batch",
    "screenshot",
    "downloads",
    "skills",
  ]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-17T11:58:52.754Z
sources:
  - id: openwiki-source-985a8c577ad91500d47d089f
    resource: repo://docs/architecture/decisions/0046-agent-sourced-file-upload-action.md
  - id: openwiki-source-fa0ef08f9e7df2be74f39e59
    resource: repo://docs/architecture/decisions/0047-download-awareness.md
  - id: openwiki-source-992a62d4a0e989fc2da546d0
    resource: repo://docs/architecture/decisions/0048-client-side-action-approval.md
  - id: openwiki-source-92452913749f06d1d45cbf40
    resource: repo://docs/architecture/decisions/0061-forward-error-codes-through-mcp.md
  - id: openwiki-source-79dd91ec51a55e7e78c52ccc
    resource: repo://docs/architecture/decisions/0064-visual-action-verification.md
  - id: openwiki-source-9b8357af9c7ef75912f57765
    resource: repo://docs/project/CAPABILITY_MATRIX.md
  - id: openwiki-source-5524638d57e96598fd8e40d4
    resource: repo://packages/shared/src/background-controller.ts
  - id: openwiki-source-d0197860041da5ce4f4f84ca
    resource: repo://servers/mcp/skills/form-filling/SKILL.md
  - id: openwiki-source-5ed33ac94d61e6c5b4d5710f
    resource: repo://servers/mcp/src/batch-tool.ts
  - id: openwiki-source-f5342d53607dcbe9ba36091b
    resource: repo://servers/mcp/src/form-action-tools.ts
  - id: openwiki-source-36c61251055ea6d2f82f0b4e
    resource: repo://servers/mcp/src/mcp-server.ts
  - id: openwiki-source-0e497abc3e4b543baa3c63c2
    resource: repo://servers/mcp/src/page-actions.ts
  - id: openwiki-source-48d3485f346966d1c44c7ea7
    resource: repo://servers/mcp/src/protocol.ts
  - id: openwiki-source-13054dea741b794a82597d0c
    resource: repo://servers/mcp/src/skills.ts
generated: { by: "openwiki/0.7.2", at: "2026-10-17T11:58:52.754Z" }
---

# Browser Action and Tool Catalog

Brijio exposes its browser-driving capability to AI agents through a set of MCP
tools, MCP resources, one MCP prompt, and a library of skill documents. Every
tool call is an explicit request — there is no streaming or background
automation — and every tool resolves to either a structured result or a
forwarded error. This page is the catalog of that surface and the behavior
agents and implementers can rely on. The transport path (MCP tool wrapper →
WebSocket relay → extension background) is traced in
[Architecture: MCP ↔ WebSocket ↔ Extension flow](../architecture/mcp-extension-flow.md);
per-call tab targeting is covered in [Multi-tab workflow](multi-tab.md).
Support status for each capability is governed by the
[Capability Matrix](../../docs/project/CAPABILITY_MATRIX.md), which is the
single source of truth for what Brijio can and cannot do.

## How a tool call flows

Each tool is registered in `createBrijioMcpServer` with a Zod input schema and a
handler that logs the call, delegates to a tool module for input normalization,
and serializes the result. Tool modules live in `servers/mcp/src/*-tool.ts` and
`servers/mcp/src/form-action-tools.ts`; they validate and normalize inputs, then
call helpers in `servers/mcp/src/page-actions.ts` (or `page-context.ts` for
reads). Those helpers build WebSocket request options from a
`BrijioPageActionsConfig` — `websocketUrl`, `pairingToken`, `timeoutMs`, and
optional `approvalTimeoutMs` — and send them over the WebSocket client to the
connected extension. Results return through the same chain as a discriminated
union: `{ ok: true, data }` or `{ ok: false, error: { code, message, detail? } }`.

<!-- openwiki: mermaid parse failed and this diagram was converted to a text fence so it does not break rendering. Fix the diagram source and restore the mermaid fence. Parser error: Heuristic: an unescaped angle bracket inside a label breaks rendering; rephrase the label. -->

```text
flowchart TD
  Call["Agent calls MCP tool"] --> Handler["mcp-server.ts handler<br/>parses Zod input"]
  Handler --> Module["*-tool.ts module<br/>normalizes input"]
  Module --> Actions["page-actions.ts / page-context.ts<br/>builds WS request options"]
  Actions --> WSC["websocket-client.ts<br/>auth + send envelope"]
  WSC --> Ext["Extension background controller<br/>approval gate + tab resolution"]
  Ext --> Result["structured result or forwarded error"]
  Result --> WSC
  WSC --> Handler
  Handler --> Agent["serialized tool result to agent"]
```

The config object is the seam that lets tests inject mock request functions:
every `request*` helper in `page-actions.ts` has a default that calls the
WebSocket client, but `BrijioPageActionsConfig` lets a caller override it. The
same seam carries `defaultBrowserInstanceId` and `defaultTabId` so tools can fall
back to a configured target when the agent omits `browserInstanceId`/`tabId`.

## Read tools

Read tools never mutate the browser. They are the only tools whose results
agents should treat as the source of element identity for subsequent actions.

| Tool                | Purpose                                                                            | Key inputs                                                       |
| ------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `list_browsers`     | List Brijio browser instances currently online for the configured pairing token.   | (none)                                                           |
| `read_current_page` | Read the current page context and optional readable content chunks.                | `includeContent`, `maxContentChunks` (1–10), `startContentIndex` |
| `list_tabs`         | List open tabs for a connected browser, with tab/window/title/URL/active metadata. | `browserInstanceId`, `tabId` (filter)                            |

`read_current_page` returns the structured page context — URL, title, headings,
links, forms, editables, actions, and a content preview — plus an optional
`nextContentIndex` for paginated content. Agents use the element IDs from this
context as targets for action tools. Those IDs are short-lived (see
[Short-lived target IDs](#short-lived-target-ids)).

## Action tools

Action tools mutate the page. They share a common targeting model and a common
set of stale-context guards.

| Tool                 | Purpose                                                                    | Key inputs                                                                     |
| -------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `navigate_to_url`    | Navigate the active tab to an HTTP(S) URL; returns final URL/title/status. | `url`                                                                          |
| `open_tab`           | Open a new tab at an HTTP(S) URL; returns the new `tabId`.                 | `url`                                                                          |
| `click_element`      | Click a visible link or button-like action.                                | `kind` (`link`/`action`), `id`, `expectedText`, `expectedHref`, `expectedRole` |
| `fill_input`         | Write text into a visible form control.                                    | `formId`, `controlId`, `text`, `expectedLabel`                                 |
| `fill_editable`      | Write text into a visible contenteditable target.                          | `id`, `text`, `expectedText`                                                   |
| `set_checked`        | Set a checkbox or select a radio option.                                   | `formId`, `controlId`, `checked`, `expectedLabel`                              |
| `select_options`     | Select option values in a visible select control (single or multi).        | `formId`, `controlId`, `values`                                                |
| `submit_form`        | Submit a visible form with browser validation.                             | `formId`, `expectedLabel`                                                      |
| `upload_file`        | Upload base64-encoded bytes into a visible file input.                     | `formId`, `controlId`, `dataBase64`, `fileName`, `mimeType`                    |
| `perform_batch`      | Execute up to 20 explicit actions in one request.                          | `actions[]`, `continueOnError`, `readAfterActions`                             |
| `capture_screenshot` | Capture a JPEG viewport screenshot of the active tab.                      | (none beyond targeting)                                                        |

Every action tool also accepts the targeting pair `browserInstanceId` and
`tabId` and the stale-context guards `pageContextId` and `visibleContextId`.

### Short-lived target IDs

Element targets discovered in a `read_current_page` response — links/actions
(`a1`, `e5`), form controls (`f2` + `controlId`), editables — are **short-lived**.
They expire when the page navigates or the DOM mutates. This is intentional:
agents must re-read page context after any navigation or DOM update before
acting again. Acting against a stale target fails with `stale_context`
(detailing the expected vs. found state) or `page_navigated`.

### Stale-context guards

Action tools accept two optional guards:

- `pageContextId` — a page-context version from the last read. If the page has
  navigated since, the action fails with `page_navigated`.
- `visibleContextId` — a visible form-state ID from the last read. If the
  visible form state changed, the action fails with `stale_context`.

These let an agent detect that its snapshot is out of date without guessing.

### Blocked inputs

`fill_input` returns `browser_error` for `type="password"` fields, and for
readonly or disabled inputs. These are deliberate security and correctness
boundaries, not bugs: the browser is the source of truth for authenticated
state and credentials never flow through Brijio. The `brijio-context` prompt
reinforces these pitfalls.

### File upload (ADR 0046)

`upload_file` is agent-sourced: the agent posts base64-encoded bytes and
metadata (`fileName`, `mimeType`) rather than a local path, because the agent
and MCP server may run on different machines. `stageUploadFilePayload` decodes
the base64, measures the decoded size, and enforces a maximum upload size
(`BRIJIO_UPLOAD_MAX_BYTES`, default 10 MiB) before staging a `FileUploadPayload`
(`contentBase64`, `sizeBytes`, `lastModified`) for the extension. The content
script materializes a browser `File` object via `DataTransfer` and assigns it
to the target `<input type="file">`. `upload_file` is also a valid batch action
type.

### Batch (ADR 0044)

`perform_batch` executes a sequence of explicit actions in one request. It is
the only way to combine multiple mutations atomically from the agent side.

- **Up to 20 actions.** The schema enforces `actions.min(1).max(20)` and the
  tool module re-validates `MAX_BATCH_ACTIONS = 20`.
- **Action types.** Valid batch action types are `click`, `write_text`,
  `set_checked`, `select_options`, `submit_form`, and `upload_file`. Reads are
  not arbitrary batch steps.
- **Per-action results and partial failures.** Each action produces its own
  result entry; a failing action does not erase prior successes.
- **`continueOnError`.** When `false` (the default), execution stops on the
  first error. When `true`, execution continues and errors are reported
  per-action.
- **Navigation aborts the batch.** If an executed action navigates the page, the
  top-level result is `aborted` and remaining actions are not attempted, because
  previously read page IDs may no longer be valid. Agents should re-read the
  page and retry.
- **`readAfterActions` is the only read.** When `true`, the batch reads page
  context once after all actions complete — this is the only read the batch
  performs. Batches remain explicit tool calls, not background automation.
- **Upload staging in batches.** Batch `upload_file` items are staged via
  `stageUploadFilePayload` before the batch is sent, so the same size and base64
  validation applies.

### Approval-gated actions

Three operations require explicit, in-browser user approval before they execute:
`submit_form`, `fetch_resource`, and `download_file`. The approval gate lives
inside the extension background controller, not the MCP server. The MCP server's
only approval responsibilities are assigning a unique `actionUUID` to each
gated action (and to every batch item), setting `approvalRequest: true` on gated
actions, and surfacing structured approval errors. See
[Client-side Action Approval](../architecture/action-approval.md) for the full
flow; do not bypass approval. Inside a batch, only `submit_form` is
approval-gated (`fetch_resource` and `download_file` are standalone tools, not
batch actions), and a per-item denial is recorded as `approval_denied` while the
batch continues.

## Download and fetch tools

These tools expose the browser's session and download manager to the agent. Per
ADR 0047, observation, save-to-disk, and authenticated fetch are separate
concerns with separate risk profiles.

| Tool              | Purpose                                                                    | Approval | Notes                                                                                                                                                                                          |
| ----------------- | -------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `download_status` | Poll for the state of downloads/fetches by ID or all session items.        | no       | Returns a `capability` of `"full"` or `"not_supported"`; Safari returns `"not_supported"` with an empty items list.                                                                            |
| `download_file`   | Initiate a download to the user's Downloads folder.                        | **yes**  | Chrome/Firefox use `chrome.downloads` and return a `downloadId`; Safari uses a content-script `<a download>` click and returns `status: "initiated_fire_and_forget"` with a null `downloadId`. |
| `fetch_resource`  | Fetch a URL using the browser's session cookies/auth; stream content back. | **yes**  | High-risk: exfiltrates session-protected content to the agent. Safari/cross-origin failures return `cors_blocked` honestly.                                                                    |

`download_file` accepts a `url`, optional `filename`, and optional
`conflictAction` (`"uniquify"` or `"overwrite"`). `fetch_resource` accepts a
`url`, optional `maxSizeBytes`, and optional `fetchTimeout`; its result includes
`fetchId`, `contentType`, `totalBytes`, `sha256`, and `dataBase64`. Because
Brijio is strictly request/response, the agent polls `download_status` for
progress rather than receiving push events.

## Screenshot (ADR 0064)

`capture_screenshot` captures a viewport screenshot of the **active tab only**
and returns it as JPEG (quality 80) base64 image content plus a text block with
`width`, `height`, `tabId`, and `capturedAt`. Full-page scroll-stitch and
background-tab capture are intentionally out of scope: capturing a background
tab would require switching focus (user-disruptive), and the browser only
captures the visible tab. On failure it returns a structured error
(`capability_not_supported`, `capture_failed`, `no_visible_tab`, or `timeout`)
with `isError: true`. It requires a vision-capable model to interpret.

## MCP resources

Resources are read-only surfaces exposed through MCP resource URIs.

| Resource               | URI                                      | Purpose                                                        |
| ---------------------- | ---------------------------------------- | -------------------------------------------------------------- |
| `current-page-context` | `browser://page/current`                 | Same structured context as `read_current_page`, as a resource. |
| `current-page-content` | `browser://page/current/content/{index}` | Paginated normalized readable content, by 1-based chunk index. |
| `skill://{name}`       | `skill://brijio/{name}`                  | Full markdown body of a Brijio skill.                          |

The `current-page-content` template URI is a `ResourceTemplate`; its `{index}`
is parsed by `parsePageContentResourceIndex` and used to fetch a specific
content chunk.

## Skills and the brijio-context prompt

Skills are detailed workflow guides, loaded from
`servers/mcp/skills/<name>/SKILL.md` by `loadSkills` in
`servers/mcp/src/skills.ts`. Each skill directory contains a `SKILL.md` with
optional YAML frontmatter (`name`, `description`) and an H1 title; `loadSkills`
parses the frontmatter, extracts the title from the first H1, falls back to the
directory name for the skill `name`, and sorts skills alphabetically. At server
startup every loaded skill is registered as an MCP resource at
`skill://brijio/{name}` (mime type `text/markdown`) so any MCP client can
discover and read the full instructions.

The `brijio-context` prompt (`server.registerPrompt`) injects a session-start
orientation message built by `buildContextMessage`: it instructs the agent to
call `list_browsers` for connected browsers, `list_tabs` for multi-tab
targeting, and `read_resource` with the `skill://brijio/{name}` URI format, then
lists every skill's title, name, and description, and finally enumerates the
key pitfalls:

- **Password fields** return `browser_error` — skip them.
- **Radio buttons** cannot be unchecked — select a different option.
- **Readonly/disabled inputs** return `browser_error` — skip them.
- **Short-lived IDs** expire on navigation/DOM change — re-read the page.
- **Never auto-submit** — ask the user to review and submit, unless explicitly
  asked to submit.
- **Multiple browsers** — always specify `browserInstanceId`.
- **Tab targeting** — without a `tabId`, tools act on the active tab; call
  `list_tabs` and pass `tabId` for a specific background tab.

The shipped skills are: `accessibility`, `comparison`, `data-extraction`,
`ecommerce`, `form-filling`, `monitoring`, `navigation`, `onboarding`,
`using-brijio`, and `web-qa`.

## Error-code model

Tool results use a discriminated union. On failure the `error.code` is a
`BrijioErrorCode` string. The locally-defined union includes `auth_required`,
`auth_failed`, `invalid_auth_message`, `browser_unavailable`,
`ambiguous_browser_target`, `invalid_browser_target`, `connection_failed`,
`timeout`, `invalid_response`, `browser_error`, `batch_failed`,
`stale_context`, `page_navigated`, `invalid_resource_uri`, and
`unsupported_scheme`. Per ADR 0061, error codes and messages from the WebSocket
server and extension are **forwarded as-is** rather than collapsed to
`browser_error`: the router-level parser passes through any string `code` and
`message`, and the action-level parser preserves `stale_context` and
`page_navigated` (with their structured `StaleContextDetail`) while passing
through other original codes. The agent therefore sees the specific cause
(`cors_blocked`, `not_supported`, `capability_not_supported`, `size_exceeded`,
approval codes) instead of a generic message.

Approval adds four action error codes: `approval_denied`, `approval_timeout`,
`approval_unavailable`, and `approval_origin_changed`; these are documented in
[Client-side Action Approval](../architecture/action-approval.md).

## What to update when tool behavior changes

When a tool's behavior changes, keep the surface coherent by updating together:

1. the tool module and `page-actions.ts`/`page-context.ts` behavior;
2. the MCP registration in `servers/mcp/src/mcp-server.ts` (schema, description);
3. relevant tests (e.g. `*-tool.test.ts`, `form-action-tools.test.ts`);
4. the affected skill(s) under `servers/mcp/skills/`;
5. the [Capability Matrix](../../docs/project/CAPABILITY_MATRIX.md) (the
   support-status authority); and
6. this page.

## Related docs

- [Architecture: MCP ↔ WebSocket ↔ Extension flow](../architecture/mcp-extension-flow.md)
- [Client-side Action Approval](../architecture/action-approval.md)
- [Protocol and Data Model Guide](../data-and-protocol.md)
- [Multi-tab workflow](multi-tab.md)
- [Capability Matrix](../../docs/project/CAPABILITY_MATRIX.md)
