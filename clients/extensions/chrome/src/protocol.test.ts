import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createPageContentErrorResponse,
  createPageContentResponse,
  createPageContextErrorResponse,
  createPageContextResponse,
  createActionResultErrorResponse,
  createActionResultResponse,
  isPerformActionEnvelope,
  isGetPageContentEnvelope,
  isGetPageContextEnvelope
} from './protocol.js'
import type { PageContext } from './protocol.js'

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

  void it('recognizes get_page_content message envelopes', () => {
    assert.equal(
      isGetPageContentEnvelope({
        type: 'message',
        id: 'content-1',
        payload: {
          type: 'get_page_content',
          index: 2
        }
      }),
      true
    )
  })

  void it('rejects get_page_content envelopes with invalid indexes', () => {
    assert.equal(
      isGetPageContentEnvelope({
        type: 'message',
        id: 'content-2',
        payload: {
          type: 'get_page_content',
          index: 0
        }
      }),
      false
    )
  })

  void it('recognizes perform_action click message envelopes', () => {
    assert.equal(
      isPerformActionEnvelope({
        type: 'message',
        id: 'action-1',
        payload: {
          type: 'perform_action',
          action: {
            type: 'click',
            target: {
              kind: 'link',
              id: 'bb-1'
            }
          }
        }
      }),
      true
    )
  })

  void it('recognizes perform_action write_text message envelopes', () => {
    assert.equal(
      isPerformActionEnvelope({
        type: 'message',
        id: 'action-write-1',
        payload: {
          type: 'perform_action',
          action: {
            type: 'write_text',
            target: {
              formId: 'bb-1',
              controlId: 'bb-2'
            },
            text: 'Ada Lovelace'
          }
        }
      }),
      true
    )
  })

  void it('rejects perform_action envelopes with invalid click targets', () => {
    assert.equal(
      isPerformActionEnvelope({
        type: 'message',
        id: 'action-2',
        payload: {
          type: 'perform_action',
          action: {
            type: 'click',
            target: {
              kind: 'image',
              id: 'bb-1'
            }
          }
        }
      }),
      false
    )
  })

  void it('rejects perform_action envelopes with invalid write_text targets', () => {
    assert.equal(
      isPerformActionEnvelope({
        type: 'message',
        id: 'action-write-2',
        payload: {
          type: 'perform_action',
          action: {
            type: 'write_text',
            target: {
              formId: 'bb-1',
              controlId: ''
            },
            text: 'Ada Lovelace'
          }
        }
      }),
      false
    )
  })

  void it('preserves request ids in page context responses', () => {
    assert.deepEqual(
      createPageContextResponse('request-3', createPageContextFixture()),
      {
        type: 'message',
        id: 'request-3',
        payload: {
          type: 'page_context_response',
          ok: true,
          data: createPageContextFixture()
        }
      }
    )
  })

  void it('builds rich page context responses', () => {
    assert.deepEqual(
      createPageContextResponse('context-1', {
        url: 'https://example.com/',
        title: 'Example Domain',
        timestamp: '2026-05-25T10:00:00.000Z',
        selectedText: 'selected words',
        preview: {
          content: 'Example preview',
          truncated: false,
          maxBytes: 4096
        },
        structure: {
          headings: [{ id: 'bb-1', level: 1, text: 'Example' }],
          landmarks: [],
          links: [],
          images: [],
          forms: [],
          actions: []
        },
        content: {
          available: true,
          requestType: 'get_page_content',
          firstIndex: 1,
          defaultMaxPayloadBytes: 131072
        }
      }),
      {
        type: 'message',
        id: 'context-1',
        payload: {
          type: 'page_context_response',
          ok: true,
          data: {
            url: 'https://example.com/',
            title: 'Example Domain',
            timestamp: '2026-05-25T10:00:00.000Z',
            selectedText: 'selected words',
            preview: {
              content: 'Example preview',
              truncated: false,
              maxBytes: 4096
            },
            structure: {
              headings: [{ id: 'bb-1', level: 1, text: 'Example' }],
              landmarks: [],
              links: [],
              images: [],
              forms: [],
              actions: []
            },
            content: {
              available: true,
              requestType: 'get_page_content',
              firstIndex: 1,
              defaultMaxPayloadBytes: 131072
            }
          }
        }
      }
    )
  })

  void it('builds page content responses', () => {
    assert.deepEqual(
      createPageContentResponse('content-3', {
        url: 'https://example.com/',
        title: 'Example Domain',
        timestamp: '2026-05-25T10:01:00.000Z',
        index: 1,
        content: '# Example\n\nReadable content',
        truncated: true,
        maxPayloadBytes: 131072
      }),
      {
        type: 'message',
        id: 'content-3',
        payload: {
          type: 'page_content_response',
          ok: true,
          data: {
            url: 'https://example.com/',
            title: 'Example Domain',
            timestamp: '2026-05-25T10:01:00.000Z',
            index: 1,
            content: '# Example\n\nReadable content',
            truncated: true,
            maxPayloadBytes: 131072
          }
        }
      }
    )
  })

  void it('builds page content error responses', () => {
    assert.deepEqual(
      createPageContentErrorResponse(
        'content-4',
        'invalid_index',
        'Page content chunk index must be available and 1-based.'
      ),
      {
        type: 'message',
        id: 'content-4',
        payload: {
          type: 'page_content_response',
          ok: false,
          error: {
            code: 'invalid_index',
            message: 'Page content chunk index must be available and 1-based.'
          }
        }
      }
    )
  })

  void it('builds click action result responses', () => {
    assert.deepEqual(
      createActionResultResponse('action-3', {
        action: 'click',
        target: {
          kind: 'action',
          id: 'bb-2'
        }
      }),
      {
        type: 'message',
        id: 'action-3',
        payload: {
          type: 'action_result',
          ok: true,
          data: {
            action: 'click',
            target: {
              kind: 'action',
              id: 'bb-2'
            }
          }
        }
      }
    )
  })

  void it('builds write_text action result responses', () => {
    assert.deepEqual(
      createActionResultResponse('action-write-3', {
        action: 'write_text',
        target: {
          formId: 'bb-1',
          controlId: 'bb-2'
        },
        textLength: 12
      }),
      {
        type: 'message',
        id: 'action-write-3',
        payload: {
          type: 'action_result',
          ok: true,
          data: {
            action: 'write_text',
            target: {
              formId: 'bb-1',
              controlId: 'bb-2'
            },
            textLength: 12
          }
        }
      }
    )
  })

  void it('builds action result error responses', () => {
    assert.deepEqual(
      createActionResultErrorResponse(
        'action-4',
        'target_not_found',
        'No matching click target was found.'
      ),
      {
        type: 'message',
        id: 'action-4',
        payload: {
          type: 'action_result',
          ok: false,
          error: {
            code: 'target_not_found',
            message: 'No matching click target was found.'
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

function createPageContextFixture (): PageContext {
  return {
    url: 'https://example.com/',
    title: 'Example Domain',
    timestamp: '2026-05-25T10:00:00.000Z',
    selectedText: null,
    preview: {
      content: '',
      truncated: false,
      maxBytes: 4096
    },
    structure: {
      headings: [],
      landmarks: [],
      links: [],
      images: [],
      forms: [],
      actions: []
    },
    content: {
      available: true,
      requestType: 'get_page_content',
      firstIndex: 1,
      defaultMaxPayloadBytes: 131072
    }
  }
}
