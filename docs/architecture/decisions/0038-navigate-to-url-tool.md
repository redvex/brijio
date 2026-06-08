# ADR 0038: Navigate to URL Tool

## Status

Accepted

## Date

2026-06-08

## Context

P1.1 — Navigation tool. The current Brijio MCP tool surface focuses on reading and acting on the **current** page. Agents that need to drive multi-step workflows (fill forms across pages, follow specific URLs, verify redirects) must already have the right page open before they can act. This forces agents to rely on external browser control or to ask the user to navigate manually, breaking end-to-end automation.

The ticket requires:

- Add `navigate_to_url` as a first-class MCP tool.
- Validate URL schemes and reject unsupported schemes.
- Return final URL, title, status, and navigation timing where available.
- Handle same-tab navigation, redirects, and timeouts.
- Distinguish success, timeout, blocked scheme, and tab unavailable in the tool result.

## Decision

Add a `navigate_to_url` MCP tool that instructs the browser extension to navigate the active tab to a given URL and returns structured metadata about the result.

### 1. New shared protocol type: `NavigateToUrlRequest`

In `packages/shared/src/protocol.ts`:

```ts
export interface NavigateToUrlRequest {
  type: "navigate_to_url";
  url: string;
}
```

The WS server already routes `PerformActionRequest` messages to the extension. Rather than inventing a separate request path, `navigate_to_url` is added as a new **request type** alongside `get_page_context`, `get_page_content`, and `perform_action`. The extension recognises `navigate_to_url` and responds with a `navigate_to_url_response`.

### 2. Extension response type: `NavigateToUrlResponse`

```ts
export interface NavigateToUrlResponse {
  type: "navigate_to_url_response";
  ok: true;
  data: NavigateToUrlResult;
}

export interface NavigateToUrlErrorResponse {
  type: "navigate_to_url_response";
  ok: false;
  error: {
    code: NavigateToUrlErrorCode;
    message: string;
  };
}

export interface NavigateToUrlResult {
  url: string; // final URL after any redirects
  title: string; // page title after navigation
  timestamp: string; // ISO 8601 timestamp
  redirected: boolean; // true if final URL differs from requested URL
  navigationMs: number; // wall-clock ms from request to page load event
}

export type NavigateToUrlErrorCode =
  | "no_active_tab" // no tab available
  | "unsupported_scheme" // scheme not in allowlist
  | "navigation_failed" // page load error (DNS failure, HTTP 4xx/5xx, etc.)
  | "timeout" // page load exceeded timeout
  | "unsupported_page" // chrome://, about:, etc.
  | "content_script_unavailable";
```

### 3. WS server handling: forwards to extension

The WS server routes `navigate_to_url` envelopes to the extension the same way it routes `perform_action` — by scope key lookup. No WS-level changes beyond recognising the new payload type and forwarding it.

Update `isNavigateToUrlEnvelope()` in `packages/shared/src/protocol.ts` and add a `handleExtensionMessage` case for `navigate_to_url`.

### 4. MCP tool: `navigate_to_url`

Registered in `mcp-server.ts` alongside existing tools:

```ts
server.registerTool(
  'navigate_to_url',
  {
    title: 'Navigate to URL',
    description:
      'Navigate the active browser tab to an HTTP or HTTPS URL. '
      + 'Returns the final URL, page title, redirect status, and navigation timing. '
      + 'Unsupported URL schemes (ftp:, javascript:, data:, etc.) return a structured error.',
    inputSchema: {
      url: z.string().describe('The HTTP or HTTPS URL to navigate to.'),
      browserInstanceId: browserInstanceIdInput
    }
  },
  async (input) => { … }
)
```

### 5. New browser capability: `navigate`

The extension announces `'navigate'` in its capability list alongside existing capabilities like `'page_context'` and `'click'`. The MCP server checks for this capability before routing; if no connected extension advertises `navigate`, it returns `browser_error` with a clear message ("Connected browser does not support navigation").

### 6. URL scheme validation (MCP server side)

The MCP server validates the URL **before** sending it to the extension. Only `http:` and `https:` schemes are allowed. This is a defence-in-depth measure — the extension also validates, but the MCP server rejects malformed or dangerous schemes immediately, producing clearer error messages.

Rejected schemes return:

```json
{
  "ok": false,
  "error": {
    "code": "unsupported_scheme",
    "message": "URL scheme 'ftp' is not supported. Only http and https are allowed."
  }
}
```

The extension should also guard against schemes it cannot navigate to (`chrome:`, `about:`, `javascript:`, `data:`, etc.), returning `unsupported_scheme` if somehow bypassed.

### 7. Timeout and redirect handling

- The extension sets a default navigation timeout of **15 seconds**. If the page hasn't fired `load` within that window, the extension returns `{ ok: false, error: { code: 'timeout', message: '…' } }`.
- The extension observes `webNavigation.onCompleted` and `webNavigation.onErrorOccurred` to detect the final URL after redirects. If the final URL differs from the requested URL, `redirected: true` and `url` reflects the final URL.
- Timeouts are reported with `navigationMs` set to the elapsed time at timeout.

### 8. Same-tab behaviour

`navigate_to_url` always navigates the **active tab**. It does not open new tabs or windows. If the active tab is a privileged page (`chrome://`, `about:`), the extension returns `unsupported_page`.

### 9. New error code in MCP protocol

Add `unsupported_scheme` to `BrijioErrorCode` in `servers/mcp/src/protocol.ts`, so the MCP tool can return it directly from server-side validation without touching the extension.

### 10. Integration tests

Add integration test in `servers/mcp/src/integration.test.ts`:

- **Success**: mock extension responds with `navigate_to_url_response` ok, verify MCP tool returns structured result.
- **Unsupported scheme**: MCP tool called with `ftp://`, `javascript:`, `data:` — verify `unsupported_scheme` error returned without reaching the extension.
- **Browser unavailable**: no extension connected — verify `browser_unavailable` error.
- **Extension returns error**: mock extension returns `{ ok: false, error: { code: 'navigation_failed' } }` — verify MCP tool propagates the error.

## Alternatives Considered

### A. Reuse `perform_action` with a `navigate` action type

Instead of a dedicated request type, add `{ type: 'perform_action', action: { type: 'navigate', url: '…' } }` to the existing `PerformActionRequest` union. **Rejected**: Navigation is fundamentally different from DOM actions — it changes the page context, involves network I/O, and has distinct error modes (redirects, timeouts, scheme validation). A dedicated request/response pair gives clearer semantics and a richer result type.

### B. New-tab navigation (open in new tab)

Allow an optional `newTab: boolean` parameter. **Deferred**: Opening new tabs adds tracking complexity (which tab is "current"? how do tools address the new tab?). Same-tab navigation is the minimal useful slice. New-tab support can be added later as a separate ADR.

### C. Server-side URL resolution (follow redirects in the WS relay)

Instead of relying on the extension to observe redirects, have the WS relay issue a HEAD request and return the final URL. **Rejected**: The relay shouldn't make network requests on behalf of the extension — it breaks the security model (the relay doesn't have the user's cookies, auth headers, or local network access). The extension is the authoritative source of truth for what happened in the browser.

### D. No server-side scheme validation

Rely entirely on the extension to reject bad schemes. **Rejected for P1.1**: Server-side validation gives immediate, clear error messages without a round-trip to the extension. It also prevents accidental scheme leakage (e.g., `file:///etc/passwd`) at the entry point. The extension still validates as a second line of defence.

## Consequences

**Positive:**

- Agents can navigate to specific URLs, enabling end-to-end workflows.
- Structured error codes let agents distinguish timeout vs. blocked scheme vs. navigation failure.
- `redirected: true` and `navigationMs` give agents visibility into what happened.
- Backward-compatible — new tool, new capability, no changes to existing tools.
- Defence-in-depth: both MCP server and extension validate URL schemes.

**Negative:**

- New protocol request/response types add surface area to both the WS server router and the extension background script.
- The `navigate` capability must be advertised by the extension; older extensions that don't support it will still connect but fail navigation requests with a clear error.

**Neutral:**

- Protocol version stays the same (additive change).
- The extension uses `tabs.update()` — a standard Chrome/Safari extension API with no special permissions beyond `tabs` (already declared). Note: `tabs.update()` returns before the page has fully loaded; the current implementation returns the updated tab info immediately. A future enhancement could add `webNavigation.onCompleted` listeners for more accurate redirect detection and load timing.

## Scope

This ADR covers both the **server-side** and **extension-side** implementation. The server side includes shared protocol types, WS server routing, MCP tool, and all tests. The extension side covers the background script handler (`tabs.update`), capability advertisement, and Chrome/Safari adapter tests.

### Server-side (ADR 0038 — completed)

1. **Protocol types** — `NavigateToUrlRequest`, `NavigateToUrlResponse`, `NavigateToUrlErrorResponse`, `NavigateToUrlResult`, `NavigateToUrlErrorCode` in `packages/shared/src/protocol.ts`. `'navigate'` added to `BrowserCapability`. `isNavigateToUrlEnvelope()` validator and `createNavigateToUrlEnvelope()` factory.
2. **MCP protocol types** — `'unsupported_scheme'` added to `BrijioErrorCode`. `NavigateToUrlResultData`, `createNavigateToUrlEnvelope()`, `parseNavigateToUrlEnvelope()` in `servers/mcp/src/protocol.ts`. `unsupportedSchemeResponse()`.
3. **WS client** — `requestNavigateToUrl()` in `servers/mcp/src/websocket-client.ts`.
4. **MCP tool module** — `servers/mcp/src/navigate-to-url-tool.ts` with URL validation, WS request, result mapping.
5. **MCP server registration** — `navigate_to_url` tool registered in `mcp-server.ts`.
6. **Unit & integration tests** — URL validation, envelope creation/parsing, error cases, 3 integration tests (success, unsupported scheme, browser unavailable).

### Extension-side (follow-up — completed)

7. **Shared controller** — `PageNavigationAdapter` interface and `PageNavigationResult` type added to `background-controller.ts`. `handleSocketMessage()` routes `navigate_to_url` envelopes to `handleNavigateToUrlRequest()`, which delegates to `this.options.pageNavigation.navigateToUrl(url)` and sends back the response/error envelope. `'navigate'` capability added to `announcePresence()`.
8. **Chrome adapter** — `navigateActiveTabToUrl()` function in Chrome's `background.ts`. Queries active tab via `chrome.tabs.query`, calls `chrome.tabs.update(tabId, { url })`, returns `PageNavigationResult` with redirect detection, error handling for `no_active_tab` and `navigation_failed`. Wired into controller via `pageNavigation` adapter. `ChromeApi` interface updated with `tabs.update`.
9. **Safari adapter** — `SafariPageNavigationAdapter` class in Safari's `background.ts`. Same logic using `browser.tabs.update()`. Wired into controller in `background-entry.ts`.
10. **Extension tests** — 4 controller-level tests in `background-controller.test.ts`, 5 Chrome `navigateActiveTabToUrl` tests, 5 Safari `SafariPageNavigationAdapter` tests.
