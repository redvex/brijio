import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const cssPaths = [
  'clients/test-page/assets/demo-layout.css',
  'servers/mcp/demo/assets/demo-layout.css'
]

const pages = [
  {
    view: 'parse',
    titleId: 'parse-title',
    source: 'parse-data.html',
    title: 'Parse Data.',
    browserTitle: 'Parse structured data',
    address: 'brijio.local/parse#table-data',
    column: /<div class="layout">\s*<div class="full-col">/,
    visual: /<div class="browser-grid browser-table-art">[\s\S]*?<div class="browser-table-row browser-table-head">/,
    files: ['clients/test-page/parse-data.html', 'servers/mcp/demo/parse-data.html']
  },
  {
    view: 'downloads',
    titleId: 'downloads-title',
    source: 'download.html',
    title: 'Downloads.',
    browserTitle: 'Download fixtures',
    address: 'brijio.local/download#fixtures',
    column: /<div class="layout">\s*<div class="left-col">[\s\S]*?<aside class="right-col">/,
    visual: /<div class="browser-grid browser-download-art">[\s\S]*?<span class="file-icon text"><\/span>/,
    files: ['clients/test-page/download.html', 'servers/mcp/demo/download.html']
  }
]

void describe('parse download shared demo layout', () => {
  void it('keeps shared demo layout CSS synchronized across demo roots', () => {
    const [clientCss, serverCss] = cssPaths.map((cssPath) =>
      readFileSync(cssPath, 'utf8')
    )

    assert.equal(serverCss, clientCss)
    assert.match(clientCss, /\.demo-view\.active\s*\{[\s\S]*?grid-template-rows:\s*auto 1fr;/)
    assert.match(clientCss, /\.demo-header,\s*\.demo-content \.layout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);/)
    assert.doesNotMatch(clientCss, /\.demo-header,\s*\.demo-content \.layout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(/)
    assert.match(clientCss, /\.hero-visual \.form-art\[aria-hidden="true"\]\s*\{[\s\S]*?display:\s*block !important;/)
    assert.match(clientCss, /\.full-col\s*\{[\s\S]*?grid-column:\s*1 \/ -1;/)
    assert.match(clientCss, /\.browser-table-row\s*\{[\s\S]*?grid-template-columns:\s*0\.9fr 1fr 0\.8fr;/)
    assert.match(clientCss, /\.browser-download-art\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/)
  })

  for (const page of pages) {
    for (const pagePath of page.files) {
      void it(`${pagePath} uses the shared header and browser visual`, () => {
        const html = readFileSync(pagePath, 'utf8')

        assert.match(html, /<link rel="stylesheet" href="assets\/demo-layout\.css">/)
        assert.doesNotMatch(html, /<style\b/)
        assert.match(
          html,
          new RegExp(`<section class="demo-view active" data-view="${page.view}" aria-labelledby="${page.titleId}">`)
        )
        assert.match(html, new RegExp(`<h1 id="${page.titleId}">${page.title.replace('.', '\\.')}<\\/h1>`))
        assert.match(
          html,
          new RegExp(`<div class="demo-content" data-source="${page.source.replace('.', '\\.')}" data-loaded="true">`)
        )
        assert.match(html, page.column)
        assert.match(html, new RegExp(`<span class="browser-title">${page.browserTitle}<\\/span>`))
        assert.match(html, new RegExp(`<span class="address-pill">${page.address.replace('/', '\\/')}<\\/span>`))
        assert.match(html, /<div class="browser-hero"><b>[^<]+<\/b><span>[^<]+<\/span><\/div>/)
        assert.match(html, page.visual)
      })
    }
  }
})
