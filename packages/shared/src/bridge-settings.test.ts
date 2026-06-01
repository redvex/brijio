import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  stringValue,
  requireString,
  createBrowserInstanceId,
  normalizeBridgeSettings
} from './bridge-settings.js'

void describe('stringValue', () => {
  void it('returns the string for non-empty strings', () => {
    assert.strictEqual(stringValue('hello'), 'hello')
  })

  void it('returns the string for whitespace-surrounded strings', () => {
    assert.strictEqual(stringValue('  hello  '), '  hello  ')
  })

  void it('returns undefined for empty strings', () => {
    assert.strictEqual(stringValue(''), undefined)
  })

  void it('returns undefined for whitespace-only strings', () => {
    assert.strictEqual(stringValue('   '), undefined)
  })

  void it('returns undefined for numbers', () => {
    assert.strictEqual(stringValue(42), undefined)
  })

  void it('returns undefined for null', () => {
    assert.strictEqual(stringValue(null), undefined)
  })

  void it('returns undefined for undefined', () => {
    assert.strictEqual(stringValue(undefined), undefined)
  })
})

void describe('requireString', () => {
  void it('returns the string for non-empty strings', () => {
    assert.strictEqual(requireString('hello', 'Field'), 'hello')
  })

  void it('throws for empty strings', () => {
    assert.throws(
      () => requireString('', 'My Field'),
      { message: 'My Field is required.' }
    )
  })

  void it('throws for whitespace-only strings', () => {
    assert.throws(
      () => requireString('   ', 'Token'),
      { message: 'Token is required.' }
    )
  })

  void it('throws for undefined', () => {
    assert.throws(
      () => requireString(undefined, 'URL'),
      { message: 'URL is required.' }
    )
  })
})

void describe('createBrowserInstanceId', () => {
  void it('returns an ID prefixed with the lowercased browser name', () => {
    const id = createBrowserInstanceId('Chrome')
    assert.ok(id.startsWith('chrome-'))
  })

  void it('lowercases the browser name', () => {
    const id = createBrowserInstanceId('Safari')
    assert.ok(id.startsWith('safari-'))
  })

  void it('includes a UUID after the prefix', () => {
    const id = createBrowserInstanceId('Chrome')
    const uuid = id.slice('chrome-'.length)
    // UUID format: 8-4-4-4-12
    assert.match(uuid, /^[0-9a-f-]{36}$/)
  })
})

void describe('normalizeBridgeSettings', () => {
  void it('returns settings when all required fields are present', () => {
    const result = normalizeBridgeSettings(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        pairingToken: 'abc123',
        browserInstanceId: 'chrome-test-id',
        profileName: 'Work',
        label: 'Chrome Work'
      },
      'Chrome'
    )
    assert.deepStrictEqual(result, {
      websocketUrl: 'ws://127.0.0.1:8787',
      pairingToken: 'abc123',
      browserInstanceId: 'chrome-test-id',
      browserName: 'Chrome',
      profileName: 'Work',
      label: 'Chrome Work'
    })
  })

  void it('uses default browser name when not provided', () => {
    const result = normalizeBridgeSettings(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        pairingToken: 'abc123',
        browserInstanceId: 'chrome-test-id'
      },
      'Safari'
    )
    assert.strictEqual(result?.browserName, 'Safari')
  })

  void it('uses default profile name when not provided', () => {
    const result = normalizeBridgeSettings(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        pairingToken: 'abc123',
        browserInstanceId: 'chrome-test-id'
      },
      'Chrome'
    )
    assert.strictEqual(result?.profileName, 'Default')
  })

  void it('derives label from browserName + profileName when not provided', () => {
    const result = normalizeBridgeSettings(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        pairingToken: 'abc123',
        browserInstanceId: 'chrome-test-id',
        profileName: 'Work'
      },
      'Chrome'
    )
    assert.strictEqual(result?.label, 'Chrome Work')
  })

  void it('returns undefined when websocketUrl is missing', () => {
    const result = normalizeBridgeSettings(
      { pairingToken: 'abc123', browserInstanceId: 'test-id' },
      'Chrome'
    )
    assert.strictEqual(result, undefined)
  })

  void it('returns undefined when pairingToken is missing', () => {
    const result = normalizeBridgeSettings(
      { websocketUrl: 'ws://127.0.0.1:8787', browserInstanceId: 'test-id' },
      'Chrome'
    )
    assert.strictEqual(result, undefined)
  })

  void it('returns undefined when browserInstanceId is missing', () => {
    const result = normalizeBridgeSettings(
      { websocketUrl: 'ws://127.0.0.1:8787', pairingToken: 'abc123' },
      'Chrome'
    )
    assert.strictEqual(result, undefined)
  })

  void it('treats empty strings as missing', () => {
    const result = normalizeBridgeSettings(
      { websocketUrl: '', pairingToken: 'abc', browserInstanceId: 'id' },
      'Chrome'
    )
    assert.strictEqual(result, undefined)
  })
})
