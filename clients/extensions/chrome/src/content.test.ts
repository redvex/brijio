import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseHTML } from 'linkedom'
import { handleContentRequest, type ContentEnvironment } from './content.js'

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
    if (!response.ok || !('url' in response.data)) {
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

  void it('clicks a visible link target by page-context id', () => {
    const { document } = parseHTML(
      '<main><a href="/first">First</a><a href="/second">Second</a></main>'
    )
    let clickedHref = ''

    document.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault()
        clickedHref = link.getAttribute('href') ?? ''
      })
    })

    const response = handleContentRequest(
      {
        type: 'perform_click',
        target: {
          kind: 'link',
          id: 'bb-2'
        }
      },
      createEnvironment(document)
    )

    assert.deepEqual(response, {
      ok: true,
      data: {
        action: 'click',
        target: {
          kind: 'link',
          id: 'bb-2'
        }
      }
    })
    assert.equal(clickedHref, '/second')
  })

  void it('clicks an enabled button-like action target by page-context id', () => {
    const { document } = parseHTML(
      '<main><button>Save</button><button>Publish</button></main>'
    )
    let clickedText = ''

    document.querySelectorAll('button').forEach((button) => {
      button.addEventListener('click', () => {
        clickedText = button.textContent ?? ''
      })
    })

    const response = handleContentRequest(
      {
        type: 'perform_click',
        target: {
          kind: 'action',
          id: 'bb-2'
        }
      },
      createEnvironment(document)
    )

    assert.deepEqual(response, {
      ok: true,
      data: {
        action: 'click',
        target: {
          kind: 'action',
          id: 'bb-2'
        }
      }
    })
    assert.equal(clickedText, 'Publish')
  })

  void it('writes text to a visible text input target by form-control id', () => {
    const { document } = parseHTML(`
      <main>
        <form>
          <label>Name <input type="text" value="Grace" /></label>
          <label>Search <input type="search" value="" /></label>
        </form>
      </main>
    `)
    const input = document.querySelector('input[type="search"]') as HTMLInputElement

    const response = handleContentRequest(
      {
        type: 'perform_write_text',
        target: {
          formId: 'bb-1',
          controlId: 'bb-2'
        },
        text: 'Ada Lovelace'
      },
      createEnvironment(document)
    )

    assert.deepEqual(response, {
      ok: true,
      data: {
        action: 'write_text',
        target: {
          formId: 'bb-1',
          controlId: 'bb-2'
        },
        textLength: 12
      }
    })
    assert.equal(input.value, 'Ada Lovelace')
  })

  void it('writes text to a visible textarea target and dispatches input events', () => {
    const { document } = parseHTML(`
      <main>
        <form>
          <textarea>Draft</textarea>
        </form>
      </main>
    `)
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    const dispatchedEvents: string[] = []

    textarea.addEventListener('input', () => dispatchedEvents.push('input'))
    textarea.addEventListener('change', () => dispatchedEvents.push('change'))

    const response = handleContentRequest(
      {
        type: 'perform_write_text',
        target: {
          formId: 'bb-1',
          controlId: 'bb-1'
        },
        text: 'Ready'
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, true)
    assert.equal(textarea.value, 'Ready')
    assert.deepEqual(dispatchedEvents, ['input', 'change'])
  })

  void it('returns target_disabled for disabled text targets', () => {
    const { document } = parseHTML(
      '<main><form><input type="text" disabled /></form></main>'
    )

    const response = handleContentRequest(
      {
        type: 'perform_write_text',
        target: {
          formId: 'bb-1',
          controlId: 'bb-1'
        },
        text: 'Ada Lovelace'
      },
      createEnvironment(document)
    )

    assert.deepEqual(response, {
      ok: false,
      error: {
        code: 'target_disabled',
        message: 'The requested text target is disabled.'
      }
    })
  })

  void it('returns target_readonly for readonly text targets', () => {
    const { document } = parseHTML(
      '<main><form><input type="text" readonly /></form></main>'
    )

    const response = handleContentRequest(
      {
        type: 'perform_write_text',
        target: {
          formId: 'bb-1',
          controlId: 'bb-1'
        },
        text: 'Ada Lovelace'
      },
      createEnvironment(document)
    )

    assert.deepEqual(response, {
      ok: false,
      error: {
        code: 'target_readonly',
        message: 'The requested text target is read-only.'
      }
    })
  })

  void it('returns unsupported_control for unsupported form controls', () => {
    const { document } = parseHTML(
      '<main><form><input type="password" /></form></main>'
    )

    const response = handleContentRequest(
      {
        type: 'perform_write_text',
        target: {
          formId: 'bb-1',
          controlId: 'bb-1'
        },
        text: 'Ada Lovelace'
      },
      createEnvironment(document)
    )

    assert.deepEqual(response, {
      ok: false,
      error: {
        code: 'unsupported_control',
        message: 'The requested form control does not support text writing.'
      }
    })
  })

  void it('returns target_not_found when no matching text target exists', () => {
    const { document } = parseHTML('<main><form><input type="text" /></form></main>')

    const response = handleContentRequest(
      {
        type: 'perform_write_text',
        target: {
          formId: 'bb-2',
          controlId: 'bb-1'
        },
        text: 'Ada Lovelace'
      },
      createEnvironment(document)
    )

    assert.deepEqual(response, {
      ok: false,
      error: {
        code: 'target_not_found',
        message: 'No matching text target was found.'
      }
    })
  })

  void it('returns target_disabled for disabled button-like action targets', () => {
    const { document } = parseHTML('<main><button disabled>Save</button></main>')

    const response = handleContentRequest(
      {
        type: 'perform_click',
        target: {
          kind: 'action',
          id: 'bb-1'
        }
      },
      createEnvironment(document)
    )

    assert.deepEqual(response, {
      ok: false,
      error: {
        code: 'target_disabled',
        message: 'The requested click target is disabled.'
      }
    })
  })

  void it('returns target_not_found when no matching click target exists', () => {
    const { document } = parseHTML('<main><button>Save</button></main>')

    const response = handleContentRequest(
      {
        type: 'perform_click',
        target: {
          kind: 'link',
          id: 'bb-1'
        }
      },
      createEnvironment(document)
    )

    assert.deepEqual(response, {
      ok: false,
      error: {
        code: 'target_not_found',
        message: 'No matching click target was found.'
      }
    })
  })
})

function createEnvironment (document: Document): ContentEnvironment {
  return {
    document,
    locationHref: 'https://example.com/',
    title: 'Example',
    selectedText: '',
    now: () => '2026-05-25T10:03:00.000Z'
  }
}
