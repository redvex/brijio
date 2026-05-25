# BrowserBridge License Policy Design

## Status

Draft for review

## Date

2026-05-25

## Goal

BrowserBridge should be publicly readable, forkable, and collaborative while
remaining free only for non-commercial use. Commercial use should require
separate permission from the relevant copyright holder or holders.

The project owner also wants to offer commercial BrowserBridge packages,
including a cloud-hosted WebSocket server and cloud-hosted MCP server.

## Decision

Use a source-available, non-commercial licensing model:

- License project source code under the PolyForm Noncommercial License 1.0.0.
- License documentation, diagrams, and other non-code written materials under
  Creative Commons Attribution-NonCommercial 4.0 International unless a file
  says otherwise.
- Keep logos, names, and branding outside the public content license unless a
  separate trademark or brand policy grants specific rights.
- Describe BrowserBridge as source-available and free for non-commercial use,
  not as OSI open source.
- Require commercial users to obtain separate written permission.

## Contribution Model

Use an inbound-equals-outbound contribution model:

- Contributors keep copyright in their contributions.
- Contributions are accepted under the same public license terms that apply to
  the contributed material.
- Code contributions are accepted under PolyForm Noncommercial License 1.0.0.
- Documentation and other non-code contributions are accepted under CC BY-NC
  4.0 unless the file says otherwise.
- Contributors do not grant the project owner automatic commercial relicensing
  rights.

This recognizes contributor ownership and avoids an asymmetric contributor
license agreement. The tradeoff is that commercial BrowserBridge offerings can
only include contributor-owned code or content when the relevant contributor
has separately approved that commercial use.

## Commercial Use

Commercial use of BrowserBridge requires separate written permission from the
relevant copyright holder or holders.

For project-owner-authored code and materials, the project owner can grant
commercial licenses directly.

For third-party contributions, commercial use requires either:

- the contribution is excluded from the commercial package; or
- the contributor separately grants commercial permission for that use.

The public repository should make this limitation clear so contributors and
commercial users understand that public collaboration does not automatically
grant commercial redistribution rights.

## Repository Changes To Plan

The implementation plan should cover:

- Replace the current AGPL license file with PolyForm Noncommercial License
  1.0.0 for source code.
- Add a clear notice for CC BY-NC 4.0 documentation and non-code materials.
- Add a commercial licensing document that explains commercial use requires
  written permission.
- Add a contributing document that explains the inbound-equals-outbound model.
- Update README status, license, and contribution language.
- Update package metadata from `AGPL-3.0-only` to the chosen source-available
  expression if an SPDX-compatible expression is available; otherwise use a
  conservative non-SPDX metadata value and document it.
- Add a follow-up legal-review note before relying on the policy for production
  commercial licensing.

## Non-Goals

- Do not introduce a contributor license agreement.
- Do not ask contributors to assign copyright.
- Do not grant automatic commercial rights over contributor-owned work.
- Do not describe the resulting project as OSI open source.
- Do not design commercial pricing, hosted-service terms, or customer
  contracts in this change.

## Risks And Mitigations

The main legal risk is ambiguity around commercial licensing once outside
contributions exist. Mitigate this by documenting that commercial packages may
only include owner-authored work or contributions with separate commercial
permission.

The main community risk is confusion caused by replacing AGPL with a
non-commercial source-available license. Mitigate this by using clear README and
contributing language: BrowserBridge is source-available and free for
non-commercial use, but it is not OSI open source.

The main operational risk is inconsistent file-level licensing between code,
docs, and brand assets. Mitigate this with explicit repository-level policy and
short notices in the relevant docs.

## Open Legal Review Point

This design is a project policy proposal, not legal advice. Before depending on
the policy for a commercial launch, the final license files and contribution
terms should be reviewed by a qualified lawyer.
