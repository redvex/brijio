import assert from 'node:assert/strict'
import { describe, it, mock, beforeEach, afterEach } from 'node:test'
import {
  type BridgeSettings,
  type BrijioBackgroundController,
  type PageNavigationResult
} from '@brijio/shared'
import {
  createMessageHandler,
  navigateActiveTabToUrl
} from './background.js'

// --- Chrome API mock for navigateActiveTabToUrl tests ---

interface MockTabs {
  queryResult: Array<{ id?: number, title?: string, url?: string }>
  updateResult: { id?: number, title?: string, url?: string }
  query: (queryInfo: { active: boolean, currentWindow: boolean }) => Promise<Array<{ id?: number, title?: string, url?: string }>>
  update: (tabId: number, updateProperties: { url: string }) => Promise<{ id?: number, title?: string, url?: string }>
}

function createMockTabs (): MockTabs {
  return {
    queryResult: [],
    updateResult: { id: 1 },
    async query (_queryInfo: { active: boolean, currentWindow: boolean }) {
      return this.queryResult
    },
    async update (_tabId: number, _updateProperties: { url: string }) {
      return this.updateResult
    }
  }
}

// --- Test helpers ---

function createMockController (): {
  controller: BrijioBackgroundController
  getBridgeSettings: ReturnType<typeof mock.fn>
  saveBridgeSettings: ReturnType<typeof mock.fn>
  requestConnect: ReturnType<typeof mock.fn>
  requestDisconnect: ReturnType<typeof mock.fn>
  getConnectionStatus: ReturnType<typeof mock.fn>
} {
  const getBridgeSettings = mock.fn(async (): Promise<BridgeSettings | undefined> => undefined)
  const saveBridgeSettings = mock.fn(async (): Promise<void> => {})
  const requestConnect = mock.fn(async (): Promise<void> => {})
  const requestDisconnect = mock.fn(async (): Promise<void> => {})
  const getConnectionStatus = mock.fn((): { state: string, lastError?: string } => ({
    state: 'disconnected'
  }))

  const controller = {
    getBridgeSettings,
    saveBridgeSettings,
    requestConnect,
    requestDisconnect,
    getConnectionStatus
  } as unknown as BrijioBackgroundController

  return {
    controller,
    getBridgeSettings,
    saveBridgeSettings,
    requestConnect,
    requestDisconnect,
    getConnectionStatus
  }
}

// --- Message handler tests ---

void describe('createMessageHandler', () => {
  void it('handles get_settings message and returns stored settings', async () => {
    const mocks = createMockController()
    const storedSettings: BridgeSettings = {
      websocketUrl: 'ws://127.0.0.1:8787',
      pairingToken: 'local-token',
      browserInstanceId: 'chrome-test',
      browserName: 'Chrome',
      profileName: 'Default',
      label: 'Chrome Default'
    }
    mocks.getBridgeSettings.mock.mockImplementation(async () => storedSettings)

    const handler = createMessageHandler(mocks.controller)
    const sendResponse = mock.fn()

    const result = handler(
      { type: 'get_settings' },
      {},
      sendResponse
    )

    assert.equal(result, true)
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.equal(sendResponse.mock.callCount(), 1)
    assert.deepEqual(sendResponse.mock.calls[0].arguments[0], {
      ok: true,
      data: storedSettings
    })
  })

  void it('handles get_settings when no settings stored', async () => {
    const mocks = createMockController()
    mocks.getBridgeSettings.mock.mockImplementation(async () => undefined)

    const handler = createMessageHandler(mocks.controller)
    const sendResponse = mock.fn()

    handler({ type: 'get_settings' }, {}, sendResponse)

    await new Promise(resolve => setTimeout(resolve, 10))
    assert.equal(sendResponse.mock.callCount(), 1)
    assert.deepEqual(sendResponse.mock.calls[0].arguments[0], {
      ok: true,
      data: undefined
    })
  })

  void it('handles save_settings message with valid fields', async () => {
    const mocks = createMockController()
    const handler = createMessageHandler(mocks.controller)
    const sendResponse = mock.fn()

    handler(
      {
        type: 'save_settings',
        websocketUrl: 'ws://127.0.0.1:8787',
        pairingToken: 'local-token',
        profileName: 'Default',
        label: 'Chrome Default'
      },
      {},
      sendResponse
    )

    await new Promise(resolve => setTimeout(resolve, 10))
    assert.equal(mocks.saveBridgeSettings.mock.callCount(), 1)
  })

  void it('handles save_settings message with missing required fields', async () => {
    const mocks = createMockController()
    const handler = createMessageHandler(mocks.controller)
    const sendResponse = mock.fn()

    handler(
      {
        type: 'save_settings',
        websocketUrl: 'ws://127.0.0.1:8787'
      },
      {},
      sendResponse
    )

    await new Promise(resolve => setTimeout(resolve, 10))
    assert.equal(mocks.saveBridgeSettings.mock.callCount(), 0)
  })

  void it('handles get_status message and returns connection status', async () => {
    const mocks = createMockController()
    mocks.getConnectionStatus.mock.mockImplementation(() => ({
      state: 'disconnected'
    }))

    const handler = createMessageHandler(mocks.controller)
    const sendResponse = mock.fn()

    handler({ type: 'get_status' }, {}, sendResponse)

    assert.equal(sendResponse.mock.callCount(), 1)
    assert.deepEqual(sendResponse.mock.calls[0].arguments[0], {
      ok: true,
      data: { state: 'disconnected' }
    })
  })

  void it('handles get_status when connected', async () => {
    const mocks = createMockController()
    mocks.getConnectionStatus.mock.mockImplementation(() => ({
      state: 'connected'
    }))

    const handler = createMessageHandler(mocks.controller)
    const sendResponse = mock.fn()

    handler({ type: 'get_status' }, {}, sendResponse)

    assert.equal(sendResponse.mock.callCount(), 1)
    assert.deepEqual(sendResponse.mock.calls[0].arguments[0], {
      ok: true,
      data: { state: 'connected' }
    })
  })

  void it('handles get_status when in error state', async () => {
    const mocks = createMockController()
    mocks.getConnectionStatus.mock.mockImplementation(() => ({
      state: 'error',
      lastError: 'Connection refused'
    }))

    const handler = createMessageHandler(mocks.controller)
    const sendResponse = mock.fn()

    handler({ type: 'get_status' }, {}, sendResponse)

    assert.equal(sendResponse.mock.callCount(), 1)
    assert.deepEqual(sendResponse.mock.calls[0].arguments[0], {
      ok: true,
      data: { state: 'error', lastError: 'Connection refused' }
    })
  })

  void it('handles connect message by calling requestConnect', async () => {
    const mocks = createMockController()
    const handler = createMessageHandler(mocks.controller)
    const sendResponse = mock.fn()

    handler({ type: 'connect' }, {}, sendResponse)

    await new Promise(resolve => setTimeout(resolve, 10))
    assert.equal(mocks.requestConnect.mock.callCount(), 1)
    assert.equal(sendResponse.mock.callCount(), 1)
    assert.deepEqual(sendResponse.mock.calls[0].arguments[0], { ok: true })
  })

  void it('handles connect message when requestConnect fails', async () => {
    const mocks = createMockController()
    mocks.requestConnect.mock.mockImplementation(async () => {
      throw new Error('No settings stored')
    })

    const handler = createMessageHandler(mocks.controller)
    const sendResponse = mock.fn()

    handler({ type: 'connect' }, {}, sendResponse)

    await new Promise(resolve => setTimeout(resolve, 10))
    assert.equal(sendResponse.mock.callCount(), 1)
    assert.equal(sendResponse.mock.calls[0].arguments[0].ok, false)
    assert.equal(
      sendResponse.mock.calls[0].arguments[0].error.code,
      'connect_failed'
    )
  })

  void it('handles disconnect message by calling requestDisconnect', async () => {
    const mocks = createMockController()
    const handler = createMessageHandler(mocks.controller)
    const sendResponse = mock.fn()

    handler({ type: 'disconnect' }, {}, sendResponse)

    await new Promise(resolve => setTimeout(resolve, 10))
    assert.equal(mocks.requestDisconnect.mock.callCount(), 1)
    assert.equal(sendResponse.mock.callCount(), 1)
    assert.deepEqual(sendResponse.mock.calls[0].arguments[0], { ok: true })
  })

  void it('returns unsupported for unknown message type', () => {
    const mocks = createMockController()
    const handler = createMessageHandler(mocks.controller)
    const sendResponse = mock.fn()

    const result = handler({ type: 'unknown' }, {}, sendResponse)

    assert.equal(result, undefined)
    assert.equal(sendResponse.mock.callCount(), 1)
    assert.deepEqual(sendResponse.mock.calls[0].arguments[0], {
      ok: false,
      error: {
        code: 'unsupported_message',
        message: 'Unsupported extension message.'
      }
    })
  })

  void it('returns unsupported for message without type', () => {
    const mocks = createMockController()
    const handler = createMessageHandler(mocks.controller)
    const sendResponse = mock.fn()

    const result = handler({}, {}, sendResponse)

    assert.equal(result, undefined)
    assert.equal(sendResponse.mock.callCount(), 1)
    assert.deepEqual(sendResponse.mock.calls[0].arguments[0], {
      ok: false,
      error: {
        code: 'unsupported_message',
        message: 'Unsupported extension message.'
      }
    })
  })
})

// --- navigateActiveTabToUrl tests ---

// The background.ts module declares `declare const chrome: ChromeApi` which
// references a global. In the test environment there is no chrome global, so
// we inject a mock on globalThis and clean up after each test.

void describe('navigateActiveTabToUrl', () => {
  let mockTabs: MockTabs

  beforeEach(() => {
    mockTabs = createMockTabs()
    ;(globalThis as unknown as Record<string, unknown>).chrome = {
      tabs: mockTabs,
      action: {
        setBadgeText: async () => {},
        setBadgeBackgroundColor: async () => {},
        setBadgeTextColor: async () => {},
        setTitle: async () => {}
      },
      runtime: {
        getURL: (path: string) => `chrome-extension://abc/${path}`,
        onMessage: { addListener: () => {} }
      },
      storage: {
        local: {
          get: async () => ({}),
          set: async () => {}
        }
      },
      scripting: {
        executeScript: async () => {}
      }
    }
  })

  afterEach(() => {
    delete (globalThis as unknown as Record<string, unknown>).chrome
  })

  void it('returns ok with navigation result when active tab exists', async () => {
    mockTabs.queryResult = [{ id: 42, url: 'https://example.com/page', title: 'Example Page' }]
    mockTabs.updateResult = { id: 42, url: 'https://example.com/page', title: 'Example Page' }

    const result = await navigateActiveTabToUrl('https://example.com/page')

    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.data.url, 'https://example.com/page')
      assert.equal(result.data.title, 'Example Page')
      assert.equal(result.data.redirected, false)
      assert.ok(typeof result.data.navigationMs === 'number')
      assert.ok(typeof result.data.timestamp === 'string')
    }
  })

  void it('detects redirect when final url differs from requested url', async () => {
    mockTabs.queryResult = [{ id: 10, url: 'https://example.com/old', title: 'Old' }]
    mockTabs.updateResult = { id: 10, url: 'https://example.com/new', title: 'New Page' }

    const result = await navigateActiveTabToUrl('https://example.com/old')

    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.data.url, 'https://example.com/new')
      assert.equal(result.data.title, 'New Page')
      assert.equal(result.data.redirected, true)
    }
  })

  void it('returns no_active_tab error when no tabs found', async () => {
    mockTabs.queryResult = []

    const result = await navigateActiveTabToUrl('https://example.com/page')

    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.code, 'no_active_tab')
    }
  })

  void it('returns no_active_tab error when tab has no id', async () => {
    mockTabs.queryResult = [{ url: 'https://example.com/page', title: 'Tab' }]

    const result = await navigateActiveTabToUrl('https://example.com/page')

    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.code, 'no_active_tab')
    }
  })

  void it('returns navigation_failed error when tabs.update throws', async () => {
    mockTabs.queryResult = [{ id: 1, url: 'about:blank', title: '' }]
    mockTabs.update = async function () {
      throw new Error('Cannot access chrome:// URLs')
    }

    const result = await navigateActiveTabToUrl('https://example.com/page')

    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.code, 'navigation_failed')
      assert.ok(result.error.message.includes('https://example.com/page'))
    }
  })
})
