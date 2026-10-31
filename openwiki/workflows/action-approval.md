---
type: workflow
title: Client-Side Action Approval
description: How approval-gated browser actions (submit_form, fetch_resource, download_file) thread actionUUID and approvalRequest from the MCP server through the extension, hold in-memory approval state, time out before the HTTP request deadline, and never bypass the user.
tags: [approval, workflow, security, mcp, extension, action-uuid]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-31T14:18:08.591Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-0f5d8a945cabdf67f37b9ad7
    resource: repo://clients/extensions/chrome/src/background.ts
  - id: openwiki-source-46d9f24e40e9fa984f0c4b99
    resource: repo://clients/extensions/chrome/src/content-script-entry.ts
  - id: openwiki-source-70dd1b5e429044bdf703d26f
    resource: repo://clients/extensions/safari/src/background-entry.ts
  - id: openwiki-source-992a62d4a0e989fc2da546d0
    resource: repo://docs/architecture/decisions/0048-client-side-action-approval.md
  - id: openwiki-source-5524638d57e96598fd8e40d4
    resource: repo://packages/shared/src/background-controller.ts
  - id: openwiki-source-c20cbcf46daa07e6332e3f7f
    resource: repo://packages/shared/src/protocol.ts
  - id: openwiki-source-1e871ebe65ae85a216285234
    resource: repo://servers/mcp/src/http-server.ts
  - id: openwiki-source-48d3485f346966d1c44c7ea7
    resource: repo://servers/mcp/src/protocol.ts
  - id: openwiki-source-fc4b25ba659ae4c102750c8d
    resource: repo://servers/mcp/src/websocket-client.ts
generated: { by: "openwiki/0.7.2", at: "2026-10-31T14:18:08.591Z" }
---

# Client-Side Action Approval

Brijio lets agents invoke browser-mutating MCP tools, but three of those tools
must first be approved by the user **in the browser** before they execute:
`submit_form`, `fetch_resource`, and `download_file`. This page documents that
approval gate end to end: which actions are gated, how the `actionUUID` and
`approvalRequest: true` fields thread from the MCP tool wrapper through the
protocol envelope and WebSocket relay into the extension's in-memory approval
state, how approvals, denials, and timeouts resolve, and the invariants that
keep the gate from being bypassed.

The design is recorded in [ADR 0048](../../docs/architecture/decisions/0048-client-side-action-approval.md).
For the surrounding request path see
[MCP Extension Flow](../architecture/mcp-extension-flow.md); for the envelope
and error-code shape see [Data and Protocol](../data-and-protocol.md); for the
trust boundary see [Security](../security.md); for multi-tab targeting see
[Multi-Tab Workflow](multi-tab.md).

## Which actions are gated

Approval is **not** required for every action. The gated set is a hardcoded
local list — not yet configurable, not policy-driven:

| Action           | Approval required | Where it appears                              |
| ---------------- | ----------------- | --------------------------------------------- |
| `submit_form`    | yes               | standalone tool and as a `perform_batch` step |
| `fetch_resource` | yes               | standalone tool only                          |
| `download_file`  | yes               | standalone tool only                          |

Everything else — `click`, `write_text` (`fill_input` / `fill_editable`),
`set_checked`, `select_options`, `upload_file`, and the non-gated
`perform_batch` step types — executes without an approval prompt in this first
implementation. `fetch_resource` and `download_file` are standalone tools and
are not batch-eligible action types, so within `perform_batch` only
`submit_form` is gated.

The gate is enforced by two cooperating pieces:

- The **MCP server** decides _which_ actions carry approval metadata and
  assigns the `actionUUID`.
- The **extension background** decides _whether_ an action may run, by holding
  the pending-action queue, the session grants, and the approval timer, and by
  rendering the user-facing banner through the content script.

Both sides consult the same hardcoded action-type list
(`submit_form` / `fetch_resource` / `download_file`), so a request only enters
the approval path when `approvalRequest === true` **and** the action type is one
of those three.

## actionUUID and approvalRequest threading

Every approval-gated operation carries a unique `actionUUID`. Operations that
require approval also carry `approvalRequest: true`. The WebSocket envelope
`id` remains the request/response correlation id; the `actionUUID` identifies
the _action within_ a request (or, in a batch, each individual action).

### Assignment at the MCP server

In `servers/mcp/src/websocket-client.ts`, each gated request helper builds an
approval-options object from `createApprovalRequestOptions()`, which calls
`createActionUUID()` to mint an `action-${Date.now()}-${random}` id, and sets
`approvalRequest: true`. That metadata is then folded into the outbound
envelope:

- `requestSubmitForm` → `createSubmitFormEnvelope(..., approval)` puts
  `actionUUID` + `approvalRequest` inside `payload.action`.
- `requestDownloadFile` → `createDownloadFileEnvelope(..., approval)` puts
  them at `payload` top level (`download_file` is a standalone envelope type,
  not a `perform_action`).
- `requestFetchResource` → `createFetchResourceEnvelope(..., approval)` does
  the same for `fetch_resource`.

For `perform_batch`, `requestPerformBatch` maps every action through
`addBatchActionApprovalMetadata`. **Every** batch action receives an
`actionUUID` (so approved, denied, or timed-out actions are identifiable), but
only `submit_form` actions additionally get `approvalRequest: true`. This
matches the ADR: batch actions carry `actionUUID` per item; only the gated
ones carry `approvalRequest`.

The same file selects the request timeout for gated calls: when a batch
contains any approval-gated action (or for the standalone gated tools), the
client uses `approvalTimeoutMs ?? timeoutMs` instead of the plain
`timeoutMs`. This keeps the agent-facing WebSocket request alive long enough
for the user to respond.

### Protocol envelope shape

`packages/shared/src/protocol.ts` defines `ApprovalMetadata` (`actionUUID?` +
`approvalRequest?`) and mixes it into each `Perform*Action` type, plus
`ApprovalRequestOptions` used by the envelope constructors. The constructors
only emit the fields when present, so non-gated actions stay clean. Envelope
validation (`hasValidApprovalMetadata`) rejects `actionUUID` that is present
but empty/whitespace, and rejects `approvalRequest` that is present but not a
boolean — so malformed approval metadata fails closed rather than silently
flowing through.

A single-action `submit_form` envelope looks like:

```json
{
  "type": "message",
  "id": "mcp-123",
  "payload": {
    "type": "perform_action",
    "action": {
      "type": "submit_form",
      "actionUUID": "550e8400-e29b-41d4-a716-446655440000",
      "approvalRequest": true,
      "target": { "formId": "bb-2", "expectedLabel": "Checkout" }
    }
  }
}
```

A batch envelope puts `actionUUID` on every item and `approvalRequest: true`
only on the gated item:

```json
{
  "type": "message",
  "id": "mcp-456",
  "payload": {
    "type": "perform_batch",
    "actions": [
      { "type": "write_text", "actionUUID": "...001", "target": {...}, "text": "gianni@example.com" },
      { "type": "submit_form", "actionUUID": "...002", "approvalRequest": true, "target": {...} }
    ]
  }
}
```

### Relay and extension handling

The WebSocket relay forwards the envelope to the connected extension
background unchanged. `BrijioBackgroundController.handleSocketMessage`
dispatches by envelope type:

- `isPerformActionEnvelope` → `handlePerformActionRequest`, which first calls
  `ensureApprovedAction(action)` and only executes if approval succeeds.
- `isDownloadFileEnvelope` → `handleDownloadFileRequest`, which threads
  `payload.actionUUID` and `payload.approvalRequest` into
  `ensureApprovedAction({ type: 'download_file', actionUUID, approvalRequest })`.
- `isFetchResourceEnvelope` → `handleFetchResourceRequest`, doing the same for
  `fetch_resource`.
- `isPerformBatchEnvelope` → `handlePerformBatchRequest`, which calls
  `hasApprovalGatedAction(actions)`; if any action is gated it routes the whole
  batch to `performApprovalAwareBatch` instead of the plain content-script
  batch executor.

The approval decision logic lives in `ensureApprovedAction`, the single
chokepoint shared by single-action, download, fetch, and batch paths.

## Approval state and the chokepoint

`ensureApprovedAction` implements the gate. It is intentionally a no-op for
non-gated actions, so the pipeline never special-cases approval outside this
function:

1. **Type + flag check.** `getApprovalActionType(action.type)` returns the
   type only for `submit_form` / `fetch_resource` / `download_file`; combined
   with `action.approvalRequest !== true`, any other action returns `{ ok: true }`
   immediately and runs without a prompt.
2. **actionUUID presence.** A gated action without a non-empty `actionUUID`
   fails with `approval_unavailable` ("Approval request is missing an
   actionUUID").
3. **Approval adapter availability.** If `options.approval` is `undefined`
   (the extension build has no approval adapter), the action fails with
   `approval_unavailable` ("Action approval is not available."). The action
   does **not** silently proceed.
4. **Origin resolution.** `approval.getActiveOrigin()` reads the active tab
   URL (via the platform background script) and returns its origin. If no
   active tab or a non-regular page URL is available, the action fails with
   `approval_unavailable` ("Active tab origin is not available for approval.").
5. **Session-grant fast path.** If a grant for
   `${origin}\u0000${actionType}` already exists in the in-memory
   `approvalSessionGrants` set, the action is approved without a prompt.
6. **Prompt with timeout.** Otherwise `waitForApprovalDecision` races the
   adapter's `requestApproval(request)` promise against a timer set to
   `options.approvalTimeoutMs ?? 55000`. On timeout it calls
   `approval.hideApproval(actionUUID)` (so the banner is removed) and resolves
   `'timeout'`.
7. **Decision mapping.** `approve` / `approve_session` proceed; `deny`
   returns `approval_denied` with the actionUUID. An unparseable content-script
   response defaults to `deny`.
8. **Origin re-check.** After the user decides, `getActiveOrigin()` is called
   again. If the active tab origin changed between prompt and execution, the
   action fails with `approval_origin_changed` instead of executing — the
   existing grant is not reused against a different site.
9. **Grant recording.** Only `approve_session` adds the grant key to
   `approvalSessionGrants`. A plain `approve` authorizes exactly this one
   action.

The `ApprovalAdapter` interface (`getActiveOrigin`, `requestApproval`,
`hideApproval`) is implemented per platform. The Chrome background builds it
in `createChromeApprovalAdapter`: `requestApproval` injects `content.js` into
the active tab and sends a `show_brijio_approval` message carrying `actionUUID`,
`actionType`, `origin`, and `timeoutMs`; the content script
(`content-script-entry.ts`) renders the `brijio-approval-banner` with three
buttons (`approve`, `approve_session`, `deny`), and `hideApproval` sends
`hide_brijio_approval` keyed by `actionUUID`. Safari provides an equivalent
adapter via `createSafariApprovalAdapter`. The banner text is "Brijio wants to
{actionType} on {origin}", keeping the user informed of both _what_ and
_where_.

## Approve, deny, and timeout outcomes

The three user choices plus the timer produce four structured outcomes, all
of which echo `actionUUID` so the agent can correlate them:

- **`approve`** — execute this one action only. No grant is stored.
- **`approve_session`** — execute this action and store a grant for
  `{ origin, actionType }` valid for the remainder of the bridge connection.
  Subsequent gated actions of the same type on the same origin skip the prompt.
- **`deny`** — `approval_denied` ("User denied approval for {actionType}."),
  with `actionUUID`.
- **timeout** — `approval_timeout` ("Timed out waiting for user approval."),
  with `actionUUID`; the banner is hidden first.

A fifth code, `approval_unavailable`, covers the no-adapter, no-origin, and
missing-`actionUUID` failures — i.e. the extension cannot even present the
choice. A sixth, `approval_origin_changed`, covers the post-decision origin
mismatch. Errors carry `actionUUID` when available.

For single-action tools the result is an `action_result` / `download_file` /
`fetch_resource` error envelope. For batches, the timed-out action becomes a
failed batch entry and the remaining unexecuted actions become `approval_timeout`
"Skipped because approval timed out before this action." entries with
`aborted: true`, so the agent can retry just those actions.

```mermaid
sequenceDiagram
  participant Agent as AI Agent
  participant MCP as MCP Server
  participant BG as Extension Background
  participant CS as Content Script
  participant User as User

  Agent->>MCP: submit_form tool call
  MCP->>MCP: assign actionUUID, set approvalRequest true, use approvalTimeoutMs
  MCP->>BG: perform_action envelope (actionUUID, approvalRequest)
  BG->>BG: ensureApprovedAction: gated type and flag present
  alt session grant for origin + actionType exists
    BG->>CS: execute submit_form (no prompt)
  else no grant
    BG->>BG: resolve active origin
    BG->>CS: show_brijio_approval (actionUUID, actionType, origin, timeoutMs)
    CS->>User: render approval banner
    alt User approves
      User-->>CS: approve or approve_session
      CS-->>BG: decision
      BG->>BG: re-check origin; if approve_session store grant
      BG->>CS: execute submit_form
    else User denies
      User-->>CS: deny
      CS-->>BG: decision deny
      BG-->>MCP: action_result ok false approval_denied
    else timer fires before decision
      BG->>CS: hide_brijio_approval (actionUUID)
      BG-->>MCP: action_result ok false approval_timeout
    end
  end
  BG-->>MCP: action_result
  MCP-->>Agent: structured tool result
```

The sequence above shows the approve / deny / timeout branches for a single
gated action; the same chokepoint drives `download_file`, `fetch_resource`,
and each gated step of `perform_batch`.

## Approval timeout derivation

The approval timer must fire **before** the local MCP HTTP request timeout so
Brijio returns a structured `approval_timeout` instead of letting the HTTP
server or client produce a generic timeout. Because Brijio owns the local MCP
HTTP process, it derives the approval deadline from the configured HTTP
timeout in `servers/mcp/src/http-server.ts`:

```text
approvalTimeoutMs = max(1000, httpTimeoutMs - BRIJIO_APPROVAL_TIMEOUT_BUFFER_MS)
```

- `BRIJIO_MCP_HTTP_TIMEOUT_MS` (default `60000`) → `httpTimeoutMs`, applied to
  both `server.timeout` and `server.requestTimeout`.
- `BRIJIO_APPROVAL_TIMEOUT_BUFFER_MS` (default `5000`) → `approvalTimeoutBufferMs`.
- `approvalTimeoutMs = Math.max(1000, httpTimeoutMs - approvalTimeoutBufferMs)`.

So with the defaults, `approvalTimeoutMs = max(1000, 60000 - 5000) = 55000`.

The computed `approvalTimeoutMs` is threaded from the HTTP server options into
the page-context config (`approvalTimeoutMs: options.approvalTimeoutMs`), into
`BrijioPageActionsConfig.approvalTimeoutMs`, and finally into each
`request*` options object. The gated request helpers (`requestSubmitForm`,
`requestDownloadFile`, `requestFetchResource`, and `requestPerformBatch` when
the batch contains a gated action) use `approvalTimeoutMs ?? timeoutMs` as
their WebSocket `timeoutMs`, giving the user the full derived window to respond.

On the extension side, `ensureApprovedAction` uses
`this.options.approvalTimeoutMs ?? 55000` for the in-extension prompt timer
(`waitForApprovalDecision`). The `55000` fallback mirrors the local default
computation so an extension configured without an explicit value still times
out before the default HTTP deadline. A floor of `1000` ms guarantees the
derived deadline is never absurdly small regardless of the buffer.

For remote or enterprise deployments behind infrastructure Brijio does not
control, the timeout values must be explicitly configured below the shortest
expected client, proxy, gateway, or load-balancer timeout; the derivation above
applies to the local MCP server Brijio owns.

## In-memory-only state and the do-not-bypass invariant

Approval state is **in-memory only** and lives in the extension background
process, not in the MCP server:

- `approvalSessionGrants` is a `Set<string>` field on
  `BrijioBackgroundController`. Grants are keyed by `${origin}\u0000${actionType}`
  and never persisted.
- Pending-action state is held only while a prompt is in flight (the
  `requestApproval` promise and its racing timer).
- Grants are cleared on bridge disconnect: `disconnect()` calls
  `this.approvalSessionGrants.clear()`. An extension reload or browser session
  end equivalently drops the in-memory set.

Pending actions and grants are not stored in page `localStorage`, extension
storage, IndexedDB, or any other persistent store. This is deliberate: the
extension is user-controlled, browser state is only available while the bridge
is connected, and approval authority must not survive a restart or outlive the
session.

The do-not-bypass invariant is stated in `AGENTS.md`: "Preserve user-visible
connection state and configured client-side action approval. Do not bypass
approval checks." In code this is enforced structurally — `ensureApprovedAction`
is the only path from a gated request to execution, and it fails closed
(`approval_unavailable`) when it cannot present a prompt rather than executing
without approval. Changes that add new gated actions or alter the gate must
keep this property: a gated request with `approvalRequest: true` may never
execute without an approve/approve_session decision or a matching session
grant.

## Batch semantics

`performApprovalAwareBatch` runs actions in order, treating each action
independently:

1. A non-gated action executes normally.
2. A gated action with a matching session grant executes normally.
3. A gated action without a grant prompts for that action only, one prompt at
   a time.

A denial is a focused per-action outcome: the denied action records
`approval_denied` (with `aborted: false`) and the runner continues to the next
action, because batch actions use explicit IDs rather than positional
selectors. An approval timeout is request-level for this synchronous
implementation, not multiplied per action: when the timer fires while waiting
for a prompt, the current action records `approval_timeout`, the banner is
hidden, and the batch returns a **partial** `batch_result`. Already-completed
actions keep their results; the timed-out action and all remaining unexecuted
actions are returned as failed entries (the remaining ones with the
"Skipped because approval timed out before this action." message and
`aborted: true`) so the agent can retry just those actions in a later call.

The `continueOnError` flag continues to apply to _execution_ failures that
occur after an action is approved (stale targets, unsupported controls,
browser errors). Page navigation remains special: if an executed action
navigates the page, remaining actions still abort because previously read page
IDs may no longer be valid. The background owns the pending queue, timers,
grants, sequencing, and final `batch_result` assembly; the content script only
renders the banner and executes individual content actions. This keeps policy
state out of the webpage and out of persistent storage.

## Policy evolution

The first implementation keeps the gated set hardcoded behind
`getApprovalActionType`, a small local function that returns the type only for
`submit_form` / `fetch_resource` / `download_file`. ADR 0048 lays out a
three-stage evolution: (1) hardcoded local list — this implementation; (2)
configurable local policy; (3) enterprise policy API. Because policy
evaluation is isolated in one function, future stages can delegate to local
configuration or a policy response without changing the action execution
pipeline or the `ensureApprovedAction` chokepoint.

## Extension points and configuration

- **New gated actions.** Add the type to `getApprovalActionType` (shared) and
  to the MCP-side assignment (`addBatchActionApprovalMetadata` for batch
  actions, or a new standalone request helper + envelope constructor), then
  extend `ApprovalActionType`. The chokepoint and timer logic do not change.
- **`BRIJIO_MCP_HTTP_TIMEOUT_MS`.** Sets the local MCP HTTP request timeout and
  drives the approval deadline via the buffer subtraction.
- **`BRIJIO_APPROVAL_TIMEOUT_BUFFER_MS`.** Safety buffer subtracted from the
  HTTP timeout; default `5000`.
- **`approvalTimeoutMs` option.** Threaded through `BrijioMcpHttpServerOptions`
  → page-context config → `BrijioPageActionsConfig` → request helpers, and into
  the background controller's `approvalTimeoutMs`. Override only when running
  behind infrastructure with a known shorter timeout.
- **`ApprovalAdapter`.** Platform-specific; Chrome and Safari each provide
  one. A build without an adapter causes gated actions to fail with
  `approval_unavailable` rather than bypass the gate.

## Focused tests

The behavior above is pinned by tests across the three packages:

- Shared protocol tests assert `actionUUID` / `approvalRequest` validation on
  `perform_action` and `perform_batch` envelopes, including rejection of
  non-boolean `approvalRequest` and empty `actionUUID`
  (`packages/shared/src/protocol.test.ts`,
  `packages/shared/src/protocol-batch.test.ts`).
- Background controller tests cover the approval matrix: approve executes,
  `approve_session` reuses the grant for the same origin + action type, deny
  returns `approval_denied`, timer returns `approval_timeout` and hides the
  banner, origin change returns `approval_origin_changed`, and
  `download_file` / `fetch_resource` each require approval before executing
  (`packages/shared/src/background-controller.test.ts`).
- Batch tests verify approval-gated actions run one at a time, denial
  continues the batch, timeout returns a partial `batch_result` with skipped
  remaining actions, and `approve_session` is reused within a batch
  (`packages/shared/src/background-controller.test.ts`).
- MCP websocket-client tests assert gated envelopes carry a unique
  `actionUUID` and `approvalRequest: true`, and that batch actions each
  receive an `actionUUID` (`servers/mcp/src/websocket-client.test.ts`).
- MCP protocol tests assert envelope constructors emit approval metadata only
  when present (`servers/mcp/src/protocol.test.ts`).
- HTTP server tests assert the derived `approvalTimeoutMs` equals `55000` for
  the default `60000` / `5000` inputs (`servers/mcp/src/http-server.test.ts`).
- Extension background/content tests assert the `show_brijio_approval` /
  `hide_brijio_approval` messages and the banner's three decisions
  (`clients/extensions/chrome/src/background.test.ts`,
  `clients/extensions/chrome/src/content.test.ts`, and the Safari
  equivalents).
