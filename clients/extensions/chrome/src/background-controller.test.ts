import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  BrowserBridgeBackgroundController,
  type ActionAdapter,
  type BrowserBridgeSocket,
  type PageReadResult,
  type PageReaderAdapter,
  type SetupAdapter,
  type StorageAdapter
} from './background-controller.js'
import type {
  PageContent,
  PageContentErrorCode,
  PageContext
} from './protocol.js'

void describe('BrowserBridge background controller', () => {
  void it('opens setup when action is clicked without a stored WebSocket URL', async () => {
    const harness = createHarness()

    await harness.controller.handleActionClicked()

    assert.equal(harness.setup.opened, true)
    assert.equal(harness.sockets.created.length, 0)
  })

  void it('connects when action is clicked with a stored WebSocket URL', async () => {
    const harness = createHarness({ websocketUrl: 'ws://127.0.0.1:8787' })

    await harness.controller.handleActionClicked()

    assert.equal(harness.sockets.created.length, 1)
    assert.equal(harness.sockets.created[0].url, 'ws://127.0.0.1:8787')
    assert.equal(harness.action.badgeText, '...')
    assert.equal(harness.action.title, 'BrowserBridge connecting')
  })

  void it('sets connected state when the socket opens', async () => {
    const harness = createHarness({ websocketUrl: 'ws://127.0.0.1:8787' })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    await new Promise((resolve) => setImmediate(resolve))

    assert.equal(harness.action.badgeText, 'ON')
    assert.equal(harness.action.title, 'BrowserBridge connected')
  })

  void it('disconnects when action is clicked while connected', async () => {
    const harness = createHarness({ websocketUrl: 'ws://127.0.0.1:8787' })

    await harness.controller.handleActionClicked()
    await harness.controller.handleActionClicked()

    assert.equal(harness.sockets.created[0].closed, true)
    assert.equal(harness.action.badgeText, 'OFF')
    assert.equal(harness.action.title, 'BrowserBridge stopped')
  })

  void it('responds to get_page_context with rich active tab context', async () => {
    const harness = createHarness({
      websocketUrl: 'ws://127.0.0.1:8787',
      pageContext: createPageContext()
    })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    await harness.sockets.created[0].receive(
      JSON.stringify({
        type: 'message',
        id: 'context-1',
        payload: {
          type: 'get_page_context'
        }
      })
    )

    assert.deepEqual(JSON.parse(harness.sockets.created[0].sent[0]), {
      type: 'message',
      id: 'context-1',
      payload: {
        type: 'page_context_response',
        ok: true,
        data: createPageContext()
      }
    })
  })

  void it('returns no_active_tab when no active tab with a URL exists', async () => {
    const harness = createHarness({
      websocketUrl: 'ws://127.0.0.1:8787',
      pageReaderError: {
        code: 'no_active_tab',
        message: 'No active tab with a URL is available.'
      }
    })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    await harness.sockets.created[0].receive(
      JSON.stringify({
        type: 'message',
        id: 'request-2',
        payload: {
          type: 'get_page_context'
        }
      })
    )

    assert.deepEqual(JSON.parse(harness.sockets.created[0].sent[0]), {
      type: 'message',
      id: 'request-2',
      payload: {
        type: 'page_context_response',
        ok: false,
        error: {
          code: 'no_active_tab',
          message: 'No active tab with a URL is available.'
        }
      }
    })
  })

  void it('responds to get_page_content with the requested chunk', async () => {
    const harness = createHarness({
      websocketUrl: 'ws://127.0.0.1:8787',
      pageContent: {
        url: 'https://example.com/',
        title: 'Example Domain',
        timestamp: '2026-05-25T10:01:00.000Z',
        index: 2,
        content: 'Second chunk',
        truncated: false,
        maxPayloadBytes: 131072
      }
    })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    await harness.sockets.created[0].receive(
      JSON.stringify({
        type: 'message',
        id: 'content-1',
        payload: {
          type: 'get_page_content',
          index: 2
        }
      })
    )

    assert.deepEqual(JSON.parse(harness.sockets.created[0].sent[0]), {
      type: 'message',
      id: 'content-1',
      payload: {
        type: 'page_content_response',
        ok: true,
        data: {
          url: 'https://example.com/',
          title: 'Example Domain',
          timestamp: '2026-05-25T10:01:00.000Z',
          index: 2,
          content: 'Second chunk',
          truncated: false,
          maxPayloadBytes: 131072
        }
      }
    })
  })

  void it('returns content_script_unavailable when active tab extraction fails', async () => {
    const harness = createHarness({
      websocketUrl: 'ws://127.0.0.1:8787',
      pageReaderError: {
        code: 'content_script_unavailable',
        message: 'Unable to reach the page content script.'
      }
    })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    await harness.sockets.created[0].receive(
      JSON.stringify({
        type: 'message',
        id: 'content-2',
        payload: {
          type: 'get_page_content',
          index: 1
        }
      })
    )

    assert.deepEqual(JSON.parse(harness.sockets.created[0].sent[0]), {
      type: 'message',
      id: 'content-2',
      payload: {
        type: 'page_content_response',
        ok: false,
        error: {
          code: 'content_script_unavailable',
          message: 'Unable to reach the page content script.'
        }
      }
    })
  })

  void it('returns regular_page_permission_required when a regular page needs host permission', async () => {
    const harness = createHarness({
      websocketUrl: 'ws://127.0.0.1:8787',
      pageReaderError: {
        code: 'regular_page_permission_required',
        message:
          'Regular page access is not enabled. Open BrowserBridge setup and enable regular page access.'
      }
    })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    await harness.sockets.created[0].receive(
      JSON.stringify({
        type: 'message',
        id: 'content-3',
        payload: {
          type: 'get_page_content',
          index: 1
        }
      })
    )

    assert.deepEqual(JSON.parse(harness.sockets.created[0].sent[0]), {
      type: 'message',
      id: 'content-3',
      payload: {
        type: 'page_content_response',
        ok: false,
        error: {
          code: 'regular_page_permission_required',
          message:
            'Regular page access is not enabled. Open BrowserBridge setup and enable regular page access.'
        }
      }
    })
  })

  void it('keeps the error state when a socket error is followed by close', async () => {
    const harness = createHarness({ websocketUrl: 'ws://127.0.0.1:8787' })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    harness.sockets.created[0].fail()
    harness.sockets.created[0].close()
    await new Promise((resolve) => setImmediate(resolve))

    assert.equal(harness.action.badgeText, 'ERR')
    assert.equal(harness.action.title, 'BrowserBridge connection error')
  })

  void it('sends extension keepalives while connected', async () => {
    const harness = createHarness({ websocketUrl: 'ws://127.0.0.1:8787' })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    harness.timers.tick()

    assert.deepEqual(JSON.parse(harness.sockets.created[0].sent[0]), {
      type: 'message',
      payload: {
        type: 'extension_keepalive'
      }
    })
    assert.equal(harness.timers.intervalMs, 20000)
  })

  void it('stops extension keepalives after disconnect', async () => {
    const harness = createHarness({ websocketUrl: 'ws://127.0.0.1:8787' })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    await harness.controller.handleActionClicked()
    harness.timers.tick()

    assert.deepEqual(harness.sockets.created[0].sent, [])
    assert.equal(harness.timers.cleared, true)
  })
})

interface HarnessOptions {
  websocketUrl?: string
  pageContext?: PageContext
  pageContent?: PageContent
  pageReaderError?: {
    code: PageContentErrorCode
    message: string
  }
}

interface Harness {
  action: FakeActionAdapter
  controller: BrowserBridgeBackgroundController
  setup: FakeSetupAdapter
  sockets: FakeSocketFactory
  timers: FakeTimersAdapter
}

function createHarness (options: HarnessOptions = {}): Harness {
  const storage = new FakeStorageAdapter(options.websocketUrl)
  const setup = new FakeSetupAdapter()
  const action = new FakeActionAdapter()
  const pageReader = new FakePageReaderAdapter(options)
  const sockets = new FakeSocketFactory()
  const timers = new FakeTimersAdapter()
  const controller = new BrowserBridgeBackgroundController({
    action,
    createWebSocket: sockets.create,
    setup,
    storage,
    pageReader,
    timers
  })

  return {
    action,
    controller,
    setup,
    sockets,
    timers
  }
}

class FakeStorageAdapter implements StorageAdapter {
  constructor (private websocketUrl: string | undefined) {}

  async getWebSocketUrl (): Promise<string | undefined> {
    return this.websocketUrl
  }

  async setWebSocketUrl (url: string): Promise<void> {
    this.websocketUrl = url
  }
}

class FakeSetupAdapter implements SetupAdapter {
  opened = false

  async openSetupPage (): Promise<void> {
    this.opened = true
  }
}

class FakeActionAdapter implements ActionAdapter {
  badgeText = ''
  title = ''

  async setBadgeText (text: string): Promise<void> {
    this.badgeText = text
  }

  async setBadgeColor (_color: string): Promise<void> {}

  async setBadgeTextColor (_color: string): Promise<void> {}

  async setTitle (title: string): Promise<void> {
    this.title = title
  }
}

class FakePageReaderAdapter implements PageReaderAdapter {
  constructor (private readonly options: HarnessOptions) {}

  async getPageContext (): Promise<PageReadResult<PageContext>> {
    if (this.options.pageReaderError !== undefined) {
      return {
        ok: false,
        error: this.options.pageReaderError
      }
    }

    if (this.options.pageContext === undefined) {
      return {
        ok: false,
        error: {
          code: 'no_active_tab',
          message: 'No active tab with a URL is available.'
        }
      }
    }

    return {
      ok: true,
      data: this.options.pageContext
    }
  }

  async getPageContent (_index: number): Promise<PageReadResult<PageContent>> {
    if (this.options.pageReaderError !== undefined) {
      return {
        ok: false,
        error: this.options.pageReaderError
      }
    }

    if (this.options.pageContent === undefined) {
      return {
        ok: false,
        error: {
          code: 'invalid_index',
          message: 'Page content chunk index must be available and 1-based.'
        }
      }
    }

    return {
      ok: true,
      data: this.options.pageContent
    }
  }
}

function createPageContext (): PageContext {
  return {
    url: 'https://example.com/',
    title: 'Example Domain',
    timestamp: '2026-05-25T10:00:00.000Z',
    selectedText: null,
    preview: {
      content: 'Example preview',
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

class FakeSocketFactory {
  readonly created: FakeSocket[] = []

  readonly create = (url: string): BrowserBridgeSocket => {
    const socket = new FakeSocket(url)
    this.created.push(socket)
    return socket
  }
}

class FakeSocket implements BrowserBridgeSocket {
  onopen: (() => void) | undefined
  onmessage: ((event: { data: string }) => void | Promise<void>) | undefined
  onclose: (() => void) | undefined
  onerror: (() => void) | undefined
  readonly sent: string[] = []
  closed = false

  constructor (readonly url: string) {}

  send (message: string): void {
    this.sent.push(message)
  }

  close (): void {
    this.closed = true
    this.onclose?.()
  }

  open (): void {
    this.onopen?.()
  }

  fail (): void {
    this.onerror?.()
  }

  async receive (message: string): Promise<void> {
    await this.onmessage?.({ data: message })
  }
}

class FakeTimersAdapter {
  callback: (() => void) | undefined
  cleared = false
  intervalMs = 0

  setInterval (callback: () => void, intervalMs: number): number {
    this.callback = callback
    this.intervalMs = intervalMs
    return 1
  }

  clearInterval (_timerId: number): void {
    this.callback = undefined
    this.cleared = true
  }

  tick (): void {
    this.callback?.()
  }
}
