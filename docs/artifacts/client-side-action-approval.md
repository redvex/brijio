# Client-Side Action Approval

Brijio requires browser-side user approval for the first hardcoded approval-gated action set:

- `submit_form`
- `fetch_resource`
- `download_file`

Other actions continue to execute without an approval prompt.

## Runtime Behavior

The MCP server marks approval-gated actions with:

- `actionUUID`: unique action identifier.
- `approvalRequest: true`: tells the extension to request user approval before execution.

The Chrome extension stores approval state in memory only. `approve_session` grants are scoped to the active tab origin and action type, for example:

```text
https://example.com + submit_form
```

Session grants are cleared when the bridge disconnects or the extension reloads.

## Timeouts

The local MCP HTTP server owns the request timeout and derives an approval timeout from it:

```text
approvalTimeoutMs = httpTimeoutMs - approvalTimeoutBufferMs
```

Supported environment variables:

- `BRIJIO_MCP_HTTP_TIMEOUT_MS`
- `BRIJIO_APPROVAL_TIMEOUT_BUFFER_MS`

The approval timeout is intentionally shorter than the HTTP timeout so Brijio can return a structured `approval_timeout` error before the HTTP layer returns a generic timeout.

## Batch Behavior

Approval-aware batches execute action by action in the extension background controller.

- A denied approval returns a focused `approval_denied` batch entry with the action UUID and continues later actions.
- An approval timeout is request-level. The current action returns `approval_timeout`, the banner is hidden, and unexecuted actions are returned as skipped timeout entries.
- `approve_session` suppresses later prompts for the same origin and action type during the same bridge connection.

Agents can retry the failed or skipped action UUIDs in a later tool call.
