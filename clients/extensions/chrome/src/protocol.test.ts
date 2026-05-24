import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createPageContextErrorResponse,
  createPageContextResponse,
  isGetPageContextEnvelope
} from './protocol.js'

void describe('Chrome extension protocol helpers', () => {
  void it('recognizes get_page_context message envelopes', () => {
    assert.equal(
      isGetPageContextEnvelope({
        type: 'message',
        id: 'request-1',
        payload: {
          type: 'get_page_context'
        }
      }),
      true
    )
  })

  void it('rejects unsupported request payloads', () => {
    assert.equal(
      isGetPageContextEnvelope({
        type: 'message',
        id: 'request-2',
        payload: {
          type: 'page_context_response'
        }
      }),
      false
    )
  })

  void it('preserves request ids in page context responses', () => {
    assert.deepEqual(
      createPageContextResponse('request-3', {
        url: 'https://example.com/',
        title: 'Example Domain'
      }),
      {
        type: 'message',
        id: 'request-3',
        payload: {
          type: 'page_context_response',
          ok: true,
          data: {
            url: 'https://example.com/',
            title: 'Example Domain'
          }
        }
      }
    )
  })

  void it('builds structured page context error responses', () => {
    assert.deepEqual(
      createPageContextErrorResponse('request-4', 'no_active_tab', 'No active tab is available.'),
      {
        type: 'message',
        id: 'request-4',
        payload: {
          type: 'page_context_response',
          ok: false,
          error: {
            code: 'no_active_tab',
            message: 'No active tab is available.'
          }
        }
      }
    )
  })
})
