import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const cssPaths = [
  'clients/test-page/assets/demo-layout.css',
  'servers/mcp/demo/assets/demo-layout.css'
]

const demoPages = [
  'clients/test-page/read-respond.html',
  'clients/test-page/parse-data.html',
  'clients/test-page/navigation.html',
  'clients/test-page/download.html',
  'servers/mcp/demo/read-respond.html',
  'servers/mcp/demo/parse-data.html',
  'servers/mcp/demo/navigation.html',
  'servers/mcp/demo/download.html'
]

function readFile (filePath) {
  return readFileSync(filePath, 'utf8')
}

void describe('demo single-flow responsive layout', () => {
  void it('keeps shared demo layout CSS synchronized across demo roots', () => {
    const [clientCss, serverCss] = cssPaths.map(readFile)

    assert.equal(serverCss, clientCss)
  })

  for (const cssPath of cssPaths) {
    void it(`${cssPath} uses a 60/40 demo header card with single-flow content`, () => {
      const css = readFile(cssPath)

      assert.match(
        css,
        /\.demo-header-copy\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*60%\)\s+minmax\(0,\s*40%\);/
      )
      assert.match(
        css,
        /\.demo-content \.layout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);/
      )
      assert.doesNotMatch(
        css,
        /\.demo-content \.layout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(/
      )
      assert.doesNotMatch(css, /\.sticky-actions\s*\{[\s\S]*?position:\s*sticky;/)
    })

    void it(`${cssPath} lets former layout columns behave as full-width flow sections`, () => {
      const css = readFile(cssPath)

      assert.match(
        css,
        /\.left-col,\s*\.right-col,\s*\.full-col,\s*#story-toc\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1;[\s\S]*?width:\s*100%;/
      )
    })
  }

  for (const pagePath of demoPages) {
    void it(`${pagePath} keeps fixture content in a single layout container`, () => {
      const html = readFile(pagePath)

      assert.match(html, /<div class="layout">/)
      assert.doesNotMatch(html, /class="right-col sticky-actions"/)
    })

    void it(`${pagePath} places the browser mock inside the demo header card`, () => {
      const html = readFile(pagePath)
      const headerColumns = html.match(
        /<div class="demo-header">\s*<div class="demo-header-copy">[\s\S]*?<div class="demo-header-visual">\s*<section class="hero-visual"[\s\S]*?<div class="browser"[\s\S]*?<\/section>\s*<\/div>\s*<\/div>\s*<\/div>\s*<div class="demo-content"/
      )

      assert.ok(headerColumns)
    })
  }
})
