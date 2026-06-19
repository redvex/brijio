import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const demoPages = [
  { view: 'read', titleId: 'title', columns: ['left-col', 'right-col'], files: ['clients/test-page/read-respond.html', 'servers/mcp/demo/read-respond.html'] },
  { view: 'parse', titleId: 'parse-title', columns: ['full-col'], files: ['clients/test-page/parse-data.html', 'servers/mcp/demo/parse-data.html'] },
  { view: 'actions', titleId: 'actions-title', columns: ['left-col', 'right-col'], files: ['clients/test-page/navigation.html', 'servers/mcp/demo/navigation.html'] },
  { view: 'downloads', titleId: 'downloads-title', columns: ['left-col', 'right-col'], files: ['clients/test-page/download.html', 'servers/mcp/demo/download.html'] }
]

function readHtml (filePath) {
  return readFileSync(filePath, 'utf8')
}

function readCss () {
  return readFileSync('clients/test-page/assets/demo-layout.css', 'utf8')
}

function countMatches (html, pattern) {
  return [...html.matchAll(pattern)].length
}

void describe('standalone demo shared layout', () => {
  for (const page of demoPages) {
    for (const filePath of page.files) {
      void it(`${filePath} uses the shared standalone demo shell`, () => {
        const html = readHtml(filePath)

        assert.match(html, /<link rel="stylesheet" href="assets\/demo-layout\.css">/)
        assert.doesNotMatch(html, /href="data:image\/svg\+xml,[^"]*<link rel="stylesheet"/)
        assert.equal(countMatches(html, /<style\b/g), 0)
        assert.match(
          html,
          new RegExp(`<section class="demo-view active" data-view="${page.view}" aria-labelledby="${page.titleId}">`)
        )
        assert.match(html, /<div class="demo-header">/)
        assert.match(html, /<section class="hero-visual" aria-label="[^"]+">/)
        assert.match(html, /<div class="demo-content" data-source="[^"]+\.html" data-loaded="true">/)
        assert.match(html, /<div class="layout">/)

        for (const column of page.columns) {
          assert.match(html, new RegExp(`<(?:div|aside) class="${column}(?: [^"]*)?">`))
        }

        for (const visualHook of ['browser-title', 'address-pill', 'browser-hero', 'browser-grid']) {
          assert.match(html, new RegExp(`class="[^"]*${visualHook}[^"]*"`))
        }
      })
    }
  }

  void it('home loader embeds only standalone demo content from shared shells', () => {
    for (const filePath of ['clients/test-page/index.html', 'servers/mcp/demo/index.html']) {
      const html = readHtml(filePath)

      assert.match(html, /var standaloneView = doc\.body\.querySelector\(["']\.demo-view\.active["']\);/)
      assert.match(html, /doc\.body\.replaceChildren\.apply\(\s*doc\.body,\s*Array\.from\(standaloneView\.childNodes\)\.concat\(scripts\),?\s*\);/)
    }
  })

  void it('uses a clean shared stylesheet without stale merged page CSS', () => {
    const css = readCss()

    assert.doesNotMatch(css, /Migrated read\/respond page styles/)
    assert.doesNotMatch(css, /Migrated navigation\/actions page styles/)
    assert.doesNotMatch(css, /\.demo-content \.parse-demo,\s*\.parse-demo\s+512px/)
    assert.doesNotMatch(css, /grid-template-columns:\s*filter:/)
    assert.doesNotMatch(css, /min-width:\s*center/)
    assert.doesNotMatch(css, /border-radius:\s*border-radius:/)
    assert.doesNotMatch(css, /\.read-form-|\.read-respond-layout|\.actions-hero|\.actions-copy|\.actions-visual|\.demo-browser/)
  })
})
