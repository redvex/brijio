---
type: "Reference"
title: "Security and Trust Model"
openwiki_generated: true
verified:
  - by: openwiki/0.9.0
    at: 2026-11-28T16:38:16.677Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-992a62d4a0e989fc2da546d0
    resource: repo://docs/architecture/decisions/0048-client-side-action-approval.md
  - id: openwiki-source-79dd91ec51a55e7e78c52ccc
    resource: repo://docs/architecture/decisions/0064-visual-action-verification.md
  - id: openwiki-source-9b8357af9c7ef75912f57765
    resource: repo://docs/project/CAPABILITY_MATRIX.md
  - id: openwiki-source-aae624fcff023b16e3665555
    resource: repo://docs/security/SECURITY_GUARANTEES.md
  - id: openwiki-source-cbad6d495fc481cc62e88aef
    resource: repo://docs/security/THREAT_MODEL.md
  - id: openwiki-source-0c22eda9f95dd622fb06ce00
    resource: repo://docs/security/TRUST_BOUNDARIES.md
generated: { by: "openwiki/0.9.0", at: "2026-11-28T16:38:16.677Z" }
---

# Security and Trust Model

Brijio is built around explicit control and minimal trust. The browser session belongs to the user, the bridge only runs while the user keeps it connected, and every read or action is the result of an explicit request — never ambient background surveillance. This page consolidates the security posture from `docs/security/`, the non-negotiable invariants in `AGENTS.md`, and the accepted/proposed ADRs that add security-relevant surfaces.

## Core trust assumptions

From `docs/security/THREAT_MODEL.md` and `TRUST_BOUNDARIES.md`:

- The user explicitly starts and controls browser connections.
- Authentication tokens are kept secret by authorized parties; the agent-facing MCP token is separate from the extension pairing token.
- The browser session belongs to the user.
- The relay transports messages without needing to inspect content.

Trust is placed and minimized across four boundaries:

| Boundary                            | Trust placed in                          | Trust minimized by                                                           |
| ----------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------- |
| Agent ↔ MCP Server                  | MCP server relays and validates requests | All requests validated against the protocol spec; agent intent never assumed |
| MCP Server ↔ Relay                  | Relay routes to the intended browser     | Separate tokens; relay need not inspect payloads                             |
| Relay ↔ Browser Extension           | Extension as the live browser session    | Pairing token; E2E encryption planned                                        |
| Browser Extension ↔ Browser Session | Extension reads structured DOM           | Page data read, not executed; least-privilege permissions                    |

The guiding rule for any new feature: if it expands trust in a party that should not be trusted, it needs additional safeguards before it can be accepted.

## Security goals

The threat model (`docs/security/THREAT_MODEL.md`) defines the primary goals:

- Protect browser sessions.
- Avoid credential exposure.
- Minimize unnecessary data transfer.
- Maintain user control.
- Reduce trust in relay infrastructure.

## Threat classes and mitigations

The threat model enumerates four classes of attacker. Mitigations are architectural rather than purely defensive code patterns.

### Malicious agent

An agent that attempts to access data beyond what was explicitly requested, exfiltrate browser state, or perform unauthorized actions.

Mitigations:

- Explicit request/response protocol; no continuous streaming by design.
- User-controlled browser connection.
- Progressive disclosure — structured context is returned before larger page content or visual data.
- **Client-side action approval** (see below) gates the most consequential mutating actions behind explicit user approve/deny decisions.

### Compromised relay server

A relay that attempts to inspect, modify, or log traffic between agents and browsers.

Mitigations:

- Relay routes messages without requiring content access.
- User-controlled infrastructure allows self-hosting.
- Future end-to-end encryption will prevent content inspection.

### Network attacker

An attacker on the network path between agent, relay, and browser.

Mitigations:

- TLS for all transports.
- Authentication tokens for all connections.
- Future E2E encryption adds defense in depth.

### Malicious website

A website that attempts to exploit the browser extension or inject content that misleads the agent.

Mitigations:

- Extension follows a least-privilege permission model.
- Structured protocol prevents arbitrary code execution.
- Content is read, not evaluated.

## Client-side action approval as a security boundary

ADR 0048 (Accepted) adds a user-approval gate in the browser for selected browser-mutating operations. This is a first-class security boundary, not a convenience feature: it converts actions that can send user-entered data to a site, trigger navigation, or cause server-side side effects into operations the user must explicitly allow before they execute.

### What is gated

The first implementation uses a hardcoded, local approval-gated list:

- `submit_form` — can submit user-entered data and trigger navigation or server side effects.
- `fetch_resource` — authenticated resource fetching.
- `download_file` — browser download initiation.

Other actions (click, fill, set_checked, select_options) do **not** require approval. The approval system is intentionally not applied to every action; policy evaluation is kept behind a small `requiresApproval(operation)` function so it can later delegate to local configuration or an enterprise policy API without changing the action execution pipeline.

### How approval works

Every approval-gated operation carries a unique `actionUUID` and `approvalRequest: true` in its payload (for `perform_batch`, every batch item carries an `actionUUID`, and gated items carry `approvalRequest: true`). When the action reaches the connected extension:

1. The background script checks for a matching in-memory **session grant** for the same `{ origin, actionType }`. If one exists and the active tab still has the same origin, the action executes without a fresh prompt.
2. Otherwise the content script renders an approval banner and the user chooses one of three decisions:
   - `approve` — approve only this action.
   - `approve_session` — approve this action and future matching actions during the same bridge connection, scoped to `{ origin, actionType }`.
   - `deny` — reject this action.
3. Before executing an approved action, the extension re-verifies the active tab still has the same origin and action type; if the origin changed, the action fails closed with `approval_origin_changed` instead of reusing the grant.

Approval grants and pending actions are held in **extension/background memory only**. They are not stored in page `localStorage`, extension storage, IndexedDB, or any persistent store, and they are cleared when the bridge disconnects, the extension reloads, or the browser session ends.

### The MCP server stays stateless

The MCP server is commonly instantiated per tool invocation and must **not** hold approval state. Continuity lives in the extension (live browser session) and the relay (connection routing). Agent polling for approval status is explicitly out of scope for ADR 0048; a future design can add an in-memory, session-scoped WebSocket status registry keyed by `actionUUID` while keeping the MCP process stateless across invocations.

### Timeout and failure semantics

Approval-gated requests use an application-level timer owned by Brijio that must fire _before_ the local MCP HTTP request timeout, so Brijio returns a structured approval error rather than a generic HTTP timeout:

```text
approvalTimeoutMs = httpRequestTimeoutMs - approvalTimeoutBufferMs
```

If the user does not respond before `approvalTimeoutMs`, the extension hides the banner, cancels the pending approval, and returns a structured `approval_timeout` error. The user-facing default is roughly 30–60 seconds depending on the configured local MCP HTTP timeout. Approval-specific error codes:

- `approval_denied` — user denied the action.
- `approval_timeout` — user did not respond before the computed timeout.
- `approval_unavailable` — the extension could not render the approval UI (e.g., restricted pages).
- `approval_origin_changed` — the active tab origin changed before execution.

All errors include the relevant `actionUUID`.

### Batches

Inside `perform_batch`, each action is treated independently: non-gated actions execute normally, gated actions prompt one at a time, and the batch only advances to the next action after the current one succeeds, is denied, or times out. A denied action returns `approval_denied` for its `actionUUID` and the batch continues with later actions (denial is a focused per-action outcome, not a batch abort). An approval timeout returns a partial `batch_result` with focused errors for the timed-out and unexecuted actions while keeping already-completed results. The background script owns the pending-action queue, timeout timers, session grants, batch sequencing, and final result assembly — keeping policy state outside the webpage and out of persistent storage.

See [Action Approval](workflows/action-approval.md) for the user-facing workflow and [MCP Extension Flow](architecture/mcp-extension-flow.md) for the request routing path.

## Screenshot privacy

`capture_screenshot` (ADR 0064, Proposed) is the only visual capture surface, and it is constrained to preserve the privacy model:

- **Explicit-only.** There is no auto-capture, no continuous screenshots, and no background polling. The tool is invoked only by an explicit MCP tool call. This matches the capability matrix boundary: "No continuous screenshots" is intentionally unsupported.
- **Active-tab-only.** It uses `tabs.captureVisibleTab()` on the active tab in the current window. Background tabs cannot be captured without switching focus (which would disrupt the user); if the agent needs a specific tab it can `list_tabs` and `open_tab` to create a dedicated tab.
- **Viewport JPEG, not full-page.** It returns a viewport-only JPEG at quality 80 — not a full-page scroll-stitch, not a screencast, and not video. Full-page capture, annotation, and redaction are deferred to a later enterprise tier.
- **No new permissions.** The existing `*://*/*` host permissions and `activeTab` already cover `captureVisibleTab`; runtime permission errors fall back to `capability_not_supported`.

The response is MCP image content returned directly to the agent (no temp file for the first implementation). Safari 14+ supports the same `browser.tabs.captureVisibleTab()` API; runtime failures return structured errors defensively.

## Explicit non-goals

The capability matrix marks these as 🚫 intentionally unsupported — product boundaries, not missing features:

- Cookie export.
- Session cloning.
- Browser mirroring / remote desktop.
- Continuous screenshots.
- Continuous DOM streaming.
- Background surveillance.
- Browser history collection.
- Credential extraction (password fields return `browser_error` on fill attempts).
- MFA interception.

`docs/security/SECURITY_GUARANTEES.md` restates the same guarantees: Brijio does not export cookies, does not clone sessions, is not remote desktop software, does not continuously monitor, does not collect credentials, and the cloud relay is intended as transport, not a data processor.

## Non-negotiable invariants

`AGENTS.md` defines invariants that are security-relevant and must not be weakened:

- The user explicitly starts and stops the browser bridge; browser state is available only while the user-controlled extension is connected.
- Every browser read or action is initiated by an explicit MCP tool or resource request — no continuous page, DOM, screenshot, history, or browser-state streaming.
- No silent background surveillance, cookie export, credential extraction, session cloning, or MFA interception.
- Do not persist page content unless an accepted ADR explicitly requires it.
- Preserve authenticated, private browser and tab routing with explicit request IDs, structured errors, and timeouts; preserve explicit per-call `browser` and `tabId` targeting with no hidden selected-browser or selected-tab session state.
- **Do not bypass approval checks.** Preserve configured client-side action approval.
- **Keep permissions minimal** and document why each browser permission is needed.
- Prefer progressive disclosure: return structured context before larger page content or visual data.

The extension is reactive: it answers explicit requests and returns structured results; it does not publish ambient browser state.

## Change guidance

Many design choices are security choices, not just implementation choices. Before changing authentication, routing, browser-state exposure, page-reading behavior, the approval-gated action list, or any visual capture behavior, re-check the security docs first:

- `docs/security/THREAT_MODEL.md`
- `docs/security/TRUST_BOUNDARIES.md`
- `docs/security/SECURITY_GUARANTEES.md`
- `docs/project/CAPABILITY_MATRIX.md`
- `docs/architecture/decisions/0048-client-side-action-approval.md`
- `docs/architecture/decisions/0064-visual-action-verification.md`

An ADR is required before implementing changes that alter authentication, authorization, privacy, storage, a trust boundary, or browser routing/targeting/lifecycle semantics.

## Related pages

- [Action Approval](workflows/action-approval.md)
- [MCP Extension Flow](architecture/mcp-extension-flow.md)
- [Browser Content Pipeline](architecture/browser-content-pipeline.md)
- [Data and Protocol](data-and-protocol.md)
