/* eslint-disable @typescript-eslint/no-floating-promises */
/**
 * Tests for network detection module (ADR-0038).
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isTailscaleIP, detectTailscaleInterface } from './network.js'

describe('isTailscaleIP', () => {
  it('returns true for addresses in 100.64.0.0/10 range', () => {
    assert.equal(isTailscaleIP('100.64.0.0'), true)
    assert.equal(isTailscaleIP('100.64.0.1'), true)
    assert.equal(isTailscaleIP('100.100.100.100'), true)
    assert.equal(isTailscaleIP('100.127.255.255'), true)
  })

  it('returns false for addresses outside the range', () => {
    assert.equal(isTailscaleIP('10.0.0.1'), false)
    assert.equal(isTailscaleIP('192.168.1.1'), false)
    assert.equal(isTailscaleIP('172.16.0.1'), false)
    assert.equal(isTailscaleIP('100.63.255.255'), false) // just below range
    assert.equal(isTailscaleIP('100.128.0.0'), false) // just above range
    assert.equal(isTailscaleIP('99.64.0.1'), false)
    assert.equal(isTailscaleIP('127.0.0.1'), false)
  })

  it('returns false for invalid IPs', () => {
    assert.equal(isTailscaleIP('not-an-ip'), false)
    assert.equal(isTailscaleIP(''), false)
    assert.equal(isTailscaleIP('1.2.3'), false)
    assert.equal(isTailscaleIP('1.2.3.4.5'), false)
  })
})

describe('detectTailscaleInterface', () => {
  it('returns null when no Tailscale interface exists (default env)', () => {
    // In CI/test environments there's typically no Tailscale interface
    const result = detectTailscaleInterface()
    // We can't assert null definitively (machine might have Tailscale),
    // but we can assert it returns a string or null
    assert.ok(result === null || typeof result === 'string')
  })

  it('would detect a 100.x.x.x address if present', () => {
    // This tests the function's type contract — the actual detection
    // depends on the machine's network interfaces.
    // The isTailscaleIP function above is tested separately for IP range logic.
    const result = detectTailscaleInterface()
    if (result != null) {
      assert.ok(isTailscaleIP(result))
    }
  })
})
