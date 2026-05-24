# BrowserBridge WebSocket Server

The WebSocket server is the local message transport for BrowserBridge.

## Current Scope

The current implementation is the first approved WebSocket milestone from ADR 0002. It is intentionally small:

- No authentication.
- One implicit in-memory channel.
- Every connected client is subscribed automatically.
- Valid messages are echoed to the sender and broadcast to other connected
  clients.
- Invalid JSON and unsupported message envelopes return structured errors to
  the sender.

This package does not yet route browser sessions, MCP requests, or browser page
state. Those behaviors need a later approved ADR.

## Message Format

Valid messages use this JSON envelope:

```json
{
  "type": "message",
  "id": "optional-message-id",
  "payload": {
    "text": "hello"
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
```

## Development

```sh
pnpm --filter @browserbridge/websocket dev
pnpm --filter @browserbridge/websocket test
pnpm --filter @browserbridge/websocket build
pnpm --filter @browserbridge/websocket check
```

The tests start a real local WebSocket server on `127.0.0.1` with an ephemeral
port and connect test clients through `ws`.

## Manual CLI Test

Start the server:

```sh
pnpm --filter @browserbridge/websocket dev
```

In another terminal, connect with `wscat`:

```sh
pnpm dlx wscat -c ws://127.0.0.1:8787
```

Send a valid message:

```json
{ "type": "message", "id": "cli-1", "payload": { "text": "hello from cli" } }
```

The server should echo the same JSON envelope back to that terminal.

To test publish/subscribe behavior, open a second `wscat` terminal connected to
the same URL. Send a valid message from either terminal; both connected clients
should receive it.

To test invalid JSON handling, send:

```text
{not valid json
```

The server should respond with an `invalid_json` error envelope.
