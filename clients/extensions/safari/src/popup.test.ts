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
  parseErrorResponse
} from './popup.js'

// --- Message construction tests ---

void describe('createGetSettingsMessage', () => {
  void it('returns a message with type "get_settings"', () => {
    const message = createGetSettingsMessage()
    assert.equal(message.type, 'get_settings')
  })
})

void describe('createSaveSettingsMessage', () => {
  void it('returns a message with type "save_settings" and the provided URL', () => {
    const message = createSaveSettingsMessage('ws://127.0.0.1:8787')
    assert.equal(message.type, 'save_settings')
    assert.equal(message.websocketUrl, 'ws://127.0.0.1:8787')
  })

  void it('preserves the exact URL string without modification', () => {
    const url = 'wss://example.com:443/ws'
    const message = createSaveSettingsMessage(url)
    assert.equal(message.websocketUrl, url)
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
  void it('returns the websocketUrl when response is successful', () => {
    const response = { ok: true, data: { websocketUrl: 'ws://127.0.0.1:8787' } }
    const url = parseSettingsResponse(response)
    assert.equal(url, 'ws://127.0.0.1:8787')
  })

  void it('returns undefined when response ok is false', () => {
    const response = { ok: false, error: { message: 'Error' } }
    const url = parseSettingsResponse(response)
    assert.equal(url, undefined)
  })

  void it('returns undefined when data is missing', () => {
    const response = { ok: true }
    const url = parseSettingsResponse(response)
    assert.equal(url, undefined)
  })

  void it('returns undefined when websocketUrl is not a string', () => {
    const response = { ok: true, data: { websocketUrl: 123 } }
    const url = parseSettingsResponse(response)
    assert.equal(url, undefined)
  })

  void it('returns undefined when websocketUrl is missing', () => {
    const response = { ok: true, data: {} }
    const url = parseSettingsResponse(response)
    assert.equal(url, undefined)
  })

  void it('returns undefined for null response', () => {
    const url = parseSettingsResponse(null)
    assert.equal(url, undefined)
  })

  void it('returns undefined for non-object response', () => {
    const url = parseSettingsResponse('ok')
    assert.equal(url, undefined)
  })
})

void describe('parseStatusResponse', () => {
  void it('returns true when response indicates connected', () => {
    const response = { ok: true, data: { connected: true } }
    const connected = parseStatusResponse(response)
    assert.equal(connected, true)
  })

  void it('returns false when response indicates disconnected', () => {
    const response = { ok: true, data: { connected: false } }
    const connected = parseStatusResponse(response)
    assert.equal(connected, false)
  })

  void it('returns false when response ok is false', () => {
    const response = { ok: false, error: { message: 'Error' } }
    const connected = parseStatusResponse(response)
    assert.equal(connected, false)
  })

  void it('returns false when data is missing', () => {
    const response = { ok: true }
    const connected = parseStatusResponse(response)
    assert.equal(connected, false)
  })

  void it('returns false when connected is not a boolean', () => {
    const response = { ok: true, data: { connected: 'yes' } }
    const connected = parseStatusResponse(response)
    assert.equal(connected, false)
  })

  void it('returns false for null response', () => {
    const connected = parseStatusResponse(null)
    assert.equal(connected, false)
  })

  void it('returns false for non-object response', () => {
    const connected = parseStatusResponse('ok')
    assert.equal(connected, false)
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