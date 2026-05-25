import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseHTML } from 'linkedom'
import {
  extractPageContent,
  extractPageContext
} from './page-context.js'

void describe('page context extraction', () => {
  void it('extracts structure, selected text, and preview', () => {
    const { document } = parseHTML(`
      <main>
        <h1>Dashboard</h1>
        <p>Welcome to the dashboard.</p>
        <a href="/reports">Reports</a>
        <button>Refresh</button>
        <form aria-label="Sign in">
          <label>Email <input type="email" value="ava@example.com" required /></label>
          <label>Password <input type="password" value="secret" /></label>
        </form>
      </main>
    `)

    const context = extractPageContext({
      document,
      locationHref: 'https://example.com/dashboard',
      title: 'Dashboard',
      selectedText: 'Welcome',
      now: () => '2026-05-25T10:00:00.000Z',
      previewMaxBytes: 4096,
      defaultMaxPayloadBytes: 131072
    })

    assert.equal(context.url, 'https://example.com/dashboard')
    assert.equal(context.title, 'Dashboard')
    assert.equal(context.selectedText, 'Welcome')
    assert.equal(context.preview.content.includes('Welcome to the dashboard.'), true)
    assert.deepEqual(context.structure.headings[0], {
      id: 'bb-1',
      level: 1,
      text: 'Dashboard'
    })
    assert.equal(context.structure.links[0].text, 'Reports')
    assert.equal(context.structure.actions[0].name, 'Refresh')
    assert.equal(context.structure.forms[0].controls[0].label, 'Email')
    assert.equal(context.structure.forms[0].controls[0].sensitive, true)
    assert.equal(context.structure.forms[0].controls[1].type, 'password')
    assert.equal(context.structure.forms[0].controls[1].sensitive, true)
  })

  void it('extracts readable content without hidden or sensitive values', () => {
    const { document } = parseHTML(`
      <article>
        <h1>Release Notes</h1>
        <p>Public text</p>
        <p hidden>Hidden text</p>
        <script>console.log('private')</script>
        <a href="https://example.com/docs">Docs</a>
        <img alt="Architecture diagram" src="https://example.com/diagram.png" />
        <table>
          <thead><tr><th>Name</th><th>Status</th></tr></thead>
          <tbody><tr><td>Bridge</td><td>Ready</td></tr></tbody>
        </table>
        <label>Password <input type="password" value="secret" /></label>
      </article>
    `)

    const content = extractPageContent(document)

    assert.equal(content.includes('# Release Notes'), true)
    assert.equal(content.includes('Public text'), true)
    assert.equal(content.includes('[Docs](https://example.com/docs)'), true)
    assert.equal(
      content.includes('![Architecture diagram](https://example.com/diagram.png)'),
      true
    )
    assert.equal(content.includes('| Name | Status |'), true)
    assert.equal(content.includes('Hidden text'), false)
    assert.equal(content.includes('console.log'), false)
    assert.equal(content.includes('secret'), false)
    assert.equal(content.includes('Password'), true)
  })

  void it('keeps landmark names structural instead of page-content-sized', () => {
    const { document } = parseHTML(`
      <main>
        <script>document.documentElement.setAttribute('data-page-mode', 'none')</script>
        <style>.private { display: none; }</style>
        <h1>Build an MCP server</h1>
        <p>${'Long article body '.repeat(80)}</p>
      </main>
      <nav aria-label="On this page">
        <a href="#intro">Intro</a>
      </nav>
    `)

    const context = extractPageContext({
      document,
      locationHref: 'https://example.com/docs',
      title: 'Docs',
      selectedText: null,
      now: () => '2026-05-25T10:00:00.000Z',
      previewMaxBytes: 4096,
      defaultMaxPayloadBytes: 131072
    })

    const main = context.structure.landmarks.find(
      (landmark) => landmark.role === 'main'
    )
    const nav = context.structure.landmarks.find(
      (landmark) => landmark.role === 'navigation'
    )

    assert.equal(main?.name, 'Build an MCP server')
    assert.equal(main?.name.includes('Long article body'), false)
    assert.equal(main?.name.includes('documentElement'), false)
    assert.equal(nav?.name, 'On this page')
  })
})
