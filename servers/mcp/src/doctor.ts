/**
 * Doctor module for Brijio (ADR-0038).
 *
 * Runs preflight checks and prints a diagnostic report.
 * Opt-in: `brijio --doctor`
 */
import { detectNetworkPaths, type NetworkPaths } from './network.js'

export interface DoctorCheckResult {
  name: string
  status: 'pass' | 'fail' | 'warn'
  message: string
  detail?: string
}

/** Run all doctor checks and return results */
export async function runDoctorChecks (opts: {
  mcpPort: number
  wsPort: number
  configPath?: string
}): Promise<DoctorCheckResult[]> {
  const results: DoctorCheckResult[] = []

  // 1. Config file
  results.push(await checkConfig(opts.configPath))

  // 2. Ports
  results.push(await checkPort(opts.mcpPort, 'MCP HTTP'))
  results.push(await checkPort(opts.wsPort, 'WebSocket'))

  // 3. Network detection
  results.push(await checkNetwork())

  // 4. Node.js version
  results.push(checkNodeVersion())

  return results
}

/** Check config file exists and is readable */
async function checkConfig (configPath?: string): Promise<DoctorCheckResult> {
  if (configPath == null || configPath === '') {
    return { name: 'Config', status: 'warn', message: 'No config file path detected', detail: 'Using environment variables or auto-generated config' }
  }
  try {
    const { access } = await import('node:fs/promises')
    await access(configPath)
    return { name: 'Config', status: 'pass', message: `Config file found: ${configPath}` }
  } catch {
    return { name: 'Config', status: 'warn', message: `Config file not found: ${configPath}`, detail: 'Will use environment variables or auto-generate' }
  }
}

/** Check if a port is available (not already bound) */
async function checkPort (port: number, label: string): Promise<DoctorCheckResult> {
  const { createServer } = await import('node:net')
  return await new Promise<DoctorCheckResult>((resolve) => {
    const server = createServer()
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve({ name: `${label} port ${port}`, status: 'fail', message: `Port ${port} is already in use`, detail: 'Another process is using this port. Use --mcp-port / --ws-port to use a different port, or stop the conflicting process.' })
      } else {
        resolve({ name: `${label} port ${port}`, status: 'fail', message: `Error checking port ${port}: ${err.message}` })
      }
    })
    server.once('listening', () => {
      server.close()
      resolve({ name: `${label} port ${port}`, status: 'pass', message: `Port ${port} is available` })
    })
    server.listen(port)
  })
}

/** Check network detection signals */
async function checkNetwork (): Promise<DoctorCheckResult> {
  let paths: NetworkPaths
  try {
    paths = await detectNetworkPaths()
  } catch (err) {
    return { name: 'Network', status: 'warn', message: 'Network detection failed', detail: err instanceof Error ? err.message : String(err) }
  }

  const signals: string[] = []

  if (paths.tailscale.running && paths.tailscale.ip != null) {
    signals.push(`Tailscale: ${paths.tailscale.ip}`)
  }
  if (paths.mdns != null && paths.mdns !== '') {
    signals.push(`mDNS: ${paths.mdns}`)
  }
  // Localhost is always reachable in practice
  signals.push('Localhost: 127.0.0.1')

  return { name: 'Network', status: 'pass', message: `Detected ${signals.length} reachable path(s)`, detail: signals.join('\n') }
}

/** Check Node.js version */
function checkNodeVersion (): DoctorCheckResult {
  const version = process.version
  const major = parseInt(version.slice(1).split('.')[0], 10)
  if (major < 18) {
    return { name: 'Node.js', status: 'fail', message: `Node.js ${version} is too old`, detail: 'Brijio requires Node.js >= 18' }
  }
  return { name: 'Node.js', status: 'pass', message: `Node.js ${version}` }
}

/** Format doctor results as a human-readable report (printed to stdout) */
export function formatDoctorReport (results: DoctorCheckResult[]): string {
  const lines: string[] = [
    '',
    '  🔍 Brijio Doctor',
    '  ───────────────',
    ''
  ]
  for (const result of results) {
    const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️ '
    lines.push(`  ${icon}  ${result.name}: ${result.message}`)
    if (result.detail != null && result.detail !== '') {
      for (const detailLine of result.detail.split('\n')) {
        lines.push(`      ${detailLine}`)
      }
    }
  }
  const failCount = results.filter(r => r.status === 'fail').length
  const warnCount = results.filter(r => r.status === 'warn').length
  lines.push('')
  if (failCount > 0) {
    lines.push(`  ❌ ${failCount} issue(s) found. Fix the above before running Brijio.`)
  } else if (warnCount > 0) {
    lines.push(`  ⚠️  No critical issues, but ${warnCount} warning(s). Brijio should work.`)
  } else {
    lines.push('  ✅ All checks passed. Brijio is ready to run!')
  }
  lines.push('')
  return lines.join('\n')
}
