import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
import { parseHTML } from 'linkedom'
import { handleContentRequest, type ContentEnvironment } from '@brijio/shared'
import {
  hideBrijioApprovalBanner,
  hideBrijioTabIndicator,
  showBrijioApprovalBanner,
  showBrijioTabIndicator,
  type BrijioApprovalDecision
} from './content-script-entry.js'

// linkedom does not provide MutationObserver — install a minimal stub.
class MockMutationObserver {
  callback: MutationCallback
  constructor (callback: MutationCallback) {
    this.callback = callback
  }
  observe (): void {}
  disconnect (): void {}
  takeRecords (): MutationRecord[] { return [] }
}

const savedMutationObserver = (globalThis as unknown as { MutationObserver?: typeof MutationObserver }).MutationObserver

before(() => {
  ;(globalThis as unknown as { MutationObserver: typeof MutationObserver }).MutationObserver =
    MockMutationObserver as unknown as typeof MutationObserver
})

after(() => {
  if (savedMutationObserver !== undefined) {
    ;(globalThis as unknown as { MutationObserver: typeof MutationObserver }).MutationObserver =
      savedMutationObserver
  } else {
    delete (globalThis as unknown as { MutationObserver?: typeof MutationObserver }).MutationObserver
  }
})

void describe('Chrome content script entry', () => {
  void it('delegates to shared handleContentRequest', () => {
    const { document } = parseHTML('<main><h1>Test</h1></main>')

    const response = handleContentRequest(
      {
        type: 'extract_page_context',
        previewMaxBytes: 4096,
        defaultMaxPayloadBytes: 131072
      },
      createEnvironment(document)
    )

    assert.equal(response.ok, true)
  })

  void it('builds environment from browser globals', () => {
    const { document } = parseHTML('<main><p>Hello</p></main>')

    const environment = createEnvironment(document)

    assert.equal(typeof environment.locationHref, 'string')
    assert.equal(typeof environment.title, 'string')
    assert.equal(typeof environment.selectedText, 'string')
    assert.equal(typeof environment.now(), 'string')
  })

  void it('renders approval banner and resolves approve decision', () => {
    const { document } = parseHTML('<main><h1>Test</h1></main>')
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

  void it('renders approve session and deny controls', () => {
    const { document } = parseHTML('<main><h1>Test</h1></main>')
    const decisions: BrijioApprovalDecision[] = []

    showBrijioApprovalBanner(document, {
      type: 'show_brijio_approval',
      actionUUID: 'action-2',
      actionType: 'download_file',
      origin: 'https://example.com',
      timeoutMs: 55000
    }, value => {
      decisions.push(value)
    })
    document
      .querySelector<HTMLButtonElement>('[data-brijio-approval-decision="approve_session"]')
      ?.click()

    showBrijioApprovalBanner(document, {
      type: 'show_brijio_approval',
      actionUUID: 'action-3',
      actionType: 'download_file',
      origin: 'https://example.com',
      timeoutMs: 55000
    }, value => {
      decisions.push(value)
    })
    document
      .querySelector<HTMLButtonElement>('[data-brijio-approval-decision="deny"]')
      ?.click()

    assert.deepEqual(decisions, ['approve_session', 'deny'])
  })

  void it('renders compact approval banner layout', () => {
    const { document } = parseHTML('<main><h1>Test</h1></main>')

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
    const { document } = parseHTML('<main><h1>Test</h1></main>')

    showBrijioApprovalBanner(document, {
      type: 'show_brijio_approval',
      actionUUID: 'action-4',
      actionType: 'fetch_resource',
      origin: 'https://example.com',
      timeoutMs: 55000
    }, () => {})
    hideBrijioApprovalBanner(document, 'action-4')

    assert.equal(document.getElementById('brijio-approval-banner'), null)
  })

  void it('showBrijioTabIndicator prepends ● to document.title', () => {
    const { document } = parseHTML('<html><head><title>My Page</title></head><body></body></html>')
    document.title = 'My Page'

    showBrijioTabIndicator(document)

    assert.equal(document.title, '● My Page')
  })

  void it('hideBrijioTabIndicator restores original document.title', () => {
    const { document } = parseHTML('<html><head><title>Original Title</title></head><body></body></html>')
    document.title = 'Original Title'

    showBrijioTabIndicator(document)
    assert.equal(document.title, '● Original Title')

    hideBrijioTabIndicator(document)
    assert.equal(document.title, 'Original Title')
  })

  void it('showBrijioTabIndicator injects banner element with correct id', () => {
    const { document } = parseHTML('<html><head><title>Test</title></head><body></body></html>')
    document.title = 'Test'

    showBrijioTabIndicator(document)

    const banner = document.getElementById('brijio-tab-indicator')
    assert.ok(banner, 'banner element should exist after show')
    assert.equal(banner.getAttribute('role'), 'status')
    assert.equal(banner.getAttribute('aria-live'), 'polite')
  })

  void it('hideBrijioTabIndicator removes banner element', () => {
    const { document } = parseHTML('<html><head><title>Test</title></head><body></body></html>')
    document.title = 'Test'

    showBrijioTabIndicator(document)
    assert.ok(document.getElementById('brijio-tab-indicator'))

    hideBrijioTabIndicator(document)
    assert.equal(document.getElementById('brijio-tab-indicator'), null)
  })
})

function createEnvironment (document: Document): ContentEnvironment {
  return {
    document,
    locationHref: 'https://example.com/',
    title: 'Test',
    selectedText: '',
    now: () => new Date().toISOString()
  }
}
