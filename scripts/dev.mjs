import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir, hostname } from 'node:os'
import { spawn } from 'node:child_process'
import http from 'node:http'
import { generatePairingToken, generateAuthToken } from './token-utils.mjs'

// ─── Constants ────────────────────────────────────────────────────────────────

const PLACEHOLDER_PAIRING = 'replace-with-generated-token'
const PLACEHOLDER_MCP = 'replace-with-generated-mcp-token'
const WS_PORT = 8787
const MCP_PORT = 8788
const HEALTH_TIMEOUT_MS = 15000
const HEALTH_INTERVAL_MS = 500
const MAX_RESTART_ATTEMPTS = 5
const RESTART_BACKOFF_MS = 2000
const SHUTDOWN_GRACE_MS = 5000

// ─── .env helpers ─────────────────────────────────────────────────────────────

export function createEnvFromTemplate (templatePath, envPath) {
  if (existsSync(envPath)) return
  if (!existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`)
  }
  copyFileSync(templatePath, envPath)
}

export function readEnv (envPath) {
  if (!existsSync(envPath)) return {}
  const content = readFileSync(envPath, 'utf8')
  const result = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex)
    const value = trimmed.slice(eqIndex + 1)
    result[key] = value
  }
  return result
}

export function writeEnv (envPath, config) {
  let content = ''
  if (existsSync(envPath)) {
    content = readFileSync(envPath, 'utf8')
  }

  const lines = content.split('\n')
  const written = new Set()

  // Update existing lines preserving order and comments
  const updated = lines.map(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return line
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) return line
    const key = trimmed.slice(0, eqIndex)
    if (key in config) {
      written.add(key)
      return `${key}=${config[key]}`
    }
    return line
  })

  // Append new keys that weren't in the file
  for (const key of Object.keys(config)) {
    if (!written.has(key)) {
      updated.push(`${key}=${config[key]}`)
    }
  }

  writeFileSync(envPath, updated.join('\n'))
}

// ─── Token detection ──────────────────────────────────────────────────────────

export function isPlaceholderToken (value) {
  if (!value) return false
  return value === PLACEHOLDER_PAIRING || value === PLACEHOLDER_MCP
}

// ─── Host derivation ──────────────────────────────────────────────────────────

function getTailscaleHostname () {
  // Try reading ~/.tailscale-hostname
  const tsFile = join(homedir(), '.tailscale-hostname')
  try {
    const name = readFileSync(tsFile, 'utf8').trim()
    if (name) return name
  } catch {}

  // Fall back to os.hostname() + .local
  return hostname() + '.local'
}

export function deriveHosts (allowLocalHosts, allowTailscaleHosts) {
  const useLocalhost = !allowLocalHosts && !allowTailscaleHosts
  const bindingHost = useLocalhost ? '127.0.0.1' : '0.0.0.0'

  const allowParts = ['127.0.0.1', 'localhost']
  if (allowLocalHosts) {
    allowParts.push('*.local')
  }
  if (allowTailscaleHosts) {
    allowParts.push(getTailscaleHostname())
  }

  return {
    WEBSOCKET_HOST: bindingHost,
    MCP_HTTP_HOST: bindingHost,
    MCP_HTTP_ALLOWED_HOSTS: allowParts.join(',')
  }
}

// ─── Config generation ─────────────────────────────────────────────────────────

export function generateConfig ({ allowLocalHosts = false, allowTailscaleHosts = false } = {}) {
  const hosts = deriveHosts(allowLocalHosts, allowTailscaleHosts)

  return {
    WEBSOCKET_HOST: hosts.WEBSOCKET_HOST,
    WEBSOCKET_PORT: '8787',
    BROWSERBRIDGE_WEBSOCKET_URL: `ws://${hosts.WEBSOCKET_HOST}:8787`,
    BROWSERBRIDGE_REQUEST_TIMEOUT_MS: '5000',
    BROWSERBRIDGE_PAIRING_TOKEN: generatePairingToken(),
    BROWSERBRIDGE_BROWSER_INSTANCE_ID: '',
    MCP_HTTP_HOST: hosts.MCP_HTTP_HOST,
    MCP_HTTP_PORT: '8788',
    MCP_HTTP_PATH: '/mcp',
    MCP_HTTP_AUTH_TOKEN: generateAuthToken(),
    MCP_HTTP_ALLOWED_HOSTS: hosts.MCP_HTTP_ALLOWED_HOSTS,
    MCP_HTTP_ALLOWED_ORIGINS: '',
    MCP_HTTP_ALLOW_TAILSCALE_HOSTS: String(allowTailscaleHosts),
    MCP_HTTP_ALLOW_LOCAL_HOSTS: String(allowLocalHosts),
    TEST_PAGE_PORT: '8080'
  }
}

// ─── Health check ──────────────────────────────────────────────────────────────

export async function healthCheck (url, timeoutMs = HEALTH_TIMEOUT_MS, intervalMs = HEALTH_INTERVAL_MS) {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          resolve(res)
        })
        req.on('error', reject)
        req.setTimeout(2000, () => {
          req.destroy()
          reject(new Error('timeout'))
        })
      })

      if (response.statusCode === 200) {
        // Consume the body to free the socket
        response.resume()
        return true
      }
      // Consume body for non-200 too
      response.resume()
    } catch {
      // Connection refused or timeout, retry
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }

  return false
}

// ─── Banner ────────────────────────────────────────────────────────────────────

function maskToken (token) {
  if (!token || token.length < 4) return '****'
  return token.slice(0, 3) + '***'
}

export function printBanner (config, stdout = process.stdout, stderr = process.stderr, maskTokens = false) {
  const wsHost = config.WEBSOCKET_HOST || '127.0.0.1'
  const mcpHost = config.MCP_HTTP_HOST || '127.0.0.1'
  const wsPort = config.WEBSOCKET_PORT || '8787'
  const mcpPort = config.MCP_HTTP_PORT || '8788'
  const mcpPath = config.MCP_HTTP_PATH || '/mcp'
  const pairingToken = config.BROWSERBRIDGE_PAIRING_TOKEN || ''
  const authToken = config.MCP_HTTP_AUTH_TOKEN || ''

  // Display localhost instead of 0.0.0.0 for readability
  const displayWsHost = wsHost === '0.0.0.0' ? 'localhost' : wsHost
  const displayMcpHost = mcpHost === '0.0.0.0' ? 'localhost' : mcpHost

  const displayPairing = maskTokens ? maskToken(pairingToken) : pairingToken
  const displayAuth = maskTokens ? maskToken(authToken) : authToken

  const lines = [
    '',
    '🚀 BrowserBridge dev servers ready!',
    '',
    `  WebSocket:    ws://${displayWsHost}:${wsPort}`,
    `  MCP:         http://${displayMcpHost}:${mcpPort}${mcpPath}`,
    '',
    `  Pairing Token:    ${displayPairing}`,
    `  MCP Auth Token:   ${displayAuth}`,
    '',
    '  Connect your browser extension using the Pairing Token above.',
    '  Configure your MCP client with the MCP URL and Auth Token.',
    '',
    '  Press Ctrl+C to stop all servers.',
    ''
  ]

  const output = lines.join('\n')
  stdout.write(output + '\n')
  stderr.write(output + '\n')
}

// ─── Args parsing ──────────────────────────────────────────────────────────────

export function parseArgs (args) {
  return {
    nonInteractive: args.includes('--yes') || args.includes('-y')
  }
}

// ─── Interactive prompt ────────────────────────────────────────────────────────

export async function promptUser (questions, createInterface = null) {
  const results = {}

  if (!createInterface) {
    const { createInterface: rlCreate } = await import('node:readline')
    const { stdin, stdout } = process
    createInterface = (opts) => rlCreate({ input: stdin, output: stdout, ...opts })
  }

  const rl = createInterface()

  for (const q of questions) {
    const answer = await rl.question(`${q.message} [${q.default}]: `)
    results[q.name] = answer.trim() || q.default
  }

  if (rl.close) rl.close()

  return results
}

// ─── Classify existing .env ────────────────────────────────────────────────────

function classifyEnv (env) {
  const pairing = env.BROWSERBRIDGE_PAIRING_TOKEN || ''
  const mcpAuth = env.MCP_HTTP_AUTH_TOKEN || ''

  if (isPlaceholderToken(pairing) || isPlaceholderToken(mcpAuth)) {
    return 'placeholders'
  }
  if (pairing && mcpAuth) {
    return 'configured'
  }
  return 'incomplete'
}

// ─── Setup .env ────────────────────────────────────────────────────────────────

async function setupEnv (envPath, templatePath, nonInteractive) {
  const projectRoot = join(envPath, '..')

  if (!existsSync(envPath)) {
    console.log('No .env found. Creating from template...')
    createEnvFromTemplate(templatePath, envPath)
  }

  const env = readEnv(envPath)
  const state = classifyEnv(env)

  let allowLocalHosts = false
  let allowTailscaleHosts = false
  let regenerateTokens = true

  if (state === 'configured') {
    // Show current config with masked tokens
    console.log('')
    console.log('Found existing .env configuration:')
    const displayWsHost = (env.WEBSOCKET_HOST || '127.0.0.1') === '0.0.0.0' ? 'localhost' : (env.WEBSOCKET_HOST || '127.0.0.1')
    const displayMcpHost = (env.MCP_HTTP_HOST || '127.0.0.1') === '0.0.0.0' ? 'localhost' : (env.MCP_HTTP_HOST || '127.0.0.1')
    console.log(`  WebSocket:    ws://${displayWsHost}:${env.WEBSOCKET_PORT || '8787'}`)
    console.log(`  MCP:         http://${displayMcpHost}:${env.MCP_HTTP_PORT || '8788'}${env.MCP_HTTP_PATH || '/mcp'}`)
    console.log(`  Pairing Token:    ${maskToken(env.BROWSERBRIDGE_PAIRING_TOKEN || '')}`)
    console.log(`  MCP Auth Token:   ${maskToken(env.MCP_HTTP_AUTH_TOKEN || '')}`)

    if (nonInteractive) {
      regenerateTokens = false
    } else {
      const answer = await promptUser([
        { name: 'regen', message: 'Re-generate tokens? (y/N)', default: 'N' }
      ])
      regenerateTokens = answer.regen.toLowerCase() === 'y' || answer.regen.toLowerCase() === 'yes'
    }

    if (!regenerateTokens) {
      console.log('Keeping existing tokens.')
      return env
    }
  } else if (state === 'placeholders') {
    console.log('Found .env with placeholder tokens.')
  } else {
    console.log('Found incomplete .env.')
  }

  // Ask network questions
  if (nonInteractive) {
    // Defaults: localhost-only
  } else {
    const answers = await promptUser([
      { name: 'allowLocalHosts', message: 'Allow local network connections (*.local)? (true/false)', default: 'false' },
      { name: 'allowTailscaleHosts', message: 'Allow Tailscale connections? (true/false)', default: 'false' }
    ])
    allowLocalHosts = answers.allowLocalHosts === 'true'
    allowTailscaleHosts = answers.allowTailscaleHosts === 'true'
  }

  // Generate config
  const config = generateConfig({ allowLocalHosts, allowTailscaleHosts })

  // Merge with existing env preserving values we don't override
  const merged = { ...env, ...config }

  // Ensure placeholders are replaced by generated tokens
  if (isPlaceholderToken(merged.BROWSERBRIDGE_PAIRING_TOKEN)) {
    merged.BROWSERBRIDGE_PAIRING_TOKEN = config.BROWSERBRIDGE_PAIRING_TOKEN
  }
  if (isPlaceholderToken(merged.MCP_HTTP_AUTH_TOKEN)) {
    merged.MCP_HTTP_AUTH_TOKEN = config.MCP_HTTP_AUTH_TOKEN
  }

  writeEnv(envPath, merged)
  console.log('.env updated successfully.')

  return merged
}

// ─── Process spawning ──────────────────────────────────────────────────────────

function startServer (name, command, args, env, restartCount = { ws: 0, mcp: 0 }) {
  const child = spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: process.cwd()
  })

  const prefix = name === 'ws' ? '[ws]' : '[mcp]'

  child.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n')
    for (const line of lines) {
      if (line) process.stdout.write(`${prefix} ${line}\n`)
    }
  })

  child.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n')
    for (const line of lines) {
      if (line) process.stderr.write(`${prefix} ${line}\n`)
    }
  })

  child.on('exit', (code, signal) => {
    if (shuttingDown) return

    const key = name
    restartCount[key] = (restartCount[key] || 0) + 1

    if (restartCount[key] > MAX_RESTART_ATTEMPTS) {
      console.error(`${prefix} exceeded max restart attempts (${MAX_RESTART_ATTEMPTS}). Exiting.`)
      process.exit(1)
    }

    console.error(`${prefix} process exited (code=${code}, signal=${signal}). Restarting in ${RESTART_BACKOFF_MS}ms... (attempt ${restartCount[key]}/${MAX_RESTART_ATTEMPTS})`)
    setTimeout(() => {
      if (!shuttingDown) {
        children[name] = startServer(name, command, args, env, restartCount)
      }
    }, RESTART_BACKOFF_MS)
  })

  return child
}

// ─── Graceful shutdown ──────────────────────────────────────────────────────────

let shuttingDown = false
let children = {}

function gracefulShutdown () {
  if (shuttingDown) return
  shuttingDown = true

  console.log('\nShutting down...')

  const childList = Object.values(children).filter(Boolean)

  // Send SIGTERM to all children
  for (const child of childList) {
    try { child.kill('SIGTERM') } catch {}
  }

  // Give them 5s to exit, then SIGKILL
  const forceTimer = setTimeout(() => {
    for (const child of childList) {
      try { child.kill('SIGKILL') } catch {}
    }
    process.exit(0)
  }, SHUTDOWN_GRACE_MS)

  // If all children exit before timeout, exit immediately
  let exited = 0
  for (const child of childList) {
    child.on('exit', () => {
      exited++
      if (exited === childList.length) {
        clearTimeout(forceTimer)
        process.exit(0)
      }
    })
  }

  if (childList.length === 0) {
    clearTimeout(forceTimer)
    process.exit(0)
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main () {
  const args = process.argv.slice(2)
  const { nonInteractive } = parseArgs(args)

  const isNonInteractive = nonInteractive || process.env.CI === 'true'

  const projectRoot = import.meta.dirname
  const envPath = join(projectRoot, '..', '.env')
  const templatePath = join(projectRoot, '..', '.env.example')

  // Setup .env
  const envConfig = await setupEnv(envPath, templatePath, isNonInteractive)

  // Build env for child processes
  const childEnv = {
    BROWSERBRIDGE_PAIRING_TOKEN: envConfig.BROWSERBRIDGE_PAIRING_TOKEN,
    MCP_HTTP_AUTH_TOKEN: envConfig.MCP_HTTP_AUTH_TOKEN
  }

  // Spawn servers
  console.log('Starting servers...')

  const restartCount = { ws: 0, mcp: 0 }
  children.ws = startServer('ws', 'npx', ['tsx', 'watch', 'servers/websocket/src/index.ts'], childEnv, restartCount)
  children.mcp = startServer('mcp', 'npx', ['tsx', 'watch', 'servers/mcp/src/index.ts'], childEnv, restartCount)

  // Health checks
  const wsHost = envConfig.WEBSOCKET_HOST || '127.0.0.1'
  const mcpHost = envConfig.MCP_HTTP_HOST || '127.0.0.1'

  console.log('Waiting for servers to be ready...')

  const [wsReady, mcpReady] = await Promise.all([
    healthCheck(`http://${wsHost === '0.0.0.0' ? '127.0.0.1' : wsHost}:${WS_PORT}/health`),
    healthCheck(`http://${mcpHost === '0.0.0.0' ? '127.0.0.1' : mcpHost}:${MCP_PORT}/health`)
  ])

  if (!wsReady) {
    console.error('WebSocket server health check failed')
    gracefulShutdown()
    process.exit(1)
  }

  if (!mcpReady) {
    console.error('MCP server health check failed')
    gracefulShutdown()
    process.exit(1)
  }

  // Print banner
  printBanner(envConfig)

  // Register shutdown handlers
  process.on('SIGINT', gracefulShutdown)
  process.on('SIGTERM', gracefulShutdown)
}

// Export main for testing purposes
export { main }

// Run main if executed directly
if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  main().catch(err => {
    console.error(err)
    process.exit(1)
  })
}