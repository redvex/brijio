# ADR 0052: Safari Client Reconnect On Wake

## Status

Accepted

## Date

2026-06-18

## Context

ADR 0050 made the iOS Safari extension background page non-persistent. ADR 0051
split Safari build outputs so macOS can remain persistent while iOS stays App
Store compatible.

On iOS, Safari can unload the extension background page and drop the WebSocket.
The server already marks the browser unavailable when keepalives stop, so the
remaining client-side need is to reconnect automatically when Safari wakes the
extension again after the user has explicitly chosen Connect.

## Decision

Persist Safari client-side desired connection state:

- `desiredConnectionState: "connected"` after Connect.
- `desiredConnectionState: "disconnected"` after Disconnect.

When the Safari background entry point starts, it reads the desired connection
state and saved bridge settings. If the user previously requested a connected
bridge and settings are usable, the background controller reconnects.

Safari content scripts also send a lightweight page-activity message on
`pageshow`, `focus`, and `visibilitychange` when the document becomes visible.
The message gives the background page another event-driven chance to reconnect.

This does not try to keep the WebSocket alive while iOS has unloaded extension
JavaScript. It only reconnects when Safari gives the extension runtime another
event.

## Consequences

Positive:

- iOS reconnects silently on extension wake if the user previously clicked
  Connect.
- Disconnect remains explicit and durable.
- No server changes are required.

Negative:

- Reconnect remains best-effort because iOS controls whether and when extension
  code wakes.
- Content-script page-activity messages are hints, not a guarantee that the
  background page remains live.

## Testing

Implementation should verify:

- Connect stores desired connection state as connected.
- Disconnect stores desired connection state as disconnected.
- Background startup reconnects when desired state is connected and saved
  settings are usable.
- Background startup does not reconnect when desired state is disconnected.
- Page activity messages trigger the same reconnect path.
