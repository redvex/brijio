import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const navigationPages = [
  'clients/test-page/navigation.html',
  'servers/mcp/demo/navigation.html'
]

function readHtml (filePath) {
  return readFileSync(filePath, 'utf8')
}

function readCss () {
  return readFileSync('clients/test-page/assets/demo-layout.css', 'utf8')
}

void describe('navigation demo layout containment', () => {
  for (const pagePath of navigationPages) {
    void it(`${pagePath} uses the shared actions single-flow layout`, () => {
      const html = readHtml(pagePath)

      assert.match(html, /<link rel="stylesheet" href="assets\/demo-layout\.css">/)
      assert.doesNotMatch(html, /<style\b/)
      assert.match(html, /<section class="demo-view active" data-view="actions" aria-labelledby="actions-title">/)
      assert.match(html, /<div class="demo-content" data-source="navigation\.html" data-loaded="true">/)
      assert.match(html, /<div class="layout">\s*<div class="left-col">/)
      assert.match(html, /<aside class="right-col">/)
      assert.match(html, /<span class="browser-title">Explore page<\/span>/)
      assert.match(html, /<span class="address-pill">brijio\.local\/actions#route-control<\/span>/)
      assert.match(html, /<div class="browser-hero"><b>Navigate<\/b><span>Click, switch state, and confirm route changes\.<\/span><\/div>/)
      assert.match(html, /<div class="browser-grid browser-tree-art">/)
      assert.match(html, /<div class="browser-tree-node child selected"><span><\/span><b>Route control<\/b><\/div>/)
    })
  }

  void it('keeps actions layout in the shared single flow', () => {
    const css = readCss()

    assert.match(css, /\.demo-header,\s*\.demo-content \.layout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);/)
    assert.match(css, /\.browser-tree-node\s*\{[\s\S]*?display:\s*flex;/)
    assert.match(css, /\.demo-content \.right-col\s*\{[\s\S]*?grid-column:\s*1 \/ -1;[\s\S]*?width:\s*100%;/)
    assert.doesNotMatch(css, /\.right-col\s*\{[^}]*position:\s*sticky;/)
    assert.doesNotMatch(css, /\.right-col\s*\{[^}]*max-height:\s*calc\(100vh - 32px\);/)
    assert.doesNotMatch(css, /\.right-col\s*\{[^}]*overflow-y:\s*auto;/)
  })
})
