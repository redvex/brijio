#!/usr/bin/env node

// Combined entry point for Brijio — starts both WebSocket and MCP servers.
// Per ADR-0037: `npx @brijio/mcp` exposes the preferred `brijio` binary and
// keeps `browserbridge` as a backwards-compatible alias for the transition window.
//
// Supports daemon lifecycle commands (install, uninstall, start, stop, restart,
// status, logs) and auto-generates BRIJIO_PAIRING_TOKEN / MCP_HTTP_AUTH_TOKEN
// when unset, mirrors the pairing token to legacy BrowserBridge env vars for
// compatibility, prints them to stdout at startup, and manages graceful
// shutdown on SIGINT/SIGTERM.

import { randomBytes } from 'node:crypto'
import { basename } from 'node:path'
// Static imports so tsup can bundle them. Server modules read process.env at
// evaluation time, so we must configure env BEFORE these run — hence the
// indirection through the main() function below.
import { createWebSocketServer } from '@brijio/websocket/server'
import {
  getMcpHttpServerOptionsFromEnv,
  startBrijioMcpHttpServer
} from '../src/http-server.ts'

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

async function importDaemonModule () {
  try {
    const { tsImport } = await import('tsx/esm/api')
    return await tsImport('../src/daemon.ts', import.meta.url)
  } catch {
    return await import('../src/daemon.ts')
  }
}

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
} = await importDaemonModule()

// ─── Dispatch daemon commands ─────────────────────────────────────────────────

try {
  const command = parseDaemonCommand(process.argv.slice(2))

  if (command.name === 'help') {
    console.log(usage())
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
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}

// ─── Interactive mode: apply env and start servers ────────────────────────────

applyBrijioEnv(loadBrijioEnv())

// ─── Auto-generate tokens if not set ─────────────────────────────────────────

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
// Server modules were imported statically at the top. Now that process.env is
// fully configured, call their factory functions to actually start listening.

const wsHost = process.env.WEBSOCKET_HOST
const wsPort = Number(process.env.WEBSOCKET_PORT)
const pairingToken = process.env.BRIJIO_PAIRING_TOKEN

const wsServer = await createWebSocketServer({
  host: wsHost,
  port: wsPort,
  pairingToken
})

const mcpOptions = getMcpHttpServerOptionsFromEnv()
const mcpRuntime = await startBrijioMcpHttpServer(mcpOptions)

// ─── Startup banner ──────────────────────────────────────────────────────────

const displayWsHost = wsHost === '0.0.0.0' ? 'localhost' : wsHost
const displayMcpHost = mcpOptions.host === '0.0.0.0' ? 'localhost' : mcpOptions.host

const pairingLabel = pairingTokenProvided ? '' : '  [auto-generated]'
const authLabel = authTokenProvided ? '' : '  [auto-generated]'

const lines = [
  '',
  '🚀 Brijio ready!',
  '',
  `  WebSocket:    ws://${displayWsHost}:${wsPort}`,
  `  MCP:         http://${displayMcpHost}:${mcpOptions.port}${mcpOptions.path}`,
  '',
  `  Pairing Token:    ${process.env.BRIJIO_PAIRING_TOKEN}${pairingLabel}`,
  `  MCP Auth Token:   ${process.env.MCP_HTTP_AUTH_TOKEN}${authLabel}`
]

if (!pairingTokenProvided || !authTokenProvided) {
  lines.push(
    '',
    '  ⚠  Auto-generated tokens change on restart. Set BRIJIO_PAIRING_TOKEN and',
    '    MCP_HTTP_AUTH_TOKEN environment variables for persistent tokens.'
  )
}

lines.push(
  '',
  '  Connect your browser extension using the Pairing Token above.',
  '  Configure your MCP client with the MCP URL and Auth Token.',
  ''
)

console.log(lines.join('\n'))

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