import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createScopeKey } from './protocol.js'

void describe('WebSocket protocol helpers', () => {
  void it('creates stable non-token scope keys', () => {
    const first = createScopeKey('local-token')
    const second = createScopeKey('local-token')

    assert.equal(first, second)
    assert.notEqual(first, 'local-token')
    assert.match(first, /^[a-f0-9]{64}$/)
  })
})
