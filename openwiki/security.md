---
type: "Reference"
title: "Security and Trust Model"
description: "Brijio security posture: trust assumptions, security goals, threat classes, explicit non-goals, client-side action approval, and the explicit-only screenshot boundary."
tags: [security, trust, approval, threat-model, non-goals]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-10T14:14:23.130Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-f123ddd303568576cb329d7b
    resource: repo://docs/architecture/decisions/0025-tailscale-friendly-mcp-http-hosts.md
  - id: openwiki-source-4ca8c6708aab9bf346de734a
    resource: repo://docs/architecture/decisions/0026-local-domain-friendly-mcp-http-hosts.md
  - id: openwiki-source-992a62d4a0e989fc2da546d0
    resource: repo://docs/architecture/decisions/0048-client-side-action-approval.md
  - id: openwiki-source-79dd91ec51a55e7e78c52ccc
    resource: repo://docs/architecture/decisions/0064-visual-action-verification.md
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
generated: { by: "openwiki/0.7.2", at: "2026-10-10T14:14:23.130Z" }
---

# Security and Trust Model

Brijio is built around explicit control and minimal trust. The browser session belongs to the user; the agent only ever acts through explicit, user-controlled requests, and several categories of behavior are deliberately out of scope as product boundaries rather than missing features.

## Core trust assumptions

From `docs/security/THREAT_MODEL.md` and `docs/security/TRUST_BOUNDARIES.md`:

- the user explicitly starts and controls the browser connection
- authentication tokens are held only by authorized parties
- the browser session belongs to the user
- the relay transports messages without needing to inspect content

Trust is deliberately placed and minimized across the boundaries in the system. The MCP server does not trust the agent to self-limit; every request is validated against the protocol. The relay and extension authenticate with a separate pairing token, and the relay routes between authenticated parties without requiring content access. The extension does not trust web page content — page data is read as structured context, never executed or evaluated.

## Security boundary: auth tokens, not IP allowlists

The security boundary is authentication tokens, not network host or origin allowlists. ADRs 0025 and 0026 add convenience suffix matching for Tailscale MagicDNS (`.ts.net`) and local mDNS (`.local`) names so the MCP HTTP server can be reached over a tailnet or local network, but these host and origin checks are **request routing guardrails, not authentication**.

- `MCP_HTTP_AUTH_TOKEN` remains required for every MCP HTTP request.
- `MCP_HTTP_ALLOW_TAILSCALE_HOSTS=true` or `MCP_HTTP_ALLOW_LOCAL_HOSTS=true` only append wildcard suffixes to the allowed host/origin lists.
- A forged `Host:` header matching a suffix can pass host validation; the bearer token is therefore still required before any MCP tool handling, and deployment guidance recommends firewalling or binding to the trusted interface.

The WebSocket relay, extension connection behavior, pairing tokens, and MCP tool behavior are unchanged by these conveniences.

## Security goals

The security docs describe the main goals as:

- protect browser sessions
- avoid credential exposure
- minimize unnecessary data transfer
- reduce trust in relay infrastructure
- maintain user control

## Threats the project plans around

The threat model calls out these classes of attacker:

| Attacker                 | Mitigations                                                                                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Malicious agent          | Explicit request/response protocol, no continuous streaming, user-controlled browser connection, progressive disclosure, client-side action approval for sensitive actions |
| Compromised relay server | Relay routes without content inspection; future E2E encryption will prevent content inspection; self-hostable infrastructure                                               |
| Network attacker         | TLS for all transports, authentication tokens for all connections, future E2E encryption as defense in depth                                                               |
| Malicious website        | Extension follows least-privilege permissions, structured protocol prevents arbitrary code execution, page content is read not evaluated                                   |

The mitigations are architectural rather than purely defensive code patterns: explicit request/response flows, no continuous streaming, user-controlled browser connections, and progressive disclosure.

## Client-side action approval (ADR 0048)

Not every browser-mutating action needs approval, but a small set of operations that can send user data to a site, trigger server-side side effects, or initiate downloads require explicit browser-side user approval. This preserves Brijio's core privacy boundary: the extension is user-controlled, browser state is available only while the bridge is connected, and agents must not gain silent background authority. Per `AGENTS.md`, you must not bypass approval checks.

### Approval-gated actions

For the first hardcoded implementation, three operations require approval:

- `submit_form` — can send user-entered data and trigger navigation or server-side side effects
- `fetch_resource` — authenticated resource fetching
- `download_file` — browser download initiation

Other actions execute without an approval prompt. The approval-gated set is hardcoded behind a small local function such as `requiresApproval(operation)`, which is designed to later delegate to configurable local policy or an enterprise policy API without changing the action execution pipeline.

### Approval protocol

Every approval-gated operation carries:

- `actionUUID` — a unique identifier for the action (every action in a `perform_batch` carries its own `actionUUID`)
- `approvalRequest: true` — tells the extension to request user approval before execution

The WebSocket envelope `id` remains the request/response identifier; the `actionUUID` identifies the specific action within a single action request or batch.

### Approval states

The user chooses one of three decisions:

- `approve` — approve only the current action
- `approve_session` — approve this action and future matching actions during the same bridge connection
- `deny` — reject the current action

`approve_session` is scoped to:

```ts
{
  origin: string;
  actionType: "submit_form" | "fetch_resource" | "download_file";
}
```

The origin is computed from the active tab URL at approval time. Before executing an approved action, the extension verifies the active tab still has the same origin and same action type; if the origin changed, the action fails with `approval_origin_changed` instead of reusing the grant.

### State lifecycle and storage

Approval state is held **in memory only** — in the extension background script, not the page or persistent stores:

- pending action queue
- approval timeout timers
- session approval grants
- batch sequencing
- final `action_result` / `batch_result` assembly

Pending actions and grants are never stored in page `localStorage`, extension storage, IndexedDB, or other persistent stores. Grants are cleared when the bridge disconnects, the extension reloads, or the browser session ends. This keeps policy state outside the webpage and avoids persisting action payloads.

### Timeout behavior

Approval-gated requests use an application-level approval timer that must fire **before** the local MCP HTTP server request timeout, so Brijio returns a structured approval error instead of letting the HTTP layer produce a generic timeout:

```text
approvalTimeoutMs = httpRequestTimeoutMs - approvalTimeoutBufferMs
```

For example, with `BRIJIO_MCP_HTTP_TIMEOUT_MS=60000` and `BRIJIO_APPROVAL_TIMEOUT_BUFFER_MS=5000`, the computed `approvalTimeoutMs` is `55000` (the implementation floors the value at `1000ms`). If the timer fires, the extension hides the approval banner, cancels the pending approval, and returns a structured `approval_timeout` error carrying the `actionUUID`.

For remote or enterprise deployments behind infrastructure Brijio does not control, timeout values must be explicitly configured below the shortest expected client, proxy, gateway, or load-balancer timeout.

### Batch behavior

Approval-aware batches execute one action at a time in the extension background controller, preserving ADR 0044's ordered batch semantics:

1. Actions that do not require approval execute normally.
2. Actions that require approval and have a matching session grant execute normally.
3. Actions that require approval and have no grant show the approval banner for that action only.
4. The batch continues to the next action only after the current one succeeds, is denied, or times out.

Denial is a focused per-action outcome — the action returns `approval_denied` for its `actionUUID` and later batch actions still run. Approval timeout is request-level: the current action records `approval_timeout`, the banner is hidden, and already-completed actions keep their results; the timed-out action and remaining unexecuted actions are returned as focused failed entries so the agent can retry them later. Page navigation remains special — an executed action that navigates the page still aborts remaining actions because previously read page IDs may no longer be valid.

### Approval error codes

| Code                      | Meaning                                                   |
| ------------------------- | --------------------------------------------------------- |
| `approval_denied`         | User denied the action                                    |
| `approval_timeout`        | User did not respond before the computed approval timeout |
| `approval_unavailable`    | The extension could not render the approval UI            |
| `approval_origin_changed` | The active tab origin changed before execution            |

Errors include `actionUUID` when available; batch errors include `aborted` following existing batch result conventions.

## Explicit non-goals

The capability matrix and security guarantees make several boundaries clear. Brijio intentionally does not aim to provide:

- cookie export (authentication cookies, session cookies, browser storage remain local)
- session cloning (it operates on the existing session, never duplicates authenticated environments)
- browser mirroring (it is not remote desktop software)
- continuous screenshots
- continuous DOM streaming
- background surveillance (the bridge is reactive; information is exchanged only on explicit request)
- credential extraction (passwords, passkeys, MFA codes are never collected)
- MFA interception (MFA challenges belong to the user)

These are product boundaries, not missing features. The keepalive messages between extension and relay contain no browser state, and `fill_input` returns `browser_error` for `type="password"` fields — a security boundary, not a bug.

## The screenshot boundary (ADR 0064)

The "no continuous screenshots" non-goal does not mean no screenshots at all. ADR 0064 introduces an explicit, on-demand `capture_screenshot` MCP tool that is carefully scoped so it does **not** contradict the non-goal:

- **Explicit, not automatic.** Screenshots are captured only when an agent explicitly calls `capture_screenshot`; there is no auto-capture, background capture, or screencast/video support.
- **Viewport-only.** The tool uses `tabs.captureVisibleTab()` and returns only the visible tab in the current window — no full-page scroll-stitch, annotation, or redaction (those are deferred to a later Enterprise-tier Visual Evidence effort). Capturing a background tab would require switching focus (user-disruptive) and is out of scope.
- **JPEG, active tab.** It returns MCP image content as JPEG (quality 80), a manageable context size for vision models.
- **Vision-capable agent required.** The result is image content; a non-vision agent cannot interpret it, and the skill documentation notes the vision-agent requirement.

Continuous and auto capture remain intentionally unsupported; the explicit on-demand screenshot is the bounded exception. Permission errors at runtime fall back to `capability_not_supported` as a defensive measure.

## Change guidance

If you change authentication, routing, browser-state exposure, or page-reading behavior, re-check the security docs first. Many design choices are security choices, not just implementation choices. When evaluating a new feature, ask whether it expands trust in any party that should not be trusted — if it does, the feature needs additional safeguards before it can be accepted.

## Related source files

- [docs/security/THREAT_MODEL.md](../docs/security/THREAT_MODEL.md)
- [docs/security/TRUST_BOUNDARIES.md](../docs/security/TRUST_BOUNDARIES.md)
- [docs/security/SECURITY_GUARANTEES.md](../docs/security/SECURITY_GUARANTEES.md)
- [docs/project/CAPABILITY_MATRIX.md](../docs/project/CAPABILITY_MATRIX.md)
- [docs/architecture/decisions/0048-client-side-action-approval.md](../docs/architecture/decisions/0048-client-side-action-approval.md)
- [docs/architecture/decisions/0064-visual-action-verification.md](../docs/architecture/decisions/0064-visual-action-verification.md)
- [docs/architecture/decisions/0025-tailscale-friendly-mcp-http-hosts.md](../docs/architecture/decisions/0025-tailscale-friendly-mcp-http-hosts.md)
- [docs/architecture/decisions/0026-local-domain-friendly-mcp-http-hosts.md](../docs/architecture/decisions/0026-local-domain-friendly-mcp-http-hosts.md)
- [AGENTS.md](../AGENTS.md)
