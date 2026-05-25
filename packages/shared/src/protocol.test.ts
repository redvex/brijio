import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createAuthEnvelope,
  createBrowserPresenceAnnounceEnvelope,
  createBrowserPresenceRequestEnvelope,
  createPageContentErrorResponse,
  createPageContentResponse,
  createPageContextErrorResponse,
  createPageContextResponse,
  createActionResultErrorResponse,
  createActionResultResponse,
  createScopeKey,
  isPerformActionEnvelope,
  isGetPageContentEnvelope,
  isGetPageContextEnvelope,
  parseBrowserBridgeEnvelope
} from './protocol.js'
import type { PageContext } from './protocol.js'

void describe('shared BrowserBridge protocol', () => {
  void it('creates stable non-token scope keys', () => {
    const first = createScopeKey('local-token')
    const second = createScopeKey('local-token')

    assert.equal(first, second)
    assert.notEqual(first, 'local-token')
    assert.match(first, /^[a-f0-9]{64}$/)
  })

  void it('parses auth envelopes', () => {
    const envelope = createAuthEnvelope({
      requestId: 'auth-1',
      token: 'local-token',
      role: 'extension'
    })

    assert.deepEqual(parseBrowserBridgeEnvelope(JSON.stringify(envelope)), {
      ok: true,
      message: envelope
    })
  })

  void it('parses browser presence request envelopes', () => {
    const envelope = createBrowserPresenceRequestEnvelope('presence-1')

    assert.deepEqual(parseBrowserBridgeEnvelope(JSON.stringify(envelope)), {
      ok: true,
      message: envelope
    })
  })

  void it('parses browser presence announce envelopes', () => {
    const envelope = createBrowserPresenceAnnounceEnvelope({
      requestId: 'presence-2',
      browserInstanceId: 'chrome-default-abc123',
      label: 'Chrome Default',
      browserName: 'Chrome',
      profileName: 'Default',
      capabilities: ['page_context', 'click']
    })

    assert.deepEqual(parseBrowserBridgeEnvelope(JSON.stringify(envelope)), {
      ok: true,
      message: envelope
    })
  })

  void it('rejects invalid JSON', () => {
    assert.deepEqual(parseBrowserBridgeEnvelope('{not json'), {
      ok: false,
      error: {
        type: 'error',
        error: {
          code: 'invalid_json',
          message: 'Message must be valid JSON.'
        }
      }
    })
  })
})

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

  void it('recognizes perform_action write_text editable target envelopes', () => {
    assert.equal(
      isPerformActionEnvelope({
        type: 'message',
        id: 'action-write-editable-1',
        payload: {
          type: 'perform_action',
          action: {
            type: 'write_text',
            target: {
              kind: 'editable',
              id: 'bb-1'
            },
            text: 'Plain text'
          }
        }
      }),
      true
    )
  })

  void it('recognizes perform_action set_checked message envelopes', () => {
    assert.equal(
      isPerformActionEnvelope({
        type: 'message',
        id: 'action-check-1',
        payload: {
          type: 'perform_action',
          action: {
            type: 'set_checked',
            target: {
              formId: 'bb-1',
              controlId: 'bb-3'
            },
            checked: true
          }
        }
      }),
      true
    )
  })

  void it('recognizes perform_action select_options message envelopes', () => {
    assert.equal(
      isPerformActionEnvelope({
        type: 'message',
        id: 'action-select-1',
        payload: {
          type: 'perform_action',
          action: {
            type: 'select_options',
            target: {
              formId: 'bb-1',
              controlId: 'bb-4'
            },
            values: ['alpha', 'beta']
          }
        }
      }),
      true
    )
  })

  void it('recognizes perform_action submit_form message envelopes', () => {
    assert.equal(
      isPerformActionEnvelope({
        type: 'message',
        id: 'action-submit-1',
        payload: {
          type: 'perform_action',
          action: {
            type: 'submit_form',
            target: {
              formId: 'bb-1'
            }
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

  void it('rejects perform_action envelopes with invalid select option values', () => {
    assert.equal(
      isPerformActionEnvelope({
        type: 'message',
        id: 'action-select-2',
        payload: {
          type: 'perform_action',
          action: {
            type: 'select_options',
            target: {
              formId: 'bb-1',
              controlId: 'bb-4'
            },
            values: ['alpha', 2]
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
          editables: [],
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
              editables: [],
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
      createPageContextErrorResponse(
        'request-4',
        'no_active_tab',
        'No active tab is available.'
      ),
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
      editables: [],
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
