# ADR 0055: Shared Demo Layout And SPA Style Isolation

## Status

Accepted

## Date

2026-06-19

## Context

ADR 0054 split the demo information architecture into four routes, but the
standalone pages still drifted visually. Read and Respond, Parse Data,
Navigation and Actions, and Downloads needed the same hero/header layout,
content grid, and browser visual treatment.

During review, Navigation and Actions also exposed a containment issue. At the
reported desktop viewport, the aside grid item was correctly assigned a 409px
column, but nested Route Control content resolved closer to 476px. Long route
text and stable button sizes preserved a larger intrinsic width, so child panels
visually overflowed the aside and page boundary.

The SPA added another styling boundary. If fetched standalone page styles are
inserted into hidden route containers, those styles still apply globally and can
corrupt the Home route after navigating away and back.

## Options

1. Keep each standalone page responsible for its own layout.
   - This preserves page independence but keeps duplication and makes visual
     drift likely.
2. Add a shared standalone demo stylesheet and make every fixture page use the
   same shell.
   - This addresses visual drift directly and gives the browser visual one
     implementation.
3. Inject each fetched standalone page stylesheet into its SPA route container.
   - This gives demo routes their styles, but hidden route styles still apply
     globally and can break Home.
4. Mount the shared demo stylesheet only while a demo route is active.
   - This keeps a single CSS source for demo pages and isolates Home.

## Decision

Use options 2 and 4.

Create `assets/demo-layout.css` in both static roots and keep those files
byte-for-byte synchronized:

- `clients/test-page/assets/demo-layout.css`
- `servers/mcp/demo/assets/demo-layout.css`

Each standalone fixture page uses the same top-level structure:

- `.demo-view.active`
- `.demo-header`
- `.hero-visual`
- `.demo-content`
- `.layout`
- `.left-col` plus `.right-col`, or `.full-col` for Parse Data

Each page keeps a dedicated browser visual by providing its own
`.browser-title`, `.address-pill`, `.browser-hero`, and `.browser-grid` content.
The visual content should match the route: form evidence for Read and Respond,
table rows for Parse Data, a menu/tree visual for Navigation and Actions, and
download/file cards for Downloads.

Add containment to the shared stylesheet so browser mock internals and
Navigation and Actions panels cannot force wider intrinsic widths than their
assigned column. Long route text wraps inside `.url-display`; sticky aside
panels use `width: 100%`, `max-width: 100%`, and `min-width: 0`.

For the SPA, do not copy `<style>` or stylesheet nodes from fetched standalone
pages. Instead, mount one `link[data-demo-layout]` for `assets/demo-layout.css`
while a demo route is active and remove it when returning to Home. This
preserves the single demo CSS source without leaking standalone rules into Home.

## Consequences

Positive:

- The four demo routes now share the same layout shell.
- Route Control panels remain visually contained within the aside column.
- Action Eligibility remains readable in the narrow right column.
- Desktop layout keeps the intended left/right composition.
- Mobile layout remains a single-column stack.
- Home is no longer affected by demo route stylesheet rules after navigation.

Negative:

- Static demo duplication still requires synchronizing client and packaged MCP
  demo roots.
- Visual regressions need browser verification because the issue is rendered
  layout rather than TypeScript behavior.

## Testing

Implementation should verify:

- Client and packaged MCP demo roots keep the same shared layout CSS.
- Read, Parse, Actions, and Downloads use the same standalone shell.
- Parse Data uses `.full-col`; the other routes use `.left-col` and
  `.right-col`.
- At the reported desktop viewport, Route Control long URL text wraps within
  the panel.
- Action Eligibility cards stack vertically inside the sticky aside.
- SPA route navigation loads demo styling on demo routes and removes it from
  Home.
- Existing interactive controls still respond to clicks, switches, tabs,
  disclosure toggles, and SPA navigation buttons.
