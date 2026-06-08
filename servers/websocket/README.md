# Brijio WebSocket Server

The WebSocket server is the local message transport for Brijio.

## Current Scope

The current implementation authenticates MCP and extension WebSocket clients
with a local pairing token, tracks live browser extension presence in memory,
and routes MCP requests only to browser instances in the same token scope.

- The WebSocket server requires `BRIJIO_PAIRING_TOKEN`.
- MCP and extension clients must send an `auth` message before any other
  message.
- Extension connections announce browser presence after authentication and in
  response to `browser_presence_request`.
- MCP connections can call `list_browsers` or send browser requests with an
  optional `target.browserInstanceId`.
- If no target is supplied, routing succeeds only when exactly one browser is
  online in the token scope.
- Presence is runtime state only. It is removed when the extension socket
  closes and does not include page URL, title, content, or DOM state.
- Invalid JSON, auth failures, unsupported messages, missing browsers, invalid
  targets, and ambiguous targets return structured errors.

## Message Format

Valid messages use this JSON envelope:

```json
{
  "type": "message",
  "id": "optional-message-id",
  "payload": {
    "type": "list_browsers"
  }
}
```

Clients authenticate with:

```json
{
  "type": "message",
  "id": "auth-1",
  "payload": {
    "type": "auth",
    "role": "mcp",
    "token": "your-local-token"
  }
}
```

Extension auth uses `"role": "extension"`. After extension auth succeeds, the
server sends `browser_presence_request`; the extension replies with
`browser_presence_announce`.

MCP targeting uses the optional top-level `target` field:

```json
{
  "type": "message",
  "id": "request-1",
  "target": {
    "browserInstanceId": "chrome-default-test"
  },
  "payload": {
    "type": "get_page_context"
  }
}
```

Invalid input returns:

```json
{
  "type": "error",
  "error": {
    "code": "invalid_json",
    "message": "Message must be valid JSON."
  }
}
```

or:

```json
{
  "type": "error",
  "error": {
    "code": "invalid_message",
    "message": "Message must be an object with type \"message\" and a payload property."
  }
}
```

## Environment

Expected local variables:

```sh
WEBSOCKET_HOST=127.0.0.1
WEBSOCKET_PORT=8787
BRIJIO_PAIRING_TOKEN=replace-with-generated-token
```

## Development

```sh
pnpm --filter @brijio/websocket dev
pnpm --filter @brijio/websocket test
pnpm --filter @brijio/websocket build
pnpm --filter @brijio/websocket check
```

The tests start a real local WebSocket server on `127.0.0.1` with an ephemeral
port and connect test clients through `ws`.

## Manual CLI Test

Start the server:

```sh
pnpm --filter @brijio/websocket dev
```

In another terminal, connect with `wscat`:

```sh
pnpm dlx wscat -c ws://127.0.0.1:8787
```

Send a valid auth message:

```json
{
  "type": "message",
  "id": "auth-1",
  "payload": {
    "type": "auth",
    "role": "mcp",
    "token": "your-local-token"
  }
}
```

Then request browser presence:

```json
{ "type": "message", "id": "list-1", "payload": { "type": "list_browsers" } }
```

The response contains online browser instances for the authenticated token
scope.

To test invalid JSON handling, send:

```text
{not valid json
```

The server should respond with an `invalid_json` error envelope.
