import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'
import {
  BrowserBridgeBackgroundController,
  createGlobalTimers,
  type BrowserBridgeSocket,
  type PageReadResult,
  type PageContext,
  type PageContent
} from '@browserbridge/shared'
import {
  SafariActionBadge,
  SafariStorageAdapter,
  SafariSetupAdapter,
  SafariPageReaderAdapter,
  SafariWebSocketConnection,
  type BrowserApi
} from './background.js'

// --- Mock browser.* API ---

function createMockBrowser (): BrowserApi {
  const storageData: Record<string, unknown> = {}
  const mockStorage = {
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

  const mockAction = {
    lastBadgeText: '',
    lastBadgeColor: '',
    lastBadgeTextColor: '',
    lastTitle: '',
    async setBadgeText (details: { text: string }) {
      mockAction.lastBadgeText = details.text
    },
    async setBadgeBackgroundColor (_details: { color: string }) {
      // Safari does not support badge background color — no-op
    },
    async setBadgeTextColor (_details: { color: string }) {
      // Safari does not support badge text color — no-op
    },
    async setTitle (details: { title: string }) {
      mockAction.lastTitle = details.title
    },
    onClicked: {
      listeners: [] as Array<() => void | Promise<void>>,
      addListener (callback: () => void | Promise<void>) {
        mockAction.onClicked.listeners.push(callback)
      }
    }
  }

  const mockTabs = {
    queryResult: [] as Array<{ id?: number, title?: string, url?: string }>,
    async query (_queryInfo: { active: boolean, currentWindow: boolean }) {
      return mockTabs.queryResult
    },
    sendMessageResult: {} as unknown,
    async sendMessage (_tabId: number, _message: unknown) {
      return mockTabs.sendMessageResult
    },
    createResult: {} as unknown,
    async create (_properties: { url: string }) {
      return mockTabs.createResult
    }
  }

  const mockScripting = {
    async executeScript (_details: { target: { tabId: number }, files: string[] }) {
      // no-op for tests
    }
  }

  const mockRuntime = {
    getURLResult: 'safari-extension://abc/',
    getURL (path: string) {
      return mockRuntime.getURLResult + path
    },
    onMessage: {
      listeners: [] as unknown[],
      addListener (callback: unknown) {
        mockRuntime.onMessage.listeners.push(callback)
      }
    }
  }

  return { storage: mockStorage, action: mockAction, tabs: mockTabs, scripting: mockScripting, runtime: mockRuntime }
}

// --- SafariActionBadge tests ---

void describe('SafariActionBadge', () => {
  const browser = createMockBrowser()

  void it('setBadgeText delegates to browser.action.setBadgeText', async () => {
    const badge = new SafariActionBadge(browser.action)
    await badge.setBadgeText('ON')
    assert.equal(browser.action.lastBadgeText, 'ON')
  })

  void it('setBadgeColor is a no-op (Safari has no color API)', async () => {
    const badge = new SafariActionBadge(browser.action)
    // Should not throw and should resolve without error
    await badge.setBadgeColor('#ff0000')
    // lastBadgeColor remains unchanged — no-op
    assert.equal(browser.action.lastBadgeColor, '')
  })

  void it('setBadgeTextColor is a no-op (Safari has no color API)', async () => {
    const badge = new SafariActionBadge(browser.action)
    await badge.setBadgeTextColor('#ffffff')
    assert.equal(browser.action.lastBadgeTextColor, '')
  })

  void it('setTitle delegates to browser.action.setTitle', async () => {
    const badge = new SafariActionBadge(browser.action)
    await badge.setTitle('BrowserBridge connected')
    assert.equal(browser.action.lastTitle, 'BrowserBridge connected')
  })
})

// --- SafariStorageAdapter tests ---

void describe('SafariStorageAdapter', () => {
  let browser: ReturnType<typeof createMockBrowser>

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
  let browser: ReturnType<typeof createMockBrowser>

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

  void it('close method exists and is callable (implements BrowserBridgeSocket)', () => {
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

// --- BrowserBridgeBackgroundController with Safari adapters ---

void describe('BrowserBridgeBackgroundController with Safari adapters', () => {
  void it('can be instantiated with all Safari adapter implementations', () => {
    const browser = createMockBrowser()

    const action = new SafariActionBadge(browser.action)
    const storage = new SafariStorageAdapter(browser.storage)
    const setup = new SafariSetupAdapter()
    const pageReader = new SafariPageReaderAdapter(browser.tabs, browser.scripting)

    const createWebSocket = (_url: string): BrowserBridgeSocket => {
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

    const controller = new BrowserBridgeBackgroundController({
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
      timers
    })

    assert.ok(controller instanceof BrowserBridgeBackgroundController)
  })
})
