# Regular Page Host Permissions

ADR 0011 adds optional Chrome host permissions for regular web pages:

- `http://*/*`
- `https://*/*`

The extension still uses `activeTab` and on-demand content script injection for
explicit page reads. Optional host permissions make regular page reads more
reliable when the temporary active-tab grant is unavailable.

## User Flow

The setup page now includes an explicit regular page access control. When the
user clicks it, Chrome prompts for the optional HTTP and HTTPS host
permissions. BrowserBridge does not request these permissions silently from MCP
request handling.

## Read Behavior

The background worker still rejects non-regular URLs before injection. Supported
read targets are only:

- `http://...`
- `https://...`

Unsupported pages include Chrome internal pages, extension pages, local files,
and browser-managed pages that Chrome prevents extensions from reading.

If content script injection fails on a regular page and regular page access is
not granted, the extension returns:

```json
{
  "ok": false,
  "error": {
    "code": "regular_page_permission_required",
    "message": "Regular page access is not enabled. Open BrowserBridge setup and enable regular page access."
  }
}
```

If regular page access is already granted and content script communication
still fails, the extension keeps returning `content_script_unavailable`.

## Security Boundary

This change does not add browser action tools, continuous page streaming,
storage of page content, or access to protected browser pages. Page reads remain
explicit MCP-originated requests while the user-started bridge is connected.

## Verification

The implementation adds coverage for:

- regular page origin constants;
- HTTP and HTTPS URL recognition;
- optional permission checks and requests;
- forwarding `regular_page_permission_required` through page responses;
- extension build output with the updated manifest.
