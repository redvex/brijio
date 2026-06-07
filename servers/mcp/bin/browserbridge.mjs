#!/usr/bin/env node

// Combined entry point for Brijio — starts both WebSocket and MCP servers.
// Per ADR-0037: `npx @brijio/mcp` exposes the preferred `brijio` binary and
// keeps `browserbridge` as a backwards-compatible alias for the transition window.
//
// Auto-generates BRIJIO_PAIRING_TOKEN and MCP_HTTP_AUTH_TOKEN when unset,
// mirrors the pairing token to legacy BrowserBridge env vars for compatibility,
// prints them to stdout at startup, and manages graceful shutdown on SIGINT/SIGTERM.

import { randomBytes } from 'node:crypto'
import { basename } from 'node:path'

const invokedAs = basename(process.argv[1] ?? 'brijio')
const usingLegacyBinary = invokedAs === 'browserbridge'

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printHelp()
  process.exit(0)
}

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

// ─── Register tsx for .ts imports (dev mode only) ───────────────────────────
// In the published npm package, tsx is not a dependency and this registration
// is skipped. When running from the monorepo, tsx allows importing .ts files.

try {
  const { register } = await import('node:module')
  const { pathToFileURL } = await import('node:url')
  register('tsx/esm', pathToFileURL(import.meta.url))
} catch {
  // tsx not available or registration failed — bundled JS doesn't need it
}

// ─── Auto-generate tokens if not set ─────────────────────────────────────────

const pairingTokenProvided = !!(
  envValue('BRIJIO_PAIRING_TOKEN') ??
  envValue('BROWSERBRIDGE_PAIRING_TOKEN') ??
  envValue('BROWSERBRIDGE_TOKEN')
)

const authTokenProvided = !!envValue('MCP_HTTP_AUTH_TOKEN')

const configuredPairingToken = resolveRenamedEnv({
  newName: 'BRIJIO_PAIRING_TOKEN',
  oldNames: ['BROWSERBRIDGE_PAIRING_TOKEN', 'BROWSERBRIDGE_TOKEN'],
  defaultValue: randomBytes(32).toString('base64url')
})

process.env.BRIJIO_PAIRING_TOKEN = configuredPairingToken
process.env.BROWSERBRIDGE_PAIRING_TOKEN = configuredPairingToken

if (!authTokenProvided) {
  process.env.MCP_HTTP_AUTH_TOKEN = randomBytes(32).toString('base64url')
}

// ─── Set sensible defaults for local-single-machine use ──────────────────────
// These MUST be set before importing server modules, because both the WebSocket
// and MCP servers read from process.env at module-evaluation time.

process.env.WEBSOCKET_HOST ??= '0.0.0.0'
process.env.WEBSOCKET_PORT ??= '8787'
const configuredWsUrl = resolveRenamedEnv({
  newName: 'BRIJIO_WS_URL',
  oldNames: ['BROWSERBRIDGE_WEBSOCKET_URL', 'BROWSERBRIDGE_WS_URL', 'WEBSOCKET_URL'],
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

// ─── Import and start servers ────────────────────────────────────────────────
// Imports use the pnpm workspace package names. tsx handles .ts resolution.

const { createWebSocketServer } = await import('@browserbridge/websocket/server')
const {
  getMcpHttpServerOptionsFromEnv,
  startBrowserBridgeMcpHttpServer
} = await import('../src/http-server.ts')

const wsHost = process.env.WEBSOCKET_HOST
const wsPort = Number(process.env.WEBSOCKET_PORT)
const pairingToken = process.env.BROWSERBRIDGE_PAIRING_TOKEN

const wsServer = await createWebSocketServer({
  host: wsHost,
  port: wsPort,
  pairingToken
})

const mcpOptions = getMcpHttpServerOptionsFromEnv()
const mcpRuntime = await startBrowserBridgeMcpHttpServer(mcpOptions)

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

function printHelp () {
  console.log(`Brijio MCP runtime

Usage:
  brijio [--help] [--version]
  browserbridge [--help] [--version]  # deprecated alias

Starts the local Brijio WebSocket and MCP HTTP servers.

Environment:
  BRIJIO_PAIRING_TOKEN          Pairing token for browser extensions
  BRIJIO_WS_URL                 WebSocket URL used by the MCP server
  BRIJIO_REQUEST_TIMEOUT_MS     Browser request timeout in milliseconds
  MCP_HTTP_AUTH_TOKEN           Bearer token for MCP HTTP transport

Compatibility:
  BROWSERBRIDGE_PAIRING_TOKEN, BROWSERBRIDGE_TOKEN,
  BROWSERBRIDGE_WEBSOCKET_URL, BROWSERBRIDGE_WS_URL, WEBSOCKET_URL, and
  BROWSERBRIDGE_REQUEST_TIMEOUT_MS are still accepted during the transition.
`)
}

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
