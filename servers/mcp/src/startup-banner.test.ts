/* eslint-disable @typescript-eslint/no-floating-promises */
/**
 * Tests for startup banner module (ADR-0038).
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatStartupBanner } from './startup-banner.js'

describe('formatStartupBanner', () => {
  it('includes the Brijio header', async () => {
    const banner = await formatStartupBanner({
      wsPort: 8787,
      mcpPort: 8788,
      mcpPath: '/mcp',
      pairingToken: 'test-pair',
      authToken: 'test-auth',
      pairingTokenProvided: true,
      authTokenProvided: true,
      dev: false
    })
    assert.ok(banner.includes('Brijio'))
  })

  it('shows a reachable URL (localhost or 127.0.0.1)', async () => {
    const banner = await formatStartupBanner({
      wsPort: 8787,
      mcpPort: 8788,
      mcpPath: '/mcp',
      pairingToken: 'pair',
      authToken: 'auth',
      pairingTokenProvided: true,
      authTokenProvided: true,
      dev: false
    })
    assert.ok(banner.includes('localhost') || banner.includes('127.0.0.1'))
  })

  it('marks ephemeral tokens', async () => {
    const banner = await formatStartupBanner({
      wsPort: 8787,
      mcpPort: 8788,
      mcpPath: '/mcp',
      pairingToken: 'pair',
      authToken: 'auth',
      pairingTokenProvided: false,
      authTokenProvided: false,
      dev: false
    })
    assert.ok(banner.includes('ephemeral') || banner.includes('auto-generated'))
  })

  it('shows dev mode indicator when dev is true', async () => {
    const banner = await formatStartupBanner({
      wsPort: 8787,
      mcpPort: 8788,
      mcpPath: '/mcp',
      pairingToken: 'pair',
      authToken: 'auth',
      pairingTokenProvided: true,
      authTokenProvided: true,
      dev: true
    })
    assert.ok(banner.includes('dev') || banner.includes('Dev'))
  })
})
