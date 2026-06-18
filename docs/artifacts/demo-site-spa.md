# Demo Site SPA

The Brijio demo site is a static SPA served by `brijio demo` from `clients/test-page/`.

## Structure

- `clients/test-page/index.html` is the screenshot-ready SPA shell and home page.
- `clients/test-page/read-respond.html` preserves the original long-form read/respond fixture.
- `clients/test-page/navigation.html` preserves the navigation and DOM action fixture.
- `clients/test-page/download.html` provides download and fetch scenarios.
- `clients/test-page/assets/` contains same-origin fixture files for deterministic download and fetch happy paths.

`servers/mcp/demo/` mirrors the same files as the packaged fallback used when the source `clients/test-page/` directory is not available.

## Routes

The SPA uses hash routes so it works with the existing static file server and nginx Docker service:

- `/#home`
- `/#read`
- `/#actions`
- `/#downloads`

The three demo routes load their existing fixture pages in same-origin iframes. Each fixture page also remains directly reachable for standalone MCP testing.

## Download Fixtures

Happy-path download URLs are local:

- `assets/brijio-demo-summary.txt`
- `assets/brijio-demo-data.json`
- `assets/brijio-demo-image.svg`

The download page keeps external URLs only for intentional edge cases:

- `https://httpbin.org/json` for CORS-allowed remote fetch behavior.
- `https://example.com` for CORS-blocked browser fetch behavior.

Use `download_file` followed by `download_status` for local fixture downloads. Use `fetch_resource` against the local JSON fixture for deterministic content verification.
