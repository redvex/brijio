import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseHTML } from 'linkedom'
import {
  handleContentRequest,
  type ContentRequest,
  type ContentResponse,
  type ContentEnvironment
} from '@brijio/shared'

void describe('Safari content-script-entry module', () => {
  void it('exports handleContentRequest from @brijio/shared', () => {
    assert.equal(typeof handleContentRequest, 'function')
  })

  void it('handles extract_page_context via shared handler with a DOM-based ContentEnvironment', () => {
    const { document } = parseHTML('<main><h1>Example</h1><p>Hello</p></main>')

    const env: ContentEnvironment = {
      document,
      locationHref: 'https://example.com/test',
      title: 'Test Page',
      selectedText: '',
      now: () => '2026-05-27T00:00:00.000Z'
    }

    const request: ContentRequest = {
      type: 'extract_page_context',
      previewMaxBytes: 4096,
      defaultMaxPayloadBytes: 8192
    }

    const response: ContentResponse = handleContentRequest(request, env)

    assert.equal(response.ok, true)
  })

  void it('handles perform_click via shared handler', () => {
    const { document } = parseHTML('<main><button id="my-btn">Click me</button></main>')

    const env: ContentEnvironment = {
      document,
      locationHref: 'https://example.com/test',
      title: 'Test Page',
      selectedText: '',
      now: () => '2026-05-27T00:00:00.000Z'
    }

    const request: ContentRequest = {
      type: 'perform_click',
      target: { kind: 'action', id: 'nonexistent-btn' }
    }

    const response: ContentResponse = handleContentRequest(request, env)

    // Clicking a nonexistent element should return an error response
    assert.equal(response.ok, false)
  })
})
