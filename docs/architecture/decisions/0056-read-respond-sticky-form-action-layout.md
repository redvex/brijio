# ADR 0056: Read Respond Page Grid Layout

## Status

Accepted

## Date

2026-06-19

## Context

ADR 0054 split structured parsing out of Read and Respond, and ADR 0055
standardized the shared demo shell. Follow-up review clarified that Read and
Respond should keep the same two-row rhythm as the other demos:

```text
[ title and visual ]
[ stories and response form ]
```

The older standalone Read and Respond page used a flex row where the title and
local navigation belonged only to the story column, while the table of contents
and form rail started below that title. In the SPA, the route header already
owns the title/visual row, so the embedded fixture should contribute only the
working row: stories on the left and table-of-contents/form controls on the
right.

## Decision

Use the shared demo layout shell for Read and Respond.

Standalone Read and Respond keeps:

- a `.demo-header` first row with the copy panel on the left;
- a route-specific browser visual in `.hero-visual` on the right;
- a second-row `.layout` with story content in `.left-col`;
- a sticky `.right-col` containing the table of contents and response form;
- equal-width form action controls where paired buttons appear together.

When loaded inside the SPA, the loader strips the duplicated standalone shell
and embeds the route body into the SPA route. The SPA manages the shared
stylesheet with `link[data-demo-layout]`, so the fixture does not need copied
inline styles and does not leak route styles into Home.

No browser-action behavior, validation logic, answer keys, dynamic content, file
upload behavior, or form field IDs should change as part of this layout refactor.

## Consequences

Positive:

- Read and Respond follows the same demo layout rhythm as Parse Data, Navigation
  and Actions, and Downloads.
- The form rail remains close to the story content on desktop and stacks cleanly
  on mobile.
- The first viewport communicates the route purpose through a dedicated browser
  visual rather than a generic image.
- Existing MCP/browser-extension validation fixtures remain stable.

Negative:

- The duplicated client and packaged MCP static pages still need synchronization.
- Visual verification is required because the change is layout-focused.

## Testing

Implementation should verify:

- `clients/test-page/read-respond.html` and
  `servers/mcp/demo/read-respond.html` use the same shared shell.
- First row contains title/subtitle copy and a route-specific browser visual.
- Second row contains stories on the left and table-of-contents/form rail on the
  right.
- SPA Read and Respond route loads without duplicating the standalone shell.
- Existing form submission, reset, clear, validation, file upload, and dynamic
  content behavior continue to work.
