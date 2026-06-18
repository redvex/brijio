import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseHTML } from 'linkedom'
import { handleContentRequest, type ContentRequest, type ContentResponse, type ContentEnvironment } from '@brijio/shared'
import {
  hideBrijioApprovalBanner,
  registerPageActivityListeners,
  showBrijioApprovalBanner,
  type BrijioApprovalDecision
} from './content-script-entry.js'

void describe('Safari content-script-entry module', () => {
  void it('exports handleContentRequest from @brijio/shared', () => {
    assert.equal(typeof handleContentRequest, 'function')
  })

  void it('sends page activity message when visible page becomes active', () => {
    const { document } = parseHTML('<main></main>')
    const originalDocument = globalThis.document
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: document
    })
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false
    })
    const messages: unknown[] = []

    try {
      registerPageActivityListeners({
        runtime: {
          async sendMessage (message: unknown) {
            messages.push(message)
          },
          onMessage: {
            addListener () {},
            removeListener () {}
          }
        }
      })

      const DocumentEvent = (document.defaultView as unknown as { Event: typeof Event }).Event
      document.dispatchEvent(new DocumentEvent('visibilitychange'))

      assert.deepEqual(messages, [
        { type: 'brijio_page_active' },
        { type: 'brijio_page_active' }
      ])
    } finally {
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: originalDocument
      })
    }
  })

  void it('handles extract_page_context via shared handler with DOM-based ContentEnvironment', () => {
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

    assert.equal(response.ok, false)
  })

  void it('renders approval banner and resolves approve decision', () => {
    const { document } = parseHTML('<main><h1>Example</h1></main>')
    let decision: BrijioApprovalDecision | undefined

    showBrijioApprovalBanner(document, {
      type: 'show_brijio_approval',
      actionUUID: 'action-1',
      actionType: 'submit_form',
      origin: 'https://example.com',
      timeoutMs: 55000
    }, value => {
      decision = value
    })

    assert.ok(document.getElementById('brijio-approval-banner'))
    document
      .querySelector<HTMLButtonElement>('[data-brijio-approval-decision="approve"]')
      ?.click()

    assert.equal(decision, 'approve')
    assert.equal(document.getElementById('brijio-approval-banner'), null)
  })

  void it('renders compact approval banner layout', () => {
    const { document } = parseHTML('<main><h1>Example</h1></main>')

    showBrijioApprovalBanner(document, {
      type: 'show_brijio_approval',
      actionUUID: 'action-layout',
      actionType: 'fetch_resource',
      origin: 'http://100.90.11.40:8789',
      timeoutMs: 55000
    }, () => {})

    const banner = document.getElementById('brijio-approval-banner')
    const approveSession = document.querySelector<HTMLButtonElement>('[data-brijio-approval-decision="approve_session"]')

    assert.ok(banner)
    assert.equal(banner.style.boxSizing, 'border-box')
    assert.equal(banner.style.flexWrap, 'wrap')
    assert.equal(banner.style.width, 'max-content')
    assert.equal(banner.style.right ?? '', '')
    assert.equal(approveSession?.style.whiteSpace, 'nowrap')
  })

  void it('hides approval banner by actionUUID', () => {
    const { document } = parseHTML('<main><h1>Example</h1></main>')

    showBrijioApprovalBanner(document, {
      type: 'show_brijio_approval',
      actionUUID: 'action-2',
      actionType: 'fetch_resource',
      origin: 'https://example.com',
      timeoutMs: 55000
    }, () => {})
    hideBrijioApprovalBanner(document, 'action-2')

    assert.equal(document.getElementById('brijio-approval-banner'), null)
  })
})
