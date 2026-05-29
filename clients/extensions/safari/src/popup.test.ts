import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createGetSettingsMessage,
  createSaveSettingsMessage,
  createConnectMessage,
  createDisconnectMessage,
  createGetStatusMessage,
  parseSettingsResponse,
  parseStatusResponse,
  parseErrorResponse,
  sendMessage
} from './popup.js'

// --- sendMessage helper tests ---

void describe('sendMessage', () => {
  void it('resolves with the response when callback is called', async () => {
    const browser = {
      runtime: {
        sendMessage (message: unknown, _opts: unknown, callback?: (response: unknown) => void): void {
          if (callback != null) {
            // eslint-disable-next-line n/no-callback-literal
            callback({ ok: true, data: { websocketUrl: 'ws://test' } })
          }
        }
      }
    }
    const result = await sendMessage(browser, createGetSettingsMessage())
    assert.deepEqual(result, { ok: true, data: { websocketUrl: 'ws://test' } })
  })

  void it('resolves with undefined when callback receives undefined', async () => {
    const browser = {
      runtime: {
        sendMessage (_message: unknown, _opts: unknown, callback?: (response: unknown) => void): void {
          if (callback != null) {
            callback(undefined)
          }
        }
      }
    }
    const result = await sendMessage(browser, createGetSettingsMessage())
    assert.equal(result, undefined)
  })

  void it('passes the message to sendMessage', async () => {
    let captured: unknown = null
    const browser = {
      runtime: {
        sendMessage (message: unknown, _opts: unknown, callback?: (response: unknown) => void): void {
          captured = message
          if (callback != null) {
            // eslint-disable-next-line n/no-callback-literal
            callback({ ok: true })
          }
        }
      }
    }
    await sendMessage(browser, createConnectMessage())
    assert.deepEqual(captured, { type: 'connect' })
  })
})

void describe('createGetSettingsMessage', () => {
  void it('returns a message with type "get_settings"', () => {
    const message = createGetSettingsMessage()
    assert.equal(message.type, 'get_settings')
  })
})

void describe('createSaveSettingsMessage', () => {
  void it('returns a message with type "save_settings" and complete pairing settings', () => {
    const message = createSaveSettingsMessage({
      websocketUrl: 'ws://127.0.0.1:8787',
      pairingToken: 'local-token',
      profileName: 'Default',
      label: 'Safari Default'
    })
    assert.equal(message.type, 'save_settings')
    assert.equal(message.websocketUrl, 'ws://127.0.0.1:8787')
    assert.equal(message.pairingToken, 'local-token')
    assert.equal(message.profileName, 'Default')
    assert.equal(message.label, 'Safari Default')
  })

  void it('preserves the exact settings strings without modification', () => {
    const settings = {
      websocketUrl: 'wss://example.com:443/ws',
      pairingToken: '  local-token  ',
      profileName: 'Work',
      label: 'Safari Work'
    }
    const message = createSaveSettingsMessage(settings)
    assert.equal(message.websocketUrl, settings.websocketUrl)
    assert.equal(message.pairingToken, settings.pairingToken)
    assert.equal(message.profileName, settings.profileName)
    assert.equal(message.label, settings.label)
  })
})

void describe('createConnectMessage', () => {
  void it('returns a message with type "connect"', () => {
    const message = createConnectMessage()
    assert.equal(message.type, 'connect')
  })
})

void describe('createDisconnectMessage', () => {
  void it('returns a message with type "disconnect"', () => {
    const message = createDisconnectMessage()
    assert.equal(message.type, 'disconnect')
  })
})

void describe('createGetStatusMessage', () => {
  void it('returns a message with type "get_status"', () => {
    const message = createGetStatusMessage()
    assert.equal(message.type, 'get_status')
  })
})

// --- Response parsing tests ---

void describe('parseSettingsResponse', () => {
  void it('returns editable pairing settings when response is successful', () => {
    const response = {
      ok: true,
      data: {
        websocketUrl: 'ws://127.0.0.1:8787',
        pairingToken: 'local-token',
        profileName: 'Default',
        label: 'Safari Default'
      }
    }
    const settings = parseSettingsResponse(response)
    assert.deepEqual(settings, {
      websocketUrl: 'ws://127.0.0.1:8787',
      pairingToken: 'local-token',
      profileName: 'Default',
      label: 'Safari Default'
    })
  })

  void it('returns undefined when response ok is false', () => {
    const response = { ok: false, error: { message: 'Error' } }
    const settings = parseSettingsResponse(response)
    assert.equal(settings, undefined)
  })

  void it('returns undefined when data is missing', () => {
    const response = { ok: true }
    const settings = parseSettingsResponse(response)
    assert.equal(settings, undefined)
  })

  void it('ignores non-string fields', () => {
    const response = {
      ok: true,
      data: {
        websocketUrl: 123,
        pairingToken: 'local-token',
        profileName: false,
        label: 'Safari Default'
      }
    }
    const settings = parseSettingsResponse(response)
    assert.deepEqual(settings, {
      pairingToken: 'local-token',
      label: 'Safari Default'
    })
  })

  void it('returns undefined when no editable fields are present', () => {
    const response = { ok: true, data: {} }
    const settings = parseSettingsResponse(response)
    assert.equal(settings, undefined)
  })

  void it('returns undefined for null response', () => {
    const settings = parseSettingsResponse(null)
    assert.equal(settings, undefined)
  })

  void it('returns undefined for non-object response', () => {
    const settings = parseSettingsResponse('ok')
    assert.equal(settings, undefined)
  })
})

void describe('parseStatusResponse', () => {
  void it('returns state and lastError from valid connected response', () => {
    const response = { ok: true, data: { state: 'connected' } }
    const result = parseStatusResponse(response)
    assert.deepStrictEqual(result, { state: 'connected', lastError: undefined })
  })

  void it('returns state with lastError from error response', () => {
    const response = { ok: true, data: { state: 'error', lastError: 'Connection refused' } }
    const result = parseStatusResponse(response)
    assert.deepStrictEqual(result, { state: 'error', lastError: 'Connection refused' })
  })

  void it('returns disconnected state', () => {
    const response = { ok: true, data: { state: 'disconnected' } }
    const result = parseStatusResponse(response)
    assert.deepStrictEqual(result, { state: 'disconnected', lastError: undefined })
  })

  void it('returns undefined when response ok is false', () => {
    const response = { ok: false, error: { message: 'Error' } }
    const result = parseStatusResponse(response)
    assert.equal(result, undefined)
  })

  void it('returns undefined when data is missing', () => {
    const response = { ok: true }
    const result = parseStatusResponse(response)
    assert.equal(result, undefined)
  })

  void it('returns undefined when state is not a string', () => {
    const response = { ok: true, data: { state: 42 } }
    const result = parseStatusResponse(response)
    assert.equal(result, undefined)
  })

  void it('returns undefined for null response', () => {
    const result = parseStatusResponse(null)
    assert.equal(result, undefined)
  })

  void it('returns undefined for non-object response', () => {
    const result = parseStatusResponse('ok')
    assert.equal(result, undefined)
  })
})

void describe('parseErrorResponse', () => {
  void it('returns the error message from the response', () => {
    const response = { ok: false, error: { message: 'Something went wrong' } }
    const message = parseErrorResponse(response)
    assert.equal(message, 'Something went wrong')
  })

  void it('returns a default message when error message is missing', () => {
    const response = { ok: false, error: {} }
    const message = parseErrorResponse(response)
    assert.equal(message, 'An unknown error occurred.')
  })

  void it('returns a default message for non-object response', () => {
    const message = parseErrorResponse('error')
    assert.equal(message, 'An unknown error occurred.')
  })

  void it('returns a default message for null response', () => {
    const message = parseErrorResponse(null)
    assert.equal(message, 'An unknown error occurred.')
  })

  void it('returns a default message when error has no message property', () => {
    const response = { ok: false, error: { code: 'unsupported_message' } }
    const message = parseErrorResponse(response)
    assert.equal(message, 'An unknown error occurred.')
  })
})
