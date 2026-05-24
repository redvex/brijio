# WebSocket Single-Channel Echo And Pub/Sub

## Summary

`servers/websocket` now runs a local unauthenticated WebSocket server for the
first approved transport milestone. It is a narrow echo and pub/sub server, not
the final BrowserBridge session router.

## Behavior

All connected clients share one implicit channel. When a client sends a valid
JSON envelope, the server sends the same envelope back to the sender and to all
other connected clients.

Valid envelope:

```json
{
  "type": "message",
  "id": "optional-message-id",
  "payload": {
    "text": "hello"
  }
}
```

Invalid JSON returns:

```json
{
  "type": "error",
  "error": {
    "code": "invalid_json",
    "message": "Message must be valid JSON."
  }
}
```

Unsupported envelopes return:

```json
{
  "type": "error",
  "error": {
    "code": "invalid_message",
    "message": "Message must be an object with type \"message\" and a payload property."
  }
}
```

## Local Commands

```sh
pnpm install
pnpm --filter @browserbridge/websocket dev
pnpm --filter @browserbridge/websocket test
pnpm --filter @browserbridge/websocket build
pnpm --filter @browserbridge/websocket check
```

## Environment

```sh
WEBSOCKET_HOST=127.0.0.1
WEBSOCKET_PORT=8787
```

## Limits

This milestone does not include authentication, user IDs, session IDs, named
channels, MCP routing, browser extension integration, storage, replay, or
browser page state access.
