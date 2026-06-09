/**
 * Startup banner for Brijio (ADR-0038).
 *
 * Detects network paths and formats the startup banner.
 * Output goes to stderr so stdout stays clean for piping.
 */
import { detectNetworkPaths, type NetworkPaths } from './network.js'

export interface BannerOptions {
  /** WebSocket port */
  wsPort: number
  /** MCP HTTP port */
  mcpPort: number
  /** MCP HTTP path (e.g. '/mcp') */
  mcpPath: string
  /** Pairing token */
  pairingToken: string
  /** Auth token */
  authToken: string
  /** Whether the pairing token was provided by the user (not auto-generated) */
  pairingTokenProvided: boolean
  /** Whether the auth token was provided by the user (not auto-generated) */
  authTokenProvided: boolean
  /** Dev mode flag — forces 127.0.0.1 */
  dev: boolean
  /** Demo mode flag — include demo page URL in banner */
  demo?: boolean
  /** Demo page port (only shown when demo is true) */
  demoPort?: number
  /** Demo attached to an already-running daemon (WS/MCP skipped) */
  demoAttachedToExistingDaemon?: boolean
}

/**
 * Format the startup banner string.
 * All output goes to stderr; this returns the banner text.
 */
export async function formatStartupBanner (options: BannerOptions): Promise<string> {
  const {
    wsPort,
    mcpPort,
    mcpPath,
    pairingToken,
    authToken,
    pairingTokenProvided,
    authTokenProvided,
    dev,
    demo,
    demoPort,
    demoAttachedToExistingDaemon
  } = options

  let networkPaths: NetworkPaths | undefined

  if (!dev) {
    try {
      networkPaths = await detectNetworkPaths()
    } catch {
      // Network detection is best-effort; don't block startup
    }
  }

  const lines: string[] = [
    '',
    '🚀 Brijio ready!',
    ''
  ]

  if (demoAttachedToExistingDaemon === true) {
    // Demo attached to an already-running daemon — only show demo URL.
    // WS/MCP URLs and tokens belong to the daemon process, not this one.
    if (demoPort !== undefined) {
      const demoHost = networkPaths?.bestHost ?? (dev ? '127.0.0.1' : 'localhost')
      lines.push(`  Demo page:   http://${demoHost}:${demoPort}/`)
      if (networkPaths != null && !dev) {
        for (const addr of networkPaths.addresses) {
          if (addr.host !== networkPaths.bestHost) {
            lines.push(`               http://${addr.host}:${demoPort}/`)
          }
        }
      }
    }
    lines.push('')
    lines.push('  Connected to existing Brijio daemon on WS port ' + String(wsPort) + '.')
    lines.push('  Run `brijio status` or `brijio logs` to inspect the daemon.')
  } else if (networkPaths != null && !dev) {
    // Show all reachable addresses
    const urlEntries: string[] = []
    for (const addr of networkPaths.addresses) {
      const wsUrl = `ws://${addr.host}:${wsPort}`
      const mcpUrl = `http://${addr.host}:${mcpPort}${mcpPath}`
      urlEntries.push(`  ${addr.label.padEnd(12)} WS: ${wsUrl}   MCP: ${mcpUrl}`)
    }
    lines.push(...urlEntries)

    if (demo === true && demoPort !== undefined) {
      lines.push(`  Demo page:   http://${networkPaths.bestHost ?? '127.0.0.1'}:${demoPort}/`)
    }
  } else {
    const displayWsHost = dev ? '127.0.0.1' : 'localhost'
    const displayMcpHost = dev ? '127.0.0.1' : 'localhost'
    lines.push(`  WebSocket:    ws://${displayWsHost}:${wsPort}`)
    lines.push(`  MCP:         http://${displayMcpHost}:${mcpPort}${mcpPath}`)
  }

  if (demoAttachedToExistingDaemon !== true) {
    if (demo === true && demoPort !== undefined) {
      const displayDemoHost = dev ? '127.0.0.1' : 'localhost'
      lines.push(`  Demo page:   http://${displayDemoHost}:${demoPort}/`)
    }

    lines.push('')

    // Token display
    const pairingLabel = pairingTokenProvided ? '' : '  [ephemeral]'
    const authLabel = authTokenProvided ? '' : '  [ephemeral]'

    lines.push(`  Pairing Token:  ${pairingToken}${pairingLabel}`)
    lines.push(`  MCP Auth Token: ${authToken}${authLabel}`)

    if (!pairingTokenProvided || !authTokenProvided) {
      lines.push(
        '',
        '  ⚠  Ephemeral tokens change on restart. Set BRIJIO_PAIRING_TOKEN and',
        '    MCP_HTTP_AUTH_TOKEN environment variables for persistent tokens.'
      )
    }

    if (dev) {
      lines.push(
        '',
        '  🔧 Dev mode — binding to 127.0.0.1 only'
      )
    }

    lines.push(
      '',
      '  Connect your browser extension using the Pairing Token above.',
      '  Configure your MCP client with the MCP URL and Auth Token.',
      ''
    )
  } else {
    lines.push('')
  }

  return lines.join('\n')
}
