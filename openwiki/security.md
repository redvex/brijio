---
type: "Reference"
title: "Security and Trust Model"
description: "Brijio security posture: core trust assumptions, security goals, threat classes, explicit non-goals, the client-side action approval trust boundary, and change guidance for authentication, routing, and browser-state exposure."
tags: [security, trust-model, threat-model, approval, permissions]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-14T14:46:23.462Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-af7274aa59c39815b06b15de
    resource: repo://docs/architecture/decisions/0011-regular-page-host-permissions-for-chrome-extension.md
  - id: openwiki-source-992a62d4a0e989fc2da546d0
    resource: repo://docs/architecture/decisions/0048-client-side-action-approval.md
  - id: openwiki-source-9b8357af9c7ef75912f57765
    resource: repo://docs/project/CAPABILITY_MATRIX.md
  - id: openwiki-source-aae624fcff023b16e3665555
    resource: repo://docs/security/SECURITY_GUARANTEES.md
  - id: openwiki-source-cbad6d495fc481cc62e88aef
    resource: repo://docs/security/THREAT_MODEL.md
  - id: openwiki-source-0c22eda9f95dd622fb06ce00
    resource: repo://docs/security/TRUST_BOUNDARIES.md
  - id: openwiki-source-5524638d57e96598fd8e40d4
    resource: repo://packages/shared/src/background-controller.ts
generated: { by: "openwiki/0.9.0", at: "2026-11-14T14:46:23.462Z" }
---

# Security and Trust Model

Brijio is built around explicit control and minimal trust. The browser is the
source of truth for authenticated state; the extension is reactive and answers
only explicit requests; and the cloud relay is a transport, not a data
processor. This page summarizes the security docs in `docs/security/` and the
invariants enforced in code, then gives change guidance for the areas where a
design decision is also a security decision.

## Core trust assumptions

The threat model (`docs/security/THREAT_MODEL.md`) and trust boundaries
(`docs/security/TRUST_BOUNDARIES.md`) state these assumptions explicitly:

- The user explicitly starts and controls the browser connection.
- Authentication tokens are held only by authorized parties.
- The browser session belongs to the user.
- The relay transports messages without needing to inspect content.

Trust is placed deliberately and minimized at each boundary:

| Boundary            | Trust placed in | How it is bounded                                                  |
| ------------------- | --------------- | ------------------------------------------------------------------ |
| Browser identity    | Pairing token   | Authenticated at WebSocket connection                              |
| Agent authorization | MCP auth token  | Separate from the extension pairing token                          |
| Message routing     | Relay           | Routes between authenticated parties without content access        |
| Browser session     | User            | User controls connection state; bridge is inactive until connected |
| Page data accuracy  | Extension       | Reads structured DOM as data, not arbitrary JS                     |

## Security goals

From `docs/security/THREAT_MODEL.md`, Brijio's security goals are:

- Protect browser sessions.
- Avoid credential exposure.
- Minimize unnecessary data transfer.
- Reduce trust in relay infrastructure.
- Maintain user control.

These are reinforced by the product invariants in `AGENTS.md`: the user
explicitly starts and stops the bridge, browser state is available only while
the user-controlled extension is connected, and every read or action is
initiated by an explicit MCP tool or resource request.

## Threat classes and architectural mitigations

The threat model names four classes of attacker. The mitigations are
architectural rather than purely defensive code patterns.

### Malicious agent

An agent that attempts to access data beyond what was explicitly requested,
exfiltrate browser state, or perform unauthorized actions.

Mitigations:

- **Explicit request/response protocol** — no data flows without an explicit
  MCP tool call; the extension never publishes ambient browser state.
- **No continuous streaming** — there is no page, DOM, screenshot, history, or
  browser-state push; agents must poll via `read_current_page`.
- **Progressive disclosure** — structured context (URL, title, headings, links,
  forms) is returned before larger page content or visual data.
- **Per-call targeting** — each browser read and action targets an explicit
  browser and `tabId`; there is no hidden selected-browser or selected-tab
  session state that an agent can inherit.
- **Client-side action approval** — see the trust boundary below.

### Compromised relay server

A relay that attempts to inspect, modify, or log traffic between agents and
browsers.

Mitigations:

- The relay routes messages between authenticated parties without requiring
  content access.
- Future end-to-end encryption will prevent content inspection.
- User-controlled infrastructure allows self-hosting, reducing dependence on the
  hosted relay.

### Network attacker

An attacker on the network path between agent, relay, and browser.

Mitigations:

- TLS for all transports.
- Authentication tokens for all connections (separate MCP and pairing tokens).
- Future end-to-end encryption will add defense in depth.

### Malicious website

A website that attempts to exploit the browser extension or inject content that
misleads the agent.

Mitigations:

- The extension follows a least-privilege permission model.
- The structured protocol prevents arbitrary code execution; page content is
  read, not evaluated.
- Read targets are restricted to regular `http://` and `https://` pages; internal
  browser pages and restricted pages are rejected before script injection.

## Client-side action approval trust boundary (ADR 0048)

Most browser-mutating actions (`click_element`, `fill_input`, `set_checked`,
`select_options`, `upload_file`) execute once they reach the connected
extension. Three operations are gated behind an additional client-side user
approval step before they execute:

- `submit_form`
- `fetch_resource`
- `download_file`

The approval policy is hardcoded in the extension background controller's
`getApprovalActionType`. The `AGENTS.md` invariants require preserving
configured client-side action approval and **never bypassing approval checks**.

### How approval works

Each approval-gated operation carries a unique `actionUUID` and
`approvalRequest: true`. When the extension receives such a request, the
background controller calls `ensureApprovedAction` before execution. The
`ApprovalAdapter` renders a user-facing approval banner and returns one of three
decisions:

- `approve` — approve only the current action.
- `approve_session` — approve this action and future matching actions during the
  same bridge connection.
- `deny` — reject the current action.

Session grants are scoped to `{ origin, actionType }`, where the origin is the
active tab origin computed at approval time. Before executing an approved
action, the controller re-checks the active origin; if it changed, the action
fails with `approval_origin_changed` rather than reusing the grant. Grant keys
are held only in background memory (`approvalSessionGrants`); they are cleared
when the bridge disconnects, the extension reloads, or the session ends. Pending
actions are never stored in `localStorage`, extension storage, IndexedDB, or
other persistent stores.

### Approval failure modes

Approval errors are structured and agent-visible:

- `approval_denied` — user denied the action.
- `approval_timeout` — user did not respond before the computed approval
  timeout (default 55000 ms, derived from the local MCP HTTP timeout minus a
  buffer). On timeout the banner is hidden and the pending approval cancelled.
- `approval_unavailable` — the extension could not render the approval UI or the
  adapter is absent.
- `approval_origin_changed` — the active tab origin changed before an approved
  action could run.

If the `ApprovalAdapter` is not provided, or the action lacks a valid
`actionUUID`, the controller returns `approval_unavailable` rather than
executing silently — it fails closed.

### Approval in batches

Inside `perform_batch`, each action is treated independently. Only `submit_form`
is approval-gated within batches; `fetch_resource` and `download_file` are
standalone tools. Actions execute in order; an approval-gated action waits for
its own prompt (or reuses a session grant) before continuing. Denial or timeout
of one action is a focused per-action outcome: a denied action returns
`approval_denied` for its `actionUUID` and the batch continues to later actions,
while a timeout returns a partial `batch_result` with focused errors for the
timed-out and unexecuted actions. The full approval flow is documented in the
[action approval workflow](workflows/action-approval.md).

## Explicit non-goals

The capability matrix marks these as 🚫 _Intentionally unsupported_ — deliberate
product boundaries, not missing features:

- Cookie export (violates the authenticated-session model).
- Session cloning (the browser remains the source of truth for authenticated
  state).
- Browser mirroring (Brijio is not remote desktop software).
- Continuous screenshots (privacy and token efficiency; screenshots are only on
  explicit request).
- Continuous DOM streaming (data is exchanged only on explicit request).
- Background surveillance (the bridge is inactive until the user connects).
- Browser history collection (outside project scope).
- Credential extraction (password fields return `browser_error` on `fill_input`
  attempts).
- MFA interception (MFA challenges belong to the user).

## Permission minimality (ADR 0011)

Brijio follows a least-privilege permission model. The `AGENTS.md` invariants
require keeping permissions minimal and documenting why each browser permission
is needed. ADR 0011 codifies this for page reading: the Chrome extension keeps
`activeTab` for the lightweight path and adds optional `http://*/*` and
`https://*/*` host permissions, requested from a user-initiated flow rather
than silently from background request handling. The extension rejects
non-regular pages (`chrome://`, `chrome-extension://`, Web Store pages,
restricted viewer pages, file URLs) before attempting script injection. Each
added permission must be documented and justified; the extension adapters are
described in [extension adapters](architecture/extension-adapters.md).

## Change guidance

Many design choices in Brijio are security choices, not just implementation
choices. Before changing any of the following, re-check the security docs
(`docs/security/`) and the relevant ADRs first:

- **Authentication** — pairing tokens, MCP auth tokens, and the separation
  between them.
- **Routing** — explicit per-call browser and `tabId` targeting, and the
  authenticated relay routing model.
- **Browser-state exposure** — any read of page content, DOM, screenshots, or
  tab/browser metadata, and the explicit request/response and progressive
  disclosure rules.
- **Page-reading behavior** — the URL-scheme guard, host-permission flow, and
  read-as-data (never execute) contract.
- **Action approval** — the `submit_form`, `fetch_resource`, and `download_file`
  gating list, the `ApprovalAdapter` boundary, and the memory-only grant model.

The trust-boundaries guiding rule: when evaluating a new feature, ask whether
it expands trust in any party that should not be trusted. If yes, the feature
needs additional safeguards before it can be accepted. Cross-layer protocol or
browser-capability changes typically require an ADR before implementation; see
the [architecture](architecture.md) and [data and protocol](data-and-protocol.md)
pages for the cross-layer change path.

## Related source files

- `docs/security/THREAT_MODEL.md`
- `docs/security/TRUST_BOUNDARIES.md`
- `docs/security/SECURITY_GUARANTEES.md`
- `docs/project/CAPABILITY_MATRIX.md`
- `docs/architecture/decisions/0011-regular-page-host-permissions-for-chrome-extension.md`
- `docs/architecture/decisions/0048-client-side-action-approval.md`
- `packages/shared/src/background-controller.ts`
