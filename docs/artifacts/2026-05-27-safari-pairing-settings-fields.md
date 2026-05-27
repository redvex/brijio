# Safari Pairing Settings Fields

## Summary

The Safari extension popup now supports the complete local pairing settings
needed by the shared extension controller:

- WebSocket URL
- Pairing token
- Profile name
- Browser label

Saving or connecting from the popup persists a complete `BridgeSettings` object.
The Safari background script preserves the existing browser instance ID when one
already exists and creates a stable `safari-${randomUUID}` browser instance ID on
first save.

## User Flow

1. Open the BrowserBridge Safari popup.
2. Enter the WebSocket URL.
3. Enter the local pairing token used by the WebSocket and MCP servers.
4. Confirm or edit the profile name and browser label.
5. Click Save or Connect.

Connect saves the latest settings before attempting to start the WebSocket
connection.

## Validation

The Safari background script validates these required fields:

- WebSocket URL
- Pairing token
- Profile name
- Browser label

Blank required values return a structured runtime response:

```json
{
  "ok": false,
  "error": {
    "code": "invalid_settings",
    "message": "Pairing token is required."
  }
}
```

The popup displays the returned error message in its status area.

## Implementation Notes

The Safari `get_settings` runtime message now returns the full stored
`BridgeSettings` object instead of only `websocketUrl`. The popup parser reads
only editable fields from that response and ignores non-string values.

The Safari `save_settings` runtime message now accepts:

- `websocketUrl`
- `pairingToken`
- `profileName`
- `label`

`browserName` remains `Safari` unless a valid existing value is already stored.
`browserInstanceId` is generated once and then preserved across settings saves.

## Verification

Verified with:

- `pnpm --filter @browserbridge/safari-extension test`
- `pnpm --filter @browserbridge/safari-extension build`
- `pnpm lint:ts`
- `pnpm lint:md`
- `git diff --check`
