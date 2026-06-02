import assert from 'node:assert/strict'
import { describe, it, beforeEach, afterEach } from 'node:test'
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import http from 'node:http'
import {
  createEnvFromTemplate,
  readEnv,
  writeEnv,
  isPlaceholderToken,
  classifyEnv,
  generateConfig,
  healthCheck,
  printBanner,
  parseArgs,
  promptUser
} from './dev.mjs'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTempDir () {
  const dir = join(tmpdir(), `dev-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

function removeTempDir (dir) {
  try { rmSync(dir, { recursive: true, force: true }) } catch {}
}

const SAMPLE_ENV_EXAMPLE = [
  'WEBSOCKET_HOST=127.0.0.1',
  'WEBSOCKET_PORT=8787',
  'BROWSERBRIDGE_WEBSOCKET_URL=ws://127.0.0.1:8787',
  'BROWSERBRIDGE_REQUEST_TIMEOUT_MS=5000',
  'BROWSERBRIDGE_PAIRING_TOKEN=replace-with-generated-token',
  'BROWSERBRIDGE_BROWSER_INSTANCE_ID=',
  'MCP_HTTP_HOST=127.0.0.1',
  'MCP_HTTP_PORT=8788',
  'MCP_HTTP_PATH=/mcp',
  'MCP_HTTP_AUTH_TOKEN=replace-with-generated-mcp-token',
  'MCP_HTTP_ALLOWED_ORIGINS=',
  'TEST_PAGE_PORT=8080'
].join('\n') + '\n'

// ─── createEnvFromTemplate ────────────────────────────────────────────────────

void describe('createEnvFromTemplate', () => {
  let tmpDir

  beforeEach(() => { tmpDir = makeTempDir() })
  afterEach(() => { removeTempDir(tmpDir) })

  void it('copies .env.example to .env', () => {
    const templatePath = join(tmpDir, '.env.example')
    const envPath = join(tmpDir, '.env')
    writeFileSync(templatePath, SAMPLE_ENV_EXAMPLE)

    createEnvFromTemplate(templatePath, envPath)

    assert.ok(existsSync(envPath))
    assert.equal(readFileSync(envPath, 'utf8'), SAMPLE_ENV_EXAMPLE)
  })

  void it('throws if template does not exist', () => {
    assert.throws(() => {
      createEnvFromTemplate(join(tmpDir, 'nope'), join(tmpDir, '.env'))
    })
  })

  void it('does not overwrite an existing .env', () => {
    const templatePath = join(tmpDir, '.env.example')
    const envPath = join(tmpDir, '.env')
    writeFileSync(templatePath, SAMPLE_ENV_EXAMPLE)
    writeFileSync(envPath, 'EXISTING=true\n')

    createEnvFromTemplate(templatePath, envPath)
    assert.equal(readFileSync(envPath, 'utf8'), 'EXISTING=true\n')
  })
})

// ─── readEnv ──────────────────────────────────────────────────────────────────

void describe('readEnv', () => {
  let tmpDir

  beforeEach(() => { tmpDir = makeTempDir() })
  afterEach(() => { removeTempDir(tmpDir) })

  void it('parses key=value pairs', () => {
    const envPath = join(tmpDir, '.env')
    writeFileSync(envPath, 'FOO=bar\nBAZ=123\n')

    const result = readEnv(envPath)

    assert.deepEqual(result, { FOO: 'bar', BAZ: '123' })
  })

  void it('handles empty values', () => {
    const envPath = join(tmpDir, '.env')
    writeFileSync(envPath, 'EMPTY=\n')

    const result = readEnv(envPath)

    assert.deepEqual(result, { EMPTY: '' })
  })

  void it('preserves values with equals signs', () => {
    const envPath = join(tmpDir, '.env')
    writeFileSync(envPath, 'URL=ws://127.0.0.1:8787\n')

    const result = readEnv(envPath)

    assert.deepEqual(result, { URL: 'ws://127.0.0.1:8787' })
  })

  void it('ignores comments and blank lines', () => {
    const envPath = join(tmpDir, '.env')
    writeFileSync(envPath, '# comment\n\nKEY=val\n')

    const result = readEnv(envPath)

    assert.deepEqual(result, { KEY: 'val' })
  })

  void it('returns empty object for missing file', () => {
    const result = readEnv(join(tmpDir, 'nope'))

    assert.deepEqual(result, {})
  })
})

// ─── writeEnv ─────────────────────────────────────────────────────────────────

void describe('writeEnv', () => {
  let tmpDir

  beforeEach(() => { tmpDir = makeTempDir() })
  afterEach(() => { removeTempDir(tmpDir) })

  void it('updates values while preserving order and comments', () => {
    const envPath = join(tmpDir, '.env')
    writeFileSync(envPath, '# header\nFOO=old\nBAR=keep\n')

    writeEnv(envPath, { FOO: 'new', BAR: 'keep' })

    const content = readFileSync(envPath, 'utf8')
    assert.match(content, /^# header$/m)
    assert.match(content, /^FOO=new$/m)
    assert.match(content, /^BAR=keep$/m)
  })

  void it('adds new keys at the end', () => {
    const envPath = join(tmpDir, '.env')
    writeFileSync(envPath, 'FOO=bar\n')

    writeEnv(envPath, { FOO: 'bar', NEW: 'val' })

    const content = readFileSync(envPath, 'utf8')
    assert.match(content, /^NEW=val$/m)
  })

  void it('creates file if it does not exist', () => {
    const envPath = join(tmpDir, '.env')

    writeEnv(envPath, { KEY: 'val' })

    const content = readFileSync(envPath, 'utf8')
    assert.match(content, /^KEY=val$/m)
  })
})

// ─── isPlaceholderToken ──────────────────────────────────────────────────────

void describe('isPlaceholderToken', () => {
  void it('detects pairing placeholder', () => {
    assert.equal(isPlaceholderToken('replace-with-generated-token'), true)
  })

  void it('detects mcp placeholder', () => {
    assert.equal(isPlaceholderToken('replace-with-generated-mcp-token'), true)
  })

  void it('rejects real tokens', () => {
    assert.equal(isPlaceholderToken('abc123XYZ_-very-long-base64url-string'), false)
  })

  void it('rejects empty string', () => {
    assert.equal(isPlaceholderToken(''), false)
  })

  void it('rejects partial matches', () => {
    assert.equal(isPlaceholderToken('replace-with-generated'), false)
    assert.equal(isPlaceholderToken('my-replace-with-generated-token'), false)
  })
})

// ─── generateConfig ────────────────────────────────────────────────────────────

void describe('generateConfig', () => {
  void it('generates a full config with tokens', () => {
    const config = generateConfig()

    assert.equal(config.WEBSOCKET_HOST, '0.0.0.0')
    assert.equal(config.MCP_HTTP_HOST, '0.0.0.0')
    assert.match(config.BROWSERBRIDGE_PAIRING_TOKEN, /^[A-Za-z0-9_-]{43}$/)
    assert.match(config.MCP_HTTP_AUTH_TOKEN, /^[A-Za-z0-9_-]{43}$/)
    assert.equal(config.BROWSERBRIDGE_WEBSOCKET_URL, 'ws://127.0.0.1:8787')
  })

  void it('preserves ports and other values from defaults', () => {
    const config = generateConfig()

    assert.equal(config.WEBSOCKET_PORT, '8787')
    assert.equal(config.MCP_HTTP_PORT, '8788')
    assert.equal(config.MCP_HTTP_PATH, '/mcp')
  })
})

// ─── healthCheck ──────────────────────────────────────────────────────────────

void describe('healthCheck', () => {
  let server

  afterEach(() => {
    if (server) {
      server.close()
      server = null
    }
  })

  void it('resolves when server responds 200', async () => {
    server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok' }))
    })
    await new Promise(resolve => server.listen(0, resolve))
    const port = server.address().port

    const result = await healthCheck(`http://127.0.0.1:${port}/health`, 5000, 100)

    assert.equal(result, true)
  })

  void it('resolves after retries when server initially returns 500', async () => {
    let callCount = 0
    server = http.createServer((_req, res) => {
      callCount++
      if (callCount < 3) {
        res.writeHead(500)
        res.end('not ready')
      } else {
        res.writeHead(200)
        res.end('ok')
      }
    })
    await new Promise(resolve => server.listen(0, resolve))
    const port = server.address().port

    const result = await healthCheck(`http://127.0.0.1:${port}/health`, 5000, 100)

    assert.equal(result, true)
  })

  void it('returns false on timeout', async () => {
    // Port 1 is privileged / unreachable on most systems
    const result = await healthCheck('http://127.0.0.1:1/health', 500, 100)

    assert.equal(result, false)
  })
})

// ─── printBanner ──────────────────────────────────────────────────────────────

void describe('printBanner', () => {
  void it('prints a formatted banner with config values', () => {
    const lines = []
    const mockStdout = { write: (s) => { lines.push(s) } }
    const mockStderr = { write: (s) => { lines.push(s) } }

    printBanner({
      WEBSOCKET_HOST: '0.0.0.0',
      MCP_HTTP_HOST: '0.0.0.0',
      WEBSOCKET_PORT: '8787',
      MCP_HTTP_PORT: '8788',
      MCP_HTTP_PATH: '/mcp',
      BROWSERBRIDGE_PAIRING_TOKEN: 'pair-abc123',
      MCP_HTTP_AUTH_TOKEN: 'auth-xyz789'
    }, mockStdout, mockStderr)

    const output = lines.join('')
    assert.match(output, /🚀 BrowserBridge/)
    assert.match(output, /pair-abc123/)
    assert.match(output, /auth-xyz789/)
    assert.match(output, /Ctrl\+C/)
  })

  void it('displays localhost instead of 0.0.0.0', () => {
    const lines = []
    const mockStdout = { write: (s) => { lines.push(s) } }
    const mockStderr = { write: (s) => { lines.push(s) } }

    printBanner({
      WEBSOCKET_HOST: '0.0.0.0',
      MCP_HTTP_HOST: '0.0.0.0',
      WEBSOCKET_PORT: '8787',
      MCP_HTTP_PORT: '8788',
      MCP_HTTP_PATH: '/mcp',
      BROWSERBRIDGE_PAIRING_TOKEN: 'pair-abc123',
      MCP_HTTP_AUTH_TOKEN: 'auth-xyz789'
    }, mockStdout, mockStderr)

    const output = lines.join('')
    assert.match(output, /ws:\/\/localhost:8787/)
    assert.match(output, /http:\/\/localhost:8788\/mcp/)
    assert.doesNotMatch(output, /0\.0\.0\.0/)
  })

  void it('masks tokens when maskTokens is true', () => {
    const lines = []
    const mockStdout = { write: (s) => { lines.push(s) } }
    const mockStderr = { write: (s) => { lines.push(s) } }

    printBanner({
      WEBSOCKET_HOST: '0.0.0.0',
      MCP_HTTP_HOST: '0.0.0.0',
      WEBSOCKET_PORT: '8787',
      MCP_HTTP_PORT: '8788',
      MCP_HTTP_PATH: '/mcp',
      BROWSERBRIDGE_PAIRING_TOKEN: 'pair-abc123',
      MCP_HTTP_AUTH_TOKEN: 'auth-xyz789'
    }, mockStdout, mockStderr, true)

    const output = lines.join('')
    assert.match(output, /pai\*\*\*/)
    assert.match(output, /aut\*\*\*/)
    assert.doesNotMatch(output, /pair-abc123/)
    assert.doesNotMatch(output, /auth-xyz789/)
  })
})

// ─── parseArgs ────────────────────────────────────────────────────────────────

void describe('parseArgs', () => {
  void it('defaults to non-interactive false', () => {
    const result = parseArgs([])

    assert.equal(result.nonInteractive, false)
  })

  void it('sets nonInteractive with --yes', () => {
    const result = parseArgs(['--yes'])

    assert.equal(result.nonInteractive, true)
  })

  void it('sets nonInteractive with -y', () => {
    const result = parseArgs(['-y'])

    assert.equal(result.nonInteractive, true)
  })

  void it('ignores other arguments', () => {
    const result = parseArgs(['some', 'other', 'args'])

    assert.equal(result.nonInteractive, false)
  })
})

// ─── promptUser ───────────────────────────────────────────────────────────────

void describe('promptUser', () => {
  void it('asks questions and collects answers', async () => {
    const answers = ['yes']
    let inputIndex = 0
    const mockCreateInterface = () => ({
      question: (_prompt) => {
        const idx = inputIndex
        inputIndex++
        return Promise.resolve(answers[idx])
      },
      close: () => {}
    })

    const result = await promptUser(
      [
        { name: 'confirmReset', message: 'Reset tokens?', default: 'no' }
      ],
      mockCreateInterface
    )

    assert.equal(result.confirmReset, 'yes')
  })

  void it('uses default values for empty answers', async () => {
    let inputIndex = 0
    const mockCreateInterface = () => ({
      question: (_prompt) => {
        inputIndex++
        return Promise.resolve('')
      },
      close: () => {}
    })

    const result = await promptUser(
      [
        { name: 'confirmReset', message: 'Reset tokens?', default: 'no' }
      ],
      mockCreateInterface
    )

    assert.equal(result.confirmReset, 'no')
  })
})

// ─── classifyEnv ─────────────────────────────────────────────────────────────

void describe('classifyEnv', () => {
  void it('returns "placeholders" when tokens are placeholder values', () => {
    const env = {
      BROWSERBRIDGE_PAIRING_TOKEN: 'replace-with-generated-token',
      MCP_HTTP_AUTH_TOKEN: 'replace-with-generated-mcp-token'
    }
    assert.equal(classifyEnv(env), 'placeholders')
  })

  void it('returns "configured" when tokens are real values', () => {
    const env = {
      BROWSERBRIDGE_PAIRING_TOKEN: 'real-pairing-token-value',
      MCP_HTTP_AUTH_TOKEN: 'real-mcp-auth-token-value'
    }
    assert.equal(classifyEnv(env), 'configured')
  })

  void it('returns "incomplete" when tokens are empty or missing', () => {
    assert.equal(classifyEnv({}), 'incomplete')
    assert.equal(classifyEnv({ BROWSERBRIDGE_PAIRING_TOKEN: '', MCP_HTTP_AUTH_TOKEN: '' }), 'incomplete')
    assert.equal(classifyEnv({ BROWSERBRIDGE_PAIRING_TOKEN: 'real-token' }), 'incomplete')
  })
})