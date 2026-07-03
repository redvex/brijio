# Security and Trust Model

Brijio is built around explicit control and minimal trust.

## Core trust assumptions

From `docs/security/THREAT_MODEL.md` and the root README:

- the user explicitly starts and controls the browser connection
- authentication tokens are held only by authorized parties
- the browser session belongs to the user
- the relay transports messages without needing to inspect content

## Security goals

The security docs describe the main goals as:

- protect browser sessions
- avoid credential exposure
- minimize unnecessary data transfer
- reduce trust in relay infrastructure
- maintain user control

## Threats the project plans around

The threat model calls out these classes of attacker:

- malicious agent
- compromised relay server
- network attacker
- malicious website

The mitigations are architectural rather than purely defensive code patterns: explicit request/response flows, no continuous streaming, user-controlled browser connections, and progressive disclosure.

## Explicit non-goals

The capability matrix makes several boundaries clear. Brijio intentionally does not aim to provide:

- cookie export
- session cloning
- browser mirroring
- continuous screenshots
- continuous DOM streaming
- background surveillance
- credential extraction
- MFA interception

These are product boundaries, not missing features.

## Change guidance

If you change authentication, routing, browser-state exposure, or page-reading behavior, re-check the security docs first. Many design choices are security choices, not just implementation choices.

## Related source files

- `docs/security/THREAT_MODEL.md`
- `docs/security/TRUST_BOUNDARIES.md`
- `docs/security/SECURITY_GUARANTEES.md`
- `docs/project/CAPABILITY_MATRIX.md`
- `README.md`
