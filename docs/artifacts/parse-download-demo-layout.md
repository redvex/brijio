# Parse Download Demo Layout

## Summary

Parse Data and Downloads standalone demo pages use the shared demo layout shell
defined in `assets/demo-layout.css`.

The shared shell matches the Read and Respond and Navigation and Actions visual
rhythm:

- left hero copy panel with eyebrow, large title, intro, and tags;
- top-right browser-frame visual with frame dots, address bar, cursor, and route
  path;
- second-row content grid with primary fixtures on the left and sticky support
  rail on the right;
- Inter/system font stack, shared color tokens, 8px radii, and responsive mobile
  stacking.

## Files

- `clients/test-page/assets/demo-layout.css`
- `servers/mcp/demo/assets/demo-layout.css`
- `clients/test-page/parse-data.html`
- `servers/mcp/demo/parse-data.html`
- `clients/test-page/download.html`
- `servers/mcp/demo/download.html`
- `clients/test-page/index.html`
- `servers/mcp/demo/index.html`

The two CSS files are kept byte-for-byte identical. Parse Data and Downloads
HTML files are synchronized between the client test page and packaged MCP demo
roots.

## SPA Loading

The SPA demo loader fetches the standalone page, strips duplicated standalone
navigation, and inserts only the fixture body into the route container. It does
not copy fetched `<style>` or stylesheet nodes into the route container because
hidden route styles still apply globally.

Instead, `index.html` mounts one `link[data-demo-layout]` for
`assets/demo-layout.css` while a demo route is active and removes that link when
returning to Home. This keeps Parse Data and Downloads on the shared layout
without letting standalone demo rules alter the Home route.

## Fixture Stability

The layout refactor preserves existing validation fixtures:

- Parse Data keeps table section IDs `characters-table`, `timeline-table`, and
  `answer-key`.
- Downloads keeps local fixture URLs, download links, `self-url`, and the page
  script that expands local URLs and records direct download clicks.

## Verification

Use focused layout tests:

```sh
node --test scripts/parse-download-layout.test.mjs
```

The broader script test command also runs this coverage:

```sh
node --test scripts/*.test.mjs
```
