import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createGetPageContextEnvelope,
  parsePageContextEnvelope
} from './protocol.js'

void describe('MCP page context protocol helpers', () => {
  void it('creates a get_page_context envelope with the request ID', () => {
    assert.deepEqual(createGetPageContextEnvelope('request-1'), {
      type: 'message',
      id: 'request-1',
      payload: {
        type: 'get_page_context'
      }
    })
  })

  void it('parses a successful matching page context response', () => {
    const result = parsePageContextEnvelope(
      {
        type: 'message',
        id: 'request-1',
        payload: {
          type: 'page_context_response',
          ok: true,
          data: {
            url: 'https://example.com/',
            title: 'Example'
          }
        }
      },
      'request-1'
    )

    assert.deepEqual(result, {
      ok: true,
      data: {
        url: 'https://example.com/',
        title: 'Example'
      }
    })
  })

  void it('parses a matching extension error as a browser_error', () => {
    const result = parsePageContextEnvelope(
      {
        type: 'message',
        id: 'request-2',
        payload: {
          type: 'page_context_response',
          ok: false,
          error: {
            code: 'no_active_tab',
            message: 'No active tab is available.'
          }
        }
      },
      'request-2'
    )

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'browser_error',
        message: 'No active tab is available.'
      }
    })
  })

  void it('ignores envelopes for a different request ID', () => {
    const result = parsePageContextEnvelope(
      {
        type: 'message',
        id: 'request-3',
        payload: {
          type: 'page_context_response',
          ok: true,
          data: {
            url: 'https://example.com/',
            title: 'Example'
          }
        }
      },
      'request-4'
    )

    assert.deepEqual(result, { ok: false, ignored: true })
  })

  void it('returns invalid_response for malformed matching responses', () => {
    const result = parsePageContextEnvelope(
      {
        type: 'message',
        id: 'request-5',
        payload: {
          type: 'page_context_response',
          ok: true,
          data: {
            url: 'https://example.com/'
          }
        }
      },
      'request-5'
    )

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'invalid_response',
        message: 'Received an invalid page context response.'
      }
    })
  })
})
