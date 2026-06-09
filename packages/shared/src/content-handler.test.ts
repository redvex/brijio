import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseHTML } from 'linkedom'
import {
  handleContentRequest,
  getPageContextVersion,
  resetPageContextVersion,
  type ContentEnvironment
} from './content-handler.js'

void describe('content handler request handler', () => {
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
    const input = document.querySelector(
      'input[type="search"]'
    ) as HTMLInputElement

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

  void it('writes text to additional value-entry input types', () => {
    const { document } = parseHTML(`
      <main>
        <form>
          <input type="email" />
          <input type="url" />
          <input type="number" />
        </form>
      </main>
    `)
    const input = document.querySelector(
      'input[type="number"]'
    ) as HTMLInputElement

    const response = handleContentRequest(
      {
        type: 'perform_write_text',
        target: {
          formId: 'bb-1',
          controlId: 'bb-3'
        },
        text: '42'
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, true)
    assert.equal(input.value, '42')
  })

  void it('writes text to a visible contenteditable target', () => {
    const { document } = parseHTML(`
      <main>
        <div contenteditable="true" role="textbox" aria-label="Notes">Draft</div>
      </main>
    `)
    const editable = document.querySelector('[contenteditable]') as HTMLElement
    const dispatchedEvents: string[] = []

    editable.addEventListener('input', () => dispatchedEvents.push('input'))

    const response = handleContentRequest(
      {
        type: 'perform_write_text',
        target: {
          kind: 'editable',
          id: 'bb-1'
        },
        text: 'Ready'
      },
      createEnvironment(document)
    )

    assert.deepEqual(response, {
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
    assert.equal(editable.textContent, 'Ready')
    assert.deepEqual(dispatchedEvents, ['input'])
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

  void it('sets checkbox checked state by clicking the wrapper label path', () => {
    const { document } = parseHTML(`
      <main>
        <form>
          <label class="picasso-checkbox">
            <span class="MuiCheckbox-root">
              <span>
                <input id="understand" name="understand" type="checkbox" />
                <span class="visual-box"></span>
              </span>
            </span>
            <span>I understand that this is a controlled checkbox.</span>
          </label>
        </form>
      </main>
    `)
    const checkbox = document.querySelector('input') as HTMLInputElement
    const visual = document.querySelector('.MuiCheckbox-root') as HTMLElement
    const label = document.querySelector('label') as HTMLLabelElement
    const dispatchedEvents: string[] = []

    checkbox.addEventListener('input', () => dispatchedEvents.push('input'))
    checkbox.addEventListener('change', () => dispatchedEvents.push('change'))
    label.addEventListener('click', () => visual.classList.add('Mui-checked'))

    const response = handleContentRequest(
      {
        type: 'perform_set_checked',
        target: {
          formId: 'bb-1',
          controlId: 'bb-1'
        },
        checked: true
      },
      createEnvironment(document)
    )

    assert.deepEqual(response, {
      ok: true,
      data: {
        action: 'set_checked',
        target: {
          formId: 'bb-1',
          controlId: 'bb-1'
        },
        checked: true,
        changed: true
      }
    })
    assert.equal(checkbox.checked, true)
    assert.equal(visual.classList.contains('Mui-checked'), true)
    assert.deepEqual(dispatchedEvents, ['input', 'change'])
  })

  void it('selects a radio option by form-control id', () => {
    const { document } = parseHTML(`
      <main>
        <form>
          <input name="choice" type="radio" value="one" checked />
          <input name="choice" type="radio" value="two" />
        </form>
      </main>
    `)
    const radios = document.querySelectorAll('input')

    const response = handleContentRequest(
      {
        type: 'perform_set_checked',
        target: {
          formId: 'bb-1',
          controlId: 'bb-2'
        },
        checked: true
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, true)
    assert.equal(radios[0].checked, false)
    assert.equal(radios[1].checked, true)
  })

  void it('selects options by form-control id', () => {
    const { document } = parseHTML(`
      <main>
        <form>
          <select multiple>
            <option value="alpha">Alpha</option>
            <option value="beta">Beta</option>
            <option value="gamma">Gamma</option>
          </select>
        </form>
      </main>
    `)
    const options = document.querySelectorAll('option')

    const response = handleContentRequest(
      {
        type: 'perform_select_options',
        target: {
          formId: 'bb-1',
          controlId: 'bb-1'
        },
        values: ['alpha', 'gamma']
      },
      createEnvironment(document)
    )

    assert.deepEqual(response, {
      ok: true,
      data: {
        action: 'select_options',
        target: {
          formId: 'bb-1',
          controlId: 'bb-1'
        },
        values: ['alpha', 'gamma']
      }
    })
    assert.equal(options[0].selected, true)
    assert.equal(options[1].selected, false)
    assert.equal(options[2].selected, true)
  })

  void it('returns option_not_found for unavailable option values', () => {
    const { document } = parseHTML(
      '<main><form><select><option value="alpha">Alpha</option></select></form></main>'
    )

    const response = handleContentRequest(
      {
        type: 'perform_select_options',
        target: {
          formId: 'bb-1',
          controlId: 'bb-1'
        },
        values: ['missing']
      },
      createEnvironment(document)
    )

    assert.deepEqual(response, {
      ok: false,
      error: {
        code: 'option_not_found',
        message: 'The requested option value was not found.'
      }
    })
  })

  void it('submits a visible form by form id', () => {
    const { document } = parseHTML('<main><form></form></main>')
    const form = document.querySelector('form') as HTMLFormElement & {
      requestSubmit: () => void
    }
    let submitted = false

    form.requestSubmit = () => {
      submitted = true
    }

    const response = handleContentRequest(
      {
        type: 'perform_submit_form',
        target: {
          formId: 'bb-1'
        }
      },
      createEnvironment(document)
    )

    assert.deepEqual(response, {
      ok: true,
      data: {
        action: 'submit_form',
        target: {
          formId: 'bb-1'
        }
      }
    })
    assert.equal(submitted, true)
  })

  void it('returns target_not_found when no matching text target exists', () => {
    const { document } = parseHTML(
      '<main><form><input type="text" /></form></main>'
    )

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
    const { document } = parseHTML(
      '<main><button disabled>Save</button></main>'
    )

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

  // ── Stale-context validation tests ─────────────────────────────────

  void it('clicks a link when expectedText matches (case-insensitive)', () => {
    const { document } = parseHTML(
      '<main><a href="/first">First Page</a><a href="/second">Second Page</a></main>'
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
        target: { kind: 'link', id: 'bb-1', expectedText: 'first' }
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, true)
    assert.equal(clickedHref, '/first')
  })

  void it('returns stale_context when expectedText does not match', () => {
    const { document } = parseHTML(
      '<main><a href="/first">First Page</a><a href="/second">Second Page</a></main>'
    )

    const response = handleContentRequest(
      {
        type: 'perform_click',
        target: { kind: 'link', id: 'bb-1', expectedText: 'Second' }
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, false)
    if (response.ok) {
      assert.fail('Expected stale_context error')
      return
    }
    assert.equal(response.error.code, 'stale_context')
    assert.equal(
      response.error.message.includes('Expected text containing "Second"'),
      true
    )
    assert.equal(
      response.error.message.includes('Call read_current_page'),
      true
    )
    if (response.error.detail == null) {
      assert.fail('Expected detail on stale_context error')
      return
    }
    assert.equal(response.error.detail.id, 'bb-1')
    assert.equal(response.error.detail.kind, 'link')
    assert.equal(response.error.detail.expectedText, 'Second')
    assert.equal(response.error.detail.foundText, 'First Page')
  })

  void it('returns stale_context when expectedHref does not match (link)', () => {
    const { document } = parseHTML(
      '<main><a href="/payments">Payments</a><a href="/jobs">My Jobs</a></main>'
    )

    const response = handleContentRequest(
      {
        type: 'perform_click',
        target: { kind: 'link', id: 'bb-2', expectedHref: '/payments' }
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, false)
    if (response.ok) {
      assert.fail('Expected stale_context error')
      return
    }
    assert.equal(response.error.code, 'stale_context')
    assert.equal(response.error.detail?.expectedHref, '/payments')
    assert.equal(response.error.detail?.foundHref, '/jobs')
  })

  void it('clicks a link when expectedHref matches (pathname)', () => {
    const { document } = parseHTML(
      '<main><a href="/jobs?page=2">My Jobs</a></main>'
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
        target: { kind: 'link', id: 'bb-1', expectedHref: '/jobs' }
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, true)
    assert.equal(clickedHref, '/jobs?page=2')
  })

  void it('returns stale_context when expectedRole does not match (action)', () => {
    const { document } = parseHTML(
      '<main><button>Save</button><button role="switch">Toggle</button></main>'
    )

    const response = handleContentRequest(
      {
        type: 'perform_click',
        target: { kind: 'action', id: 'bb-2', expectedRole: 'button' }
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, false)
    if (response.ok) {
      assert.fail('Expected stale_context error')
      return
    }
    assert.equal(response.error.code, 'stale_context')
    assert.equal(response.error.detail?.expectedRole, 'button')
    assert.equal(response.error.detail?.foundRole, 'switch')
  })

  void it('clicks an action when expectedRole matches implicit role', () => {
    const { document } = parseHTML('<main><button>Save</button></main>')
    let clicked = false
    const button = document.querySelector('button') as HTMLButtonElement
    button.addEventListener('click', () => {
      clicked = true
    })

    const response = handleContentRequest(
      {
        type: 'perform_click',
        target: { kind: 'action', id: 'bb-1', expectedRole: 'button' }
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, true)
    assert.equal(clicked, true)
  })

  void it('ignores expectedHref for kind=action targets', () => {
    const { document } = parseHTML('<main><button>Save</button></main>')
    let clicked = false
    const button = document.querySelector('button') as HTMLButtonElement
    button.addEventListener('click', () => {
      clicked = true
    })

    // expectedHref should be ignored for actions — only expectedText and expectedRole apply
    const response = handleContentRequest(
      {
        type: 'perform_click',
        target: {
          kind: 'action',
          id: 'bb-1',
          expectedText: 'Save',
          expectedHref: '/irrelevant'
        }
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, true)
    assert.equal(clicked, true)
  })

  void it('ignores empty expectedText (treated as not provided)', () => {
    const { document } = parseHTML('<main><a href="/page">A Page</a></main>')
    let clicked = false
    const link = document.querySelector('a') as HTMLAnchorElement
    link.addEventListener('click', (event) => {
      event.preventDefault()
      clicked = true
    })

    // Empty string expectedText is treated as not provided, so no validation
    const response = handleContentRequest(
      {
        type: 'perform_click',
        target: { kind: 'link', id: 'bb-1', expectedText: '' }
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, true)
    assert.equal(clicked, true)
  })

  void it('returns stale_context with multiple mismatching validations', () => {
    const { document } = parseHTML(
      '<main><a href="/payments">Payments History</a></main>'
    )

    const response = handleContentRequest(
      {
        type: 'perform_click',
        target: {
          kind: 'link',
          id: 'bb-1',
          expectedText: 'My Jobs',
          expectedHref: '/jobs'
        }
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, false)
    if (response.ok) {
      assert.fail('Expected stale_context error')
      return
    }
    assert.equal(response.error.code, 'stale_context')
    // Both text and href should mismatch
    assert.equal(
      response.error.message.includes('Expected text containing "My Jobs"'),
      true
    )
    assert.equal(
      response.error.message.includes('Expected href path "/jobs"'),
      true
    )
    assert.equal(response.error.detail?.expectedText, 'My Jobs')
    assert.equal(response.error.detail?.foundText, 'Payments History')
    assert.equal(response.error.detail?.expectedHref, '/jobs')
  })

  void it('clicks without validation when no expected fields are provided', () => {
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

    // No validation — backward compatible, existing behavior
    const response = handleContentRequest(
      {
        type: 'perform_click',
        target: { kind: 'link', id: 'bb-2' }
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, true)
    assert.equal(clickedHref, '/second')
  })

  // ── pageContextVersion tests ─────────────────────────────────────

  void it('getPageContextVersion starts at 1', () => {
    resetPageContextVersion(1)
    assert.equal(getPageContextVersion(), 1)
  })

  void it('resetPageContextVersion sets the counter to an arbitrary value', () => {
    resetPageContextVersion(5)
    assert.equal(getPageContextVersion(), 5)
    // Clean up
    resetPageContextVersion(1)
  })

  void it('resetPageContextVersion defaults to 1 when called without arguments', () => {
    resetPageContextVersion(10)
    resetPageContextVersion()
    assert.equal(getPageContextVersion(), 1)
  })

  // ── page_navigated error tests ───────────────────────────────────

  void it('returns page_navigated when pageContextId does not match pageContextVersion', () => {
    resetPageContextVersion(3)
    const { document } = parseHTML('<main><form><input type="text" /></form></main>')

    const response = handleContentRequest(
      {
        type: 'perform_write_text',
        target: {
          formId: 'bb-1',
          controlId: 'bb-1'
        },
        text: 'Ada Lovelace',
        pageContextId: 1
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, false)
    if (response.ok) {
      assert.fail('Expected page_navigated error')
      return
    }
    assert.equal(response.error.code, 'page_navigated')
    assert.equal(
      response.error.message.includes('context 1'),
      true
    )
    assert.equal(
      response.error.message.includes('current 3'),
      true
    )

    // Clean up
    resetPageContextVersion(1)
  })

  void it('proceeds normally when pageContextId matches pageContextVersion', () => {
    resetPageContextVersion(3)
    const { document } = parseHTML(
      '<main><form><input type="text" /></form></main>'
    )

    const response = handleContentRequest(
      {
        type: 'perform_write_text',
        target: {
          formId: 'bb-1',
          controlId: 'bb-1'
        },
        text: 'Ada Lovelace',
        pageContextId: 3
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, true)

    // Clean up
    resetPageContextVersion(1)
  })

  void it('proceeds normally when pageContextId is not provided', () => {
    resetPageContextVersion(5)
    const { document } = parseHTML(
      '<main><form><input type="text" /></form></main>'
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

    assert.equal(response.ok, true)

    // Clean up
    resetPageContextVersion(1)
  })

  void it('returns page_navigated for submit_form when context is stale', () => {
    resetPageContextVersion(3)
    const { document } = parseHTML('<main><form></form></main>')

    const response = handleContentRequest(
      {
        type: 'perform_submit_form',
        target: { formId: 'bb-1' },
        pageContextId: 1
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, false)
    if (response.ok) {
      assert.fail('Expected page_navigated error')
      return
    }
    assert.equal(response.error.code, 'page_navigated')

    // Clean up
    resetPageContextVersion(1)
  })

  // ── validateFormControlTarget tests ───────────────────────────────
  // Note: linkedom does not support CSS.escape, so we use aria-label
  // or wrapping <label> elements instead of <label for="..."> to
  // exercise getControlLabel in the test environment.

  void it('write_text succeeds when expectedLabel matches the control label', () => {
    const { document } = parseHTML(`
      <main>
        <form>
          <label>Full Name <input type="text" /></label>
        </form>
      </main>
    `)

    const response = handleContentRequest(
      {
        type: 'perform_write_text',
        target: {
          formId: 'bb-1',
          controlId: 'bb-1',
          expectedLabel: 'full name'
        },
        text: 'Ada Lovelace'
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, true)
  })

  void it('write_text returns stale_context when expectedLabel does not match', () => {
    const { document } = parseHTML(`
      <main>
        <form>
          <label>Full Name <input type="text" /></label>
        </form>
      </main>
    `)

    const response = handleContentRequest(
      {
        type: 'perform_write_text',
        target: {
          formId: 'bb-1',
          controlId: 'bb-1',
          expectedLabel: 'email address'
        },
        text: 'Ada Lovelace'
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, false)
    if (response.ok) {
      assert.fail('Expected stale_context error')
      return
    }
    assert.equal(response.error.code, 'stale_context')
    assert.equal(
      response.error.message.includes('Expected label containing'),
      true
    )
    assert.equal(
      response.error.message.includes('"email address"'),
      true
    )
  })

  void it('write_text skips expectedLabel validation when expectedLabel is empty', () => {
    const { document } = parseHTML(`
      <main>
        <form>
          <label>Full Name <input type="text" /></label>
        </form>
      </main>
    `)

    const response = handleContentRequest(
      {
        type: 'perform_write_text',
        target: {
          formId: 'bb-1',
          controlId: 'bb-1',
          expectedLabel: ''
        },
        text: 'Ada Lovelace'
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, true)
  })

  void it('set_checked returns stale_context when expectedLabel does not match', () => {
    const { document } = parseHTML(`
      <main>
        <form>
          <label>I agree <input type="checkbox" /></label>
        </form>
      </main>
    `)

    const response = handleContentRequest(
      {
        type: 'perform_set_checked',
        target: {
          formId: 'bb-1',
          controlId: 'bb-1',
          expectedLabel: 'disagree'
        },
        checked: true
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, false)
    if (response.ok) {
      assert.fail('Expected stale_context error')
      return
    }
    assert.equal(response.error.code, 'stale_context')
  })

  void it('select_options returns stale_context when expectedLabel does not match', () => {
    const { document } = parseHTML(`
      <main>
        <form>
          <label>Favorite Color
            <select><option value="red">Red</option></select>
          </label>
        </form>
      </main>
    `)

    const response = handleContentRequest(
      {
        type: 'perform_select_options',
        target: {
          formId: 'bb-1',
          controlId: 'bb-1',
          expectedLabel: 'size'
        },
        values: ['red']
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, false)
    if (response.ok) {
      assert.fail('Expected stale_context error')
      return
    }
    assert.equal(response.error.code, 'stale_context')
  })

  // ── validateEditableTarget tests ──────────────────────────────────

  void it('write_text to editable succeeds when expectedText matches', () => {
    const { document } = parseHTML(`
      <main>
        <div contenteditable="true" role="textbox" aria-label="Notes">Draft notes</div>
      </main>
    `)

    const response = handleContentRequest(
      {
        type: 'perform_write_text',
        target: {
          kind: 'editable',
          id: 'bb-1',
          expectedText: 'draft'
        },
        text: 'Updated'
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, true)
  })

  void it('write_text to editable returns stale_context when expectedText does not match', () => {
    const { document } = parseHTML(`
      <main>
        <div contenteditable="true" role="textbox" aria-label="Notes">Draft notes</div>
      </main>
    `)

    const response = handleContentRequest(
      {
        type: 'perform_write_text',
        target: {
          kind: 'editable',
          id: 'bb-1',
          expectedText: 'final version'
        },
        text: 'Updated'
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, false)
    if (response.ok) {
      assert.fail('Expected stale_context error')
      return
    }
    assert.equal(response.error.code, 'stale_context')
    assert.equal(
      response.error.message.includes('Expected text containing'),
      true
    )
    assert.equal(
      response.error.message.includes('"final version"'),
      true
    )
  })

  void it('write_text to editable skips expectedText validation when empty', () => {
    const { document } = parseHTML(`
      <main>
        <div contenteditable="true" role="textbox" aria-label="Notes">Draft</div>
      </main>
    `)

    const response = handleContentRequest(
      {
        type: 'perform_write_text',
        target: {
          kind: 'editable',
          id: 'bb-1',
          expectedText: ''
        },
        text: 'Updated'
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, true)
  })

  // ── validateFormSubmitTarget tests ────────────────────────────────

  void it('submit_form succeeds when expectedLabel matches the form heading', () => {
    const { document } = parseHTML(`
      <main>
        <form>
          <h2>Contact Details</h2>
          <input type="text" name="name" />
        </form>
      </main>
    `)
    const form = document.querySelector('form') as HTMLFormElement & {
      requestSubmit: () => void
    }
    let submitted = false
    form.requestSubmit = () => {
      submitted = true
    }

    const response = handleContentRequest(
      {
        type: 'perform_submit_form',
        target: {
          formId: 'bb-1',
          expectedLabel: 'contact'
        }
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, true)
    assert.equal(submitted, true)
  })

  void it('submit_form returns stale_context when expectedLabel does not match', () => {
    const { document } = parseHTML(`
      <main>
        <form>
          <h2>Contact Details</h2>
          <input type="text" name="name" />
        </form>
      </main>
    `)

    const response = handleContentRequest(
      {
        type: 'perform_submit_form',
        target: {
          formId: 'bb-1',
          expectedLabel: 'payment'
        }
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, false)
    if (response.ok) {
      assert.fail('Expected stale_context error')
      return
    }
    assert.equal(response.error.code, 'stale_context')
    assert.equal(
      response.error.message.includes('Expected label containing'),
      true
    )
    assert.equal(
      response.error.message.includes('"payment"'),
      true
    )
  })

  void it('submit_form skips expectedLabel validation when expectedLabel is empty', () => {
    const { document } = parseHTML(`
      <main>
        <form>
          <h2>Contact Details</h2>
        </form>
      </main>
    `)
    const form = document.querySelector('form') as HTMLFormElement & {
      requestSubmit: () => void
    }
    let submitted = false
    form.requestSubmit = () => {
      submitted = true
    }

    const response = handleContentRequest(
      {
        type: 'perform_submit_form',
        target: {
          formId: 'bb-1',
          expectedLabel: ''
        }
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, true)
    assert.equal(submitted, true)
  })

  void it('submit_form matches expectedLabel against aria-label', () => {
    const { document } = parseHTML(`
      <main>
        <form aria-label="Search Form">
          <input type="text" name="q" />
        </form>
      </main>
    `)
    const form = document.querySelector('form') as HTMLFormElement & {
      requestSubmit: () => void
    }
    let submitted = false
    form.requestSubmit = () => {
      submitted = true
    }

    const response = handleContentRequest(
      {
        type: 'perform_submit_form',
        target: {
          formId: 'bb-1',
          expectedLabel: 'search'
        }
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, true)
    assert.equal(submitted, true)
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
