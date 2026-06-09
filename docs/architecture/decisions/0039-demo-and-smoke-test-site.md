# ADR 0039: Demo and smoke-test site

- **Status:** Proposed
- **Date:** 2026-06-09
- **Ticket:** P0.3

## Context & Problem

Users need an immediate way to verify that Brijio works end-to-end before trying it on a real logged-in application. The existing `test.html` at the repo root only covers basic form inputs (text, checkbox, select, contenteditable). The `docker compose --profile test up test-page` service runs an nginx container that serves `clients/test-page/` — but that directory is currently empty, and requiring Docker just to see a demo page is a poor onboarding experience for `npx brijio` users (ADR 0029 deliberately scoped test-page to Docker-only for P0.1 to avoid a third coordinated process).

Meanwhile, Brijio's MCP tool surface has grown substantially since `test.html` was written. The server now exposes: `click_element`, `fill_input`, `form_action` (checkbox, radio, select, multi-select), `read_current_page`, `navigate`, `scroll_page`, `select_element`, `list_browsers`, and MCP skills (`using-brijio`, `form-filling`, `navigation`, `web-qa`, `accessibility`, `monitoring`). None of these newer tools have a reproducible, agent-verifiable fixture page.

## Decision

### 1. `brijio demo` CLI command

Add a `demo` subcommand to the Brijio CLI that starts the full stack (WS server + MCP server) and serves the demo page on a local HTTP port — zero-Docker, zero-config.

```
brijio demo
```

This is functionally equivalent to `brijio start` (ADR 0035 daemon lifecycle) with an additional static file server for the demo content. The demo server runs on a configurable port (default `8789`) with CORS headers that allow the extension-bearing browser to submit form data back to the same origin.

Implementation: add a thin HTTP static server in the daemon process that serves `clients/test-page/` assets. When `brijio demo` is invoked, the startup banner appends:

```
  Demo page:   http://127.0.0.1:8789/
```

The demo server is started only when the `demo` subcommand is used — not for `brijio start` or `brijio install`.

### 2. Demo page content: "read and respond" pattern

Migrate and substantially extend `test.html` into `clients/test-page/index.html`. The page follows a "read and respond" pattern — a passage of text followed by a form whose questions can only be answered by reading that text. This exercises both page reading and form interaction in one flow.

**Passage** — a short fictional story (2-3 paragraphs) containing specific facts: names, numbers, dates, colours, order of events. Chosen to be self-contained; no external knowledge required.

**Response form** — one section per input type Brijio supports, each clearly labelled:

| Section | Input type | MCP tools exercised |
|---|---|---|
| Short text | `<input type="text">` | `fill_input` |
| Email | `<input type="email">` | `fill_input` |
| Password | `<input type="password">` | `fill_input` |
| Search | `<input type="search">` | `fill_input` |
| Textarea | `<textarea>` | `fill_input` |
| Number | `<input type="number">` | `fill_input` |
| Date | `<input type="date">` | `fill_input` |
| Checkboxes | `<input type="checkbox">` (multi) | `form_action` (checkbox) |
| Radio buttons | `<input type="radio">` (grouped) | `form_action` (radio) |
| Single select | `<select>` | `form_action` (select) / `select_element` |
| Multi-select | `<select multiple>` | `form_action` (select) / `select_element` |
| Contenteditable | `<div contenteditable>` | `fill_input` (rich) |
| Links | `<a href>` | `click_element` / `navigate` |
| Buttons | `<button>` | `click_element` |
| Disabled controls | `disabled` inputs/buttons | Verify graceful handling |
| Dynamic DOM | JS-driven content insertion | `read_current_page` (poll) |
| Table | `<table>` with structured data | `read_current_page` |
| Navigation | Same-tab link, redirect chain | `navigate` |

### 3. Submission and verification

The `<form>` uses `method="GET"` and submits to a `/results` hash-route on the same page. A small inline script reads `window.location.search`, parses the query string, and renders a results summary showing:

- Each question label
- The submitted value
- Whether it matches the expected answer (✅ / ❌)

This gives agents a deterministic, self-contained round-trip: read → fill → submit → verify, with no server-side logic or external dependencies.

### 4. Smoke-test script

Add `clients/test-page/smoke-test.md` — a Markdown checklist listing each MCP action and its expected outcome against the demo page. Structured as:

```markdown
## 1. Page reading
- [ ] Call `read_current_page` → expect passage text containing "Elena Varga"
- [ ] Call `read_current_page` → expect table with 4 data rows
- [ ] Call `read_current_page` after dynamic update → expect "Content loaded at HH:MM"

## 2. Form filling
- [ ] Call `fill_input` on `#surname` with "Varga" → expect field value "Varga"
- [ ] Call `form_action` checkbox "blue" → expect checked
- [ ] Call `form_action` select "year" value "2024" → expect selected
...
```

This is meant as a human-readable reference for agent operators, not a machine-executable test harness. The agent follows the steps and verifies each outcome visually or via tool response. CI integration tests continue to use the existing `integration.test.ts` harness.

### 5. Docker `test-page` service remains

`docker compose --profile test up test-page` continues to serve the same `clients/test-page/` content via nginx. No duplication — both `brijio demo` and Docker serve from the same source directory. The Docker service is retained for CI and for users who prefer container workflows.

### 6. README "verify in 2 minutes" section

Add a section to the project README:

```markdown
## Verify in 2 minutes

1. Install: `npx @brijio/mcp`
2. Start demo: `brijio demo`
3. Open the demo page URL printed in the banner.
4. In your MCP client, call `list_browsers` → should show your connected browser.
5. Call `read_current_page` → should see the passage text.
6. Call `fill_input` on any field → should update the page.
7. Follow `clients/test-page/smoke-test.md` for a full walkthrough.

<details>
<summary>Docker alternative</summary>

```bash
docker compose --profile test up
# Open http://localhost:8789/
```
</details>
```

### 7. Remove root `test.html`

Delete the root `test.html` file. It is superseded entirely by `clients/test-page/index.html`. Any references to it in documentation or tests are updated.

## Consequences

### Positive
- **Zero-Docker onboarding** — `brijio demo` gives a full-stack verification path without containers.
- **Comprehensive coverage** — every MCP action type has a fixture, not just text inputs.
- **Agent-verifiable** — the "read and respond" pattern gives agents a realistic end-to-end task with deterministic expected results.
- **Single source of truth** — `clients/test-page/` is the only demo content directory; both `brijio demo` and Docker serve from it.
- **CI continuity** — existing Docker-based CI unaffected; same content, different delivery.

### Negative
- **Additional process responsibility** — `brijio demo` adds a static HTTP server to the daemon's responsibilities (mitigated: single-port, no dynamic logic, only started for the `demo` subcommand).
- **Maintenance surface** — demo page must be kept in sync with tool changes (mitigated: page is simple static HTML with no build step).
- **No dynamic backend** — form submission uses GET params and client-side JS only; no server-side validation. This limits testing of POST flows and file uploads (deferred to P1.6 file upload support and P6.1 E2E fixture tests).

### Neutral
- ADR 0029's "test page is Docker-only" decision is superseded by this ADR.
- `test.html` is removed; its useful content is merged into `clients/test-page/index.html`.
- The `BRIJIO_DEMO_PORT` env var (default `8789`) joins the existing port configuration family (`BRIJIO_WS_PORT`, `BRIJIO_MCP_PORT`).