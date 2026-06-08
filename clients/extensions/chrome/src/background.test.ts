import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
import {
  type BridgeSettings,
  type BrijioBackgroundController
} from '@brijio/shared'
import {
  createMessageHandler
} from './background.js'

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
