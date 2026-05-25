import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseHTML } from 'linkedom'
import { handleContentRequest } from './content.js'

void describe('content script request handler', () => {
  void it('handles extract_page_context requests', () => {
    const { document } = parseHTML('<main><h1>Example</h1><p>Hello</p></main>')

    const response = handleContentRequest(
      {
        type: 'extract_page_context',
        previewMaxBytes: 4096,
        defaultMaxPayloadBytes: 131072
      },
      {
        document,
        locationHref: 'https://example.com/',
        title: 'Example',
        selectedText: '',
        now: () => '2026-05-25T10:00:00.000Z'
      }
    )

    assert.equal(response.ok, true)
    if (!response.ok) {
      assert.fail('Expected a successful page context response.')
    }
    assert.equal(response.data.url, 'https://example.com/')
  })

  void it('handles extract_page_content requests', () => {
    const { document } = parseHTML('<main><h1>Example</h1><p>Hello</p></main>')

    const response = handleContentRequest(
      {
        type: 'extract_page_content',
        index: 1,
        maxContentBytes: 120000,
        maxPayloadBytes: 131072
      },
      {
        document,
        locationHref: 'https://example.com/',
        title: 'Example',
        selectedText: '',
        now: () => '2026-05-25T10:01:00.000Z'
      }
    )

    assert.equal(response.ok, true)
    if (!response.ok || !('index' in response.data)) {
      assert.fail('Expected a page content response.')
    }
    assert.equal(response.data.index, 1)
    assert.equal(response.data.content.includes('# Example'), true)
  })

  void it('returns invalid_index for unavailable chunks', () => {
    const { document } = parseHTML('<main><p>Only one chunk</p></main>')

    const response = handleContentRequest(
      {
        type: 'extract_page_content',
        index: 2,
        maxContentBytes: 120000,
        maxPayloadBytes: 131072
      },
      {
        document,
        locationHref: 'https://example.com/',
        title: 'Example',
        selectedText: '',
        now: () => '2026-05-25T10:02:00.000Z'
      }
    )

    assert.deepEqual(response, {
      ok: false,
      error: {
        code: 'invalid_index',
        message: 'Page content chunk index must be available and 1-based.'
      }
    })
  })
})
