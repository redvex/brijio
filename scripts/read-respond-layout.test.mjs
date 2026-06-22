import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const readRespondPages = [
  'clients/test-page/read-respond.html',
  'servers/mcp/demo/read-respond.html'
]

const spaPages = [
  'clients/test-page/index.html',
  'servers/mcp/demo/index.html'
]

function readHtml (filePath) {
  return readFileSync(filePath, 'utf8')
}

function readCss () {
  return readFileSync('clients/test-page/assets/demo-layout.css', 'utf8')
}

void describe('read and respond shared layout', () => {
  for (const pagePath of readRespondPages) {
    void it(`${pagePath} uses the shared read/respond shell`, () => {
      const html = readHtml(pagePath)

      assert.match(html, /<link rel="stylesheet" href="assets\/demo-layout\.css">/)
      assert.doesNotMatch(html, /<style\b/)
      assert.match(html, /<section class="demo-view active" data-view="read" aria-labelledby="title">/)
      assert.match(html, /<div class="demo-header">/)
      assert.match(html, /<p class="eyebrow">READ AND RESPOND SURFACE<\/p>/)
      assert.match(html, /<h1 id="title">Read and Respond\.<\/h1>/)
      assert.match(html, /Brijio reads visible story content, fills explicit page controls, and validates the result through user-approved browser actions\./)
      assert.match(html, /<section class="hero-visual" aria-label="Agent typing response form">/)
      assert.match(html, /<span class="browser-title">Complete the response<\/span>/)
      assert.match(html, /<span class="address-pill">brijio\.local\/read#form<\/span>/)
      assert.match(html, /<div class="browser-hero"><b>Fill from context<\/b><span>Story evidence becomes approved form input\.<\/span><\/div>/)
      assert.match(html, /<div class="browser-field-card"><span>Helen's surname<\/span><b>Stoner<\/b><\/div>/)
      assert.match(html, /<span class="form-step">fill<\/span>/)
      assert.match(html, /<div class="demo-content" data-source="read-respond\.html" data-loaded="true">/)
      assert.match(html, /<div class="layout">\s*<section id="story-toc"/)
      assert.match(html, /<section id="story-toc" class="story-toc toc-col"/)
      assert.match(html, /<div class="left-col">\s*<section id="stories"/)
      assert.match(html, /<div class="right-col">\s*<section id="form"/)
    })
  }

  void it('keeps read/respond layout styling in the shared stylesheet', () => {
    const css = readCss()

    assert.match(css, /\.demo-view\[data-view="read"\] \.layout\s*\{[\s\S]*?display:\s*grid;/)
    assert.match(css, /\.demo-view\[data-view="read"\] \.layout > \.right-col\s*\{[\s\S]*?display:\s*grid;/)
    assert.match(css, /\.form-action-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/)
    assert.match(css, /\.browser-field-card\.wide\s*\{[\s\S]*?grid-column:\s*1 \/ -1;/)
  })

  void it('gives TOC section same padding as other sections', () => {
    const css = readCss()

    assert.match(css, /#story-toc,\s*\n\.demo-panel,/)
    assert.match(css, /#story-toc\s*\{[\s\S]*?padding:\s*20px/)
  })

  void it('keeps mobile stories visible and ordered below the TOC', () => {
    const css = readCss()

    assert.match(css, /#story-toc\s*\{[\s\S]*?order:\s*-1;/)
    assert.match(css, /#stories\s*\{[\s\S]*?order:\s*2;/)
    assert.match(css, /#form\s*\{[\s\S]*?order:\s*3;/)
    assert.doesNotMatch(css, /#stories \.story-accordion\s*\{[\s\S]*?display:\s*none/)
    assert.doesNotMatch(css, /#stories \.story-accordion\.toc-open/)
  })

  void it('keeps SPA loader stripping external page shell before embedding', () => {
    for (const spaPath of spaPages) {
      const html = readHtml(spaPath)

      assert.doesNotMatch(html, /doc\.head\.querySelectorAll\(["']style, link\[rel="stylesheet"\]["']\)/)
      assert.match(html, /container\.replaceChildren\.apply\(\s*container,\s*Array\.from\(doc\.body\.childNodes\),?\s*\);/)
      assert.match(html, /source === ["']read-respond\.html["']/)
      assert.match(html, /var standaloneView = doc\.body\.querySelector\(["']\.demo-view\.active["']\);/)
      assert.match(html, /doc\.body\.replaceChildren\.apply\(\s*doc\.body,\s*Array\.from\(standaloneView\.childNodes\)\.concat\(scripts\),?\s*\);/)
    }
  })
})
