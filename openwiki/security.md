---
type: "Reference"
title: "Security and Trust Model"
description: "Brijio security posture: core trust assumptions, security goals, threat classes, explicit non-goals, client-side action approval, browser permissions, and change guidance for authentication, routing, and browser-state exposure."
tags:
  [
    security,
    trust,
    threat-model,
    authentication,
    approval,
    privacy,
    permissions,
    relay,
  ]
verified:
  - by: openwiki/0.9.0
    at: 2026-11-20T16:42:52.757Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-dacf7bd89f09b6d1db0c5fa2
    resource: repo://clients/extensions/chrome/manifest.json
  - id: openwiki-source-fa213a96cd30a09d577d0a92
    resource: repo://clients/extensions/chrome/src/permissions.ts
  - id: openwiki-source-992a62d4a0e989fc2da546d0
    resource: repo://docs/architecture/decisions/0048-client-side-action-approval.md
  - id: openwiki-source-ddb891893094959f285c6239
    resource: repo://docs/artifacts/client-side-action-approval.md
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
  - id: openwiki-source-c20cbcf46daa07e6332e3f7f
    resource: repo://packages/shared/src/protocol.ts
  - id: openwiki-source-1e871ebe65ae85a216285234
    resource: repo://servers/mcp/src/http-server.ts
  - id: openwiki-source-bdc89ae687954f18387846a0
    resource: repo://servers/mcp/src/websocket-client.test.ts
  - id: openwiki-source-fc4b25ba659ae4c102750c8d
    resource: repo://servers/mcp/src/websocket-client.ts
  - id: openwiki-source-875036d8e83469fa1fc3f8e3
    resource: repo://servers/websocket/src/server.ts
generated: { by: "openwiki/0.9.0", at: "2026-11-20T16:42:52.757Z" }
---

# Security and Trust Model

Brijio connects a remote AI agent to a browser session the user already controls.
Its security posture is architectural rather than incidental: control is explicit,
trust is minimized, and most guarantees are enforced by _what the system does not
do_ as much as by what it does. This page summarizes the trust assumptions, the
security goals, the threat classes the design plans around, the explicit
non-goals, the client-side action-approval model, the browser permissions, and
the change guidance that keeps these choices intact.

## Core trust assumptions

The threat model states the assumptions the design rests on explicitly:

- The user explicitly starts and stops the browser bridge; nothing happens in
  the background.
- Authentication tokens are held only by authorized parties.
- The browser session belongs to the user — Brijio operates on the session the
  user is already using, never a cloned or duplicated one.
- The relay transports messages between authenticated parties without needing to
  inspect their content.

These assumptions are non-negotiable invariants in `AGENTS.md`: the user
explicitly starts and stops the bridge, browser state is available only while
the user-controlled extension is connected, every read or action is initiated
by an explicit MCP tool or resource request, and the extension is reactive
(it answers explicit requests and returns structured results rather than
publishing ambient browser state).

## Security goals

The threat model lists five goals:

- protect browser sessions
- avoid credential exposure
- minimize unnecessary data transfer
- reduce trust in relay infrastructure
- maintain user control

These goals are realized through the architectural chain documented on
[Architecture](architecture.md): an explicit request/response flow
`Agent -> MCP Server -> WebSocket Relay -> Browser Extension -> Browser Session`,
with no continuous streaming and with progressive disclosure returning the
minimum context needed before larger page content or visual data.

## Threat classes and mitigations

The threat model enumerates four attacker classes. The mitigations are
architectural — request/response discipline, the absence of streaming,
user-controlled connections, and progressive disclosure — not just defensive
code.

| Threat class      | What it assumes                                                                                        | Architectural mitigations                                                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Malicious agent   | Tries to access data beyond what was requested, exfiltrate browser state, or act without authorization | Explicit request/response protocol; no continuous streaming by design; user-controlled connection; progressive disclosure limits data exposure; all requests validated against the protocol specification |
| Compromised relay | Tries to inspect, modify, or log traffic between agents and browsers                                   | Relay routes messages without requiring content access; future end-to-end encryption will prevent content inspection; user-controlled infrastructure allows self-hosting                                  |
| Network attacker  | Sits on the network path between agent, relay, and browser                                             | TLS for all transports; authentication tokens for all connections; future E2E encryption as defense in depth                                                                                              |
| Malicious website | Tries to exploit the extension or inject content that misleads the agent                               | Least-privilege permission model; structured protocol prevents arbitrary code execution; page content is read as structured context, not evaluated                                                        |

### Trust boundaries

The trust-boundaries document maps where trust is placed, minimized, and
_not_ assumed:

- **Agent ↔ MCP server** — the MCP server does not trust the agent to limit
  itself; every request is validated against the protocol spec.
- **MCP server ↔ relay** — they authenticate with separate tokens. The relay
  trusts the MCP server as an authorized consumer; the MCP server trusts the
  relay to route. The relay does not need to inspect payloads.
- **Relay ↔ extension** — they authenticate with a pairing token; the extension
  does _not_ trust the relay for data confidentiality (E2E encryption is planned
  to strengthen this).
- **Extension ↔ browser session** — the extension operates with the permissions
  the user granted; it does not trust web-page content, reading it as
  structured data rather than executing it.

Trust is _not_ assumed for the network (TLS required), cloud-relay privacy
(transport only, not a data processor), agent intent (all requests validated),
or website content (read as data, never executed). The guiding rule: when
evaluating a new feature, ask _"Does this change expand trust in any party that
should not be trusted?"_ If yes, the feature needs additional safeguards.

## Authentication and routing

Authentication is token-based and scoped so that no single token grants broad
access across roles.

- The relay requires `BRIJIO_PAIRING_TOKEN` (or `BRIJIO_TOKEN`) before it will
  accept any connection; a missing token is a startup error. Unauthenticated
  messages receive `auth_required`, and a wrong token receives `auth_failed`.
- Once authenticated, a connection's `scopeKey` is derived from the pairing
  token. Routing is keyed by that scope plus the message `id`, so the relay
  routes a response back to the specific MCP socket waiting for it without
  needing to interpret the payload.
- The extension and the MCP server use _separate_ tokens, so agent
  authorization (MCP auth token) and browser identity (pairing token) are
  independent trust facts rather than one shared secret.

The relay deliberately routes between authenticated parties and does not need
content access. This is the property that lets the hosted relay be intended as
transport rather than a data processor, and it is the precondition for the
planned end-to-end encryption.

## Client-side action approval

Most browser actions (`click`, `write_text`, `set_checked`, `select_options`,
`navigate_to_url`) execute without a browser-side prompt. ADR 0048 introduces
**client-side action approval** for a hardcoded first set of sensitive
operations, so the user explicitly confirms them in the browser before the
extension performs them:

- `submit_form`
- `fetch_resource`
- `download_file`

Approval is a privacy and safety boundary, not an extra step on every action.
The design preserves the core invariants: the extension is user-controlled,
browser state is only available while the bridge is connected, and agents must
not gain silent background authority.

### Protocol shape

Each approval-gated operation carries two protocol fields:

- `actionUUID` — a unique identifier for the action within the request (or, for
  `perform_batch`, for each action in the batch). The MCP server generates it
  for single actions and stamps it onto every batch action so approved, denied,
  or timed-out actions are identifiable inside a batch.
- `approvalRequest: true` — signals that the action requires user approval
  before execution.

Single-action requests add both fields; batch requests add `actionUUID` to
every item and `approvalRequest` only to the items that require it. The
WebSocket envelope `id` remains the request/response identifier; `actionUUID`
identifies the action within the request.

### Approval decisions and session grants

The user-facing decision is one of three:

- `approve` — approve only the current action.
- `approve_session` — approve this action _and_ future matching actions for the
  same bridge connection.
- `deny` — reject the current action.

`approve_session` is scoped to the pair `{ origin, actionType }`, where the
origin is computed from the active tab URL at approval time. Before executing an
approved action the extension re-checks that the active tab still has the same
origin and the same action type; if the origin changed, the action fails with
`approval_origin_changed` rather than reusing the grant. Session grants live in
extension background memory only and are cleared when the bridge disconnects or
the extension reloads — they are never persisted to `localStorage`, extension
storage, or IndexedDB.

### Timeout behavior

The approval timeout is derived from the local MCP HTTP request timeout so
Brijio can return a structured approval error before the HTTP layer produces a
generic timeout:

```text
approvalTimeoutMs = httpTimeoutMs - approvalTimeoutBufferMs
```

`BRIJIO_MCP_HTTP_TIMEOUT_MS` (default `60000`) sets the HTTP timeout and
`BRIJIO_APPROVAL_TIMEOUT_BUFFER_MS` (default `5000`) sets the buffer, yielding
a default computed approval timeout of `55000ms`. The same request budget is
used for standalone approval-gated tools and for `perform_batch`. If the timer
fires, the extension hides the banner, cancels the pending approval, and
returns a structured `approval_timeout` error carrying the `actionUUID`.

### Batch behavior

Approval-aware batches run action by action in the background controller. For
each action: if it does not require approval it executes normally; if it
requires approval and a matching session grant exists it executes; otherwise
the banner is shown for that action only, and the batch continues only after
the current action succeeds, is denied, or times out. Within `perform_batch`
only `submit_form` is approval-gated; `fetch_resource` and `download_file` are
standalone tools.

A denied approval is a focused per-action outcome: the action returns
`approval_denied` with its `actionUUID` and the batch continues with later
actions. An approval timeout is request-level: the current action records
`approval_timeout`, the banner is hidden, and the timed-out and remaining
unexecuted actions are returned as focused failed entries so the agent can
retry them in a later call. `continueOnError` continues to apply to execution
failures after approval, and page navigation still aborts remaining actions
because previously read target IDs may be stale.

### Approval error codes

- `approval_denied` — the user denied the action.
- `approval_timeout` — no response before the computed approval timeout.
- `approval_unavailable` — the extension could not render the approval UI, or
  approval was missing an `actionUUID`, or approval is not available.
- `approval_origin_changed` — the active tab origin changed before execution.

### Policy evolution

The first implementation keeps the gated set hardcoded, but approval policy is
designed to evolve in three stages: a hardcoded local list (this stage), a
configurable local policy, and an enterprise policy API. Policy evaluation
stays behind a small local `requiresApproval`-style function that can later
delegate to local config or an enterprise response without changing the action
execution pipeline. Agent polling for approval status and a relay-side
in-memory status registry are explicitly out of scope for this stage; the MCP
server remains stateless across per-invocation processes.

## Browser permissions

Permissions are kept minimal and each is documented with a reason, per the
non-negotiable invariants in `AGENTS.md`. The Chrome manifest requests
`activeTab`, `scripting`, `storage`, `tabs`, and `downloads`, plus broad host
permissions for `http://*/*` and `https://*/*`. Per ADR 0030, Chrome grants the
broad host permission at install time (there is no runtime permission request
flow), so `hasRegularPageAccess` resolves to `true`; Safari grants broad host
access at install. Each permission exists for a concrete capability:

- `activeTab` / `tabs` / broad host permissions — target and read/act on the
  user's current authenticated tab the user is already using.
- `scripting` — inject the content script that extracts structured page context
  and performs explicit DOM actions.
- `storage` — hold the WebSocket URL, pairing token, and profile/label
  configuration in extension local storage (not browser content).
- `downloads` — the `download_file` capability, which is approval-gated.

The extension never evaluates web-page content: page data is read as structured
DOM context and returned to the agent, not executed. This is the mitigation for
the malicious-website threat class.

## Explicit non-goals

The capability matrix and security guarantees mark several boundaries as
intentionally unsupported — they are product boundaries, not missing features:

- **No cookie / browser-storage export** — the browser session stays local; the
  browser is the source of truth.
- **No session cloning** — Brijio operates on the existing session; it does not
  create duplicate authenticated environments.
- **No browser mirroring / remote desktop** — no window mirroring or desktop
  streaming.
- **No continuous screenshots** — screenshots are only on explicit request
  (planned), never ambient.
- **No continuous DOM streaming** — data is exchanged only on explicit request.
- **No background surveillance** — the bridge is inactive until the user
  connects; keepalive messages carry no browser state.
- **No browser-history collection** — outside project scope.
- **No credential extraction** — password fields return `browser_error` on fill;
  passkeys and MFA codes are never collected (MFA challenges belong to the user).

The user-visible expression of several of these is an implemented security
property: user-controlled bridge activation, pairing-token authentication, the
explicit request/response model, and no background data transmission (keepalives
contain no browser state). Planned hardening — end-to-end encryption,
fine-grained per-capability approvals, and user-approval workflows for sensitive
actions like payments, deletions, and data exports — is on the roadmap.

## Change guidance

Many design choices are security choices, not just implementation choices.
Before changing authentication, routing, browser-state exposure, or
page-reading behavior, re-read `docs/security/THREAT_MODEL.md`,
`docs/security/TRUST_BOUNDARIES.md`, `docs/security/SECURITY_GUARANTEES.md`,
and the non-negotiable invariants in `AGENTS.md` first. In particular:

- Do not add continuous page, DOM, screenshot, history, or browser-state
  streaming, or silent background surveillance.
- Do not implement cookie export, credential extraction, session cloning, or
  MFA interception.
- Do not persist page content unless an accepted ADR explicitly requires it.
- Preserve user-visible connection state and configured client-side action
  approval; do not bypass approval checks.
- Keep permissions minimal and document why each browser permission is needed.
- Prefer progressive disclosure: return structured context before larger page
  content or visual data.
- When touching a protocol or browser capability, check the full cross-layer
  path (`shared protocol -> WebSocket relay -> MCP surface -> shared controller
-> Chrome adapter -> Safari adapter -> integration tests`) so a security
  boundary is not silently crossed on one platform but not another.

The trust-boundaries guiding rule applies to every new feature: if a change
expands trust in a party that should not be trusted, it needs additional
safeguards before it can be accepted.

## Related pages and sources

- [Architecture](architecture.md) — the explicit request chain and per-layer
  change guidance.
- [Data and Protocol](data-and-protocol.md) — the protocol shapes that enforce
  the request/response discipline.
- [Operations: Runtime and Deployment](operations/runtime-and-deployment.md) —
  token and relay configuration.
- [Workflows](workflows.md) — agent-driven re-read and batch patterns.
- Source documents: `docs/security/THREAT_MODEL.md`,
  `docs/security/TRUST_BOUNDARIES.md`,
  `docs/security/SECURITY_GUARANTEES.md`,
  `docs/architecture/decisions/0048-client-side-action-approval.md`,
  `docs/artifacts/client-side-action-approval.md`,
  `docs/project/CAPABILITY_MATRIX.md`, and `AGENTS.md`.
