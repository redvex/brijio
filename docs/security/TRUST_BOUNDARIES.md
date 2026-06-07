# Brijio Trust Boundaries

## Purpose

This document defines the trust boundaries in the Brijio architecture — where trust is required, where it is minimized, and where it is explicitly not assumed.

---

## Trust Boundaries

### Agent ↔ MCP Server

The agent trusts the MCP server to relay requests accurately and return responses without modification.

The MCP server does not trust the agent to limit itself to appropriate requests. All requests are validated against the protocol specification.

### MCP Server ↔ Brijio Relay

The MCP server and relay authenticate with separate tokens. The relay trusts the MCP server to be an authorized consumer. The MCP server trusts the relay to route messages to the intended browser.

Communication is authenticated but the relay does not need to inspect message payloads.

### Relay ↔ Browser Extension

The relay and extension authenticate with a pairing token. The relay routes messages between authenticated parties without requiring content access.

The browser extension does not trust the relay to protect data confidentiality. Future E2E encryption will make this boundary stronger by ensuring the relay cannot inspect payloads.

### Browser Extension ↔ Browser Session

The browser extension operates inside the user's browser with the permissions the user has granted.

The extension does not trust web page content. Page data is read as structured context, not executed or evaluated.

---

## Where Trust Is Placed

| Trust               | Placed In      | Reason                                 |
| ------------------- | -------------- | -------------------------------------- |
| Browser identity    | Pairing token  | Authenticated at WebSocket connection  |
| Agent authorization | MCP auth token | Separate from extension token          |
| Message routing     | Relay          | Routes between authenticated parties   |
| Browser session     | User           | User controls connection state         |
| Page data accuracy  | Extension      | Reads structured DOM, not arbitrary JS |

## Where Trust Is Minimized

| Boundary            | Minimized By                                                    |
| ------------------- | --------------------------------------------------------------- |
| Agent → Browser     | Explicit request protocol, no continuous streaming              |
| Relay → Payload     | Relay routes without content inspection; E2E encryption planned |
| Website → Extension | Read-only structured extraction, no code execution              |
| Agent → Credentials | Brijio never exports cookies, passwords, or MFA codes           |

## Where Trust Is Not Assumed

| Boundary            | Why                                                      |
| ------------------- | -------------------------------------------------------- |
| Network             | TLS required; E2E encryption planned as defense in depth |
| Cloud relay privacy | Relay intended as transport, not data processor          |
| Agent intent        | All requests validated, no assumption of good behavior   |
| Website content     | Read as data, never executed                             |

---

## Guiding Rule

When evaluating a new feature, ask:

"Does this change expand trust in any party that should not be trusted?"

If the answer is yes, the feature needs additional safeguards before it can be accepted.
