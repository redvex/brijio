# ADR 0057: Parse And Download Shared Demo Layout

## Status

Accepted

## Date

2026-06-19

## Context

Read and Respond and Navigation and Actions were already moving toward a
consistent demo layout:

- left hero copy panel with eyebrow, title, intro copy, and coverage tags;
- top-right browser-frame visual language;
- second working row with primary content on the left and support controls on
  the right;
- shared Inter/system font stack and restrained 8px-radius card language.

Parse Data and Downloads still used older page-local layouts with their own
`.page`, `.hero`, `.grid`, card, table, and navigation styles. That made the
visual system diverge and forced future demo page changes to be copied by hand.

The static demo pages are also duplicated between `clients/test-page` and
`servers/mcp/demo`, so any layout refactor must keep both roots synchronized.

## Decision

Move Parse Data and Downloads onto the shared demo layout stylesheet introduced
for the four-route demo surface.

For Parse Data:

- keep existing structured tables, IDs, records, and extraction fixture text;
- use the shared hero/header structure with a route-specific browser visual that
  resembles table extraction;
- use `.full-col` for the main content because Parse Data has no persistent
  right rail in the working row.

For Downloads:

- keep existing fixture URLs, IDs, download links, and script behavior;
- use the shared hero/header structure with a route-specific download/file
  visual;
- use `.left-col` for fixtures and `.right-col` for expected outcomes and tool
  guidance.

For SPA loading, do not preserve fetched page styles by copying `<style>` or
stylesheet nodes into route containers. The SPA mounts one shared
`assets/demo-layout.css` link while any demo route is active and removes it when
returning to Home.

Do not change MCP tools, browser extension behavior, download/fetch semantics,
structured extraction data, or form/action behavior as part of this layout
refactor.

## Consequences

Positive:

- Parse Data and Downloads match Read and Respond and Navigation and Actions in
  layout, typography, and browser visual treatment.
- All four demo routes share predictable class names and layout primitives.
- Test fixture IDs, table data, download links, and scripts remain stable for
  MCP/browser-extension validation.
- Home remains isolated from standalone demo route styles.

Negative:

- The duplicated demo copies under `clients/test-page` and `servers/mcp/demo`
  still need synchronization checks.
- Visual verification is required on desktop and mobile because the change is
  layout-focused.

## Testing

Implementation should verify:

- `clients/test-page/parse-data.html` and `servers/mcp/demo/parse-data.html`
  render the same layout.
- `clients/test-page/download.html` and `servers/mcp/demo/download.html` render
  the same layout.
- Parse Data uses `.full-col`; Downloads uses `.left-col` plus `.right-col`.
- Pages stack cleanly on mobile without overlapping text, clipped cards, or
  unreadable tables.
- Existing fixture IDs, table content, download links, URL labels, and scripts
  still work.
- SPA demo shell loads Parse Data and Downloads with shared styles present and
  removes those styles when returning to Home.
