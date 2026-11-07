---
type: "Reference"
title: "Security and Trust Model"
openwiki_generated: true
verified:
  - by: openwiki/0.9.0
    at: 2026-11-07T14:40:48.642Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
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
generated: { by: "openwiki/0.9.0", at: "2026-11-07T14:40:48.642Z" }
---

# Security and Trust Model

Brijio is built around explicit control and minimal trust. It does not give an
agent its own browser, does not export credentials, and does not push ambient
browser state. Instead it bridges a remote agent to the authenticated browser
session the user already controls, exchanging data only through explicit,
request-driven MCP tool calls.

## Core trust assumptions

From `docs/security/THREAT_MODEL.md` and `docs/security/TRUST_BOUNDARIES.md`:

- **The user explicitly starts and controls the browser connection.** The
  browser bridge is inactive until the user connects, and the user can
  disconnect at any time. Browser state is available only while the
  user-controlled extension is connected.
- **Authentication tokens are held only by authorized parties.** The MCP
  server and relay authenticate with separate MCP auth tokens; the relay and
  browser extension authenticate with a pairing token. Agent authorization is
  separate from extension identity.
- **The browser session belongs to the user.** Brijio operates on the session
  the user is already signed into. It does not create duplicate authenticated
  environments and does not treat the agent as the session owner.
- **The relay transports messages without needing to inspect content.** The
  relay routes between authenticated parties but is not designed to read
  payloads. Future end-to-end encryption will strengthen this boundary by
  ensuring the relay cannot inspect payloads.

These are the sources of truth the rest of the security model is built on.

## Trust boundaries

`docs/security/TRUST_BOUNDARIES.md` makes the boundaries explicit:

- **Agent ↔ MCP server** — the agent trusts the MCP server to relay requests
  accurately and return responses without modification. The MCP server does
  _not_ trust the agent to limit itself; every request is validated against the
  protocol specification.
- **MCP server ↔ relay** — authenticated with separate tokens. The relay trusts
  the MCP server to be an authorized consumer; the MCP server trusts the relay
  to route to the intended browser. Communication is authenticated, but the
  relay does not need to inspect message payloads.
- **Relay ↔ browser extension** — authenticated with a pairing token. The
  extension does not trust the relay to protect confidentiality; E2E encryption
  is planned to harden this boundary.
- **Extension ↔ browser session** — the extension runs inside the user's
  browser with the permissions the user has granted. It does not trust web page
  content: page data is read as structured context, never executed or
  evaluated.

The guiding rule from the trust-boundaries document is: when evaluating a new
feature, ask whether it expands trust in any party that should not be trusted.
If yes, the feature needs additional safeguards before it can be accepted.

## Security goals

The threat model states the primary goals:

- protect browser sessions
- avoid credential exposure
- minimize unnecessary data transfer
- reduce trust in relay infrastructure
- maintain user control

These are supported by architectural choices — explicit request/response
flows, no continuous streaming, user-controlled connections, and progressive
disclosure — rather than purely defensive code patterns.

## Threats the project plans around

`docs/security/THREAT_MODEL.md` calls out four classes of attacker, each with
architectural mitigations.

### Malicious agent

An agent that tries to access data beyond what was explicitly requested,
exfiltrate browser state, or perform unauthorized actions.

Mitigations: explicit request/response protocol; no continuous streaming by
design; user-controlled browser connection; progressive disclosure limits data
exposure. All requests are validated against the protocol specification — agent
intent is never assumed to be good.

### Compromised relay server

A relay that tries to inspect, modify, or log traffic between agents and
browsers.

Mitigations: the relay routes messages without requiring content access; future
end-to-end encryption will prevent content inspection; user-controlled
infrastructure allows self-hosting, so the hosted relay is not a single point of
trust.

### Network attacker

An attacker on the network path between agent, relay, and browser.

Mitigations: TLS for all transports; authentication tokens for all connections;
future E2E encryption will add defense in depth.

### Malicious website

A website that tries to exploit the browser extension or inject content that
misleads the agent.

Mitigations: the extension follows a least-privilege permission model; the
structured protocol prevents arbitrary code execution; page content is read,
not evaluated.

## Explicit non-goals

These boundaries are prominent and deliberate. They are **product boundaries,
not missing features**. `docs/security/SECURITY_GUARANTEES.md`,
`docs/project/CAPABILITY_MATRIX.md`, and `AGENTS.md` all mark them as
intentionally unsupported.

Brijio intentionally does **not** provide:

- **Cookie export** — authentication and session cookies, and browser storage,
  are never exported. The browser session remains local.
- **Session cloning** — Brijio operates on the session the user already
  controls. It does not create duplicate authenticated environments.
- **Browser mirroring / remote desktop** — no window mirroring, desktop
  streaming, or remote desktop access. Brijio is not remote desktop software.
- **Continuous screenshots** — screenshots, when planned, are only available on
  explicit request, never pushed automatically.
- **Continuous DOM streaming** — no continuous page, DOM, screenshot, history,
  or browser-state streaming. Data is exchanged only on explicit request.
- **Background surveillance** — the bridge is inactive until the user connects.
  It does not publish ambient browser state.
- **Browser history collection** — outside project scope.
- **Credential extraction** — passwords, passkeys, and MFA codes are never
  collected. Password fields return `browser_error` on `fill_input` attempts.
- **MFA interception** — MFA challenges belong to the user. This is a security
  boundary.

The `AGENTS.md` non-negotiable invariants restate these as hard rules: do not
add continuous page, DOM, screenshot, history, or browser-state streaming; do
not implement silent background surveillance, cookie export, credential
extraction, session cloning, or MFA interception; do not persist page content
unless an accepted ADR explicitly requires it.

## Client-side action approval

Brijio keeps the user in the loop for browser-mutating actions through
client-side action approval (ADR 0048). This is a security control, not a UX
feature, and it reinforces the core invariant that agents must not gain silent
<!-- openwiki: broken internal link [../workflows/action-approval.md] file "../workflows/action-approval.md" does not exist. Fix the href or restore the target, then delete this comment. -->

background authority. See [Action Approval](../workflows/action-approval.md) for
the user-facing workflow.

Key properties from the accepted ADR:

- **Not every action requires approval.** For the first hardcoded
  implementation, only `submit_form`, `fetch_resource`, and `download_file`
  require user approval. Policy is evaluated behind a small
  `requiresApproval(operation)` function so it can later delegate to local
  configuration or an enterprise policy API without changing the action
  execution pipeline.
- **Per-action identifiers.** Every approval-gated operation carries a unique
  `actionUUID` and `approvalRequest: true`. For `perform_batch`, every batch
  item carries an `actionUUID`, and only approval-gated items are flagged.
- **Three user choices:** `approve` (this action only), `approve_session` (this
  action plus future matching actions during the same bridge connection), and
  `deny`. Session grants are scoped to `{ origin, actionType }` and verified
  against the active tab origin at execution time; if the origin changed, the
  action fails rather than reusing the grant.
- **Memory-only state.** Pending actions and approval grants live in extension
  background memory only — never in page `localStorage`, extension storage,
  IndexedDB, or other persistent stores. Grants are cleared when the bridge
  disconnects, the extension reloads, or the browser session ends.
- **Timeout before HTTP timeout.** The approval timer is computed as
  `httpRequestTimeoutMs - approvalTimeoutBufferMs` so Brijio can return a
  structured `approval_timeout` error instead of letting the HTTP server or
  client produce a generic timeout. Remote/enterprise deployments must configure
  the timer below the shortest client, proxy, gateway, or load-balancer
  timeout.
- **Structured error codes:** `approval_denied`, `approval_timeout`,
  `approval_unavailable` (banner could not render), and
  `approval_origin_changed`. Errors include the relevant `actionUUID`.
- **Batches stay ordered and explicit.** Approval-gated batch items execute one
  at a time; a denied action is a focused per-action outcome (not a whole-batch
  abort), and a timeout returns a partial `batch_result` with focused failed
  entries for the timed-out and remaining actions.

The ADR lists these as **out of scope**: persisting approvals across bridge
connections or restarts, agent polling for approval status, approval for actions
beyond the hardcoded list, silent auto-approval based on form contents or
labels, and storing pending actions in persistent storage.

The security-relevant invariant this enforces is one of the `AGENTS.md`
non-negotiables: preserve user-visible connection state and configured
client-side action approval, and do not bypass approval checks.

## The relay as transport

The relay is intended as a transport, not a data processor. The keepalive
messages it carries contain no browser state, and the extension is reactive —
it answers explicit requests and returns structured results rather than
publishing ambient state. This is why "reduce trust in relay infrastructure" is
a security goal rather than just an architectural preference. See
<!-- openwiki: broken internal link [../architecture/websocket-relay.md] file "../architecture/websocket-relay.md" does not exist. Fix the href or restore the target, then delete this comment. -->

[WebSocket Relay](../architecture/websocket-relay.md) for the relay protocol
and routing design.

## Change guidance

From `AGENTS.md`, an ADR is required before implementing a change that
introduces or alters authentication, authorization, privacy, storage, or a trust
boundary; browser routing, targeting, or lifecycle semantics; or a product
capability / cross-package protocol. Many design choices in Brijio are
security choices, not just implementation choices.

If you change any of the following, re-check the security docs
(`docs/security/*`) and the capability matrix first:

- **Authentication or authorization** — token issuance, pairing tokens,
  MCP auth tokens, or who is trusted at each boundary.
- **Routing or browser-state exposure** — message routing, per-call browser and
  `tabId` targeting, short-lived target IDs, or what browser state is exposed
  to the agent.
- **Page-reading or action behavior** — anything that changes what is read, how
  content is extracted, whether actions require approval, or whether state is
  persisted.
- **Approval policy** — the hardcoded approval-gated list, the
  `requiresApproval` function, or session-grant scope.

When updating a security boundary, also update the relevant documentation first:
`docs/security/SECURITY_GUARANTEES.md` for guarantees, `docs/security/THREAT_MODEL.md`
for threat actors, `docs/security/TRUST_BOUNDARIES.md` for boundaries,
`docs/project/CAPABILITY_MATRIX.md` for capability and support status, and
`docs/architecture/decisions` for the ADR. Keep documentation linked rather than
copying mutable inventories between files.

## Related source files

- `docs/security/THREAT_MODEL.md`
- `docs/security/TRUST_BOUNDARIES.md`
- `docs/security/SECURITY_GUARANTEES.md`
- `docs/project/CAPABILITY_MATRIX.md`
- `docs/architecture/decisions/0048-client-side-action-approval.md`
- `AGENTS.md`
- `README.md`
