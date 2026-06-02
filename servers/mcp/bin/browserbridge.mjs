#!/usr/bin/env node

// Combined entry point for BrowserBridge — starts both WebSocket and MCP servers.
// Per ADR-0035: `npx @redvex/browserbridge` or `node bin/browserbridge.mjs`
//
// Auto-generates BROWSERBRIDGE_PAIRING_TOKEN and MCP_HTTP_AUTH_TOKEN when unset,
// prints them to stdout at startup, and manages graceful shutdown on SIGINT/SIGTERM.

import { randomBytes } from 'node:crypto'

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
  process.env.BROWSERBRIDGE_PAIRING_TOKEN &&
  process.env.BROWSERBRIDGE_PAIRING_TOKEN.trim() !== ''
)

const authTokenProvided = !!(
  process.env.MCP_HTTP_AUTH_TOKEN &&
  process.env.MCP_HTTP_AUTH_TOKEN.trim() !== ''
)

if (!pairingTokenProvided) {
  process.env.BROWSERBRIDGE_PAIRING_TOKEN = randomBytes(32).toString('base64url')
}

if (!authTokenProvided) {
  process.env.MCP_HTTP_AUTH_TOKEN = randomBytes(32).toString('base64url')
}

// ─── Set sensible defaults for local-single-machine use ──────────────────────
// These MUST be set before importing server modules, because both the WebSocket
// and MCP servers read from process.env at module-evaluation time.

process.env.WEBSOCKET_HOST ??= '0.0.0.0'
process.env.WEBSOCKET_PORT ??= '8787'
process.env.BROWSERBRIDGE_WEBSOCKET_URL ??= 'ws://127.0.0.1:8787'
process.env.MCP_HTTP_HOST ??= '0.0.0.0'
process.env.MCP_HTTP_PORT ??= '8788'
process.env.MCP_HTTP_PATH ??= '/mcp'
process.env.BROWSERBRIDGE_REQUEST_TIMEOUT_MS ??= '5000'

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
  '🚀 BrowserBridge ready!',
  '',
  `  WebSocket:    ws://${displayWsHost}:${wsPort}`,
  `  MCP:         http://${displayMcpHost}:${mcpOptions.port}${mcpOptions.path}`,
  '',
  `  Pairing Token:    ${process.env.BROWSERBRIDGE_PAIRING_TOKEN}${pairingLabel}`,
  `  MCP Auth Token:   ${process.env.MCP_HTTP_AUTH_TOKEN}${authLabel}`
]

if (!pairingTokenProvided || !authTokenProvided) {
  lines.push(
    '',
    '  ⚠  Auto-generated tokens change on restart. Set BROWSERBRIDGE_PAIRING_TOKEN and',
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