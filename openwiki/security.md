---
type: "Reference"
title: "Security and Trust Model"
description: "Brijio security posture: trust assumptions, security goals, threat classes and mitigations, explicit non-goals, client-side action approval, minimal browser permissions, and change guidance for authentication, routing, and browser-state exposure."
tags: ["security", "trust-model", "threat-model", "permissions", "approval"]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-17T11:58:52.754Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-1ee5f9755b4fc234314b5fca
    resource: repo://docs/architecture/decisions/0005-first-chrome-extension-page-context.md
  - id: openwiki-source-af7274aa59c39815b06b15de
    resource: repo://docs/architecture/decisions/0011-regular-page-host-permissions-for-chrome-extension.md
  - id: openwiki-source-ddecf2e5550aae0caa3b51ed
    resource: repo://docs/architecture/decisions/0019-safari-web-extension-and-shared-extension-package.md
  - id: openwiki-source-3738bff346a654f3e05c08bd
    resource: repo://docs/architecture/decisions/0045-user-visible-form-state-model.md
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
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-3a44815832a872f4778f822b
    resource: repo://SECURITY.md
generated: { by: "openwiki/0.7.2", at: "2026-10-17T11:58:52.754Z" }
---

# Security and Trust Model

Brijio connects remote AI agents to the browser session a user already controls.
Security in Brijio is built around **explicit control and minimal trust**: the
user starts and stops the bridge, every browser read or action is an explicit
request, and the relay is treated as transport rather than a trusted data
processor. These boundaries are product decisions, not missing features, and
they are documented as invariants in [AGENTS.md](../AGENTS.md) and the
[threat model](../docs/security/THREAT_MODEL.md).

## Core trust assumptions

The threat model assumes that AI agents, networks, cloud infrastructure, and
third-party services may be imperfect or untrusted. From
[`docs/security/THREAT_MODEL.md`](../docs/security/THREAT_MODEL.md) and the root
[README](../README.md), the trust placed in the system is deliberately narrow:

- The user explicitly starts and controls the browser connection.
- Authentication tokens are kept secret by authorized parties.
- The browser session belongs to the user.
- The relay transports messages without requiring content inspection.

Trust is therefore placed in a pairing token (browser identity), a separate
MCP auth token (agent authorization), the relay (message routing), the user
(browser session), and the extension (structured DOM reads — not arbitrary JS
execution). Trust is minimized at the agent→browser, relay→payload,
website→extension, and agent→credentials boundaries, and is explicitly _not_
assumed for the network, cloud-relay privacy, agent intent, or website content.
The full placement/minimization tables live in
[`docs/security/TRUST_BOUNDARIES.md`](../docs/security/TRUST_BOUNDARIES.md).

## Security goals

The security docs ([`docs/security/THREAT_MODEL.md`](../docs/security/THREAT_MODEL.md),
[`docs/security/SECURITY_GUARANTEES.md`](../docs/security/SECURITY_GUARANTEES.md))
state the main goals as:

- Protect browser sessions.
- Avoid credential exposure.
- Minimize unnecessary data transfer.
- Reduce trust in relay infrastructure.
- Maintain user control.

These are reinforced by the non-negotiable invariants in [AGENTS.md](../AGENTS.md):
the user explicitly starts and stops the bridge, browser state is available only
while the user-controlled extension is connected, and every read or action is
initiated by an explicit MCP tool or resource request.

## Threat classes and mitigations

The threat model calls out four classes of attacker. The mitigations are
architectural rather than purely defensive code patterns.

### Malicious agent

An agent that attempts to access data beyond what was explicitly requested,
exfiltrate browser state, or perform unauthorized actions.

Mitigations:

- Explicit request/response protocol — no data flows without an explicit MCP
  tool call.
- No continuous streaming by design.
- User-controlled browser connection — the bridge is inactive until the user
  connects.
- Progressive disclosure limits data exposure (structured context first,
  content only when requested).
- Client-side action approval for sensitive operations (see below).

### Compromised relay server

A relay that attempts to inspect, modify, or log traffic between agents and
browsers.

Mitigations:

- The relay routes messages between authenticated parties without requiring
  content access.
- The MCP server and relay authenticate with separate tokens; the extension
  authenticates with a pairing token.
- User-controlled infrastructure allows self-hosting the relay.
- Future end-to-end encryption will prevent content inspection (planned, not yet
  implemented).

### Network attacker

An attacker on the network path between agent, relay, and browser.

Mitigations:

- TLS for all transports.
- Authentication tokens for all connections.
- Future E2E encryption will add defense in depth.

### Malicious website

A website that attempts to exploit the browser extension or inject content
that misleads the agent.

Mitigations:

- The extension follows a least-privilege permission model.
- The structured protocol prevents arbitrary code execution.
- Page content is read as structured data, not evaluated or executed.

## Client-side action approval

[ADR 0048 — Client-Side Action Approval](../docs/architecture/decisions/0048-client-side-action-approval.md)
adds an approval-aware protocol for selected browser-mutating operations. It is
a trust-boundary mechanism agents must not bypass, and [AGENTS.md](../AGENTS.md)
lists preserving client-side action approval as a non-negotiable invariant.

The model places approval state in the **extension background** (and, by
extension, the relay) rather than the MCP server, because the MCP server is
commonly instantiated per tool invocation and is not the long-lived holder of
approval state. Approval guarantees the core privacy boundary: the extension is
user-controlled, browser state is available only while the bridge is connected,
and agents must not gain silent background authority.

Approval-gated operations (the hardcoded first-implementation list):

- `submit_form`
- `fetch_resource`
- `download_file`

Other actions do not require approval. Every approval-gated operation carries a
unique `actionUUID` and `approvalRequest: true`; for `perform_batch`, every
batch action carries an `actionUUID` so approved, denied, or timed-out actions
are identifiable inside the batch.

Approval decisions are `approve` (current action only), `approve_session`
(approve this action and future matching actions during the same bridge
connection), or `deny`. Session grants are scoped to `{ origin, actionType }`,
where origin is computed from the active tab URL at approval time. Before
executing an approved action, the extension verifies the active tab still has
the same origin and action type; if the origin changed, the action fails with
`approval_origin_changed` rather than reusing the grant.

Invariants that matter for security:

- The approval-gated operation list is hardcoded behind a small
  `requiresApproval(operation)` function with a clear path to configurable and
  enterprise-managed policies later.
- Approval state is **in memory only** — never in page `localStorage`,
  extension storage, IndexedDB, or other persistent stores.
- Grants are cleared when the bridge disconnects, the extension reloads, or the
  browser session ends.
- Pending approvals time out before the local MCP HTTP request timeout
  (`approvalTimeoutMs = httpRequestTimeoutMs - approvalTimeoutBufferMs`) and
  return a structured `approval_timeout` error rather than a generic timeout.
- Batch approval is one prompt at a time, preserving ordered batch semantics;
  denial is a focused per-action outcome, not a reason to abort the whole batch.
- The extension fails closed: if the active page changes while an approval prompt
  is visible it returns `approval_origin_changed`, and if banner injection fails
  on restricted pages it returns `approval_unavailable`.

See [Action Approval](architecture/action-approval.md) for the full protocol
shape, states, timeout behavior, and batch flow.

## Explicit non-goals (product boundaries)

The [capability matrix](../docs/project/CAPABILITY_MATRIX.md) and
[`docs/security/SECURITY_GUARANTEES.md`](../docs/security/SECURITY_GUARANTEES.md)
mark several capabilities as 🚫 **Intentionally unsupported**. These are product
boundaries, not missing features:

- **No cookie export** — the browser is the source of truth for the
  authenticated session.
- **No session cloning** — Brijio operates on the browser session already
  controlled by the user; it does not create duplicate authenticated
  environments.
- **No browser mirroring** — Brijio is not remote desktop software and does not
  mirror windows, stream desktops, or provide remote desktop access.
- **No continuous screenshots** — privacy and token efficiency; screenshots are
  available only on explicit request (planned).
- **No continuous DOM streaming** — data is exchanged only on explicit request;
  agents must poll via `read_current_page`.
- **No background surveillance** — the bridge is inactive until the user
  connects; no ambient browser state is published.
- **No credential extraction** — `fill_input` returns `browser_error` for
  `type="password"` fields; raw text-like values are never returned for text,
  email, password, tel, number, date, or textarea controls.
- **No MFA interception** — MFA challenges belong to the user.
- **No browser history collection** — outside project scope.

### Screenshot exception (ADR 0064)

There is one explicit screenshot exception.
[ADR 0064 — Visual Action Verification](../docs/architecture/decisions/0064-visual-action-verification.md)
adds a `capture_screenshot` MCP tool that returns JPEG image content from the
**active tab only** via `tabs.captureVisibleTab()`, with no auto-capture. This
is consistent with the no-continuous-screenshot boundary, not a violation of it:

- It is **explicit/on-request only** — there is no auto-capture, no polling loop,
  and no streaming; the agent must invoke the tool to get a single frame.
- It is **active-tab only** — capturing a background tab would require switching
  focus (user-disruptive), so it is out of scope for this stage.
- It returns **JPEG** (quality 80) to keep context size manageable.
- It requires **no new permissions** — `host_permissions` and `activeTab`
  already cover `captureVisibleTab`; runtime permission errors fall back to
  `capability_not_supported`.

Full-page scroll-stitching, annotation/highlighting, screencast/video capture,
and policy controls/redaction remain out of scope (deferred to P4.5 Visual
Evidence).

## Minimal browser permissions

Brijio keeps browser permissions minimal and requires documentation of why each
permission is needed — this is a non-negotiable invariant in
[AGENTS.md](../AGENTS.md) ("Keep permissions minimal and document why each
browser permission is needed") and in the security posture.

The extension declares the minimum needed for its behavior:

- `storage` — to remember the user-entered WebSocket URL and connection
  preference.
- `tabs` — so the background worker can read the active tab URL and title when
  handling an explicit request, and for `navigate_to_url` via `tabs.update()`.
- `scripting` — to inject the content script on demand for explicit page reads
  and actions.
- `activeTab` — the lightweight per-action access path.
- `host_permissions` (`http://*/*`, `https://*/*`) — regular-page access for
  reads and actions. Chrome requests this at runtime via
  `optional_host_permissions` per [ADR 0011](../docs/architecture/decisions/0011-regular-page-host-permissions-for-chrome-extension.md);
  Safari declares `*://*/*` as a required install-time permission because it
  does not support runtime permission prompts (see
  [ADR 0019](../docs/architecture/decisions/0019-safari-web-extension-and-shared-extension-package.md)).

The extension rejects non-regular pages before attempting script injection;
`chrome://`, `chrome-extension://`, Chrome Web Store pages, internal viewer
pages, `file://` (unless a later ADR approves it), and debugger/CDP-based access
remain out of scope.

## Change guidance

If you change authentication, routing, browser-state exposure, page-reading, or
approval behavior, **re-check the security docs first**. Many design choices are
security choices, not just implementation choices.

- Changing authentication, authorization, privacy, storage, or a trust boundary
  requires an ADR before implementation (see the change workflow in
  [AGENTS.md](../AGENTS.md)).
- When evaluating a new feature, ask the guiding rule from
  [`docs/security/TRUST_BOUNDARIES.md`](../docs/security/TRUST_BOUNDARIES.md):
  "Does this change expand trust in any party that should not be trusted?" If
  yes, the feature needs additional safeguards before it can be accepted.
- Do not add continuous page, DOM, screenshot, history, or browser-state
  streaming, and do not implement silent background surveillance, cookie
  export, credential extraction, session cloning, or MFA interception.
- Do not bypass client-side action approval checks.
- Keep permissions minimal and document why each browser permission is needed.
- Security guarantees in
  [`docs/security/SECURITY_GUARANTEES.md`](../docs/security/SECURITY_GUARANTEES.md)
  are part of the project's identity and should only change with extreme care.

Vulnerability reporting is private (do not disclose publicly); see
[`SECURITY.md`](../SECURITY.md) for the reporting address, scope, and response
process.

## Related pages and sources

Wiki pages:

- [Architecture Overview](architecture.md) — the Agent→MCP→WebSocket→Extension→Browser chain.
- [Action Approval](architecture/action-approval.md) — full approval protocol and flow.
- [Data and Protocol](data-and-protocol.md) — message shapes and routing.
- [Domains](domains.md) — component ownership boundaries.

Source-of-truth documents:

- [`docs/security/THREAT_MODEL.md`](../docs/security/THREAT_MODEL.md)
- [`docs/security/TRUST_BOUNDARIES.md`](../docs/security/TRUST_BOUNDARIES.md)
- [`docs/security/SECURITY_GUARANTEES.md`](../docs/security/SECURITY_GUARANTEES.md)
- [`docs/project/CAPABILITY_MATRIX.md`](../docs/project/CAPABILITY_MATRIX.md)
- [`SECURITY.md`](../SECURITY.md)
- [ADR 0048 — Client-Side Action Approval](../docs/architecture/decisions/0048-client-side-action-approval.md)
- [ADR 0064 — Visual Action Verification](../docs/architecture/decisions/0064-visual-action-verification.md)
- [ADR 0011 — Regular Page Host Permissions](../docs/architecture/decisions/0011-regular-page-host-permissions-for-chrome-extension.md)
- [ADR 0019 — Safari Web Extension](../docs/architecture/decisions/0019-safari-web-extension-and-shared-extension-package.md)
- [`README.md`](../README.md)
- [`AGENTS.md`](../AGENTS.md)
