---
type: "Architecture surface"
title: "MCP Tool and Skill Surface"
description: "The agent-facing MCP surface exposed by the Brijio MCP server: registered tools, page-context/content resources, the brijio-context prompt, the skills system, common targeting inputs, structured results, and error forwarding."
tags:
  [
    "mcp",
    "tool-surface",
    "resources",
    "skills",
    "error-forwarding",
    "http-transport",
  ]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-14T14:46:23.462Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-92452913749f06d1d45cbf40
    resource: repo://docs/architecture/decisions/0061-forward-error-codes-through-mcp.md
  - id: openwiki-source-45ccf4ff163f6f2991c87ac1
    resource: repo://servers/mcp/README.md
  - id: openwiki-source-5766be9fdca091bba2930898
    resource: repo://servers/mcp/src/click-element-tool.test.ts
  - id: openwiki-source-1e871ebe65ae85a216285234
    resource: repo://servers/mcp/src/http-server.ts
  - id: openwiki-source-36c61251055ea6d2f82f0b4e
    resource: repo://servers/mcp/src/mcp-server.ts
  - id: openwiki-source-ac88caafdb9674d72e823a21
    resource: repo://servers/mcp/src/page-context.ts
  - id: openwiki-source-7c07f491a7b95deca63dcedd
    resource: repo://servers/mcp/src/page-reading-tool.ts
  - id: openwiki-source-13054dea741b794a82597d0c
    resource: repo://servers/mcp/src/skills.ts
generated: { by: "openwiki/0.9.0", at: "2026-11-14T14:46:23.462Z" }
---

# MCP Tool and Skill Surface

The Brijio MCP server (`servers/mcp`) is the only agent-facing boundary into the
user's browser. It registers MCP tools, resources, and a prompt on top of the
official TypeScript MCP SDK, then relays every request over a short-lived
WebSocket to the relay/extension described in
[MCP to WebSocket to Extension Flow](mcp-extension-flow.md). The server itself
holds no page state: it is a stateless translator between MCP tool/resource
calls and Brijio protocol envelopes. The canonical registration site is
`createBrijioMcpServer` in `servers/mcp/src/mcp-server.ts`; the canonical,
always-current tool list lives in [the MCP server README](../../../servers/mcp/README.md),
which this page summarizes rather than reproduces verbatim.

<!-- openwiki: mermaid parse failed and this diagram was converted to a text fence so it does not break rendering. Fix the diagram source and restore the mermaid fence. Parser error: Heuristic: an unescaped angle bracket inside a label breaks rendering; rephrase the label. -->

```text
flowchart TD
    Agent["AI Agent"] -->|MCP tool / resource call| Http["HTTP transport<br/>StreamableHTTP"]
    Http -->|connect per request| McpServer["createBrijioMcpServer<br/>registers tools, resources, prompt"]
    McpServer -->|normalize input, build envelope| Handlers["per-tool handlers<br/>page-actions.ts / page-context.ts"]
    Handlers -->|Brijio protocol envelope| WsClient["websocket-client.ts<br/>requestId, target, timeout"]
    WsClient -->|WebSocket| Relay["WS relay / extension"]
    Relay -->|structured result or forwarded error| WsClient
    WsClient -->|BrijioToolResult| McpServer
    McpServer -->|content text JSON or image| Http
    Http -->|JSON / image| Agent
```

One request flows through the MCP surface from agent HTTP call to a
`BrijioToolResult` returned as MCP content text.

## HTTP transport

The server is an HTTP server built on Node's `http.createServer`
(`servers/mcp/src/http-server.ts`). Each incoming request is handled by a
fresh `McpServer` connected to a `StreamableHTTPServerTransport` from the MCP
SDK; sessions are stateless (`sessionIdGenerator: undefined`,
`enableJsonResponse: true`). The server is created and closed per request, so
there is no shared long-lived MCP session across HTTP calls.

Boundary checks enforced before the SDK transport sees the request:

1. **Path match.** Only the configured `path` (default `/mcp`, from
   `MCP_HTTP_PATH`) is the MCP endpoint. `/health` answers `GET` with a small
   health JSON; any other path returns `404 not_found`.
2. **CORS preflight.** `OPTIONS` returns `204`.
3. **Origin check.** `MCP_HTTP_ALLOWED_ORIGINS` is a comma-separated list of
   allowed origins. Entries may be exact origins or wildcard DNS suffixes such
   as `*.ts.net`; a wildcard matches the origin's hostname suffix. An
   unallowed `Origin` header returns `403 forbidden_origin`. Requests with no
   `Origin` header skip the check.
4. **Bearer auth.** `MCP_HTTP_AUTH_TOKEN` is **required** — `getMcpHttpServerOptionsFromEnv`
   throws if it is empty. Clients must send `Authorization: Bearer <token>`,
   matched exactly; mismatched tokens return `401 unauthorized`. This token is
   distinct from the Brijio pairing token and must not be reused as it.
5. **Method allowlist.** Only `GET`, `POST`, and `DELETE` are MCP methods;
   others return `405 method_not_allowed`.

Timeouts (`MCP_HTTP_HOST`, `MCP_HTTP_PORT`, `BRIJIO_MCP_HTTP_TIMEOUT_MS`,
`BRIJIO_APPROVAL_TIMEOUT_BUFFER_MS`) shape the HTTP server and an
approval-timeout budget passed down to action handlers. The README additionally
documents `MCP_HTTP_ALLOWED_HOSTS`, `MCP_HTTP_ALLOW_TAILSCALE_HOSTS`, and
`MCP_HTTP_ALLOW_LOCAL_HOSTS` for host-header allow-listing; the current
`http-server.ts` implements origin allow-listing and bearer auth, with host
allow-listing handled by the surrounding deployment/daemon configuration rather
than in this HTTP handler.

## Common input shape

Every action and read tool shares a small set of optional inputs declared once
in `createBrijioMcpServer` and threaded down to the WebSocket client.

### Browser and tab targeting

- **`browserInstanceId`** (`string`, optional) selects one of the browser
  extension instances connected for the pairing token. When omitted, the relay
  routes automatically only when exactly one browser is online; otherwise it
  returns `ambiguous_browser_target` (multiple) or `browser_unavailable`
  (none). A process-wide default can be set with `BRIJIO_BROWSER_INSTANCE_ID`,
  applied in `page-context.ts` when the call does not supply one explicitly.
- **`tabId`** (`string`, optional) targets a specific browser tab instead of the
  active foreground tab. It is discovered via `list_tabs` and must be passed as
  the exact string returned. When omitted, tools fall back to the active tab
  (ADR 0062 threads `tabId` through the whole action stack; see
  [Multi-Tab Workflow](../workflows/multi-tab.md)).

Both are normalized by per-tool `normalizeBrowserInstanceId` /
`normalizeTabId` helpers; invalid non-string values become
`invalid_tool_input` results rather than being sent to the relay.

### Stale-context validation

Action tools accept two correlated guards against acting on a stale page after
navigation or DOM/form changes:

- **`pageContextId`** (`number`, optional) is the page-context version from the
  last `read_current_page`. If the page has navigated since the read, the
  action fails with `page_navigated`.
- **`visibleContextId`** (`string`, optional) is the visible form-state ID from
  the last read. If the visible form structure has changed, the action fails
  with `stale_context`.

Several action tools also accept **`expected*`** hints (`expectedText`,
`expectedHref`, `expectedRole`, `expectedLabel`) that validate the target's
visible label/text/role before acting; a mismatch yields `stale_context`. On
either stale error the correct recovery is to re-read the page and retry with
fresh short-lived IDs.

Short-lived element IDs (`e5`, `f2`, `a1`, form IDs) expire on any navigation
or DOM update. Agents must re-read with `read_current_page` after navigation,
form submission, or any mutation before reusing IDs.

## Structured results and error forwarding

All tool handlers return a `BrijioToolResult<T>` (defined in
`page-reading-tool.ts`):

```ts
type BrijioToolResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: { code: string; message: string; detail?: StaleContextDetail };
    };
```

The MCP wrapper serializes the result as a single `text` content item
(`JSON.stringify(result)`). The only tool that deviates is `capture_screenshot`,
which on success returns an `image` content item (JPEG, base64) plus a `text`
sidecar with width/height/tabId/capturedAt, and on failure returns the text
JSON with the MCP `isError` flag set. Per ADR 0061, errors are returned in the
`content` text field as JSON, not as MCP-level transport errors.

Error codes are forwarded, not rewrapped. Per ADR 0061
(`docs/architecture/decisions/0061-forward-error-codes-through-mcp.md`):

- **Router-level errors** from the relay (`parseRouterErrorEnvelope`) forward
  the original `code` and `message` as-is when both are strings; only a
  structurally malformed envelope becomes `invalid_response`.
- **Action-level errors** from the extension (`parseErrorPayload`) forward the
  original `code` string (e.g. `not_supported`, `cors_blocked`, `http_error`)
  instead of flattening to `browser_error`. `stale_context` and `page_navigated`
  keep their structured `detail`.

The `BrijioToolResult` error `code` is typed as `string` (not a closed union)
so the server can pass through extension/relay codes it does not know about.
Known codes the server itself produces include `connection_failed`, `timeout`,
`invalid_response`, `browser_error`, `invalid_resource_uri`, `auth_required`,
`auth_failed`, `browser_unavailable`, `ambiguous_browser_target`,
`invalid_browser_target`, `batch_failed`, `unsupported_scheme`,
`invalid_tool_input`, `page_navigated`, and `stale_context`. Because codes are
open, agents should read the `message` field and not switch solely on
`code === 'browser_error'`.

## Resources

Two read-only resources are registered (ADR 0007 / 0009):

- **`browser://page/current`** (named `current-page-context`) opens a WebSocket,
  sends a `get_page_context` request with a generated ID, awaits the matching
  `page_context_response`, and returns structured JSON. It carries URL, title,
  timestamp, selected text, a preview, a `structure` object (headings,
  landmarks, links, images, forms, actions, editables), and a `content`
  descriptor (`available`, `requestType`, `firstIndex`, `defaultMaxPayloadBytes`).
- **`browser://page/current/content/{index}`** (named `current-page-content`) is
  a `ResourceTemplate`. The handler parses the 1-based `{index}` segment
  (`parsePageContentResourceIndex`), sends a `get_page_content` request for that
  chunk, awaits `page_content_response`, and returns the chunk content with
  `truncated` and `maxPayloadBytes`. Invalid indices return
  `invalid_resource_uri`.

Resources accept the same `browserInstanceId`/`tabId` targeting as tools via
the underlying `getCurrentPageContext` / `getCurrentPageContent` calls in
`page-context.ts`. They are intended for resource-first MCP clients; tool-first
clients should use `read_current_page`, which reuses the same WebSocket request
path.

## brijio-context prompt

The `brijio-context` prompt injects orientation context at session start. It is
built by `buildContextMessage` (`skills.ts`) from the loaded skills and a fixed
set of pitfalls: call `list_browsers` first, specify `browserInstanceId` when
multiple browsers are connected, use `list_tabs`/`tabId` for multi-tab
targeting, the `skill://brijio/{name}` read format, short-lived IDs, radio
buttons that cannot be unchecked, password/readonly fields that `fill_input`
rejects, and the "never auto-submit" rule. The prompt returns a single `user`
message containing this text; MCP clients call it to orient the agent before
any browser interaction.

## Registered tools

All tools are registered in `createBrijioMcpServer`. The grouping below is by
concern; the README is the canonical, always-current list.

### Discovery

| Tool            | Purpose                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| `list_browsers` | Browser instances online for the pairing token. Call first.                                                   |
| `list_tabs`     | Open tabs in a browser, including background tabs; returns a `tabId` per tab plus `active`/`supported` flags. |

### Reading

| Tool                | Purpose                                                                                                                                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `read_current_page` | Reads page context and, by default, the first readable content chunk. `includeContent` (default `true`), `maxContentChunks` (default `1`, max `10`), `startContentIndex` (default `1`, continue from `nextContentIndex`). Returns `context`, `content[]`, `contentTruncated`, `nextContentIndex`. |

Reading is also available through the `browser://page/current` and
`browser://page/current/content/{index}` resources above.

### Actions (page mutations)

| Tool             | Purpose                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `click_element`  | Click a link (`kind: "link"`) or button-like action (`kind: "action"`) by short-lived ID.                                              |
| `fill_input`     | Write text into a form control by `formId`/`controlId`. Empty text clears; password/readonly/disabled controls return `browser_error`. |
| `fill_editable`  | Write plain text into a contenteditable target by short-lived `id` (ADR 0016 editable shape).                                          |
| `set_checked`    | Set checkbox state or select a radio by `formId`/`controlId` + `checked`. Radios cannot be unchecked.                                  |
| `select_options` | Select option `values` in a single/multi `<select>` by `formId`/`controlId`. Values must come from the control's `options[]` metadata. |
| `submit_form`    | Submit a visible form by short-lived `formId`. The extension uses browser-native submission.                                           |
| `upload_file`    | Write base64 file content into a visible file input by `formId`/`controlId`, with optional `fileName`/`mimeType`.                      |

Each action tool sends one ADR 0016 `perform_action` message and waits for the
matching `action_result`, accepting the targeting and stale-context inputs
described above.

### Navigation

| Tool              | Purpose                                                                                                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `navigate_to_url` | Navigate the browser (or a `tabId`) to an HTTP/HTTPS URL and wait for load. Returns final `url`, `title`, `redirected`, `navigationMs`, `timestamp`. Non-HTTP(S) returns `unsupported_scheme`. |
| `open_tab`        | Open a new tab at an HTTP/HTTPS URL and return its `tabId` for subsequent targeting. Does not accept `tabId` (it creates one).                                                                 |

### Batch

`perform_batch` sends 1–20 explicit write actions in one WebSocket request
(`click`, `write_text`, `set_checked`, `select_options`, `upload_file`,
`submit_form`). `continueOnError` (default `false`) lets later actions continue
after recoverable per-action errors; page navigation still aborts the batch
because short-lived IDs may no longer match. `readAfterActions` (default
`false`) appends a fresh page-context read as the final result entry. The
result has an outer MCP `ok` and an inner `data.ok` batch outcome, plus
top-level `aborted`; agents must re-read the page before retrying when
`aborted` is `true`. Batch-level dispatch failures use `batch_failed`.

### Downloads and fetch

| Tool              | Purpose                                                                                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `download_status` | Status of downloads by optional IDs or all session downloads. Returns a `capability` field (`full` or `not_supported`; Safari returns `not_supported`).                |
| `download_file`   | Initiate a download by URL with optional `filename`/`conflictAction`. Chrome/Firefox return a download ID; Safari is fire-and-forget with `initiated_fire_and_forget`. |
| `fetch_resource`  | Fetch a URL with the browser's session cookies/auth. High-risk; Safari or CORS blocks return `cors_blocked`. Optional `maxSizeBytes`/`fetchTimeout`.                   |

### Capture

`capture_screenshot` (ADR 0064) captures a viewport JPEG (quality 80) of the
current tab as base64 plus a metadata sidecar. It is the only tool that returns
an `image` content item and sets the MCP `isError` flag on failure.

## Skills system

Skills are human-authored workflow guides that orient the agent for specific
tasks (form filling, navigation, data extraction, accessibility, e-commerce,
etc.). They are not executable code; they are markdown instructions exposed as
MCP resources and summarized by the `brijio-context` prompt.

### Layout and loading

Skills live one per directory under `servers/mcp/skills/<name>/SKILL.md`. Each
`SKILL.md` begins with optional YAML frontmatter:

```
---
name: navigation
description: "Navigate multi-step flows on authenticated pages..."
---
```

`loadSkills` (`servers/mcp/src/skills.ts`) reads the skills root directory
(resolved by `resolveSkillsDir` to `../skills` next to the compiled output or
TS source), iterates subdirectories, reads each `SKILL.md`, parses frontmatter
(`name` defaults to the directory name; `description` defaults to the first
non-heading paragraph, truncated at 200 chars), extracts the first H1 as
`title`, and returns skills sorted alphabetically by name. A missing skills
directory or `SKILL.md` is skipped gracefully.

### Exposure

`createBrijioMcpServer` loads skills at server creation and registers each as an
MCP resource:

- **Resource URI:** `skill://brijio/{name}` (built by `skillResourceUri`).
- **Resource name:** the skill's directory/frontmatter `name`.
- **MIME type:** `text/markdown`; the resource body is the markdown content
  without frontmatter.

Any MCP client can discover and read a skill's full instructions via
`read_resource` with the `skill://brijio/{name}` URI. The skill directories
shipped under `servers/mcp/skills` are:

`accessibility`, `comparison`, `data-extraction`, `ecommerce`, `form-filling`,
`monitoring`, `navigation`, `onboarding`, `using-brijio`, `web-qa`.

The `using-brijio` skill is the orientation entry point; it lists the other
skills and the URI format. `navigation` covers both click-through flows and
direct `navigate_to_url` / `open_tab` usage.

### Prompt integration

`buildContextMessage` turns the loaded skills into the "Available Skills"
section of the `brijio-context` prompt, listing each skill's title, name, and
description. This is how an agent learns the skills exist without first reading
a resource; the progressive-disclosure pattern is "know the name and
description, read the full SKILL.md only when the task matches."

## Change management

Tool behavior changes ripple across several artifacts. Per `AGENTS.md`, when a
tool's behavior changes you must update its tests, its MCP registration in
`mcp-server.ts`, the relevant skills under `servers/mcp/skills`, the capability
matrix (`docs/project/CAPABILITY_MATRIX.md`), and the relevant OpenWiki workflow
pages (for example [Action Approval](../workflows/action-approval.md) and
[Multi-Tab Workflow](../workflows/multi-tab.md)). Protocol definitions stay in
`packages/shared` and must not be duplicated; per-call `browserInstanceId` and
`tabId` targeting and the active-tab fallback must be preserved; and page
context must be re-read after navigation or any mutation that can invalidate
short-lived IDs.

## Related pages

- [MCP to WebSocket to Extension Flow](mcp-extension-flow.md) — the end-to-end
  request path this surface feeds into.
- [Extension Adapters](extension-adapters.md) — Chrome/Safari adapter seams that
  execute the actions dispatched from these tools.
- [Data and Protocol](../data-and-protocol.md) — the shared envelope shapes the
  tools build and parse.
- [Action Approval](../workflows/action-approval.md) — approval gating applied to
  action tools.
- [Multi-Tab Workflow](../workflows/multi-tab.md) — `list_tabs`/`tabId` usage.
