/* eslint-disable @typescript-eslint/no-floating-promises */
/**
 * Tests for print-config module (ADR-0038).
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveAgentName, AGENTS, formatConfig, formatDefaultJson, formatInteractivePrompt } from './print-config.js'

const defaultOpts = {
  mcpUrl: 'http://localhost:8788/mcp',
  wsUrl: 'ws://localhost:8787',
  authToken: 'test-token-123',
  authTokenEnvVar: 'MCP_HTTP_AUTH_TOKEN',
  isEphemeral: false,
  isDev: false
}

describe('resolveAgentName', () => {
  it('resolves canonical names', () => {
    assert.equal(resolveAgentName('claude-desktop'), 'claude-desktop')
    assert.equal(resolveAgentName('cursor'), 'cursor')
    assert.equal(resolveAgentName('vscode'), 'vscode')
    assert.equal(resolveAgentName('codex'), 'codex')
    assert.equal(resolveAgentName('goose'), 'goose')
  })

  it('resolves aliases', () => {
    assert.equal(resolveAgentName('claude'), 'claude-desktop')
    assert.equal(resolveAgentName('cur'), 'cursor')
    assert.equal(resolveAgentName('vs'), 'vscode')
    assert.equal(resolveAgentName('code'), 'claude-code')
  })

  it('is case-insensitive', () => {
    assert.equal(resolveAgentName('Cursor'), 'cursor')
    assert.equal(resolveAgentName('VSCODE'), 'vscode')
  })

  it('returns null for unknown agents', () => {
    assert.equal(resolveAgentName('unknown'), null)
    assert.equal(resolveAgentName('foo'), null)
  })
})

describe('AGENTS array', () => {
  it('has 12 agents', () => {
    assert.equal(AGENTS.length, 12)
  })

  it('every agent has a name and label', () => {
    for (const agent of AGENTS) {
      assert.ok(agent.name, `Agent missing name: ${JSON.stringify(agent)}`)
      assert.ok(agent.label, `Agent missing label: ${JSON.stringify(agent)}`)
    }
  })
})

describe('formatConfig', () => {
  it('throws for unknown agent', () => {
    assert.throws(() => formatConfig('unknown', defaultOpts), /Unknown agent/)
  })

  it('formats claude-desktop as MCP JSON', () => {
    const result = formatConfig('claude-desktop', defaultOpts)
    assert.ok(result.stdout.includes('"mcpServers"'))
    assert.ok(result.stdout.includes('test-token-123'))
    assert.ok(result.stdout.includes('http://localhost:8788/mcp'))
  })

  it('formats vscode with type: http', () => {
    const result = formatConfig('vscode', defaultOpts)
    assert.ok(result.stdout.includes('"type": "http"'))
    assert.ok(result.stdout.includes('"servers"'))
  })

  it('formats codex as shell command', () => {
    const result = formatConfig('codex', defaultOpts)
    assert.ok(result.stdout.includes('codex mcp add'))
    assert.ok(result.stdout.includes('MCP_HTTP_AUTH_TOKEN'))
  })

  it('formats claude-code as shell command', () => {
    const result = formatConfig('claude-code', defaultOpts)
    assert.ok(result.stdout.includes('claude mcp add'))
    assert.ok(result.stdout.includes('test-token-123'))
  })

  it('formats gemini as shell command', () => {
    const result = formatConfig('gemini', defaultOpts)
    assert.ok(result.stdout.includes('gemini mcp add'))
  })

  it('formats goose as "not supported" message', () => {
    const result = formatConfig('goose', defaultOpts)
    assert.ok(result.stdout.includes('not supported') || result.stdout.includes('Not supported') || result.stdout.includes('stdio'))
  })

  it('formats windsurf with serverUrl', () => {
    const result = formatConfig('windsurf', defaultOpts)
    const parsed = JSON.parse(result.stdout)
    assert.ok(parsed.mcpServers.brijio.serverUrl)
  })

  it('formats zed with context_servers', () => {
    const result = formatConfig('zed', defaultOpts)
    assert.ok(result.stdout.includes('context_servers'))
  })

  it('formats continue as YAML', () => {
    const result = formatConfig('continue', defaultOpts)
    assert.ok(result.stdout.includes('name:'))
    assert.ok(result.stdout.includes('streamable-http'))
  })

  it('formats hermes as YAML', () => {
    const result = formatConfig('hermes', defaultOpts)
    assert.ok(result.stdout.includes('mcp_servers:'))
    assert.ok(result.stdout.includes('Bearer test-token-123'))
  })

  it('includes ephemeral note when isEphemeral is true', () => {
    const ephemeralOpts = { ...defaultOpts, isEphemeral: true }
    const result = formatConfig('codex', ephemeralOpts)
    assert.ok(result.stdout.includes('ephemeral'))
  })

  it('formats hermes as YAML with ephemeral note', () => {
    const ephemeralOpts = { ...defaultOpts, isEphemeral: true }
    const result = formatConfig('hermes', ephemeralOpts)
    assert.ok(result.stdout.includes('ephemeral'))
  })
})

describe('formatDefaultJson', () => {
  it('produces mcpServers JSON', () => {
    const result = formatDefaultJson(defaultOpts)
    assert.ok(result.stdout.includes('"mcpServers"'))
    assert.ok(result.stdout.includes('brijio'))
  })
})

describe('formatInteractivePrompt', () => {
  it('lists all 12 agents numbered 1-12', () => {
    const prompt = formatInteractivePrompt()
    for (let i = 1; i <= 12; i++) {
      assert.ok(prompt.includes(`${i}.`), `Missing number ${i}`)
    }
  })

  it('includes agent names', () => {
    const prompt = formatInteractivePrompt()
    for (const agent of AGENTS) {
      assert.ok(prompt.includes(agent.name), `Missing agent name: ${agent.name}`)
    }
  })
})
