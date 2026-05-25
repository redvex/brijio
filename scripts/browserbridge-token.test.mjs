import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { generatePairingToken } from './browserbridge-token.mjs'

void describe('browserbridge token generator', () => {
  void it('generates a high-entropy url-safe token', () => {
    const token = generatePairingToken()

    assert.match(token, /^[A-Za-z0-9_-]{43}$/)
  })

  void it('generates non-repeating tokens', () => {
    const tokens = new Set(
      Array.from({ length: 100 }, () => generatePairingToken())
    )

    assert.equal(tokens.size, 100)
  })
})
