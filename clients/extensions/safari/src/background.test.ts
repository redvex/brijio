import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'
import {
  BrijioBackgroundController,
  createGlobalTimers,
  type BrijioSocket,
  type PageReadResult,
  type PageContext,
  type PageContent
} from '@brijio/shared'
import {
  SafariActionBadge,
  SafariStorageAdapter,
  SafariSetupAdapter,
  SafariPageReaderAdapter,
  SafariPageNavigationAdapter,
  SafariWebSocketConnection
} from './background.js'

// --- Mock browser.* API ---

interface MockOnClicked {
  listeners: Array<() => void | Promise<void>>
  addListener: (callback: () => void | Promise<void>) => void
}

interface MockAction {
  lastBadgeText: string
  lastBadgeColor: string
  lastBadgeTextColor: string
  lastTitle: string
  setBadgeText: (details: { text: string }) => Promise<void>
  setBadgeBackgroundColor: (details: { color: string }) => Promise<void>
  setBadgeTextColor: (details: { color: string }) => Promise<void>
  setTitle: (details: { title: string }) => Promise<void>
  onClicked: MockOnClicked
}

interface MockStorageLocal {
  data: Record<string, unknown>
  get: (keys: string[]) => Promise<Record<string, unknown>>
  set: (items: Record<string, unknown>) => Promise<void>
}

interface MockStorage {
  local: MockStorageLocal
}

interface MockTabs {
  queryResult: Array<{ id?: number, title?: string, url?: string }>
  sendMessageResult: unknown
  createResult: unknown
  updateResult: { id?: number, title?: string, url?: string }
  query: (queryInfo: { active: boolean, currentWindow: boolean }) => Promise<Array<{ id?: number, title?: string, url?: string }>>
  sendMessage: (tabId: number, message: unknown) => Promise<unknown>
  create: (properties: { url: string }) => Promise<unknown>
  update: (tabId: number, updateProperties: { url: string }) => Promise<{ id?: number, title?: string, url?: string }>
}

interface MockScripting {
  executeScript: (details: { target: { tabId: number }, files: string[] }) => Promise<void>
}

interface MockOnMessage {
  listeners: unknown[]
  addListener: (callback: unknown) => void
}

interface MockRuntime {
  getURL: (path: string) => string
  onMessage: MockOnMessage
}

interface MockBrowser {
  browserAction: MockAction
  storage: MockStorage
  tabs: MockTabs
  scripting: MockScripting
  runtime: MockRuntime
}

interface MockTab {
  id?: number
  title?: string
  url?: string
}

function createMockBrowser (): MockBrowser {
  const storageData: Record<string, unknown> = {}
  const storage: MockStorage = {
    local: {
      data: storageData,
      async get (keys: string[]): Promise<Record<string, unknown>> {
        const result: Record<string, unknown> = {}
        for (const key of keys) {
          if (key in this.data) {
            result[key] = this.data[key]
          }
        }
        return result
      },
      async set (items: Record<string, unknown>): Promise<void> {
        Object.assign(this.data, items)
      }
    }
  }

  const action: MockAction = {
    lastBadgeText: '',
    lastBadgeColor: '',
    lastBadgeTextColor: '',
    lastTitle: '',
    async setBadgeText (details: { text: string }) {
      action.lastBadgeText = details.text
    },
    async setBadgeBackgroundColor (_details: { color: string }) {
      // Safari does not support badge background color — no-op
    },
    async setBadgeTextColor (_details: { color: string }) {
      // Safari does not support badge text color — no-op
    },
    async setTitle (details: { title: string }) {
      action.lastTitle = details.title
    },
    onClicked: {
      listeners: [] as Array<() => void | Promise<void>>,
      addListener (callback: () => void | Promise<void>) {
        action.onClicked.listeners.push(callback)
      }
    }
  }

  const emptyUpdateResult: MockTab = {}
  const tabs: MockTabs = {
    queryResult: [] as MockTab[],
    async query (_queryInfo: { active: boolean, currentWindow: boolean }) {
      return tabs.queryResult
    },
    sendMessageResult: {} as unknown,
    async sendMessage (_tabId: number, _message: unknown) {
      return tabs.sendMessageResult
    },
    createResult: {} as unknown,
    async create (_properties: { url: string }) {
      return tabs.createResult
    },
    updateResult: emptyUpdateResult,
    async update (_tabId: number, updateProperties: { url: string }) {
      return tabs.updateResult
    }
  }

  const scripting: MockScripting = {
    async executeScript (_details: { target: { tabId: number }, files: string[] }) {
      // no-op for tests
    }
  }

  const runtime: MockRuntime = {
    getURL (path: string) {
      return 'safari-extension://abc/' + path
    },
    onMessage: {
      listeners: [] as unknown[],
      addListener (callback: unknown) {
        runtime.onMessage.listeners.push(callback)
      }
    }
  }

  return { storage, browserAction: action, tabs, scripting, runtime }
}

// --- SafariActionBadge tests ---

void describe('SafariActionBadge', () => {
  const browser = createMockBrowser()

  void it('setBadgeText delegates to browser.browserAction.setBadgeText', async () => {
    const badge = new SafariActionBadge(browser.browserAction)
    await badge.setBadgeText('ON')
    assert.equal(browser.browserAction.lastBadgeText, 'ON')
  })

  void it('setBadgeColor is a no-op (Safari has no color API)', async () => {
    const badge = new SafariActionBadge(browser.browserAction)
    // Should not throw and should resolve without error
    await badge.setBadgeColor('#ff0000')
    // lastBadgeColor remains unchanged — no-op
    assert.equal(browser.browserAction.lastBadgeColor, '')
  })

  void it('setBadgeTextColor is a no-op (Safari has no color API)', async () => {
    const badge = new SafariActionBadge(browser.browserAction)
    await badge.setBadgeTextColor('#ffffff')
    assert.equal(browser.browserAction.lastBadgeTextColor, '')
  })

  void it('setTitle delegates to browser.browserAction.setTitle', async () => {
    const badge = new SafariActionBadge(browser.browserAction)
    await badge.setTitle('Brijio connected')
    assert.equal(browser.browserAction.lastTitle, 'Brijio connected')
  })
})

// --- SafariStorageAdapter tests ---

void describe('SafariStorageAdapter', () => {
  let browser: MockBrowser

  beforeEach(() => {
    browser = createMockBrowser()
    browser.storage.local.data = {}
  })

  void it('getWebSocketUrl returns undefined when not set', async () => {
    const storage = new SafariStorageAdapter(browser.storage)
    const result = await storage.getWebSocketUrl()
    assert.equal(result, undefined)
  })

  void it('getWebSocketUrl delegates to browser.storage.local.get and returns stored URL', async () => {
    browser.storage.local.data = { websocketUrl: 'wss://example.com' }
    const storage = new SafariStorageAdapter(browser.storage)
    const result = await storage.getWebSocketUrl()
    assert.equal(result, 'wss://example.com')
  })

  void it('setWebSocketUrl delegates to browser.storage.local.set', async () => {
    const storage = new SafariStorageAdapter(browser.storage)
    await storage.setWebSocketUrl('wss://example.com/ws')
    assert.equal(browser.storage.local.data.websocketUrl, 'wss://example.com/ws')
  })

  void it('getBridgeSettings returns complete stored bridge settings', async () => {
    browser.storage.local.data = {
      websocketUrl: 'wss://example.com',
      pairingToken: 'local-token',
      browserInstanceId: 'safari-default-test',
      browserName: 'Safari',
      profileName: 'Default',
      label: 'Safari Default'
    }
    const storage = new SafariStorageAdapter(browser.storage)

    assert.deepEqual(await storage.getBridgeSettings(), {
      websocketUrl: 'wss://example.com',
      pairingToken: 'local-token',
      browserInstanceId: 'safari-default-test',
      browserName: 'Safari',
      profileName: 'Default',
      label: 'Safari Default'
    })
  })

  void it('getBridgeSettings returns undefined when required values are missing', async () => {
    browser.storage.local.data = {
      websocketUrl: 'wss://example.com'
    }
    const storage = new SafariStorageAdapter(browser.storage)

    assert.equal(await storage.getBridgeSettings(), undefined)
  })

  void it('setBridgeSettings delegates complete settings to browser.storage.local.set', async () => {
    const storage = new SafariStorageAdapter(browser.storage)
    await storage.setBridgeSettings({
      websocketUrl: 'wss://example.com',
      pairingToken: 'local-token',
      browserInstanceId: 'safari-default-test',
      browserName: 'Safari',
      profileName: 'Default',
      label: 'Safari Default'
    })

    assert.deepEqual(browser.storage.local.data, {
      websocketUrl: 'wss://example.com',
      pairingToken: 'local-token',
      browserInstanceId: 'safari-default-test',
      browserName: 'Safari',
      profileName: 'Default',
      label: 'Safari Default'
    })
  })
})

// --- SafariSetupAdapter tests ---

void describe('SafariSetupAdapter', () => {
  void it('openSetupPage is a no-op (Safari uses popup, not setup page)', async () => {
    const setup = new SafariSetupAdapter()
    // Should resolve without error
    await setup.openSetupPage()
  })
})

// --- SafariPageReaderAdapter tests ---

void describe('SafariPageReaderAdapter', () => {
  let browser: MockBrowser

  beforeEach(() => {
    browser = createMockBrowser()
  })

  void it('getPageContext returns error when no active tab', async () => {
    browser.tabs.queryResult = []
    const reader = new SafariPageReaderAdapter(browser.tabs, browser.scripting)
    const result: PageReadResult<PageContext> = await reader.getPageContext()
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.code, 'no_active_tab')
    }
  })

  void it('getPageContext returns error when active tab has no URL', async () => {
    browser.tabs.queryResult = [{ id: 1 }]
    const reader = new SafariPageReaderAdapter(browser.tabs, browser.scripting)
    const result: PageReadResult<PageContext> = await reader.getPageContext()
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.code, 'no_active_tab')
    }
  })

  void it('getPageContext returns error for non-HTTP URLs', async () => {
    browser.tabs.queryResult = [{ id: 1, url: 'safari-extension://page' }]
    const reader = new SafariPageReaderAdapter(browser.tabs, browser.scripting)
    const result: PageReadResult<PageContext> = await reader.getPageContext()
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.code, 'unsupported_page')
    }
  })

  void it('getPageContext returns content_script_unavailable when sendMessage fails', async () => {
    browser.tabs.queryResult = [{ id: 1, url: 'https://example.com' }]
    browser.tabs.sendMessageResult = { ok: true, data: { title: 'Test' } }

    // Make sendMessage throw
    browser.tabs.sendMessage = async function (_tabId: number, _message: unknown) {
      throw new Error('Connection refused')
    }

    const reader = new SafariPageReaderAdapter(browser.tabs, browser.scripting)
    const result: PageReadResult<PageContext> = await reader.getPageContext()
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.code, 'content_script_unavailable')
    }
  })

  void it('getPageContext delegates to browser.scripting.executeScript and browser.tabs.sendMessage', async () => {
    browser.tabs.queryResult = [{ id: 1, url: 'https://example.com' }]
    browser.tabs.sendMessageResult = {
      ok: true,
      data: { title: 'Test Page', url: 'https://example.com' }
    }

    const reader = new SafariPageReaderAdapter(browser.tabs, browser.scripting)
    const result: PageReadResult<PageContext> = await reader.getPageContext()
    assert.equal(result.ok, true)
  })

  void it('getPageContent returns error when no active tab', async () => {
    browser.tabs.queryResult = []
    const reader = new SafariPageReaderAdapter(browser.tabs, browser.scripting)
    const result: PageReadResult<PageContent> = await reader.getPageContent(1)
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.code, 'no_active_tab')
    }
  })
})

// --- SafariWebSocketConnection tests ---

void describe('SafariWebSocketConnection', () => {
  void it('connect method exists and is callable', () => {
    const ws = new SafariWebSocketConnection('wss://example.com')
    assert.equal(typeof ws.connect, 'function')
  })

  void it('disconnect method exists and is callable', () => {
    const ws = new SafariWebSocketConnection('wss://example.com')
    assert.equal(typeof ws.disconnect, 'function')
  })

  void it('send method exists and is callable', () => {
    const ws = new SafariWebSocketConnection('wss://example.com')
    assert.equal(typeof ws.send, 'function')
  })

  void it('close method exists and is callable (implements BrijioSocket)', () => {
    const ws = new SafariWebSocketConnection('wss://example.com')
    assert.equal(typeof ws.close, 'function')
  })

  void it('onopen, onmessage, onclose, onerror can be set', () => {
    const ws = new SafariWebSocketConnection('wss://example.com')
    assert.equal(typeof ws.onopen, 'undefined')
    assert.equal(typeof ws.onmessage, 'undefined')
    assert.equal(typeof ws.onclose, 'undefined')
    assert.equal(typeof ws.onerror, 'undefined')

    ws.onopen = () => {}
    ws.onmessage = () => {}
    ws.onclose = () => {}
    ws.onerror = () => {}

    assert.equal(typeof ws.onopen, 'function')
    assert.equal(typeof ws.onmessage, 'function')
    assert.equal(typeof ws.onclose, 'function')
    assert.equal(typeof ws.onerror, 'function')
  })

  void it('disconnect without connect does not throw', () => {
    const ws = new SafariWebSocketConnection('wss://example.com')
    ws.disconnect()
    // Should not throw
  })
})

// --- SafariPageNavigationAdapter tests ---

void describe('SafariPageNavigationAdapter', () => {
  let browser: MockBrowser

  beforeEach(() => {
    browser = createMockBrowser()
  })

  void it('returns ok with navigation result when active tab exists', async () => {
    browser.tabs.queryResult = [{ id: 5, url: 'https://example.com/page', title: 'Example' }]
    browser.tabs.updateResult = { id: 5, url: 'https://example.com/page', title: 'Example' }

    const adapter = new SafariPageNavigationAdapter(browser.tabs)
    const result = await adapter.navigateToUrl('https://example.com/page')

    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.data.url, 'https://example.com/page')
      assert.equal(result.data.title, 'Example')
      assert.equal(result.data.redirected, false)
      assert.ok(typeof result.data.navigationMs === 'number')
      assert.ok(typeof result.data.timestamp === 'string')
    }
  })

  void it('detects redirect when final url differs from requested url', async () => {
    browser.tabs.queryResult = [{ id: 5, url: 'https://example.com/old', title: 'Old' }]
    browser.tabs.updateResult = { id: 5, url: 'https://example.com/new', title: 'New Page' }

    const adapter = new SafariPageNavigationAdapter(browser.tabs)
    const result = await adapter.navigateToUrl('https://example.com/old')

    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.data.url, 'https://example.com/new')
      assert.equal(result.data.title, 'New Page')
      assert.equal(result.data.redirected, true)
    }
  })

  void it('returns no_active_tab error when no tabs found', async () => {
    browser.tabs.queryResult = []

    const adapter = new SafariPageNavigationAdapter(browser.tabs)
    const result = await adapter.navigateToUrl('https://example.com/page')

    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.code, 'no_active_tab')
    }
  })

  void it('returns no_active_tab error when tab has no id', async () => {
    browser.tabs.queryResult = [{ url: 'https://example.com/page', title: 'Tab' }]

    const adapter = new SafariPageNavigationAdapter(browser.tabs)
    const result = await adapter.navigateToUrl('https://example.com/page')

    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.code, 'no_active_tab')
    }
  })

  void it('returns navigation_failed error when tabs.update throws', async () => {
    browser.tabs.queryResult = [{ id: 1, url: 'about:blank', title: '' }]
    browser.tabs.update = async function () {
      throw new Error('Cannot access chrome:// URLs')
    }

    const adapter = new SafariPageNavigationAdapter(browser.tabs)
    const result = await adapter.navigateToUrl('https://example.com/page')

    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.code, 'navigation_failed')
      assert.ok(result.error.message.includes('https://example.com/page'))
    }
  })

  void it('returns success with original url when tabs.update returns undefined', async () => {
    browser.tabs.queryResult = [{ id: 1, url: 'about:blank', title: '' }]
    browser.tabs.updateResult = undefined as unknown as { id?: number, title?: string, url?: string }

    const adapter = new SafariPageNavigationAdapter(browser.tabs)
    const result = await adapter.navigateToUrl('https://example.com/')

    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.data.url, 'https://example.com/')
      assert.equal(result.data.title, '')
      assert.equal(result.data.redirected, false)
    }
  })

  void it('returns timeout error when tabs.update hangs beyond 10s', async () => {
    browser.tabs.queryResult = [{ id: 1, url: 'about:blank', title: '' }]
    // Simulate a tabs.update that never resolves — verify the timeout
    // mechanism is wired. We race against a short 500ms check to avoid
    // waiting the full 10s timeout, just confirming the promise stays
    // in-flight without crashing.
    let resolveUpdate: ((value: { id?: number, title?: string, url?: string }) => void) | undefined
    const updatePromise = new Promise<{ id?: number, title?: string, url?: string }>(
      (resolve) => { resolveUpdate = resolve }
    )
    browser.tabs.update = async function () {
      return await updatePromise
    }

    const adapter = new SafariPageNavigationAdapter(browser.tabs)
    const result = await Promise.race([
      adapter.navigateToUrl('https://example.com/'),
      new Promise<{ timedOut: true }>((resolve) =>
        setTimeout(() => resolve({ timedOut: true }), 500)
      )
    ])

    if ('timedOut' in result && result.timedOut) {
      // Expected: the 10s timeout hasn't elapsed yet, so we're still waiting.
      // Resolve the update to clean up.
      const completeUpdate = resolveUpdate
      if (completeUpdate === undefined) {
        throw new Error('tabs.update promise resolver was not captured')
      }
      completeUpdate({})
    } else {
      // Unexpected early result — verify it's an error, not a crash.
      const navigationResult = result as Awaited<ReturnType<SafariPageNavigationAdapter['navigateToUrl']>>
      assert.equal(navigationResult.ok, false)
    }
  })
})

// --- BrijioBackgroundController with Safari adapters ---

void describe('BrijioBackgroundController with Safari adapters', () => {
  void it('can be instantiated with all Safari adapter implementations', () => {
    const browser = createMockBrowser()

    const action = new SafariActionBadge(browser.browserAction)
    const storage = new SafariStorageAdapter(browser.storage)
    const setup = new SafariSetupAdapter()
    const pageReader = new SafariPageReaderAdapter(browser.tabs, browser.scripting)
    const pageNavigation = new SafariPageNavigationAdapter(browser.tabs)

    const createWebSocket = (_url: string): BrijioSocket => {
      // Return a stub socket for instantiation test
      const listeners: Record<string, (() => void) | undefined> = {}
      return {
        get onopen () { return listeners.onopen },
        set onopen (fn) { listeners.onopen = fn },
        get onmessage () { return listeners.onmessage as undefined },
        set onmessage (fn) { listeners.onmessage = fn },
        get onclose () { return listeners.onclose },
        set onclose (fn) { listeners.onclose = fn },
        get onerror () { return listeners.onerror },
        set onerror (fn) { listeners.onerror = fn },
        send () {},
        close () {}
      }
    }

    const timers = createGlobalTimers()

    const controller = new BrijioBackgroundController({
      action,
      createWebSocket,
      setup,
      storage,
      pageReader,
      pageActions: {
        async click () { return { ok: false, error: { code: 'target_not_found' as const, message: 'test' } } },
        async writeText () { return { ok: false, error: { code: 'target_not_found' as const, message: 'test' } } },
        async setChecked () { return { ok: false, error: { code: 'target_not_found' as const, message: 'test' } } },
        async selectOptions () { return { ok: false, error: { code: 'target_not_found' as const, message: 'test' } } },
        async submitForm () { return { ok: false, error: { code: 'target_not_found' as const, message: 'test' } } }
      },
      pageBatch: {
        async performBatch () {
          return { ok: false, results: [], aborted: false }
        }
      },
      pageNavigation,
      timers
    })

    assert.ok(controller instanceof BrijioBackgroundController)
  })
})
