import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const cssPaths = [
  'clients/test-page/assets/demo-layout.css',
  'servers/mcp/demo/assets/demo-layout.css'
]

const readRespondPages = [
  'clients/test-page/read-respond.html',
  'servers/mcp/demo/read-respond.html'
]

function readFile (filePath) {
  return readFileSync(filePath, 'utf8')
}

function mobileBlock (css) {
  const start = css.indexOf('@media (max-width: 980px)')
  assert.notEqual(start, -1)
  const nextMedia = css.indexOf('\n@media ', start + 1)
  return css.slice(start, nextMedia === -1 ? css.length : nextMedia)
}

void describe('demo mobile layout', () => {
  void it('keeps shared demo layout CSS synchronized across demo roots', () => {
    const [clientCss, serverCss] = cssPaths.map(readFile)

    assert.equal(serverCss, clientCss)
  })

  for (const cssPath of cssPaths) {
    void it(`${cssPath} uses one demo column on mobile`, () => {
      const block = mobileBlock(readFile(cssPath))

      assert.match(
        block,
        /\.demo-content \.layout\s*\{[\s\S]*?grid-template-columns:\s*1fr;/
      )
      assert.match(
        block,
        /\.left-col,\s*\.right-col,\s*\.full-col,\s*#story-toc\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1;[\s\S]*?width:\s*100%;/
      )
    })

    void it(`${cssPath} orders read/respond mobile content as toc, stories, form`, () => {
      const block = mobileBlock(readFile(cssPath))

      assert.match(block, /#story-toc\s*\{[\s\S]*?order:\s*-1;/)
      assert.match(block, /#stories\s*\{[\s\S]*?order:\s*2;/)
      assert.match(block, /#form\s*\{[\s\S]*?order:\s*3;/)
    })

    void it(`${cssPath} keeps read/respond story accordions visible but closed on mobile`, () => {
      const block = mobileBlock(readFile(cssPath))

      assert.doesNotMatch(block, /#stories \.story-accordion\s*\{[\s\S]*?display:\s*none;/)
      assert.doesNotMatch(block, /#stories \.story-accordion\.toc-open/)
    })

    void it(`${cssPath} hides demo header browser mock when header stacks`, () => {
      const block = mobileBlock(readFile(cssPath))

      assert.match(block, /\.hero-visual\s*\{[\s\S]*?display:\s*none;/)
    })
  }

  for (const pagePath of readRespondPages) {
    void it(`${pagePath} ships read/respond stories closed by default`, () => {
      const html = readFile(pagePath)

      assert.doesNotMatch(html, /<details id="speckled-band" class="story-accordion" open>/)
      assert.match(html, /<details id="speckled-band" class="story-accordion">/)
      assert.match(html, /<details id="scandal-bohemia" class="story-accordion">/)
      assert.match(html, /<details id="red-headed-league" class="story-accordion">/)
      assert.match(html, /<details id="blue-carbuncle" class="story-accordion">/)
    })
  }
})
