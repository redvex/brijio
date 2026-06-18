import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createClickElementEnvelope,
  createFillInputEnvelope,
  createGetPageContentEnvelope,
  createGetPageContextEnvelope,
  createSelectOptionsEnvelope,
  createSetCheckedEnvelope,
  createSubmitFormEnvelope,
  createWriteEditableEnvelope,
  createNavigateToUrlEnvelope,
  createDownloadFileEnvelope,
  createFetchResourceEnvelope,
  parseActionResultEnvelope,
  parsePageContentEnvelope,
  parsePageContextEnvelope,
  parseNavigateToUrlEnvelope,
  isNavigateToUrlResultData,
  unsupportedSchemeResponse
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

  void it('creates a get_page_content envelope with the request ID and index', () => {
    assert.deepEqual(createGetPageContentEnvelope('request-content-1', 2), {
      type: 'message',
      id: 'request-content-1',
      payload: {
        type: 'get_page_content',
        index: 2
      }
    })
  })

  void it('creates a perform_action click envelope with the request ID and target', () => {
    assert.deepEqual(
      createClickElementEnvelope('request-click-1', {
        kind: 'link',
        id: 'bb-1'
      }),
      {
        type: 'message',
        id: 'request-click-1',
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
      }
    )
  })

  void it('creates a perform_action write_text envelope with the request ID, target, and text', () => {
    assert.deepEqual(
      createFillInputEnvelope(
        'request-fill-1',
        {
          formId: 'form-1',
          controlId: 'control-1'
        },
        'hello'
      ),
      {
        type: 'message',
        id: 'request-fill-1',
        payload: {
          type: 'perform_action',
          action: {
            type: 'write_text',
            target: {
              formId: 'form-1',
              controlId: 'control-1'
            },
            text: 'hello'
          }
        }
      }
    )
  })

  void it('creates a perform_action write_text editable envelope with the request ID, target, and text', () => {
    assert.deepEqual(
      createWriteEditableEnvelope(
        'request-editable-1',
        {
          kind: 'editable',
          id: 'bb-1'
        },
        'hello'
      ),
      {
        type: 'message',
        id: 'request-editable-1',
        payload: {
          type: 'perform_action',
          action: {
            type: 'write_text',
            target: {
              kind: 'editable',
              id: 'bb-1'
            },
            text: 'hello'
          }
        }
      }
    )
  })

  void it('creates a perform_action set_checked envelope with the request ID, target, and checked state', () => {
    assert.deepEqual(
      createSetCheckedEnvelope(
        'request-check-1',
        {
          formId: 'form-1',
          controlId: 'control-1'
        },
        true
      ),
      {
        type: 'message',
        id: 'request-check-1',
        payload: {
          type: 'perform_action',
          action: {
            type: 'set_checked',
            target: {
              formId: 'form-1',
              controlId: 'control-1'
            },
            checked: true
          }
        }
      }
    )
  })

  void it('creates a perform_action select_options envelope with the request ID, target, and values', () => {
    assert.deepEqual(
      createSelectOptionsEnvelope(
        'request-select-1',
        {
          formId: 'form-1',
          controlId: 'control-1'
        },
        ['alpha', 'gamma']
      ),
      {
        type: 'message',
        id: 'request-select-1',
        payload: {
          type: 'perform_action',
          action: {
            type: 'select_options',
            target: {
              formId: 'form-1',
              controlId: 'control-1'
            },
            values: ['alpha', 'gamma']
          }
        }
      }
    )
  })

  void it('creates a perform_action submit_form envelope with the request ID and target', () => {
    assert.deepEqual(
      createSubmitFormEnvelope('request-submit-1', {
        formId: 'form-1'
      }),
      {
        type: 'message',
        id: 'request-submit-1',
        payload: {
          type: 'perform_action',
          action: {
            type: 'submit_form',
            target: {
              formId: 'form-1'
            }
          }
        }
      }
    )
  })

  void it('creates approval-gated submit_form envelopes with action metadata', () => {
    assert.deepEqual(
      createSubmitFormEnvelope(
        'request-submit-approval-1',
        { formId: 'form-1' },
        undefined,
        undefined,
        { actionUUID: 'action-1', approvalRequest: true }
      ),
      {
        type: 'message',
        id: 'request-submit-approval-1',
        payload: {
          type: 'perform_action',
          action: {
            type: 'submit_form',
            target: { formId: 'form-1' },
            actionUUID: 'action-1',
            approvalRequest: true
          }
        }
      }
    )
  })

  void it('creates approval-gated download_file envelopes with action metadata', () => {
    assert.deepEqual(
      createDownloadFileEnvelope(
        'request-download-approval-1',
        'https://example.com/file.csv',
        undefined,
        undefined,
        undefined,
        { actionUUID: 'action-2', approvalRequest: true }
      ),
      {
        type: 'message',
        id: 'request-download-approval-1',
        payload: {
          type: 'download_file',
          url: 'https://example.com/file.csv',
          actionUUID: 'action-2',
          approvalRequest: true
        }
      }
    )
  })

  void it('creates approval-gated fetch_resource envelopes with action metadata', () => {
    assert.deepEqual(
      createFetchResourceEnvelope(
        'request-fetch-approval-1',
        'https://example.com/private.csv',
        undefined,
        undefined,
        undefined,
        { actionUUID: 'action-3', approvalRequest: true }
      ),
      {
        type: 'message',
        id: 'request-fetch-approval-1',
        payload: {
          type: 'fetch_resource',
          url: 'https://example.com/private.csv',
          actionUUID: 'action-3',
          approvalRequest: true
        }
      }
    )
  })

  void it('parses a successful matching page context response', () => {
    const result = parsePageContextEnvelope(
      {
        type: 'message',
        id: 'request-1',
        payload: {
          type: 'page_context_response',
          ok: true,
          data: createRichPageContext()
        }
      },
      'request-1'
    )

    assert.deepEqual(result, {
      ok: true,
      data: createRichPageContext()
    })
  })

  void it('parses a successful matching page content response', () => {
    const result = parsePageContentEnvelope(
      {
        type: 'message',
        id: 'request-content-2',
        payload: {
          type: 'page_content_response',
          ok: true,
          data: {
            url: 'https://example.com/',
            title: 'Example',
            timestamp: '2026-05-25T10:00:00.000Z',
            index: 1,
            content: '# Example\n\nReadable content',
            truncated: true,
            maxPayloadBytes: 131072
          }
        }
      },
      'request-content-2'
    )

    assert.deepEqual(result, {
      ok: true,
      data: {
        url: 'https://example.com/',
        title: 'Example',
        timestamp: '2026-05-25T10:00:00.000Z',
        index: 1,
        content: '# Example\n\nReadable content',
        truncated: true,
        maxPayloadBytes: 131072
      }
    })
  })

  void it('parses a successful matching click action result', () => {
    const result = parseActionResultEnvelope(
      {
        type: 'message',
        id: 'request-click-2',
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
      },
      'request-click-2'
    )

    assert.deepEqual(result, {
      ok: true,
      data: {
        action: 'click',
        target: {
          kind: 'action',
          id: 'bb-2'
        }
      }
    })
  })

  void it('parses a successful matching write_text action result', () => {
    const result = parseActionResultEnvelope(
      {
        type: 'message',
        id: 'request-fill-1',
        payload: {
          type: 'action_result',
          ok: true,
          data: {
            action: 'write_text',
            target: {
              formId: 'form-1',
              controlId: 'control-1'
            },
            textLength: 5
          }
        }
      },
      'request-fill-1'
    )

    assert.deepEqual(result, {
      ok: true,
      data: {
        action: 'write_text',
        target: {
          formId: 'form-1',
          controlId: 'control-1'
        },
        textLength: 5
      }
    })
  })

  void it('parses a successful matching write_text editable action result', () => {
    const result = parseActionResultEnvelope(
      {
        type: 'message',
        id: 'request-editable-1',
        payload: {
          type: 'action_result',
          ok: true,
          data: {
            action: 'write_text',
            target: {
              kind: 'editable',
              id: 'bb-1'
            },
            textLength: 5
          }
        }
      },
      'request-editable-1'
    )

    assert.deepEqual(result, {
      ok: true,
      data: {
        action: 'write_text',
        target: {
          kind: 'editable',
          id: 'bb-1'
        },
        textLength: 5
      }
    })
  })

  void it('parses a successful matching set_checked action result', () => {
    const result = parseActionResultEnvelope(
      {
        type: 'message',
        id: 'request-check-1',
        payload: {
          type: 'action_result',
          ok: true,
          data: {
            action: 'set_checked',
            target: {
              formId: 'form-1',
              controlId: 'control-1'
            },
            checked: true,
            changed: false
          }
        }
      },
      'request-check-1'
    )

    assert.deepEqual(result, {
      ok: true,
      data: {
        action: 'set_checked',
        target: {
          formId: 'form-1',
          controlId: 'control-1'
        },
        checked: true,
        changed: false
      }
    })
  })

  void it('parses a successful matching select_options action result', () => {
    const result = parseActionResultEnvelope(
      {
        type: 'message',
        id: 'request-select-1',
        payload: {
          type: 'action_result',
          ok: true,
          data: {
            action: 'select_options',
            target: {
              formId: 'form-1',
              controlId: 'control-1'
            },
            values: ['alpha', 'gamma']
          }
        }
      },
      'request-select-1'
    )

    assert.deepEqual(result, {
      ok: true,
      data: {
        action: 'select_options',
        target: {
          formId: 'form-1',
          controlId: 'control-1'
        },
        values: ['alpha', 'gamma']
      }
    })
  })

  void it('parses a successful matching submit_form action result', () => {
    const result = parseActionResultEnvelope(
      {
        type: 'message',
        id: 'request-submit-1',
        payload: {
          type: 'action_result',
          ok: true,
          data: {
            action: 'submit_form',
            target: {
              formId: 'form-1'
            }
          }
        }
      },
      'request-submit-1'
    )

    assert.deepEqual(result, {
      ok: true,
      data: {
        action: 'submit_form',
        target: {
          formId: 'form-1'
        }
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

  void it('parses a matching page content extension error as a browser_error', () => {
    const result = parsePageContentEnvelope(
      {
        type: 'message',
        id: 'request-content-3',
        payload: {
          type: 'page_content_response',
          ok: false,
          error: {
            code: 'invalid_index',
            message: 'Page content chunk index must be available and 1-based.'
          }
        }
      },
      'request-content-3'
    )

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'browser_error',
        message: 'Page content chunk index must be available and 1-based.'
      }
    })
  })

  void it('parses a matching click action extension error as a browser_error', () => {
    const result = parseActionResultEnvelope(
      {
        type: 'message',
        id: 'request-click-3',
        payload: {
          type: 'action_result',
          ok: false,
          error: {
            code: 'target_not_found',
            message: 'No matching click target was found.'
          }
        }
      },
      'request-click-3'
    )

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'browser_error',
        message: 'No matching click target was found.'
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
          data: createRichPageContext()
        }
      },
      'request-4'
    )

    assert.deepEqual(result, { ok: false, ignored: true })
  })

  void it('ignores click action result envelopes for a different request ID', () => {
    const result = parseActionResultEnvelope(
      {
        type: 'message',
        id: 'request-click-4',
        payload: {
          type: 'action_result',
          ok: true,
          data: {
            action: 'click',
            target: {
              kind: 'link',
              id: 'bb-1'
            }
          }
        }
      },
      'request-click-5'
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

  void it('returns invalid_response for malformed matching page content responses', () => {
    const result = parsePageContentEnvelope(
      {
        type: 'message',
        id: 'request-content-4',
        payload: {
          type: 'page_content_response',
          ok: true,
          data: {
            url: 'https://example.com/',
            title: 'Example',
            timestamp: '2026-05-25T10:00:00.000Z',
            index: 0,
            content: 'Readable content',
            truncated: false,
            maxPayloadBytes: 131072
          }
        }
      },
      'request-content-4'
    )

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'invalid_response',
        message: 'Received an invalid Brijio response.'
      }
    })
  })

  void it('returns invalid_response for malformed matching click action results', () => {
    const result = parseActionResultEnvelope(
      {
        type: 'message',
        id: 'request-click-6',
        payload: {
          type: 'action_result',
          ok: true,
          data: {
            action: 'click',
            target: {
              kind: 'image',
              id: 'bb-1'
            }
          }
        }
      },
      'request-click-6'
    )

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'invalid_response',
        message: 'Received an invalid Brijio response.'
      }
    })
  })
})

function createRichPageContext (): unknown {
  return {
    url: 'https://example.com/',
    title: 'Example',
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

void describe('MCP navigate_to_url protocol helpers', () => {
  void it('creates a navigate_to_url envelope with the request ID and url', () => {
    assert.deepEqual(
      createNavigateToUrlEnvelope('request-nav-1', 'https://example.com/'),
      {
        type: 'message',
        id: 'request-nav-1',
        payload: {
          type: 'navigate_to_url',
          url: 'https://example.com/'
        }
      }
    )
  })

  void it('parses a successful matching navigate_to_url response', () => {
    const result = parseNavigateToUrlEnvelope(
      {
        type: 'message',
        id: 'nav-1',
        payload: {
          type: 'navigate_to_url_response',
          ok: true,
          data: {
            url: 'https://example.com/',
            title: 'Example Domain',
            timestamp: '2026-06-08T10:00:00.000Z',
            redirected: false,
            navigationMs: 250
          }
        }
      },
      'nav-1'
    )

    assert.deepEqual(result, {
      ok: true,
      data: {
        url: 'https://example.com/',
        title: 'Example Domain',
        timestamp: '2026-06-08T10:00:00.000Z',
        redirected: false,
        navigationMs: 250
      }
    })
  })

  void it('parses a matching navigate_to_url error response as browser_error', () => {
    const result = parseNavigateToUrlEnvelope(
      {
        type: 'message',
        id: 'nav-2',
        payload: {
          type: 'navigate_to_url_response',
          ok: false,
          error: {
            code: 'navigation_failed',
            message: 'DNS lookup failed.'
          }
        }
      },
      'nav-2'
    )

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'browser_error',
        message: 'DNS lookup failed.'
      }
    })
  })

  void it('ignores envelopes for a different request ID', () => {
    const result = parseNavigateToUrlEnvelope(
      {
        type: 'message',
        id: 'nav-3',
        payload: {
          type: 'navigate_to_url_response',
          ok: true,
          data: {
            url: 'https://example.com/',
            title: 'Example',
            timestamp: '2026-06-08T10:00:00.000Z',
            redirected: false,
            navigationMs: 100
          }
        }
      },
      'nav-different'
    )

    assert.deepEqual(result, { ok: false, ignored: true })
  })

  void it('returns invalid_response for malformed navigate_to_url responses', () => {
    const result = parseNavigateToUrlEnvelope(
      {
        type: 'message',
        id: 'nav-4',
        payload: {
          type: 'navigate_to_url_response',
          ok: true,
          data: {
            url: 'https://example.com/'
          }
        }
      },
      'nav-4'
    )

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'invalid_response',
        message: 'Received an invalid Brijio response.'
      }
    })
  })

  void it('validates navigate_to_url result data correctly', () => {
    assert.equal(
      isNavigateToUrlResultData({
        url: 'https://example.com/',
        title: 'Example',
        timestamp: '2026-06-08T10:00:00.000Z',
        redirected: false,
        navigationMs: 250
      }),
      true
    )
  })

  void it('rejects invalid navigate_to_url result data', () => {
    assert.equal(
      isNavigateToUrlResultData({
        url: 'https://example.com/',
        title: 'Example'
      }),
      false
    )
  })

  void it('creates unsupported_scheme error response', () => {
    const result = unsupportedSchemeResponse('ftp')
    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'unsupported_scheme',
        message:
          "URL scheme 'ftp' is not supported. Only http and https are allowed."
      }
    })
  })
})
