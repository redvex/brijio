import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  parseSettingsResponse,
  parseStatusResponse,
  parseErrorResponse
} from './popup-parsers.js'

void describe('parseSettingsResponse', () => {
  void it('returns settings when response has ok and data with string fields', () => {
    const result = parseSettingsResponse({
      ok: true,
      data: {
        websocketUrl: 'ws://127.0.0.1:8787',
        pairingToken: 'abc123',
        profileName: 'Work',
        label: 'Chrome Work'
      }
    })
    assert.deepStrictEqual(result, {
      websocketUrl: 'ws://127.0.0.1:8787',
      pairingToken: 'abc123',
      profileName: 'Work',
      label: 'Chrome Work'
    })
  })

  void it('returns partial settings when only some fields are present', () => {
    const result = parseSettingsResponse({
      ok: true,
      data: { websocketUrl: 'ws://127.0.0.1:8787' }
    })
    assert.deepStrictEqual(result, { websocketUrl: 'ws://127.0.0.1:8787' })
  })

  void it('returns undefined when data is null', () => {
    const result = parseSettingsResponse({ ok: true, data: null })
    assert.strictEqual(result, undefined)
  })

  void it('returns undefined when data is undefined', () => {
    const result = parseSettingsResponse({ ok: true, data: undefined })
    assert.strictEqual(result, undefined)
  })

  void it('returns undefined when ok is false', () => {
    const result = parseSettingsResponse({ ok: false, data: { websocketUrl: 'ws://127.0.0.1:8787' } })
    assert.strictEqual(result, undefined)
  })

  void it('returns undefined when response is null', () => {
    const result = parseSettingsResponse(null)
    assert.strictEqual(result, undefined)
  })

  void it('returns undefined when response is undefined', () => {
    const result = parseSettingsResponse(undefined)
    assert.strictEqual(result, undefined)
  })

  void it('returns undefined when settings object would be empty', () => {
    const result = parseSettingsResponse({ ok: true, data: { websocketUrl: 42 } })
    assert.strictEqual(result, undefined)
  })
})

void describe('parseStatusResponse', () => {
  void it('returns state and lastError from valid response', () => {
    const result = parseStatusResponse({
      ok: true,
      data: { state: 'connected', lastError: undefined, pendingRequests: 0 }
    })
    assert.deepStrictEqual(result, { state: 'connected', lastError: undefined, reconnectAttempt: undefined, pendingRequests: 0 })
  })

  void it('returns state with lastError when present', () => {
    const result = parseStatusResponse({
      ok: true,
      data: { state: 'error', lastError: 'Connection refused', pendingRequests: 2 }
    })
    assert.deepStrictEqual(result, { state: 'error', lastError: 'Connection refused', reconnectAttempt: undefined, pendingRequests: 2 })
  })

  void it('returns state with reconnectAttempt when present', () => {
    const result = parseStatusResponse({
      ok: true,
      data: { state: 'reconnecting', lastError: undefined, reconnectAttempt: 3, pendingRequests: 1 }
    })
    assert.deepStrictEqual(result, { state: 'reconnecting', lastError: undefined, reconnectAttempt: 3, pendingRequests: 1 })
  })

  void it('returns undefined when ok is false', () => {
    const result = parseStatusResponse({ ok: false, data: { state: 'connected' } })
    assert.strictEqual(result, undefined)
  })

  void it('returns undefined when data.state is not a string', () => {
    const result = parseStatusResponse({ ok: true, data: { state: 42 } })
    assert.strictEqual(result, undefined)
  })

  void it('returns undefined when response is null', () => {
    const result = parseStatusResponse(null)
    assert.strictEqual(result, undefined)
  })

  void it('returns undefined when response is undefined', () => {
    const result = parseStatusResponse(undefined)
    assert.strictEqual(result, undefined)
  })
})

void describe('parseErrorResponse', () => {
  void it('returns error message from valid response', () => {
    const result = parseErrorResponse({ ok: false, error: { message: 'Invalid token' } })
    assert.strictEqual(result, 'Invalid token')
  })

  void it('returns default message when error has no message', () => {
    const result = parseErrorResponse({ ok: false, error: {} })
    assert.strictEqual(result, 'An unknown error occurred.')
  })

  void it('returns default message when response is null', () => {
    const result = parseErrorResponse(null)
    assert.strictEqual(result, 'An unknown error occurred.')
  })

  void it('returns default message when response is undefined', () => {
    const result = parseErrorResponse(undefined)
    assert.strictEqual(result, 'An unknown error occurred.')
  })

  void it('returns default message when error message is not a string', () => {
    const result = parseErrorResponse({ ok: false, error: { message: 42 } })
    assert.strictEqual(result, 'An unknown error occurred.')
  })
})
