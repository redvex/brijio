import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

interface ListenerRegistry<T> {
  listeners: T[]
  addListener: (listener: T) => void
}

type RuntimeMessageListener = (
  message: {
    type?: unknown
    websocketUrl?: unknown
    pairingToken?: unknown
    profileName?: unknown
    label?: unknown
  },
  sender: unknown,
  sendResponse: (response: unknown) => void
) => boolean | undefined

interface MockBrowser {
  browserAction: {
    onClicked: ListenerRegistry<() => void | Promise<void>>
    setBadgeText: (details: { text: string }) => Promise<void>
    setTitle: (details: { title: string }) => Promise<void>
  }
  runtime: {
    onMessage: ListenerRegistry<RuntimeMessageListener>
  }
  storage: {
    local: {
      data: Record<string, unknown>
      get: (keys: string[]) => Promise<Record<string, unknown>>
      set: (items: Record<string, unknown>) => Promise<void>
    }
  }
  tabs: {
    query: (queryInfo: { active: boolean, currentWindow: boolean }) => Promise<unknown[]>
    sendMessage: (tabId: number, message: unknown) => Promise<unknown>
  }
  scripting: {
    executeScript: (details: { target: { tabId: number }, files: string[] }) => Promise<unknown>
  }
}

function createListenerRegistry<T> (): ListenerRegistry<T> {
  const listeners: T[] = []
  return {
    listeners,
    addListener (listener: T): void {
      listeners.push(listener)
    }
  }
}

void describe('Safari background entry point', () => {
  void it('registers listeners with the Manifest V2 browserAction API', async () => {
    const browser = createMockBrowser()

    ;(globalThis as unknown as { browser: unknown }).browser = browser

    await import(`./background-entry.js?test=${Date.now()}`)

    assert.equal(browser.browserAction.onClicked.listeners.length, 1)
    assert.equal(browser.runtime.onMessage.listeners.length, 1)
  })

  void it('returns full bridge settings for get_settings messages', async () => {
    const browser = createMockBrowser({
      websocketUrl: 'ws://127.0.0.1:8787',
      pairingToken: 'local-token',
      browserInstanceId: 'safari-existing-id',
      browserName: 'Safari',
      profileName: 'Default',
      label: 'Safari Default'
    })
    ;(globalThis as unknown as { browser: unknown }).browser = browser

    await import(`./background-entry.js?test=${Date.now()}`)
    const response = await sendRuntimeMessage(browser, { type: 'get_settings' })

    assert.deepEqual(response, {
      ok: true,
      data: {
        websocketUrl: 'ws://127.0.0.1:8787',
        pairingToken: 'local-token',
        browserInstanceId: 'safari-existing-id',
        browserName: 'Safari',
        profileName: 'Default',
        label: 'Safari Default'
      }
    })
  })

  void it('saves complete settings and preserves an existing browser instance ID', async () => {
    const browser = createMockBrowser({
      websocketUrl: 'ws://old.example',
      pairingToken: 'old-token',
      browserInstanceId: 'safari-existing-id',
      browserName: 'Safari',
      profileName: 'Default',
      label: 'Safari Default'
    })
    ;(globalThis as unknown as { browser: unknown }).browser = browser

    await import(`./background-entry.js?test=${Date.now()}`)
    const response = await sendRuntimeMessage(browser, {
      type: 'save_settings',
      websocketUrl: 'ws://127.0.0.1:8787',
      pairingToken: 'local-token',
      profileName: 'Work',
      label: 'Safari Work'
    })

    assert.deepEqual(response, { ok: true })
    assert.deepEqual(browser.storage.local.data, {
      websocketUrl: 'ws://127.0.0.1:8787',
      pairingToken: 'local-token',
      browserInstanceId: 'safari-existing-id',
      browserName: 'Safari',
      profileName: 'Work',
      label: 'Safari Work'
    })
  })

  void it('generates a Safari browser instance ID on first settings save', async () => {
    const browser = createMockBrowser()
    ;(globalThis as unknown as { browser: unknown }).browser = browser

    await import(`./background-entry.js?test=${Date.now()}`)
    const response = await sendRuntimeMessage(browser, {
      type: 'save_settings',
      websocketUrl: 'ws://127.0.0.1:8787',
      pairingToken: 'local-token',
      profileName: 'Default',
      label: 'Safari Default'
    })

    assert.deepEqual(response, { ok: true })
    assert.equal(browser.storage.local.data.browserInstanceId, 'safari-test-uuid')
  })

  void it('rejects blank pairing settings with invalid_settings', async () => {
    const browser = createMockBrowser()
    ;(globalThis as unknown as { browser: unknown }).browser = browser

    await import(`./background-entry.js?test=${Date.now()}`)
    const response = await sendRuntimeMessage(browser, {
      type: 'save_settings',
      websocketUrl: 'ws://127.0.0.1:8787',
      pairingToken: ' ',
      profileName: 'Default',
      label: 'Safari Default'
    })

    assert.deepEqual(response, {
      ok: false,
      error: {
        code: 'invalid_settings',
        message: 'Pairing token is required.'
      }
    })
    assert.deepEqual(browser.storage.local.data, {})
  })

  void it('persists desired connected state when connecting', async () => {
    const browser = createMockBrowser(validBridgeStorage())
    const webSocket = installMockWebSocket()
    ;(globalThis as unknown as { browser: unknown }).browser = browser

    try {
      await import(`./background-entry.js?test=${Date.now()}`)
      const response = await sendRuntimeMessage(browser, { type: 'connect' })

      assert.deepEqual(response, { ok: true })
      assert.equal(browser.storage.local.data.desiredConnectionState, 'connected')
      assert.equal(webSocket.created.length, 1)
    } finally {
      webSocket.restore()
    }
  })

  void it('persists desired disconnected state when disconnecting', async () => {
    const browser = createMockBrowser(validBridgeStorage())
    ;(globalThis as unknown as { browser: unknown }).browser = browser

    await import(`./background-entry.js?test=${Date.now()}`)
    const response = await sendRuntimeMessage(browser, { type: 'disconnect' })

    assert.deepEqual(response, { ok: true })
    assert.equal(browser.storage.local.data.desiredConnectionState, 'disconnected')
  })

  void it('reconnects on startup when desired state is connected', async () => {
    const browser = createMockBrowser({
      ...validBridgeStorage(),
      desiredConnectionState: 'connected'
    })
    const webSocket = installMockWebSocket()
    ;(globalThis as unknown as { browser: unknown }).browser = browser

    try {
      await import(`./background-entry.js?test=${Date.now()}`)
      await nextTick()

      assert.equal(webSocket.created.length, 1)
    } finally {
      webSocket.restore()
    }
  })

  void it('does not reconnect on startup when desired state is disconnected', async () => {
    const browser = createMockBrowser({
      ...validBridgeStorage(),
      desiredConnectionState: 'disconnected'
    })
    const webSocket = installMockWebSocket()
    ;(globalThis as unknown as { browser: unknown }).browser = browser

    try {
      await import(`./background-entry.js?test=${Date.now()}`)
      await nextTick()

      assert.equal(webSocket.created.length, 0)
    } finally {
      webSocket.restore()
    }
  })

  void it('reconnects on page activity when desired state is connected', async () => {
    const browser = createMockBrowser({
      ...validBridgeStorage(),
      desiredConnectionState: 'disconnected'
    })
    const webSocket = installMockWebSocket()
    ;(globalThis as unknown as { browser: unknown }).browser = browser

    try {
      await import(`./background-entry.js?test=${Date.now()}`)
      await nextTick()
      browser.storage.local.data.desiredConnectionState = 'connected'

      const response = await sendRuntimeMessage(browser, { type: 'brijio_page_active' })

      assert.deepEqual(response, { ok: true })
      assert.equal(webSocket.created.length, 1)
    } finally {
      webSocket.restore()
    }
  })
})

function validBridgeStorage (): Record<string, unknown> {
  return {
    websocketUrl: 'ws://127.0.0.1:8787',
    pairingToken: 'local-token',
    browserInstanceId: 'safari-existing-id',
    browserName: 'Safari',
    profileName: 'Default',
    label: 'Safari Default'
  }
}

async function nextTick (): Promise<void> {
  return await new Promise(resolve => {
    setTimeout(resolve, 0)
  })
}

function installMockWebSocket (): { created: Array<{ url: string }>, restore: () => void } {
  const originalWebSocket = globalThis.WebSocket
  const created: Array<{ url: string }> = []

  class MockWebSocket {
    onopen: (() => void) | null = null
    onmessage: ((event: { data: string }) => void) | null = null
    onclose: ((event: { code: number, reason: string }) => void) | null = null
    onerror: (() => void) | null = null

    constructor (readonly url: string) {
      created.push({ url })
    }

    send (_message: string): void {}
    close (): void {}
  }

  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket

  return {
    created,
    restore () {
      globalThis.WebSocket = originalWebSocket
    }
  }
}

function createMockBrowser (initialStorage: Record<string, unknown> = {}): MockBrowser {
  const browser = {
    browserAction: {
      onClicked: createListenerRegistry<() => void | Promise<void>>(),
      async setBadgeText (_details: { text: string }) {},
      async setTitle (_details: { title: string }) {}
    },
    runtime: {
      onMessage: createListenerRegistry<RuntimeMessageListener>()
    },
    storage: {
      local: {
        data: { ...initialStorage },
        async get (keys: string[]) {
          const values: Record<string, unknown> = {}
          for (const key of keys) {
            if (key in this.data) {
              values[key] = this.data[key]
            }
          }
          return values
        },
        async set (items: Record<string, unknown>) {
          Object.assign(this.data, items)
        }
      }
    },
    tabs: {
      async query (_queryInfo: { active: boolean, currentWindow: boolean }) {
        return []
      },
      async sendMessage (_tabId: number, _message: unknown) {
        return undefined
      }
    },
    scripting: {
      async executeScript (_details: { target: { tabId: number }, files: string[] }) {
        return undefined
      }
    }
  }

  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {
      randomUUID () {
        return 'test-uuid'
      }
    }
  })

  return browser
}

async function sendRuntimeMessage (
  browser: ReturnType<typeof createMockBrowser>,
  message: Parameters<RuntimeMessageListener>[0]
): Promise<unknown> {
  const listener = browser.runtime.onMessage.listeners[0]
  return await new Promise((resolve) => {
    listener(message, undefined, resolve)
  })
}
