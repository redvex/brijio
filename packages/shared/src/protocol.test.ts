import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createAuthEnvelope,
  createBrowserPresenceAnnounceEnvelope,
  createBrowserPresenceRequestEnvelope,
  createScopeKey,
  parseBrowserBridgeEnvelope
} from './protocol.js'

void describe('shared BrowserBridge protocol', () => {
  void it('creates stable non-token scope keys', () => {
    const first = createScopeKey('local-token')
    const second = createScopeKey('local-token')

    assert.equal(first, second)
    assert.notEqual(first, 'local-token')
    assert.match(first, /^[a-f0-9]{64}$/)
  })

  void it('parses auth envelopes', () => {
    const envelope = createAuthEnvelope({
      requestId: 'auth-1',
      token: 'local-token',
      role: 'extension'
    })

    assert.deepEqual(parseBrowserBridgeEnvelope(JSON.stringify(envelope)), {
      ok: true,
      message: envelope
    })
  })

  void it('parses browser presence request envelopes', () => {
    const envelope = createBrowserPresenceRequestEnvelope('presence-1')

    assert.deepEqual(parseBrowserBridgeEnvelope(JSON.stringify(envelope)), {
      ok: true,
      message: envelope
    })
  })

  void it('parses browser presence announce envelopes', () => {
    const envelope = createBrowserPresenceAnnounceEnvelope({
      requestId: 'presence-2',
      browserInstanceId: 'chrome-default-abc123',
      label: 'Chrome Default',
      browserName: 'Chrome',
      profileName: 'Default',
      capabilities: ['page_context', 'click']
    })

    assert.deepEqual(parseBrowserBridgeEnvelope(JSON.stringify(envelope)), {
      ok: true,
      message: envelope
    })
  })

  void it('rejects invalid JSON', () => {
    assert.deepEqual(parseBrowserBridgeEnvelope('{not json'), {
      ok: false,
      error: {
        type: 'error',
        error: {
          code: 'invalid_json',
          message: 'Message must be valid JSON.'
        }
      }
    })
  })
})
