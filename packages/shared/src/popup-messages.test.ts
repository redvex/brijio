import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createGetSettingsMessage,
  createSaveSettingsMessage,
  createConnectMessage,
  createDisconnectMessage,
  createGetStatusMessage
} from './popup-messages.js'

void describe('createGetSettingsMessage', () => {
  void it('returns a get_settings message', () => {
    const message = createGetSettingsMessage()
    assert.deepStrictEqual(message, { type: 'get_settings' })
  })
})

void describe('createSaveSettingsMessage', () => {
  void it('returns a save_settings message with all fields', () => {
    const message = createSaveSettingsMessage({
      websocketUrl: 'ws://127.0.0.1:8787',
      pairingToken: 'abc123',
      profileName: 'Work',
      label: 'Chrome Work'
    })
    assert.deepStrictEqual(message, {
      type: 'save_settings',
      websocketUrl: 'ws://127.0.0.1:8787',
      pairingToken: 'abc123',
      profileName: 'Work',
      label: 'Chrome Work'
    })
  })
})

void describe('createConnectMessage', () => {
  void it('returns a connect message', () => {
    const message = createConnectMessage()
    assert.deepStrictEqual(message, { type: 'connect' })
  })
})

void describe('createDisconnectMessage', () => {
  void it('returns a disconnect message', () => {
    const message = createDisconnectMessage()
    assert.deepStrictEqual(message, { type: 'disconnect' })
  })
})

void describe('createGetStatusMessage', () => {
  void it('returns a get_status message', () => {
    const message = createGetStatusMessage()
    assert.deepStrictEqual(message, { type: 'get_status' })
  })
})
