# Brijio Capability Matrix

This document is the canonical product contract for Brijio. It describes every capability the product exposes, its current status, browser support, known limitations, and what is explicitly out of scope.

The matrix uses these status labels:

| Status                       | Meaning                                                                 |
| ---------------------------- | ----------------------------------------------------------------------- |
| ✅ Implemented               | Production-ready and shipped in the current release.                    |
| 🧪 Experimental              | Available for testing but not yet stable or complete.                   |
| 📋 Planned                   | On the roadmap but not yet implemented. May change before release.      |
| 🚫 Intentionally unsupported | A deliberate product boundary. Not a missing feature — a design choice. |

---

## Design Philosophy

Brijio is designed around:

- **Existing authenticated browser sessions** — use the browser the user is already signed into.
- **Explicit user control** — the user starts and stops the bridge; nothing happens in the background.
- **Privacy by design** — data is exchanged only on explicit request; no continuous streaming.
- **Progressive disclosure** — agents receive the minimum information needed to act.
- **Remote-agent compatibility** — agents run anywhere; browsers stay local.

Capabilities are intentionally constrained to align with these principles.

---

## MCP Tools

### Read Tools

| Tool                | Purpose                                                                    | Status         | Chrome | Safari | Firefox    | Notes                                                                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------- | -------------- | ------ | ------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_browsers`     | List browser instances currently online for the configured pairing token   | ✅ Implemented | ✅     | ✅     | 📋 Planned | Returns browser instance ID, name, profile, and label.                                                                                                                                 |
| `read_current_page` | Read the current browser page context and optional readable content chunks | ✅ Implemented | ✅     | ✅     | 📋 Planned | Returns URL, title, headings, links, forms, editables, actions, and content preview. Supports `includeContent`, `maxContentChunks`, and `startContentIndex` parameters for pagination. |

### Action Tools

| Tool              | Purpose                                                                        | Status         | Chrome | Safari | Firefox    | Notes                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------ | -------------- | ------ | ------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `navigate_to_url` | Navigate the active tab to a URL                                               | ✅ Implemented | ✅     | ✅     | 📋 Planned | Validates URL schemes, returns final URL/title/status, and handles redirects and timeouts.                                                    |
| `click_element`   | Click a visible link or button-like action from the current browser page       | ✅ Implemented | ✅     | ✅     | 📋 Planned | Targets use short-lived IDs from the latest `read_current_page` response. Supports `kind` (link/action), `id`, and `expectedText` parameters. |
| `fill_input`      | Write text into a visible form control from the current browser page           | ✅ Implemented | ✅     | ✅     | 📋 Planned | Targets form controls by short-lived `formId` and `controlId`. Returns `browser_error` for password fields and readonly/disabled inputs.      |
| `fill_editable`   | Write text into a visible contenteditable target from the current browser page | ✅ Implemented | ✅     | ✅     | 📋 Planned | Targets contenteditable elements by short-lived ID.                                                                                           |
| `set_checked`     | Set the checked state for a checkbox or select a radio option                  | ✅ Implemented | ✅     | ✅     | 📋 Planned | Cannot uncheck a radio button — select a different option instead.                                                                            |
| `select_options`  | Select option values in a visible select control from the current browser page | ✅ Implemented | ✅     | ✅     | 📋 Planned | Supports both single-select and multi-select controls.                                                                                        |
| `submit_form`     | Submit a visible form from the current browser page                            | ✅ Implemented | ✅     | ✅     | 📋 Planned | Submits with browser validation. Targets form by short-lived `formId`.                                                                        |

---

## MCP Resources

| Resource               | Purpose                                                           | Status         | Chrome | Safari | Firefox    | Notes                                                                                         |
| ---------------------- | ----------------------------------------------------------------- | -------------- | ------ | ------ | ---------- | --------------------------------------------------------------------------------------------- |
| `current-page-context` | Read the current browser page context via resource URI            | ✅ Implemented | ✅     | ✅     | 📋 Planned | URI: `brijio://current-page-context`. Returns the same structure as `read_current_page` tool. |
| `current-page-content` | Read a chunk of normalized page content via resource URI template | ✅ Implemented | ✅     | ✅     | 📋 Planned | URI template: `brijio://current-page-content/{index}`. Returns paginated readable content.    |
| `skill://{name}`       | Read a Brijio skill's full instructions via resource URI          | ✅ Implemented | ✅     | ✅     | 📋 Planned | Each skill directory under `servers/mcp/skills/` is exposed as a resource.                    |

---

## MCP Prompts

| Prompt           | Purpose                                                               | Status         | Notes                                                                                                                                                                      |
| ---------------- | --------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `brijio-context` | Inject Brijio context: connected browsers, available skills, pitfalls | ✅ Implemented | Returns a formatted message listing connected browsers, available skills with URIs, and key pitfalls (password fields, radio buttons, short-lived IDs, never auto-submit). |

---

## MCP Skills

Brijio ships skill markdown files that guide agents through common workflows. Skills are loaded from `servers/mcp/skills/`.

| Skill             | Purpose                                                                  | Status         |
| ----------------- | ------------------------------------------------------------------------ | -------------- |
| `accessibility`   | Work with accessibility tree snapshots for structured page understanding | ✅ Implemented |
| `comparison`      | Compare two pages or tabs for differences                                | ✅ Implemented |
| `data-extraction` | Extract structured data from web pages                                   | ✅ Implemented |
| `ecommerce`       | Navigate and interact with e-commerce workflows                          | ✅ Implemented |
| `form-filling`    | Complete forms on authenticated pages safely and accurately              | ✅ Implemented |
| `monitoring`      | Monitor pages for changes over time                                      | ✅ Implemented |
| `navigation`      | Navigate between pages and manage browser tabs                           | ✅ Implemented |
| `onboarding`      | First-run setup and configuration guide for new users                    | ✅ Implemented |
| `using-brijio`    | General orientation: how to connect, read pages, and perform actions     | ✅ Implemented |
| `web-qa`          | Quality-assurance workflows: check pages, debug issues, validate content | ✅ Implemented |

---

## Browser Support Matrix

| Capability                                                                       | Chrome | Safari | Firefox    |
| -------------------------------------------------------------------------------- | ------ | ------ | ---------- |
| WebSocket connection to relay                                                    | ✅     | ✅     | 📋 Planned |
| Extension popup (connect/disconnect)                                             | ✅     | ✅     | 📋 Planned |
| Pairing token authentication                                                     | ✅     | ✅     | 📋 Planned |
| Browser presence and keepalive                                                   | ✅     | ✅     | 📋 Planned |
| Page context extraction (URL, title, headings, links, forms, editables, actions) | ✅     | ✅     | 📋 Planned |
| Page content extraction (chunked readable text)                                  | ✅     | ✅     | 📋 Planned |
| Navigation (`navigate_to_url`)                                                   | ✅     | ✅     | 📋 Planned |
| Click actions (links, buttons)                                                   | ✅     | ✅     | 📋 Planned |
| Form filling (text inputs, textareas)                                            | ✅     | ✅     | 📋 Planned |
| ContentEditable filling                                                          | ✅     | ✅     | 📋 Planned |
| Checkbox and radio control                                                       | ✅     | ✅     | 📋 Planned |
| Select options (single and multi)                                                | ✅     | ✅     | 📋 Planned |
| Form submission with browser validation                                          | ✅     | ✅     | 📋 Planned |

Firefox is not yet implemented.

---

## Extension Features

| Feature                               | Chrome | Safari | Firefox    | Notes                                                                                               |
| ------------------------------------- | ------ | ------ | ---------- | --------------------------------------------------------------------------------------------------- |
| Manual connect/disconnect via popup   | ✅     | ✅     | 📋 Planned | User must explicitly start the bridge; no background auto-connect.                                  |
| WebSocket URL and token configuration | ✅     | ✅     | 📋 Planned | Stored in extension local storage.                                                                  |
| Browser identity and profile labels   | ✅     | ✅     | 📋 Planned | Auto-generated stable instance ID, user-editable profile/label.                                     |
| Connection status badge (ON/OFF/ERR)  | ✅     | ✅     | 📋 Planned | Safari uses text-only badge; Chrome also sets badge color.                                          |
| Connection error messages             | ✅     | ✅     | 📋 Planned | Distinguishable errors: bad token, unreachable server, auth failure.                                |
| Keepalive (20-second interval)        | ✅     | ✅     | 📋 Planned | Keepalive messages contain no browser state.                                                        |
| First-run setup and onboarding        | ✅     | ✅     | 📋 Planned | Chrome uses a setup page; Safari uses a popup overlay.                                              |
| Regular page access permission prompt | ✅     | —      | 📋 Planned | Chrome requests `optional_host_permissions` at runtime. Safari grants broad host access at install. |

---

## WebSocket Relay Protocol

| Message                 | Direction          | Status         | Notes                                                      |
| ----------------------- | ------------------ | -------------- | ---------------------------------------------------------- |
| `extension_connected`   | Extension → Server | ✅ Implemented | Sent after successful authentication.                      |
| `get_status`            | Server → Extension | ✅ Implemented | Request current browser status.                            |
| `status_response`       | Extension → Server | ✅ Implemented | Respond with browser metadata.                             |
| `get_page_context`      | Server → Extension | ✅ Implemented | Request structured page context from the active tab.       |
| `page_context_response` | Extension → Server | ✅ Implemented | Return structured page data.                               |
| `perform_action`        | Server → Extension | ✅ Implemented | Request a DOM action (click, fill, check, select, submit). |
| `action_result`         | Extension → Server | ✅ Implemented | Return the result of a performed action.                   |
| `error`                 | Either             | ✅ Implemented | Structured error response with code and message.           |
| `extension_keepalive`   | Extension → Server | ✅ Implemented | Sent every 20 seconds; contains no browser state.          |

---

## Security Properties

| Property                          | Status                       | Notes                                                                                       |
| --------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------- |
| No cookie export                  | 🚫 Intentionally unsupported | Violates the authenticated-session model; the browser is the source of truth.               |
| No session cloning                | 🚫 Intentionally unsupported | The browser remains the source of truth for authenticated state.                            |
| No browser mirroring              | 🚫 Intentionally unsupported | Brijio is not remote desktop software.                                                      |
| No continuous screenshots         | 🚫 Intentionally unsupported | Privacy and token efficiency. Screenshots are only available on explicit request (planned). |
| No continuous DOM streaming       | 🚫 Intentionally unsupported | Privacy and efficiency. Data is exchanged only on explicit request.                         |
| No background surveillance        | 🚫 Intentionally unsupported | User control first. The bridge is inactive until the user connects.                         |
| No browser history collection     | 🚫 Intentionally unsupported | Outside project scope.                                                                      |
| No credential extraction          | 🚫 Intentionally unsupported | Security boundary. Password fields return `browser_error` on fill attempts.                 |
| No MFA interception               | 🚫 Intentionally unsupported | Security boundary. MFA challenges belong to the user.                                       |
| User-controlled bridge activation | ✅ Implemented               | The extension connects and disconnects on explicit user action.                             |
| Pairing token authentication      | ✅ Implemented               | Extension must authenticate with a configured token before sending data.                    |
| Explicit request/response model   | ✅ Implemented               | No data flows without an explicit MCP tool call.                                            |
| No background data transmission   | ✅ Implemented               | Keepalive messages contain no browser state.                                                |

---

## Product Limitations vs Bugs

This section clarifies the boundary between what is a product limitation (a conscious design choice or scope boundary) and what is a bug (unexpected behaviour that should be fixed).

### Product Limitations (by design)

- **Short-lived element IDs**: Target IDs (e5, f2, a1) expire when the page changes. This is intentional for safety — agents must re-read page context after any navigation or DOM mutation. Not a bug.
- **No continuous streaming**: Brijio does not push page updates to agents. Agents must poll via `read_current_page`. This is a privacy feature, not a missing capability.
- **No file uploads yet**: File input controls cannot be filled. Planned but not yet implemented.
- **No multi-tab switching yet**: Agents can see which browsers are connected but cannot switch between tabs. Planned but not yet implemented.
- **No screenshot capture yet**: Screenshots are planned but not yet available.
- **Firefox not supported**: Firefox extension is a placeholder. This is a scope decision, not a bug.
- **Password fields are blocked**: `fill_input` returns `browser_error` for `type="password"` fields. This is a security boundary, not a bug.
- **Radio buttons cannot be unchecked**: You can select a different radio option but not uncheck a single radio. This is standard HTML behaviour, not a Brijio bug.
- **Readonly and disabled inputs are blocked**: `fill_input` returns `browser_error` for readonly or disabled inputs. This is intentional, not a bug.

### Known Bugs

Report bugs at [github.com/redvex/brijio/issues](https://github.com/redvex/brijio/issues). There are no currently tracked known bugs that affect the capability surface.

---

## Planned Capabilities

These capabilities are on the roadmap but not yet implemented. Details may change before release.

| Capability                               | Status     | Brief                                                                                            |
| ---------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------ |
| Stale-target handling (snapshot IDs)     | 📋 Planned | Generation IDs on page context; actions against stale snapshots are rejected.                    |
| Improved click/action model              | 📋 Planned | Expand action discovery to ARIA buttons, menu items, tabs, disclosure controls.                  |
| Keyboard interaction (`press_key`)       | 📋 Planned | Constrained keyboard actions: Enter, Escape, Tab, arrow keys for modal dismissal and navigation. |
| Better form model                        | 📋 Planned | Structured form summaries with required fields, validation state, submit buttons.                |
| File uploads                             | 📋 Planned | Upload local files to visible file input controls.                                               |
| Download awareness                       | 📋 Planned | Detect and report download metadata without exposing file contents.                              |
| Tab listing and selection                | 📋 Planned | List open tabs; select a tab as the active context for reads and actions.                        |
| New tab and close tab actions            | 📋 Planned | Open and close browser tabs with ownership tracking.                                             |
| Workflow session state                   | 📋 Planned | Local session object tracking connected browser, selected tab, latest snapshot, and last action. |
| Page-change awareness                    | 📋 Planned | Lightweight change signals after actions; optional `wait_for_page_change` / `wait_for_element`.  |
| Accessibility-first page snapshot        | 📋 Planned | Structured accessibility snapshot focused on interactive and semantic nodes.                     |
| Readable content extraction quality pass | 📋 Planned | Stable chunking, content metadata, reduced boilerplate for article/docs/tables.                  |
| Screenshot capture                       | 📋 Planned | Explicit screenshot of the selected tab; logged, not automatic.                                  |
| Element detail lookup                    | 📋 Planned | Inspect a specific element by target ID without re-reading the whole page.                       |
| Console log inspection                   | 📋 Planned | Request recent console logs for the selected tab; bounded and explicit.                          |
| Network request metadata                 | 📋 Planned | Recent network request metadata: method, URL, status, timing; no request/response bodies.        |
| Page health summary                      | 📋 Planned | Concise health summary: URL/title, load timing, console error count, failed request count.       |
| Local trace bundle                       | 📋 Planned | Optional local trace recording for a single workflow; stored locally only.                       |
| Chrome Web Store distribution            | 📋 Planned | Published Chrome extension for easy installation without local builds.                           |
| Safari parity hardening                  | 📋 Planned | Document Safari limitations; verify parity for every implemented feature.                        |
| Firefox implementation decision          | 📋 Planned | Spike Firefox feasibility; ADR to decide implement, defer, or drop.                              |
| Versioned protocol compatibility         | 📋 Planned | Protocol version in presence/auth; compatibility checks for mismatched versions.                 |
| End-to-end encryption                    | 📋 Planned | Relay cannot inspect payloads; encrypted between extension and agent.                            |
| Fine-grained permissions                 | 📋 Planned | Per-capability approvals before an agent can use a tool.                                         |
| User approval workflows                  | 📋 Planned | Explicit confirmation for sensitive actions (payments, deletions, data exports).                 |
| File vault integration                   | 📋 Planned | User-owned document repository for agent file access.                                            |
| Team relay support                       | 📋 Planned | Shared infrastructure for multiple agents and users.                                             |
| Audit trails                             | 📋 Planned | Structured audit logs for enterprise compliance workflows.                                       |

---

## Guiding Rule

When evaluating new features, ask:

> "Does this help a remote AI agent collaborate with an existing authenticated browser session?"

If the answer is no, the feature likely does not belong in Brijio.

---

_This capability matrix is the single source of truth for what Brijio can and cannot do. Extension READMEs, the MCP surface, and roadmap documents should use the same capability names defined here. When capabilities change, update this document first, then update linked references._
