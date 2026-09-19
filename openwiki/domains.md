---
type: Reference
title: Major Domains
description: The seven major source domains in the Brijio monorepo and their ownership boundaries, so agents keep changes scoped to the correct layer.
tags: [domains, ownership, architecture, brijio]
verified:
  - by: openwiki/0.5.2
    at: 2026-09-19T12:17:06.598Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-40f5f962c5456b400be6ed92
    resource: repo://clients/extensions/chrome/README.md
  - id: openwiki-source-beb468a32961295d57274fd5
    resource: repo://clients/extensions/firefox/README.md
  - id: openwiki-source-4d09410afcbfa31fdd6833ec
    resource: repo://clients/extensions/safari/README.md
  - id: openwiki-source-992a62d4a0e989fc2da546d0
    resource: repo://docs/architecture/decisions/0048-client-side-action-approval.md
  - id: openwiki-source-9b8357af9c7ef75912f57765
    resource: repo://docs/project/CAPABILITY_MATRIX.md
  - id: openwiki-source-50b814f6e8e284b1307c9be5
    resource: repo://docs/project/ROADMAP.md
  - id: openwiki-source-aae624fcff023b16e3665555
    resource: repo://docs/security/SECURITY_GUARANTEES.md
  - id: openwiki-source-0c22eda9f95dd622fb06ce00
    resource: repo://docs/security/TRUST_BOUNDARIES.md
  - id: openwiki-source-5524638d57e96598fd8e40d4
    resource: repo://packages/shared/src/background-controller.ts
  - id: openwiki-source-265221f77947a8a08e9a018a
    resource: repo://packages/shared/src/index.ts
  - id: openwiki-source-c20cbcf46daa07e6332e3f7f
    resource: repo://packages/shared/src/protocol.ts
  - id: openwiki-source-1e871ebe65ae85a216285234
    resource: repo://servers/mcp/src/http-server.ts
  - id: openwiki-source-f1f5d8584551c3d42e50d725
    resource: repo://servers/mcp/src/index.ts
  - id: openwiki-source-36c61251055ea6d2f82f0b4e
    resource: repo://servers/mcp/src/mcp-server.ts
  - id: openwiki-source-13054dea741b794a82597d0c
    resource: repo://servers/mcp/src/skills.ts
  - id: openwiki-source-48524485166ed3cd7c7732bd
    resource: repo://servers/websocket/src/index.ts
  - id: openwiki-source-875036d8e83469fa1fc3f8e3
    resource: repo://servers/websocket/src/server.ts
generated: { by: "openwiki/0.5.2", at: "2026-09-19T12:17:06.598Z" }
---

# Major Domains

Brijio is a user-controlled bridge between remote AI agents and the authenticated browser sessions a user already controls. The monorepo is organized into seven domains. Keeping changes inside the right domain — and updating shared contracts before adapters — is how the repository avoids hidden coupling across the bridge path.

<!-- openwiki: mermaid parse failed and this diagram was converted to a text fence so it does not break rendering. Fix the diagram source and restore the mermaid fence. Parser error: Heuristic: an unescaped angle bracket inside a label breaks rendering; rephrase the label. -->

```text
flowchart TD
  SUB["packages/shared<br/>protocol + browser-agnostic logic"]
  WS["servers/websocket<br/>relay + presence routing"]
  MCP["servers/mcp<br/>agent-facing tools, resources, prompts, skills"]
  CHR["clients/extensions/chrome<br/>Chrome MV3 adapter"]
  SAF["clients/extensions/safari<br/>Safari MV2 adapter"]
  FX["clients/extensions/firefox<br/>planned placeholder"]

  SUB -- "defines envelope + payload types" --> WS
  SUB -- "defines controller + handlers" --> CHR
  SUB -- "defines controller + handlers" --> SAF
  WS -- "forwards authenticated envelopes" --> MCP
  CHR -- "WebSocket peer (extension role)" --> WS
  SAF -- "WebSocket peer (extension role)" --> WS
  FX -. "not implemented" .-> WS
  MCP -- "WebSocket peer (mcp role)" --> WS
```

The diagram shows the dependency direction for the seven domains. Shared protocol and logic is the foundation; the relay routes envelopes between the MCP server and the browser adapters; the adapters are thin platform wiring over the shared background controller.

## 1. Shared protocol and browser-agnostic logic

**Primary source:** `packages/shared`

This domain owns the data model and reusable logic that both servers and browser extensions depend on. Its public surface is re-exported from `packages/shared/src/index.ts`, which exports `protocol`, `page-content`, `page-context`, `timers`, `background-controller`, `content-handler`, `popup-messages`, `popup-parsers`, `bridge-settings`, `content-helpers`, `page-reader`, `popup-init`, `logger`, and `batch-handler`.

The central contract is `packages/shared/src/protocol.ts`, which defines:

- the `WebSocketEnvelope` (`type: 'message'` with optional `id` and `target.browserInstanceId` / `target.tabId`)
- the `BrijioRole` union (`'extension' | 'mcp'`) and `BrowserCapability` names
- auth and presence messages (`auth`, `auth_success`, `browser_presence_request`, `browser_presence_announce`)
- `BrowserPresence` (browser instance ID, label, browser/profile name, capability list — no page URL, title, or content)
- tab-listing shapes (`TabInfo`, `list_tabs`, `tab_list_response`)
- page-context and page-content request/response shapes
- action request/response shapes (click, write text, set checked, select options, submit form, navigate, open tab, batch), plus download, fetch, screenshot, and file-upload shapes
- creator and guard helpers used by the relay and the extensions

The shared package also contains the browser-agnostic runtime: the `BrijioBackgroundController` (the extension background controller that adapters drive), `page-context.ts` and `page-content.ts` (pure DOM extraction and chunking), `page-reader.ts`, `content-handler.ts` (content-script request handler), `batch-handler.ts`, popup message/parsing/init helpers, `bridge-settings.ts` (settings normalization and `createBrowserInstanceId`), `timers.ts` (`createGlobalTimers`), and `logger.ts`. Because this code is platform-independent, the Chrome and Safari packages import it directly and only contribute browser-specific adapters around it.

This domain enforces the non-negotiable product invariants: no continuous streaming, user-controlled activation, page context returned before larger content, action targeting through short-lived IDs, and client-side action approval. Approval state lives in the background controller's in-memory `approvalSessionGrants`, not in persistent storage; grants are cleared when the bridge disconnects.

## 2. WebSocket relay

**Primary source:** `servers/websocket`

This service is the transport and routing layer between the MCP server and connected browser extensions. It is intentionally state-light: presence is held in an in-memory `Map` and disappears when the socket closes.

`createWebSocketServer` (`servers/websocket/src/server.ts`) builds an HTTP server with a `ws` `WebSocketServer` mounted on it and exposes a health endpoint. On each connection it tracks a `ConnectionState` (`role`, `scopeKey`, `browserInstanceId`). The lifecycle is:

1. An unauthenticated socket must send an `auth` payload carrying a pairing token. Tokens are resolved from `BRIJIO_PAIRING_TOKEN` / `BRIJIO_TOKEN` (or constructor options); a missing token throws at startup.
2. A matching token sets `role` and derives a `scopeKey` (a hash of the token) so clients sharing a token route to each other. The relay sends `auth_success`.
3. For `role: 'extension'`, the relay immediately sends a `browser_presence_request`; the extension replies with `browser_presence_announce`, which the relay stores keyed by `(scopeKey, browserInstanceId)`.
4. Authenticated messages are routed by role: extension messages update presence or carry responses to pending requests; MCP messages are forwarded to the target browser instance, optionally with a `tabId`, and a pending request is recorded so the reply can be routed back.
5. On socket close, the relay deletes that browser's presence and cleans up any pending requests owned by the socket.

The relay does not interpret message payloads beyond role-based routing and presence bookkeeping. It authenticates both extension and MCP peers with the same pairing-token family; the MCP server additionally uses its own MCP auth token (a separate trust boundary, see Domain 6).

Entry point: `servers/websocket/src/index.ts` reads `WEBSOCKET_HOST` (default `0.0.0.0`) and `WEBSOCKET_PORT` (default `8787`) and starts the server.

## 3. MCP server

**Primary source:** `servers/mcp`

This is the agent-facing surface. It exposes browser resources, tool calls, prompts, and skills through the Model Context Protocol and uses the WebSocket relay to reach connected browser extensions.

- **HTTP transport:** `http-server.ts` runs a `StreamableHTTPServerTransport` MCP server with an MCP auth token, allowed-origin checks, and configurable timeouts (`httpTimeoutMs`, `approvalTimeoutMs`). Entry point `index.ts` builds options from env via `getMcpHttpOptionsFromEnv` and starts the server.
- **Server core:** `mcp-server.ts` (`createBrijioMcpServer`) registers all MCP tools with shared `browserInstanceId` and `tabId` optional inputs: `list_browsers`, `list_tabs`, `read_current_page`, `click_element`, `fill_input`, `fill_editable`, `set_checked`, `select_options`, `submit_form`, `navigate_to_url`, `open_tab`, `perform_batch`, `download_status`, `download_file`, `fetch_resource`, and `capture_screenshot`. It also registers resources (`current-page-context`, `current-page-content/{index}`, `skill://{name}`) and the `brijio-context` prompt.
- **WebSocket client:** `websocket-client.ts` is the MCP server's relay peer (role `mcp`), forwarding tool requests to the targeted browser and awaiting correlated responses.
- **Skills:** `skills.ts` loads each skill directory under `servers/mcp/skills` as a `SKILL.md` with optional YAML frontmatter, exposes each as an MCP resource at `skill://brijio/{name}`, and `buildContextMessage` assembles the `brijio-context` prompt with connected browsers, multi-tab targeting guidance, key pitfalls, and the skill catalog.

The current MCP skills catalog under `servers/mcp/skills` is:

| Skill             | Purpose                                                        |
| ----------------- | -------------------------------------------------------------- |
| `accessibility`   | Accessibility tree snapshots for structured page understanding |
| `comparison`      | Compare two pages or tabs for differences                      |
| `data-extraction` | Extract structured data from web pages                         |
| `ecommerce`       | Navigate and interact with e-commerce workflows                |
| `form-filling`    | Complete forms on authenticated pages safely                   |
| `monitoring`      | Monitor pages for changes over time                            |
| `navigation`      | Navigate between pages and manage browser tabs                 |
| `onboarding`      | First-run setup and configuration guide                        |
| `using-brijio`    | General orientation: connect, read pages, perform actions      |
| `web-qa`          | QA workflows: check pages, debug issues, validate content      |

The server also ships a browser-friendly demo site under `servers/mcp/demo` (used by the smoke test and integration tests).

## 4. Browser extensions

**Primary sources:** `clients/extensions/chrome`, `clients/extensions/safari`

These packages implement the browser-side bridge. They differ in API surface and packaging but share the same product rules and the same `@brijio/shared` background controller, handlers, and extraction logic:

- user-controlled activation — the user manually starts and stops the bridge; the WebSocket opens only after user action
- explicit request/response behavior — the extension answers MCP-originated requests and returns structured results; it does not publish ambient browser state
- no continuous streaming of page content, DOM, screenshots, or browser state
- page context before page content (progressive disclosure)
- action targeting through short-lived IDs from the latest page-context response, scoped by `target.kind`
- client-side action approval for gating operations such as `submit_form`, `fetch_resource`, and `download_file`

**Chrome** (`clients/extensions/chrome`) is the first implementation. It is a Manifest V3 extension with a service-worker background, `activeTab` / `scripting` / `storage` permissions, a popup overlay for configuration and connect/disconnect, and toolbar badge connection state (`OFF` / `ON` / `ERR`). It authenticates with the configured pairing token, announces presence, sends a stateless `extension_keepalive` every 20 seconds, and reads DOM only after an explicit request.

**Safari** (`clients/extensions/safari`) is a parallel implementation using the standard WebExtension `browser.*` namespace and Manifest V2 background scripts. It follows the same adapter pattern and contributes only Safari-specific wiring. Key platform differences from Chrome:

| Chrome concept                                  | Safari adapter                                                              |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| `chrome.*` API namespace                        | `browser.*` (WebExtension API)                                              |
| Service worker (MV3)                            | MV2 background scripts (`persistent: false` on iOS/iPadOS, `true` on macOS) |
| `setBadgeBackgroundColor` / `setBadgeTextColor` | No-op (`SafariActionBadge`); badge text only                                |
| `chrome.permissions.request()` runtime requests | Not needed; broad host permissions granted at install                       |
| Setup page via `chrome.tabs.create`             | `popup.html` overlay                                                        |

The Safari build emits platform-specific outputs (`dist-ios`, `dist-macos`) and wraps into native Apple app projects via Makefile targets. Tests cover adapter classes, permission logic, popup message handling, platform manifest generation, and reconnect-on-wake; shared controller and extraction logic is tested in `@brijio/shared`.

**Firefox** (`clients/extensions/firefox`) is a planned placeholder. The folder reserves the client boundary; packaging, permissions, and user-control behavior must be designed in a separate ADR before implementation. Firefox support is `📋 Planned` across the capability matrix.

## 5. Product and business framing

**Primary sources:** `README.md`, `docs/project/POSITIONING.md`, `docs/project/CAPABILITY_MATRIX.md`, `docs/project/ROADMAP.md`

This domain defines what Brijio is for and what it is not. The positioning is "remote agents, local browser, no shared credentials" — using the authenticated browser session the user already controls, rather than giving the agent its own browser. The canonical product contract is `docs/project/CAPABILITY_MATRIX.md`, which lists every MCP tool, resource, prompt, and skill with status labels (`✅ Implemented`, `🧪 Experimental`, `📋 Planned`, `🚫 Intentionally unsupported`) and per-browser support. `docs/project/ROADMAP.md` tracks pre-enterprise milestones against those capability names.

The framing explicitly rejects cookie export, browser cloning, session replication, and remote-desktop-style streaming as design choices, not missing features.

## 6. Security and trust

**Primary sources:** `docs/security/THREAT_MODEL.md`, `docs/security/TRUST_BOUNDARIES.md`, `docs/security/SECURITY_GUARANTEES.md`

Security docs define the trust assumptions behind the bridge and the boundaries where trust is minimized or not assumed.

- **Threat model:** threats are a malicious agent, a compromised relay, a network attacker, and a malicious website. Mitigations are the explicit request/response protocol, no continuous streaming, user-controlled connection, progressive disclosure, least-privilege permissions, structured protocol (no arbitrary code execution), read-only page extraction, TLS, and authentication tokens. Future end-to-end encryption is planned as defense in depth.
- **Trust boundaries:** the agent↔MCP boundary (server validates all requests; agent intent is not trusted), MCP server↔relay (separate tokens), relay↔extension (pairing token; relay routes without content inspection), and extension↔browser session (extension reads structured DOM, never executes page content).
- **Security guarantees:** Brijio does not export cookies, clone sessions, act as remote desktop software, continuously monitor browsers, or collect credentials; the relay is intended as transport, not a content processor; user control comes first.

Client-side action approval (ADR 0048) lives at this boundary: approval-gated operations carry a unique `actionUUID` and `approvalRequest: true`, approval state is in-memory only and cleared on disconnect, `approve_session` grants future actions for the same `{ origin, actionType }`, and pending approvals time out before the MCP HTTP request timeout.

## 7. Docs and design history

**Primary sources:** `docs/architecture/decisions/*`, `docs/artifacts/*`

The docs tree contains the design history and the current product contract. ADRs under `docs/architecture/decisions` are the authority for architectural decisions and are especially valuable when changing browser actions, protocol shapes, routing, targeting, lifecycle, or trust boundaries. Per `AGENTS.md`, an ADR is required before implementing changes that introduce or alter a product capability, cross-package protocol, architectural boundary, authentication/authorization/privacy/storage/trust boundary, browser routing/targeting/lifecycle semantics, or a framework that materially changes the architecture. Completed operational explanations live in `docs/artifacts`.

## Practical rule for cross-layer changes

If a change touches more than one domain, update the shared protocol or ADR first, then the relay/server, then the browser adapters. `AGENTS.md` gives the full path to check:

```text
shared protocol -> WebSocket relay -> MCP surface -> shared controller
                -> Chrome adapter -> Safari adapter -> integration tests
```

Additional ownership rules that keep the explicit-contract style intact:

- Keep protocol definitions in `packages/shared`; do not duplicate them in the relay, MCP server, or extensions.
- Preserve explicit per-call browser and `tabId` targeting; do not introduce hidden selected-browser or selected-tab session state. When `tabId` is omitted, tools fall back to the active foreground tab.
- Re-read page context after navigation or a mutation that can invalidate short-lived target IDs.
- When tool behavior changes, update its tests, MCP registration, relevant skills under `servers/mcp/skills`, the capability matrix, and relevant OpenWiki workflow pages.
- Consider both Chrome and Safari for shared browser behavior; document and test intentional platform differences.

Verification is scoped per domain (`pnpm --filter @brijio/<package> test` / `check`); cross-package changes run `pnpm test` and `pnpm check`, and PRs match CI with `pnpm lint`, `pnpm build`, `pnpm test`.
