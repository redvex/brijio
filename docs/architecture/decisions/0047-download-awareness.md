# ADR 0047: Download Awareness

**Status:** Proposed | **Date:** 2026-06-15

## Context & Motivation

Brijio agents currently have no visibility into browser downloads. When a page action triggers a download (export button, PDF save, file generation), the agent receives no feedback. When an agent wants to _initiate_ a download or _fetch a resource_ on behalf of the user, it has no mechanism to do so.

This is a significant gap for common workflows:

- **Export verification:** Agent clicks "Export CSV" but cannot confirm a download started, check its filename, or detect a failure.
- **Programmatic download:** Agent needs to save a file to the user's Downloads folder (e.g., "download this invoice").
- **Authenticated resource fetch:** Agent needs the content of a URL that requires the user's session cookies — passing the URL to the agent doesn't work because the URL may be session-protected.
- **Error recovery:** A download fails (network error, disk full, permission denied) and the agent has no signal — it may assume success and move on.

Brijio's existing action model already detects side-effects (ADR 0041 stale-context, ADR 0042 click action model, ADR 0046 file upload). Download awareness extends this model.

**Critical constraints:**

1. **No push events.** Brijio is strictly request/response. The extension never pushes events to the agent. The agent cannot receive notifications the way the extension does — it must poll for state changes, consistent with `read_current_page`.
2. **URLs are not portable.** Passing a download URL to the agent is unreliable — the URL may be protected by the user's active session (cookies, auth headers, CSRF tokens). The extension is the only component with the live session, so it must be the one to fetch.
3. **Separate concerns, separate tools.** Download observation, saving to disk, and fetching authenticated content are different operations with different risk profiles. When the approvals system is implemented, `fetch_resource` will require explicit user approval (it exfiltrates data from the browser's auth context). Keeping tools separate allows granular approval policies.
4. **Cross-browser reality.** Safari does not support `browser.downloads`. Observation is not available on Safari. Initiation via `download_file` works as fire-and-forget (content-script `<a download>` click). `fetch_resource` attempts the fetch and reports CORS failure honestly — Safari same-origin works, cross-origin may be blocked.
5. **Privacy boundaries are non-negotiable.** The agent receives metadata only for `download_file` (basename, no path). `fetch_resource` sends content to the agent by explicit request. No local file paths leak, no download history is queryable.

## Decision

Add three MCP tools, a session download registry, and a content staging protocol:

1. **`download_status`** — agent polls for download state from a session-scoped registry maintained by the background script (Chrome/Firefox). Safari returns `capability: "not_supported"`.
2. **`download_file`** — agent initiates a download to the user's Downloads folder. Chrome/Firefox use `chrome.downloads.download()` and return a download ID. Safari uses content-script `<a download>` click (fire-and-forget) and returns `status: "initiated_fire_and_forget"`.
3. **`fetch_resource`** — agent requests the content of a URL, fetched by the extension using the browser's active session cookies. The extension performs the `fetch()` and streams the response back to the agent via a chunked staging protocol (reverse of ADR 0046 upload staging). The agent polls for progress. **This is a high-risk tool** — when the approvals system is implemented, it will require explicit user approval per invocation because it exfiltrates data from the browser's authenticated context.

Observation ships first. `download_file` and `fetch_resource` are built on the same protocol foundation but are separate tools with separate risk profiles.

---

## Cross-Browser Capability Matrix

| Browser | Observation      | Save to disk (`download_file`) | Authenticated fetch (`fetch_resource`)                |
| ------- | ---------------- | ------------------------------ | ----------------------------------------------------- |
| Chrome  | ✅ Full          | ✅ Full                        | ✅ Full (`host_permissions` bypasses CORS)            |
| Firefox | ✅ Full          | ✅ Full                        | ✅ Full (`host_permissions` bypasses CORS)            |
| Safari  | ❌ Not available | ⚠️ Fire-and-forget             | ⚠️ Same-origin works, cross-origin may fail with CORS |

**Safari `fetch_resource` detail:** The extension's background script attempts `fetch(url, {credentials: 'include'})`. For same-origin URLs, cookies are sent and the fetch succeeds. For cross-origin URLs, the server must provide `Access-Control-Allow-Origin` headers — otherwise the fetch fails with a CORS error, which is reported back to the agent as `{ state: "interrupted", error: "cors_blocked" }`. This is honest: the agent knows exactly what went wrong rather than receiving a generic "not supported" response.

---

## Polling Model

Brijio is request/response. The extension never pushes events to the agent. All state changes are stored in session registries and the agent polls for updates.

This applies to all three tools:

- **`download_status`** — poll for download state changes.
- **`download_file`** — returns a `downloadId` immediately; agent polls `download_status` for progress.
- **`fetch_resource`** — returns a `fetchId` immediately; agent polls `download_status` (or `fetch_resource_status`) for progress; on completion, content is retrieved via staging protocol.

```text
Agent → MCP: [fetch_resource(url)] → WS → Background script
                                         ↓
                                    fetch(url, {credentials: 'include'})
                                         ↓ (browser sends cookies automatically)
                                    Response body streaming in
                                         ↓
                                    Extension updates progress in registry
                                         ↓
                                    Agent polls: [download_status(fetchId)] → gets progress
                                         ↓
                                    On completion: extension streams content back via staging
```

If Brijio adds push events in the future, download/fetch notifications could be delivered that way — but polling remains the primary interface.

---

## MCP Tool Shapes

### `download_status` — poll for download/fetch state

```json
{
  "tool": "download_status",
  "ids": [12, "f_abc123"]
}
```

| Field | Required | Description                                                               |
| ----- | -------- | ------------------------------------------------------------------------- |
| `ids` | No       | Filter to specific download IDs or fetch IDs. Omit for all session items. |

**Response (Chrome/Firefox):**

```json
{
  "items": [
    {
      "id": 12,
      "kind": "download",
      "filename": "report-2026.csv",
      "url": "https://example.com/export",
      "mime": "text/csv",
      "size": 45230,
      "state": "complete"
    },
    {
      "id": "f_abc123",
      "kind": "fetch",
      "url": "https://app.example.com/invoice/123",
      "contentType": "application/pdf",
      "bytesReceived": 1048576,
      "totalBytes": 1048576,
      "state": "complete"
    }
  ]
}
```

**Response (Safari):**

```json
{
  "capability": "not_supported",
  "items": []
}
```

> Safari has no `browser.downloads` API. The registry cannot track downloads. The agent should treat an empty `items` list with `capability: "not_supported"` as a signal that polling is not useful, not as "zero downloads happened."

### `download_file` — initiate a download to disk

```json
{
  "tool": "download_file",
  "url": "https://example.com/file.pdf",
  "filename": "document.pdf",
  "conflictAction": "uniquify"
}
```

| Field            | Required | Description                             |
| ---------------- | -------- | --------------------------------------- |
| `url`            | Yes      | URL to download                         |
| `filename`       | No       | Suggested basename (no path components) |
| `conflictAction` | No       | `"uniquify"` (default), `"overwrite"`   |

**Response (Chrome/Firefox):**

```json
{
  "downloadId": 15,
  "status": "initiated"
}
```

**Response (Safari):**

```json
{
  "downloadId": null,
  "status": "initiated_fire_and_forget"
}
```

The agent can poll `download_status` on Chrome/Firefox using `downloadId`. On Safari, there is no status tracking — the download was triggered but completion cannot be verified.

### `fetch_resource` — fetch a URL's content using the browser's session

```json
{
  "tool": "fetch_resource",
  "url": "https://app.example.com/export/report.csv",
  "maxSizeBytes": 5242880,
  "timeout": 30000
}
```

| Field          | Required | Description                                             |
| -------------- | -------- | ------------------------------------------------------- |
| `url`          | Yes      | URL to fetch (may be session-protected)                 |
| `maxSizeBytes` | No       | Maximum response size to accept (default 10 MiB)        |
| `timeout`      | No       | Maximum time to wait for response headers (default 30s) |

**Response (immediate, all browsers):**

```json
{
  "fetchId": "f_abc123",
  "status": "in_progress"
}
```

The extension starts the fetch immediately and returns a `fetchId`. The agent polls `download_status` using this ID to track progress. On completion, the content is available via the staging protocol.

**Error response (Safari, CORS blocked):**

```json
{
  "fetchId": "f_abc123",
  "status": "interrupted",
  "error": "cors_blocked",
  "message": "Cross-origin fetch blocked by CORS policy. The server must send Access-Control-Allow-Origin headers for this request to succeed."
}
```

**Error response (size exceeded):**

```json
{
  "fetchId": "f_abc123",
  "status": "interrupted",
  "error": "size_exceeded",
  "message": "Response body exceeded maxSizeBytes limit (5242880 bytes)"
}
```

---

## `fetch_resource` Staging Protocol

The extension fetches the resource using `fetch(url, {credentials: 'include'})` — the browser's cookie jar is attached automatically. Response bytes are streamed back to MCP via a chunked staging protocol, mirroring ADR 0046's upload staging in reverse.

### Message Flow

```mermaid
sequenceDiagram
    participant Agent
    participant MCP
    participant WS as WebSocket Server
    participant Ext as Extension Background
    participant Remote as Remote Server

    Agent->>MCP: fetch_resource(url)
    MCP->>WS: fetch_resource envelope
    WS->>Ext: forward request
    Ext->>Remote: fetch(url, {credentials: 'include'})
    Remote-->>Ext: 200 OK + response headers
    Ext-->>WS: fetch_resource_start (fetchId, contentType, totalBytes)
    WS-->>MCP: forward start
    MCP-->>Agent: { fetchId, status: 'in_progress' }

    loop Content chunks
        Ext->>Ext: receive response bytes
        Ext-->>WS: fetch_resource_chunk (fetchId, index, dataBase64)
        WS-->>MCP: forward chunk
        MCP->>MCP: accumulate bytes

    Ext-->>WS: fetch_resource_complete (fetchId, sha256, totalBytes)
    WS-->>MCP: forward complete
    MCP-->>Agent: { fetchId, status: 'complete', sha256, totalBytes }
```

### WebSocket Messages

```ts
// MCP → WS → Extension
interface FetchResourceEnvelope {
  type: "fetch_resource";
  fetchId: string;
  url: string;
  maxSizeBytes?: number;
  timeout?: number;
  browserInstanceId?: string;
}

// Extension → WS → MCP
interface FetchResourceStartEnvelope {
  type: "fetch_resource_start";
  fetchId: string;
  url: string;
  contentType: string | null;
  totalBytes: number | null; // from Content-Length, null if unknown
}

interface FetchResourceChunkEnvelope {
  type: "fetch_resource_chunk";
  fetchId: string;
  index: number;
  dataBase64: string;
}

interface FetchResourceCompleteEnvelope {
  type: "fetch_resource_complete";
  fetchId: string;
  sha256: string;
  totalBytes: number;
}

interface FetchResourceErrorEnvelope {
  type: "fetch_resource_error";
  fetchId: string;
  error:
    | "cors_blocked"
    | "size_exceeded"
    | "timeout"
    | "network_error"
    | "http_error";
  httpStatus?: number;
  message: string;
}
```

### Configuration

```text
BRIJIO_FETCH_CHUNK_BYTES=65536     # max raw bytes per chunk before base64 (default 64 KiB)
BRIJIO_FETCH_MAX_BYTES=10485760    # max response size to accept (default 10 MiB)
BRIJIO_FETCH_TIMEOUT=30000         # max ms to wait for response headers (default 30s)
```

---

## `fetch_resource` Security and Approvals

`fetch_resource` is a **high-risk tool**. It fetches authenticated content from the browser's session and delivers it to the agent. This has significant security implications:

| Risk                                                                                   | Mitigation                                                                                                     |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Agent can access any URL the user's session can reach                                  | Approvals system will require explicit user consent per invocation                                             |
| Large responses could exhaust memory                                                   | `maxSizeBytes` limit enforced at both extension and MCP level                                                  |
| CORS bypass on Chrome/Firefox (extensions ignore CORS for declared `host_permissions`) | The user granted `host_permissions` when installing the extension; `fetch_resource` does not expand this scope |
| Agent receives sensitive data (bank statements, private documents)                     | Approvals system will show the URL being fetched; user can deny                                                |

**When the approvals system is implemented**, `fetch_resource` will be classified as a high-risk tool requiring explicit user approval per invocation. `download_file` and `download_status` will be classified as standard risk (they only save to the user's own Downloads folder or return metadata).

This forward-looking constraint is recorded here so that the implementation can be built with the right hooks — even if the approvals UI ships later.

---

## Download Metadata in Action Results

When a `click_element` or `perform_batch` action triggers a download that the background script detects, the response includes a `downloads` field:

```json
{
  "type": "action_result",
  "ok": true,
  "data": { "...": "..." },
  "downloads": [
    {
      "id": 12,
      "kind": "download",
      "filename": "export.csv",
      "url": "https://example.com/export",
      "mime": "text/csv",
      "size": 45230,
      "state": "in_progress"
    }
  ]
}
```

This field is **absent on Safari** (no observation capability).

---

## Download Metadata Schema

```ts
type DownloadState = "in_progress" | "complete" | "interrupted";

interface DownloadInfo {
  id: number; // browser download ID (numeric)
  kind: "download"; // distinguishes from fetch_resource items
  filename: string; // basename only, no path
  url: string; // download URL
  mime: string | null; // MIME type if known
  size: number | null; // total bytes, null if unknown
  state: DownloadState;
  error?: string; // InterruptReason if interrupted
  danger?: string; // DangerType if not "safe"
}

interface FetchResourceInfo {
  id: string; // fetchId (string, e.g. "f_abc123")
  kind: "fetch"; // distinguishes from download items
  url: string; // fetched URL
  contentType: string | null; // Content-Type header
  bytesReceived: number; // bytes received so far
  totalBytes: number | null; // Content-Length, null if unknown
  state: DownloadState | "streaming"; // "streaming" during active chunk delivery
  error?: string; // error code if interrupted
}
```

`error` and `danger` on `DownloadInfo` map from Chrome's `InterruptReason` and `DangerType` enums as structured strings.

---

## Privacy Boundaries

| Boundary                   | Applies to                         | Rationale                                                                                          |
| -------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| Basename-only filenames    | `download_file`, `download_status` | No local directory paths leak to the agent                                                         |
| No automatic file contents | `download_file`                    | Agent only gets metadata; user can access the file from their Downloads folder                     |
| Explicit content request   | `fetch_resource`                   | Content is sent only when agent explicitly requests it — this is why `fetch_resource` is high-risk |
| Session-scoped registry    | `download_status`                  | Agent cannot query downloads that started before the bridge session                                |
| No historical access       | `download_status`                  | Agent cannot search or query past downloads                                                        |
| No `downloads.open`        | All                                | `"downloads.open"` permission is explicitly excluded — agent cannot open files                     |
| Chunk content not logged   | `fetch_resource`                   | Error details may include `fetchId`, chunk indexes, sizes — but never chunk `dataBase64`           |
| `sha256` integrity check   | `fetch_resource`                   | Agent can verify received content matches what the extension fetched                               |

---

## Session Download Registry

The background script maintains two registries:

1. **`Map<number, DownloadInfo>`** — keyed by browser download ID. Populated by `chrome.downloads.onCreated`/`onChanged` events.
2. **`Map<string, FetchResourceInfo>`** — keyed by `fetchId`. Populated by `fetch_resource` execution.

**Lifecycle:**

1. Bridge connects → background script subscribes to `chrome.downloads.onCreated`/`onChanged`.
2. `onCreated` → new entry in download registry with `state: "in_progress"`.
3. `onChanged` → existing entry updated (state transition, filename finalized, size/mime populated, error set if interrupted).
4. `fetch_resource` called → new entry in fetch registry with `state: "in_progress"`, updated as bytes stream in.
5. Bridge disconnects → background script unsubscribes from events and clears both registries.

**Per-download/fetch timeout:** If an item stays `in_progress` beyond a configurable window, the background script reports it as `interrupted` with a timeout error. Default: 5 minutes.

---

## Safari — Honest Capability Disclosure

Safari does not support `browser.downloads`. Content-script heuristics for _observing_ downloads were evaluated and rejected:

| Heuristic                             | Gap                                                                         |
| ------------------------------------- | --------------------------------------------------------------------------- |
| Intercept `<a download>` clicks       | Misses `Content-Disposition: attachment` (most common real-world mechanism) |
| Sniff response headers                | Content scripts cannot access response headers                              |
| Detect `blob:`/`data:` URL navigation | Cannot observe completion, failure, MIME type, or file size                 |

Shipping a partial observation heuristic would give agents misleading signals. The honest approach is to declare the capability gap clearly.

### Safari — observation

- `download_status` returns `{ capability: "not_supported", items: [] }`.
- `get_browser_status` reports that download observation is unavailable.
- Action results do not include a `downloads` field.
- The MCP server marks `download_status` as unavailable when connected browser is Safari.

### Safari — `download_file` (fire-and-forget)

Content script creates a hidden `<a>` element with `href` set to the URL and `download` attribute set to the suggested filename, then dispatches a click event.

For cross-origin URLs: content script fetches the resource, creates a `blob:` URL with `application/octet-stream` MIME type (forces Safari to download rather than preview), then clicks the blob URL anchor. This works around Safari's limitation where the `download` attribute is ignored for cross-origin hrefs.

`download_file` returns `{ downloadId: null, status: "initiated_fire_and_forget" }` — no download ID, no status tracking. The agent treats this as best-effort.

### Safari — `fetch_resource` (honest failure)

The extension attempts `fetch(url, {credentials: 'include'})`. Results depend on the origin:

| Origin                            | Result                                    |
| --------------------------------- | ----------------------------------------- |
| Same-origin                       | ✅ Cookies sent, fetch succeeds           |
| Cross-origin with CORS headers    | ✅ Cookies sent, fetch succeeds           |
| Cross-origin without CORS headers | ❌ `cors_blocked` error reported to agent |

The agent receives a clear error message, not a generic "not supported" response. This is honest: the agent knows exactly what went wrong and can inform the user or try a different approach (e.g., asking the user to download manually).

---

## Internal WebSocket Messages

| Direction         | Message Type              | Purpose                                     |
| ----------------- | ------------------------- | ------------------------------------------- |
| Agent → Extension | `download_status`         | Poll for download/fetch state               |
| Extension → Agent | `download_status_result`  | Registry contents                           |
| Agent → Extension | `download_file`           | Initiate a download to disk                 |
| Extension → Agent | `download_file_result`    | Download ID or fire-and-forget status       |
| Agent → Extension | `fetch_resource`          | Fetch URL content with browser session      |
| Extension → Agent | `fetch_resource_start`    | Response headers received, streaming begins |
| Extension → Agent | `fetch_resource_chunk`    | Content chunk (base64)                      |
| Extension → Agent | `fetch_resource_complete` | All content streamed, sha256 provided       |
| Extension → Agent | `fetch_resource_error`    | Fetch failed (CORS, timeout, size, network) |

---

## Consequences

### Positive

- Agents can verify that downloads started, track progress, and detect failures — closing a major observability gap.
- Agents can programmatically trigger downloads, enabling export/save workflows without manual user clicks.
- Agents can fetch session-protected resources — the extension's active browser session handles authentication transparently.
- Safari users are not blocked — `download_file` works with reduced fidelity, `fetch_resource` fails honestly with clear error messages.
- Privacy boundaries are enforced by design — no file paths, no contents without explicit request, no history access.
- Polling model is consistent with Brijio's architecture — no new push infrastructure needed.
- `fetch_resource` is a separate tool with a distinct risk profile — enables granular approval policies when the approvals system ships.
- Content staging protocol mirrors ADR 0046 — proven chunking pattern, same `sha256` integrity guarantee.

### Negative

- New `"downloads"` permission required in Chrome/Firefox manifest — users will see this in the permission prompt.
- `fetch_resource` adds significant implementation complexity — streaming response, chunked staging, progress tracking, CORS handling on Safari.
- Safari observation is not available — agents operating through Safari cannot verify download outcomes.
- Safari `fetch_resource` may fail on cross-origin URLs due to CORS — this is an inherent limitation that cannot be worked around without a proxy.
- Per-download/fetch timeout adds complexity to the background script (configurable expiry, cleanup).
- Agent-side code must check capability and not block on missing results — this is a new contract that MCP tool descriptions must encode clearly.
- `fetch_resource` is high-risk — requires careful security review and will need user approval in the future.

### Risks

- **CORS on Safari `fetch_resource`:** Cross-origin fetches without CORS headers will fail. The error is reported honestly, but some workflows (e.g., fetching an invoice from a third-party portal) may not work on Safari. This is inherent to the browser's security model and cannot be fixed without a server-side proxy (out of scope).
- **Safari blob-fetch for `download_file`:** Fetching a cross-origin URL from a content script to create a blob download may also be blocked by CORS. The `<a download>` fallback still works for direct URLs but cannot set the filename reliably.
- **Download spam:** An agent could trigger many downloads or fetches in a loop. Rate limiting should be considered in a follow-up, but is out of scope for the initial implementation.
- **Memory pressure:** `fetch_resource` streams response bytes through the extension and WS. Very large resources could pressure memory. The `maxSizeBytes` limit mitigates this, but the default (10 MiB) may need tuning for different deployment scenarios.
- **Exfiltration surface:** `fetch_resource` allows the agent to access any URL the user's session can reach, including private/internal resources. The approvals system must treat this as high-risk and show the exact URL being fetched before allowing it.

---

## Scope

### In scope — observation (P1.7a)

- `"downloads"` permission in Chrome and Firefox `manifest.json`
- Session download registry in background script (Chrome/Firefox)
- `download_status` MCP tool with WebSocket routing
- Download metadata in `action_result` and `batch_result` when a download is a detected side-effect
- Safari graceful degradation: `download_status` returns `not_supported`
- Browser capability reporting in `get_browser_status`
- Per-download timeout in session registry
- Shared types in `packages/shared/src/` (`DownloadInfo`, protocol messages)

### In scope — initiation (P1.7b)

- `download_file` MCP tool: `chrome.downloads.download()` on Chrome/Firefox, `<a download>` click on Safari
- Safari cross-origin blob download fallback (`application/octet-stream`)
- `download_file_result` WebSocket messages
- Safari `initiated_fire_and_forget` response

### In scope — authenticated fetch (P1.7c)

- `fetch_resource` MCP tool with progress tracking
- `fetch_resource_start` / `_chunk` / `_complete` / `_error` WebSocket messages
- Chunked staging protocol (reverse of ADR 0046)
- `maxSizeBytes`, `timeout`, `sha256` integrity check
- CORS error detection and honest reporting on Safari
- High-risk tool classification for future approvals system

### Out of scope

- `downloads.open` permission or file-opening capability
- `downloads.search` or historical download access
- Push/event-based download notifications (polling first; push can be added later)
- `saveAs: true` file-picker prompt (default saves to user's download directory)
- Rate limiting on download/fetch initiation
- Server-side proxy for Safari CORS workaround
- Automatic file-content delivery to the agent without explicit `fetch_resource` request
- Safari observation heuristics (rejected — too unreliable)
