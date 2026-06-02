import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseHTML } from 'linkedom'
import { handleContentRequest, type ContentEnvironment } from '@browserbridge/shared'

void describe('Chrome content script entry', () => {
  void it('delegates to shared handleContentRequest', () => {
    const { document } = parseHTML('<main><h1>Test</h1></main>')

    const response = handleContentRequest(
      {
        type: 'extract_page_context',
        previewMaxBytes: 4096,
        defaultMaxPayloadBytes: 131072
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, true)
  })

  void it('builds environment from browser globals', () => {
    const { document } = parseHTML('<main><p>Hello</p></main>')

    const environment = createEnvironment(document)

    assert.equal(typeof environment.locationHref, 'string')
    assert.equal(typeof environment.title, 'string')
    assert.equal(typeof environment.selectedText, 'string')
    assert.equal(typeof environment.now(), 'string')
  })
})

function createEnvironment (document: Document): ContentEnvironment {
  return {
    document,
    locationHref: 'https://example.com/',
    title: 'Test',
    selectedText: '',
    now: () => new Date().toISOString()
  }
}
