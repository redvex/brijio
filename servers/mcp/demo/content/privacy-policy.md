# Brijio Privacy Policy

**Last updated:** June 2026

## Overview

Brijio is a user-controlled bridge between your browser and AI agents. We take privacy seriously — the extension is designed from the ground up to prevent silent data collection.

## Data Collection

**Brijio does not collect, store, or transmit any personal data to external services.**

Specifically:

- **No telemetry** — The extension does not send analytics, usage data, or crash reports.
- **No remote tracking** — No third-party tracking scripts, pixels, or identifiers.
- **No account required** — No sign-up, no login, no user accounts.
- **No cloud storage** — Connection settings (server URL, pairing token, profile name) are stored locally in Chrome's `storage.local` and never leave your machine.

## Data Flow

When you connect the Brijio extension to your local server:

1. **You explicitly start the connection** — The extension only connects when you click "Connect" and enter server details.
2. **Page data is request-driven** — AI agents must explicitly request page context or content. The extension does not continuously stream any data.
3. **All communication is local** — Data flows between your browser and your Brijio server (which you run on your own machine or network).
4. **You can disconnect anytime** — Clicking "Disconnect" immediately closes the connection. No background activity continues.

## Permissions Explained

| Permission         | Why we need it                                                              |
| ------------------ | --------------------------------------------------------------------------- |
| `activeTab`        | Access the current tab when the extension is active to provide page context |
| `scripting`        | Inject content scripts for page interaction (click, fill, form operations)  |
| `storage`          | Store connection settings locally (server URL, pairing token)               |
| `tabs`             | Query tab information (URL, title) for structured page context              |
| `host_permissions` | Inject content scripts on pages you browse — only when connected            |

## Third-Party Services

Brijio does not integrate with any third-party services, advertising networks, or analytics platforms.

## Data Retention

Since we don't collect any data, there is nothing to retain or delete.

## Changes

If we change this policy, we will update the "Last updated" date above.

## Contact

For questions about this privacy policy, open an issue at:
https://github.com/brijio/mcp/issues
