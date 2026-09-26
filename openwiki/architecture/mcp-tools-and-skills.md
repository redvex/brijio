---
type: "MCP surface"
title: "MCP Tool, Resource, and Skill Surface"
description: "The agent-facing MCP surface: the full tool inventory grouped by read, form-action, navigation, batch, download-fetch, and screenshot; the page-context and skill resources; the brijio-context prompt; and the SKILL.md loading system that exposes skills as MCP resources."
tags:
  [
    "mcp",
    "tools",
    "skills",
    "resources",
    "screenshot",
    "batch",
    "capability-matrix",
  ]
verified:
  - by: openwiki/0.6.0
    at: 2026-09-26T12:40:26.126Z
sources:
  - id: openwiki-source-c840f3fd0b704a3fd503c1e8
    resource: repo://docs/architecture/decisions/0027-mcp-skill-system.md
  - id: openwiki-source-79dd91ec51a55e7e78c52ccc
    resource: repo://docs/architecture/decisions/0064-visual-action-verification.md
  - id: openwiki-source-9b8357af9c7ef75912f57765
    resource: repo://docs/project/CAPABILITY_MATRIX.md
  - id: openwiki-source-0e2fefeaecdd03cb7671fcf2
    resource: repo://servers/mcp/skills/using-brijio/SKILL.md
  - id: openwiki-source-5ed33ac94d61e6c5b4d5710f
    resource: repo://servers/mcp/src/batch-tool.ts
  - id: openwiki-source-98d3a3b49443df3bef1fdba1
    resource: repo://servers/mcp/src/capture-screenshot-tool.ts
  - id: openwiki-source-7ec950b8e675b6267f6511dc
    resource: repo://servers/mcp/src/download-file-tool.ts
  - id: openwiki-source-37fefd6f1b68db9dac727bb2
    resource: repo://servers/mcp/src/download-status-tool.ts
  - id: openwiki-source-d8c267a5d91893c5d2dcffb5
    resource: repo://servers/mcp/src/fetch-resource-tool.ts
  - id: openwiki-source-36c61251055ea6d2f82f0b4e
    resource: repo://servers/mcp/src/mcp-server.ts
  - id: openwiki-source-5010399594ba6e70492859fd
    resource: repo://servers/mcp/src/open-tab-tool.ts
  - id: openwiki-source-ac88caafdb9674d72e823a21
    resource: repo://servers/mcp/src/page-context.ts
  - id: openwiki-source-cf0a99949586e8a89ddb7d82
    resource: repo://servers/mcp/src/protocol-batch.test.ts
  - id: openwiki-source-48d3485f346966d1c44c7ea7
    resource: repo://servers/mcp/src/protocol.ts
  - id: openwiki-source-13054dea741b794a82597d0c
    resource: repo://servers/mcp/src/skills.ts
  - id: openwiki-source-fc4b25ba659ae4c102750c8d
    resource: repo://servers/mcp/src/websocket-client.ts
generated: { by: "openwiki/0.6.0", at: "2026-09-26T12:40:26.126Z" }
---

# MCP Tool, Resource, and Skill Surface

Brijio exposes a remote agent through a single MCP server (`servers/mcp/src/mcp-server.ts`) that an agent runtime talks to over MCP. Everything an agent can _observe_ or _do_ in the user's authenticated browser is expressed as one of three MCP primitives registered on that server:

- **Tools** — actions the agent calls (read page, click, fill, navigate, batch, download, fetch, screenshot).
- **Resources** — addressable, side-effect-free reads (`browser://page/current`, `browser://page/current/content/{index}`, and one `skill://brijio/{name}` resource per skill).
- **Prompts** — one session-orientation prompt, `brijio-context`, that injects connected-browser guidance, the multi-tab targeting model, the skill list, and the key pitfalls.

The server is constructed by `createBrijioMcpServer()`, which is **async** because it loads skill files from disk at startup (`loadSkills(skillsDir)`). A skill file change therefore requires a server restart; skills are not hot-reloaded.

<!-- openwiki: mermaid parse failed and this diagram was converted to a text fence so it does not break rendering. Fix the diagram source and restore the mermaid fence. Parser error: Heuristic: an unescaped angle bracket inside a label breaks rendering; rephrase the label. -->

```text
graph TD
    subgraph Tools
        T1[read_current_page]
        T2[click_element / fill_input / fill_editable]
        T3[set_checked / select_options / upload_file / submit_form]
        T4[navigate_to_url / open_tab]
        T5[perform_batch]
        T6[download_status / download_file / fetch_resource]
        T7[capture_screenshot]
    end
    subgraph Resources
        R1[browser://page/current]
        R2[browser://page/current/content/{index}]
        R3["skill://brijio/{name} ×N"]
    end
    subgraph Prompts
        P1[brijio-context]
    end
    SRV["createBrijioMcpServer<br/>(async: loadSkills at startup)"] --> T1 & T2 & T3 & T4 & T5 & T6 & T7
    SRV --> R1 & R2 & R3
    SRV --> P1
    SKILLS["servers/mcp/skills/*/SKILL.md"] -.loadSkills.-> R3
    SKILLS -.buildContextMessage.-> P1
```

## Tool inventory

Every tool below is registered in `mcp-server.ts` with a Zod input schema. Two optional input fields — `browserInstanceId` and `tabId` — are declared once and reused across almost all tools; action tools additionally accept `pageContextId` (numeric page-context version) and `visibleContextId` (visible form-state id) for staleness validation. The browser-instance and tab ids thread all the way down to `websocket-client.ts`'s `targetEnvelope()`, which attaches a `target: { browserInstanceId, tabId }` to the relay envelope; when neither is present the envelope carries no target and the extension falls back to the active tab. See [/openwiki/architecture/mcp-extension-flow.md](/openwiki/architecture/mcp-extension-flow.md) for the per-request socket lifecycle and active-tab fallback.

### Read tools

| Tool                | Purpose                                                                                                                                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `list_browsers`     | List Brijio browser instances currently online for the configured pairing token (id, name, profile, label).                                                                                                                                                                                      |
| `list_tabs`         | List open tabs for a connected browser — tab id, window id, title, URL, active/supported flags. Only HTTP/HTTPS tabs are listed.                                                                                                                                                                 |
| `read_current_page` | Read current page context (URL, title, headings, links, forms, editables, actions) plus optional paginated readable content. Supports `includeContent`, `maxContentChunks` (default 1, max 10), and `startContentIndex` (1-based; use `nextContentIndex` from a truncated response to continue). |

`list_browsers` and `list_tabs` are discovery tools — they take no short-lived target ids. `read_current_page` is the source of the **short-lived target ids** (`e5`, `f2`, `a1` style) that the form-action and click tools consume; those ids expire whenever the page navigates or the DOM mutates, so an agent must re-read after any navigation before re-targeting.

### Form-action tools

| Tool             | Target                                 | Notes                                                                                                                                                                                       |
| ---------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `click_element`  | `{ kind, id }` from page context       | `kind` is `link` or `action`. Optional `expectedText`/`expectedHref`/`expectedRole` validators; stale ids return `stale_context`.                                                           |
| `fill_input`     | `{ formId, controlId }`                | Returns `browser_error` for password, readonly, and disabled inputs — a deliberate security boundary.                                                                                       |
| `fill_editable`  | contenteditable `id`                   | Optional `expectedText` validator.                                                                                                                                                          |
| `set_checked`    | `{ formId, controlId }` + `checked`    | A radio button cannot be unchecked; select a different option instead.                                                                                                                      |
| `select_options` | `{ formId, controlId }` + `values[]`   | Single- and multi-select.                                                                                                                                                                   |
| `upload_file`    | `{ formId, controlId }` + `dataBase64` | Optional `fileName` (default `upload`) and `mimeType` (default `application/octet-stream`). Base64 is size-validated (`stageUploadFilePayload`) against an upload byte cap before dispatch. |
| `submit_form`    | `{ formId }`                           | Submits with browser validation. Optional `expectedLabel`.                                                                                                                                  |

Every form-action tool normalizes its raw MCP input in a per-tool wrapper (`click-element-tool.ts`, `form-action-tools.ts`, etc.), validates the `browserInstanceId`/`tabId` shape, and delegates to a `page-actions.ts` helper that threads the targets into the websocket request. On validation failure the tool returns `{ ok: false, error: { code: 'invalid_tool_input' } }` without contacting the relay.

### Navigation tools

| Tool              | Purpose                                                                                                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `navigate_to_url` | Navigate the active (or targeted) tab to an HTTP/HTTPS URL; waits for load, returns final URL/title/status, handles redirects and timeouts. Rejects non-`http(s)` schemes.                     |
| `open_tab`        | Open a new tab with an HTTP/HTTPS URL on a connected browser; returns the new `tabId` for subsequent targeting. Only accepts `browserInstanceId` (no `tabId`), since the tab is being created. |

### Batch tool — `perform_batch`

`perform_batch` executes a sequential batch of explicit browser actions in one request, avoiding the round-trip and re-read cost of many individual tool calls. Semantics:

- **1–20 actions** (`MAX_BATCH_ACTIONS = 20`); the schema enforces `.min(1).max(20)`. Fewer than one or more than twenty returns `invalid_tool_input`.
- **Action types**: `click`, `write_text`, `set_checked`, `select_options`, `submit_form`, `upload_file`. Each action carries a `target` object (e.g. `{ kind: "link", id: "bb-1" }` or `{ formId, controlId }`) plus type-specific payload (`text`, `checked`, `values`, or base64 file payload).
- **`continueOnError`** (default `false`): when false, execution stops on the first error; when true, execution continues and errors are reported per-action.
- **`readAfterActions`** (default `false`): when true, the response appends a page-context read as the final result entry. This is the _only_ read available inside a batch — arbitrary `read_current_page` steps are not batchable in the MVP.
- **Per-action `actionUUID`**: the websocket client (`addBatchActionApprovalMetadata`) assigns each action a unique `actionUUID` (or preserves one supplied by the caller). A `submit_form` action additionally gets `approvalRequest: true`, which routes it through the action-approval workflow described in [/openwiki/workflows/action-approval.md](/openwiki/workflows/action-approval.md).
- **Navigation aborts remaining actions**: when an action causes the page to navigate, the affected action's error carries `aborted: true` and the remaining actions are not executed; the top-level `BrijioBatchResult.aborted` flag is set. Per-action errors also carry `aborted: true` when they are consequences of navigation. Agents should re-read page context and retry.
- **Top-level result**: `{ ok, results: BatchResultEntry[], aborted }`. `results` mixes action outcomes and (optionally) one read outcome; each entry is `{ ok: true, data }` or `{ ok: false, error: { code, message, detail?, aborted } }`.

`upload_file` actions inside a batch are staged by `stageUploadFilePayload` (the same helper the standalone `upload_file` tool uses) before the batch is sent, so file-size validation happens up front.

### Download / fetch tools

| Tool              | Purpose                                                                                                                                                                                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `download_status` | Query browser downloads by optional ids or all session downloads. Returns a `capability` field — `"full"` on Chrome/Firefox, `"not_supported"` on Safari (empty items list) — plus a list of download items (`id`, `kind`, `filename`, `url`, `state`, etc.).                                                             |
| `download_file`   | Initiate a download. On Chrome/Firefox uses the `chrome.downloads` API and returns a numeric `downloadId` with status `initiated`; on Safari it is fire-and-forget via a content script and returns `status: "initiated_fire_and_forget"` with a null id. Optional `filename` and `conflictAction` (`uniquify`            | `overwrite`). |
| `fetch_resource`  | Fetch a URL **using the browser's authenticated session** (cookies, auth), streaming the response body back as base64 with `fetchId`, `contentType`, `totalBytes`, and `sha256`. A high-risk tool: on Safari or when CORS blocks the request it returns error `cors_blocked`. Optional `maxSizeBytes` and `fetchTimeout`. |

`fetch_resource` is the only tool that exposes session-protected _content_ (not just metadata) to the agent; its risk is called out explicitly in the tool description and surfaced to skills.

### Screenshot tool — `capture_screenshot`

`capture_screenshot` (ADR 0064) captures the **visible viewport only** of the current/targeted tab as JPEG (quality 80) and returns it through a **special MCP return shape**: an `image` content block carrying the base64 data plus a `text` content block with JSON metadata (`width`, `height`, `tabId`, `capturedAt`).

This differs from every other tool, which returns a single `text` content block of `JSON.stringify(result)`. On failure the screenshot tool returns a single `text` block with `isError: true` instead. The image content block is only interpretable by a **vision-capable agent** — non-vision clients receive the metadata but cannot "see" the pixels. The tool accepts `browserInstanceId`/`tabId`; per the ADR the `tabId` must, if supplied, match the active tab (forward-compatibility only — background-tab capture is out of scope for P3.3). Full-page scroll-stitch, annotation, and video are deferred to a later tier.

## Resources

Two page resources plus one resource per skill are registered on the server:

- `browser://page/current` (`current-page-context`) — returns the same structured page context as the `read_current_page` tool, as `application/json`.
- `browser://page/current/content/{index}` (`current-page-content`) — a `ResourceTemplate` returning one normalized, paginated content chunk by 1-based index, as `application/json`. The index is parsed from the URI by `parsePageContentResourceIndex`.
- `skill://brijio/{name}` — one resource per loaded skill, served as `text/markdown`. The URI is deterministic (`skillResourceUri(name)`), so an agent can construct it from a skill name discovered via the `brijio-context` prompt.

Both page resources delegate to the same `page-context.ts` helpers as the corresponding tools; resources and tools share a single code path and produce identical structures.

## The skills system

Skills are reusable, markdown-authored workflow guides (the "Superpowers" `SKILL.md` convention). They live as directories under `servers/mcp/skills/{name}/SKILL.md` with optional YAML frontmatter:

```yaml
---
name: form-filling
description: "Complete forms on authenticated pages..."
---
# Smart Form Filling
...instructions and pitfalls...
```

`servers/mcp/src/skills.ts` is the loader:

- `resolveSkillsDir()` resolves the skills directory next to the compiled output (`import.meta.dirname/../skills`), working in both dev (TS) and production (compiled JS) layouts.
- `loadSkills(skillsDir)` reads each subdirectory, parses frontmatter (a minimal key:value parser, not a full YAML library), derives `name` (frontmatter `name` or directory name), `title` (first H1), `description` (frontmatter `description` or first non-heading paragraph, collapsed and truncated to 200 chars), and `content` (body without frontmatter). Skills with no `SKILL.md` are skipped; the result is sorted alphabetically by name. If the directory is missing, `loadSkills` returns `[]`.
- `skillResourceUri(name)` builds the `skill://brijio/{name}` URI.
- `buildContextMessage(skillSummaries)` assembles the `brijio-context` prompt body.

The currently shipped skills (all `✅ Implemented` per the capability matrix): `accessibility`, `comparison`, `data-extraction`, `ecommerce`, `form-filling`, `monitoring`, `navigation`, `onboarding`, `using-brijio`, `web-qa`. `using-brijio` is the orientation skill — it documents the tool reference and the "read the relevant skill before any browser action" workflow.

### How skills reach the agent

Skills are surfaced through three layers, all reading from the same `SKILL.md` files:

1. **MCP resources** — `mcp-server.ts` loops over the loaded skills and registers each as a `skill://brijio/{name}` resource with the skill's title/description and `text/markdown` content. Any MCP client can `resources/list` and `resources/read` them — not just plugin-aware runtimes.
2. **`brijio-context` prompt** — registered once; when invoked it calls `buildContextMessage` with a summary `{ name, title, description }` of every loaded skill. The message lists connected-browser guidance, the multi-tab targeting model (`list_tabs` + pass `tabId`), the skill URI format, the available skills, and the key pitfalls (password fields return `browser_error`; radio buttons cannot be unchecked; readonly/disabled inputs are blocked; short-lived ids expire on navigation; never auto-submit; always specify `browserInstanceId` when multiple browsers are connected).
3. **Plugin manifests** — `.codex-plugin/`, `.claude-plugin/`, and `.cursor-plugin/` at the repo root declare `./servers/mcp/skills/` as the skills directory, enabling native skill discovery by Codex, Claude Code, and Cursor runtimes.

### Extension points and maintenance

Adding a skill is `mkdir + SKILL.md` under `servers/mcp/skills/` — no code change is required; the loader discovers it on the next server start. Because skills load at startup, editing a `SKILL.md` requires a server restart. The skill _content_ stays in sync across all three exposure layers because they read the same files; only manifest _metadata_ (descriptions, keywords) can drift independently and must be maintained by hand.

When tool behavior changes, keep the surface coherent across:

- **Tests** — update the affected tool tests (e.g. `batch-tool.test.ts`, `form-action-tools.test.ts`) and the skill loader tests (`skills.test.ts`).
- **MCP registration** — update the tool's `registerTool` schema/description in `mcp-server.ts`.
- **Skills** — update the relevant skill(s) under `servers/mcp/skills/` (especially `using-brijio/SKILL.md`, which enumerates the tool reference).
- **Capability matrix** — `docs/project/CAPABILITY_MATRIX.md` is the declared product contract and should be updated first, then linked references.
- **Workflow pages** — the multi-tab ([/openwiki/workflows/multi-tab.md](/openwiki/workflows/multi-tab.md)) and action-approval ([/openwiki/workflows/action-approval.md](/openwiki/workflows/action-approval.md)) pages reference the same targeting and approval behavior.

## Capability matrix vs. actual code (doc discrepancy)

`docs/project/CAPABILITY_MATRIX.md` is the canonical product contract but is **stale relative to the implemented code**. It understates the current tool surface:

- **Screenshot capture** is listed under _Product Limitations_ as "No screenshot capture yet" and under _Planned Capabilities_ as `📋 Planned`, but `capture_screenshot` is implemented and registered in `mcp-server.ts` (ADR 0064). The MCP Tools tables omit it entirely.
- **Multi-tab** is listed as "No multi-tab switching yet" under limitations and "Tab listing and selection" / "New tab and close tab actions" as planned, yet `list_tabs` and `open_tab` are both implemented and registered, and `tabId` threading is wired across the tool surface.
- **File upload** is listed as "No file uploads yet" and "File uploads" as planned, but `upload_file` is implemented and registered, and is also a valid `perform_batch` action type.
- **Download awareness / `download_status`, `download_file`, `fetch_resource`** are not represented in the MCP Tools tables at all, though they are implemented and registered.

The actual tool surface documented above reflects the code. Treat the capability matrix's MCP Tools section and several of its "limitations"/"planned" rows as out of date until the matrix is refreshed.

## Focused tests

- `servers/mcp/src/skills.test.ts` — `loadSkills` parsing (frontmatter, title/description fallbacks, missing `SKILL.md` skipping, sorting), `skillResourceUri`, and `buildContextMessage` content.
- `servers/mcp/src/batch-tool.test.ts` and `protocol-batch.test.ts` — batch input validation (1–20 actions, action-type allow-list, upload staging), per-action `aborted` flagging, and top-level `aborted` on navigation.
- `servers/mcp/src/form-action-tools.test.ts` — form-action normalization, password/readonly/disabled rejection, and upload staging/size limits.
- `servers/mcp/src/index.test.ts` / `integration.test.ts` — end-to-end MCP server tool/resource/prompt registration and tool-call behavior.
