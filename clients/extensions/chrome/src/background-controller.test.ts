import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  BrowserBridgeBackgroundController,
  type ActionAdapter,
  type BrowserBridgeSocket,
  type SetupAdapter,
  type StorageAdapter,
  type TabsAdapter
} from './background-controller.js'

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

  void it('responds to get_page_context with the active tab URL and title', async () => {
    const harness = createHarness({
      websocketUrl: 'ws://127.0.0.1:8787',
      activeTab: {
        url: 'https://example.com/',
        title: 'Example Domain'
      }
    })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    await harness.sockets.created[0].receive(
      JSON.stringify({
        type: 'message',
        id: 'request-1',
        payload: {
          type: 'get_page_context'
        }
      })
    )

    assert.deepEqual(JSON.parse(harness.sockets.created[0].sent[0]), {
      type: 'message',
      id: 'request-1',
      payload: {
        type: 'page_context_response',
        ok: true,
        data: {
          url: 'https://example.com/',
          title: 'Example Domain'
        }
      }
    })
  })

  void it('returns no_active_tab when no active tab with a URL exists', async () => {
    const harness = createHarness({ websocketUrl: 'ws://127.0.0.1:8787' })

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
  activeTab?: ActiveTabContext
}

interface ActiveTabContext {
  url: string
  title: string
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
  const tabs = new FakeTabsAdapter(options.activeTab)
  const sockets = new FakeSocketFactory()
  const timers = new FakeTimersAdapter()
  const controller = new BrowserBridgeBackgroundController({
    action,
    createWebSocket: sockets.create,
    setup,
    storage,
    tabs,
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

class FakeTabsAdapter implements TabsAdapter {
  constructor (private readonly activeTab: ActiveTabContext | undefined) {}

  async getActiveTabContext (): Promise<{ url: string, title: string } | undefined> {
    return this.activeTab
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
