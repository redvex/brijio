#!/usr/bin/env node

// Combined entry point for Brijio — starts both WebSocket and MCP servers.
// Per ADR-0037: `npx @brijio/mcp` exposes the preferred `brijio` binary and
// keeps `browserbridge` as a backwards-compatible alias for the transition window.
// Per ADR-0038: --print-config, --doctor, --dev, and startup banner polish.
//
// Supports daemon lifecycle commands (install, uninstall, start, stop, restart,
// status, logs) and auto-generates BRIJIO_PAIRING_TOKEN / MCP_HTTP_AUTH_TOKEN
// when unset, mirrors the pairing token to legacy BrowserBridge env vars for
// compatibility, prints them to stdout at startup, and manages graceful
// shutdown on SIGINT/SIGTERM.

import { randomBytes } from 'node:crypto'
import { basename } from 'node:path'
import * as readline from 'node:readline'
// Server modules read process.env at evaluation time, so they MUST be imported
// AFTER env setup and ONLY when actually starting servers (run mode).
// Using dynamic imports prevents ERR_MODULE_NOT_FOUND for --doctor / --print-config
// which exit early and never need the server stack.

const invokedAs = basename(process.argv[1] ?? 'brijio')
const usingLegacyBinary = invokedAs === 'browserbridge'

if (process.argv.includes('--version') || process.argv.includes('-v')) {
  const { readFileSync } = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const { dirname, resolve } = await import('node:path')
  const packageJsonPath = resolve(dirname(fileURLToPath(import.meta.url)), '../package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  console.log(packageJson.version)
  process.exit(0)
}

if (usingLegacyBinary) {
  console.warn(
    'The `browserbridge` command is deprecated and will be removed after the transition window. Use `brijio` instead.'
  )
}

// ─── Load TypeScript daemon module ───────────────────────────────────────────
// Daemon commands exit early, so dynamic import is fine — tsup externalises tsx.

async function importModule (path) {
  try {
    const { tsImport } = await import('tsx/esm/api')
    return await tsImport(path, import.meta.url)
  } catch {
    return await import(path)
  }
}

const [
  daemonModule,
  printConfigModule,
  doctorModule,
  startupBannerModule
] = await Promise.all([
  importModule('../src/daemon.ts'),
  importModule('../src/print-config.ts'),
  importModule('../src/doctor.ts'),
  importModule('../src/startup-banner.ts')
])

const {
  applyBrijioEnv,
  formatStatus,
  getDaemonLogs,
  getDaemonStatus,
  installDaemon,
  loadBrijioEnv,
  parseDaemonCommand,
  restartDaemon,
  startDaemon,
  stopDaemon,
  streamDaemonLogs,
  uninstallDaemon,
  usage
} = daemonModule

const {
  formatConfig,
  formatInteractivePrompt,
  formatDefaultJson,
  resolveAgentName
} = printConfigModule

const { runDoctorChecks, formatDoctorReport } = doctorModule
const { formatStartupBanner } = startupBannerModule

// ─── Apply env early for --print-config / --doctor ───────────────────────────
// These commands need token values but don't start servers.

const loadedEnv = loadBrijioEnv()
applyBrijioEnv(loadedEnv)

const pairingTokenProvided = !!(
  envValue('BRIJIO_PAIRING_TOKEN') ??
  envValue('BROWSERBRIDGE_PAIRING_TOKEN') ??
  envValue('BRIJIO_TOKEN')
)

const authTokenProvided = !!envValue('MCP_HTTP_AUTH_TOKEN')

const configuredPairingToken = resolveRenamedEnv({
  newName: 'BRIJIO_PAIRING_TOKEN',
  oldNames: ['BROWSERBRIDGE_PAIRING_TOKEN', 'BRIJIO_TOKEN'],
  defaultValue: randomBytes(32).toString('base64url')
})

process.env.BRIJIO_PAIRING_TOKEN = configuredPairingToken
process.env.BROWSERBRIDGE_PAIRING_TOKEN = configuredPairingToken

if (!authTokenProvided) {
  process.env.MCP_HTTP_AUTH_TOKEN = randomBytes(32).toString('base64url')
}

// ─── Parse command line ──────────────────────────────────────────────────────

try {
  const command = parseDaemonCommand(process.argv.slice(2))

  if (command.name === 'help') {
    console.log(usage())
    process.exit(0)
  }

  if (command.name === 'print-config') {
    await handlePrintConfig(command)
    process.exit(0)
  }

  if (command.name === 'doctor') {
    await handleDoctor(loadedEnv.path)
    process.exit(0)
  }

  if (command.name === 'install') {
    const plan = await installDaemon(command, { binaryUrl: import.meta.url })
    console.log([
      'Brijio daemon installed.',
      '',
      `Config: ${plan.envFilePath}`,
      `Service: ${plan.linkPath}`,
      '',
      `Pairing Token:  ${plan.env.BRIJIO_PAIRING_TOKEN}`,
      `MCP Auth Token: ${plan.env.MCP_HTTP_AUTH_TOKEN}`,
      '',
      'Save these tokens for your browser extension and MCP client configuration.'
    ].join('\n'))
    process.exit(0)
  }

  if (command.name === 'uninstall') {
    const result = await uninstallDaemon()
    console.log([
      'Brijio daemon uninstalled.',
      `Removed service link: ${result.linkPath}`,
      `Preserved config and logs: ${result.configDir}`,
      `To fully remove Brijio daemon data, run: rm -rf ${result.configDir}`
    ].join('\n'))
    process.exit(0)
  }

  if (command.name === 'start') {
    const result = await startDaemon()
    console.log(`Brijio daemon started: ${result.linkPath}`)
    process.exit(0)
  }

  if (command.name === 'stop') {
    const result = await stopDaemon()
    console.log(`Brijio daemon stopped: ${result.linkPath}`)
    process.exit(0)
  }

  if (command.name === 'restart') {
    const result = await restartDaemon()
    console.log(`Brijio daemon restarted: ${result.linkPath}`)
    process.exit(0)
  }

  if (command.name === 'status') {
    console.log(formatStatus(await getDaemonStatus()))
    process.exit(0)
  }

  if (command.name === 'logs') {
    if (command.live) {
      process.exit(await streamDaemonLogs({ lines: command.lines }))
    }

    console.log(await getDaemonLogs({ lines: command.lines }))
    process.exit(0)
  }

  // ─── Dev mode: set env vars for 127.0.0.1 binding ──────────────────────────
  if (command.name === 'run' && command.dev) {
    process.env.WEBSOCKET_HOST = '127.0.0.1'
    process.env.MCP_HTTP_HOST = '127.0.0.1'
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}

// ─── Set sensible defaults for local-single-machine use ──────────────────────
// These MUST be set before the server modules' side effects run. Because we use
// static imports at the top, the modules are loaded but their top-level code
// that reads process.env runs at import evaluation time — which happens in the
// main() call below, after this env setup.

process.env.WEBSOCKET_HOST ??= '0.0.0.0'
process.env.WEBSOCKET_PORT ??= '8787'
const configuredWsUrl = resolveRenamedEnv({
  newName: 'BRIJIO_WS_URL',
  oldNames: ['BROWSERBRIDGE_WEBSOCKET_URL', 'BRIJIO_WEBSOCKET_URL', 'WEBSOCKET_URL'],
  defaultValue: 'ws://127.0.0.1:8787'
})
process.env.BRIJIO_WS_URL = configuredWsUrl
process.env.BROWSERBRIDGE_WEBSOCKET_URL = configuredWsUrl
process.env.MCP_HTTP_HOST ??= '0.0.0.0'
process.env.MCP_HTTP_PORT ??= '8788'
process.env.MCP_HTTP_PATH ??= '/mcp'
const configuredTimeoutMs = resolveRenamedEnv({
  newName: 'BRIJIO_REQUEST_TIMEOUT_MS',
  oldNames: ['BROWSERBRIDGE_REQUEST_TIMEOUT_MS'],
  defaultValue: '5000'
})
process.env.BRIJIO_REQUEST_TIMEOUT_MS = configuredTimeoutMs
process.env.BROWSERBRIDGE_REQUEST_TIMEOUT_MS = configuredTimeoutMs

// ─── Start servers ────────────────────────────────────────────────────────────
// Server modules are imported dynamically ONLY in run mode. This ensures
// --doctor and --print-config never trigger the full server module cascade.

const wsHost = process.env.WEBSOCKET_HOST
const wsPort = Number(process.env.WEBSOCKET_PORT)
const pairingToken = process.env.BRIJIO_PAIRING_TOKEN

let wsServer
let mcpRuntime

try {
  const { createWebSocketServer } = await importModule('@brijio/websocket/server')
  const { getMcpHttpServerOptionsFromEnv, startBrijioMcpHttpServer } = await importModule('../src/http-server.ts')

  wsServer = await createWebSocketServer({
    host: wsHost,
    port: wsPort,
    pairingToken
  })

  const mcpOptions = getMcpHttpServerOptionsFromEnv()
  mcpRuntime = await startBrijioMcpHttpServer(mcpOptions)
} catch (error) {
  if (error instanceof Error && 'code' in error && error.code === 'EADDRINUSE') {
    const port = 'port' in error && typeof error.port === 'number' ? error.port : wsPort
    console.error([
      '',
      `❌ Brijio failed to start: port ${port} is already in use.`,
      '',
      '  Another process is using that port. You can:',
      '',
      '  • Run `brijio --doctor` to diagnose port conflicts',
      '  • Set WEBSOCKET_PORT or MCP_HTTP_PORT to use a different port',
      '  • Stop the conflicting process and try again',
      ''
    ].join('\n'))
    process.exit(1)
  }
  throw error
}

// ─── Startup banner (ADR-0038: goes to stderr) ─────────────────────────────

const command = parseDaemonCommand(process.argv.slice(2))
const isDev = command.name === 'run' && command.dev === true

const banner = await formatStartupBanner({
  wsPort,
  mcpPort: Number(process.env.MCP_HTTP_PORT),
  mcpPath: process.env.MCP_HTTP_PATH ?? '/mcp',
  pairingToken: process.env.BRIJIO_PAIRING_TOKEN ?? '',
  authToken: process.env.MCP_HTTP_AUTH_TOKEN ?? '',
  pairingTokenProvided,
  authTokenProvided,
  dev: isDev
})

process.stderr.write(banner + '\n')

// ─── Graceful shutdown ───────────────────────────────────────────────────────

let shuttingDown = false

async function gracefulShutdown () {
  if (shuttingDown) return
  shuttingDown = true

  console.log('\nShutting down...')

  try {
    await Promise.all([
      wsServer.close(),
      mcpRuntime.close()
    ])
  } catch (err) {
    console.error('Error during shutdown:', err)
  }

  process.exit(0)
}

process.on('SIGINT', gracefulShutdown)
process.on('SIGTERM', gracefulShutdown)

// ─── --print-config handler ──────────────────────────────────────────────────

async function handlePrintConfig (command) {
  const wsPort = Number(process.env.WEBSOCKET_PORT ?? '8787')
  const mcpPort = Number(process.env.MCP_HTTP_PORT ?? '8788')
  const mcpPath = process.env.MCP_HTTP_PATH ?? '/mcp'
  const authToken = process.env.MCP_HTTP_AUTH_TOKEN ?? ''
  const isDev = command.dev === true

  // In dev mode, force localhost
  let mcpHost = '127.0.0.1'
  if (!isDev) {
    try {
      const { detectNetworkPaths } = await importModule('../src/network.ts')
      const networkPaths = await detectNetworkPaths()
      mcpHost = networkPaths.bestHost
    } catch {
      // fallback to localhost
    }
  }

  const mcpUrl = `http://${mcpHost}:${mcpPort}${mcpPath}`
  const wsUrl = `ws://${mcpHost}:${wsPort}`
  const authTokenEnvVar = 'MCP_HTTP_AUTH_TOKEN'
  const isEphemeral = !authTokenProvided

  if (command.agent) {
    // Agent specified directly — resolve and format
    const canonical = resolveAgentName(command.agent)
    if (canonical == null) {
      console.error(`Unknown agent: "${command.agent}". Run "brijio --print-config" to see available agents.`)
      process.exit(1)
    }
    const output = formatConfig(canonical, {
      mcpUrl,
      wsUrl,
      authToken,
      authTokenEnvVar,
      isEphemeral,
      isDev
    })
    process.stderr.write(output.stderr + '\n')
    process.stdout.write(output.stdout + '\n')
    return
  }

  // No agent specified — check if TTY for interactive prompt
  if (process.stdin.isTTY) {
    process.stderr.write(formatInteractivePrompt())
    const answer = await readLineFromStdin()
    const canonical = resolveAgentName(answer.trim())
    if (canonical == null) {
      console.error(`Unknown agent: "${answer.trim()}". Run "brijio --print-config" to see available agents.`)
      process.exit(1)
    }
    const output = formatConfig(canonical, {
      mcpUrl,
      wsUrl,
      authToken,
      authTokenEnvVar,
      isEphemeral,
      isDev
    })
    process.stderr.write('\n' + output.stderr + '\n')
    process.stdout.write(output.stdout + '\n')
    return
  }

  // Not TTY — fall back to default JSON
  const output = formatDefaultJson({
    mcpUrl,
    wsUrl,
    authToken,
    authTokenEnvVar,
    isEphemeral,
    isDev
  })
  process.stderr.write(output.stderr + '\n')
  process.stdout.write(output.stdout + '\n')
}

function readLineFromStdin () {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr })
    rl.question('', (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

// ─── --doctor handler ────────────────────────────────────────────────────────

/** @param {string} [configPath] */
async function handleDoctor (configPath) {
  const mcpPort = Number(process.env.MCP_HTTP_PORT ?? '8788')
  const wsPort = Number(process.env.WEBSOCKET_PORT ?? '8787')

  const results = await runDoctorChecks({ mcpPort, wsPort, configPath })
  console.log(formatDoctorReport(results))

  const hasFailures = results.some(r => r.status === 'fail')
  process.exit(hasFailures ? 1 : 0)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveRenamedEnv ({ newName, oldNames, defaultValue }) {
  const newValue = envValue(newName)

  for (const oldName of oldNames) {
    const oldValue = envValue(oldName)

    if (newValue !== undefined && oldValue !== undefined && newValue !== oldValue) {
      console.warn(`Both ${newName} and ${oldName} are set; preferring ${newName}.`)
    }
  }

  if (newValue !== undefined) {
    return newValue
  }

  for (const oldName of oldNames) {
    const oldValue = envValue(oldName)
    if (oldValue !== undefined) {
      return oldValue
    }
  }

  return defaultValue
}

function envValue (name) {
  const value = process.env[name]

  if (value === undefined || value.trim() === '') {
    return undefined
  }

  return value
}
