/**
 * Network detection module for Brijio.
 *
 * Detects Tailscale, mDNS, and localhost network paths so the CLI
 * can print reachable URLs in the startup banner and --print-config.
 *
 * ADR-0038: One-command local runtime polish
 */

import { execFile } from 'node:child_process'
import dns from 'node:dns/promises'
import os from 'node:os'

/** Result from Tailscale CLI detection */
export interface TailscaleResult {
  /** Whether `tailscale status --json` succeeded */
  running: boolean
  /** The first Tailscale IP (100.x.x.x) if available */
  ip: string | null
  /** Error message if detection failed */
  error?: string
}

/** All detected network paths */
export interface NetworkPaths {
  /** Tailscale detection result */
  tailscale: TailscaleResult
  /** mDNS hostname (e.g. 'brijio.local') or null */
  mdns: string | null
  /** Best URL host to use (priority: tailscale > mdns > localhost) */
  bestHost: string
  /** All reachable addresses for display */
  addresses: Array<{
    label: string
    host: string
  }>
}

const TAILSCALE_TIMEOUT_MS = 2000

/**
 * Check if an IP address falls within the Tailscale CGNAT range (100.64.0.0/10).
 */
export function isTailscaleIP (ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4) return false
  // 100.64.0.0/10 → 100.64.0.0 – 100.127.255.255
  // First octet must be 100, second octet must be 64-127
  return parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127
}

/**
 * Detect Tailscale by running `tailscale status --json`.
 * Times out after TAILSCALE_TIMEOUT_MS.
 */
export async function detectTailscale (): Promise<TailscaleResult> {
  return await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ running: false, ip: null, error: 'timed out' })
    }, TAILSCALE_TIMEOUT_MS)

    execFile('tailscale', ['status', '--json'], (err, stdout) => {
      clearTimeout(timeout)
      if (err != null) {
        resolve({ running: false, ip: null, error: err.message })
        return
      }
      try {
        const data = JSON.parse(stdout)
        const ips: string[] = data?.TailscaleIPs ?? []
        const ip = ips.find(ip => isTailscaleIP(ip)) ?? ips[0] ?? null
        resolve({ running: true, ip })
      } catch {
        resolve({ running: false, ip: null, error: 'invalid JSON from tailscale status' })
      }
    })
  })
}

/**
 * Detect Tailscale IP from network interfaces, even if the CLI is not in PATH.
 * Scans os.networkInterfaces() for a 100.64.0.0/10 address.
 */
export function detectTailscaleInterface (): string | null {
  const interfaces = os.networkInterfaces()
  for (const entries of Object.values(interfaces)) {
    if (entries == null) continue
    for (const entry of entries) {
      if (entry.family === 'IPv4' && isTailscaleIP(entry.address)) {
        return entry.address
      }
    }
  }
  return null
}

/**
 * Detect mDNS by resolving <hostname>.local.
 * Works natively on macOS; on Linux requires avahi-daemon or systemd-resolved.
 */
export async function detectMdns (hostname?: string): Promise<string | null> {
  const name = hostname ?? os.hostname()
  try {
    await dns.resolve(`${name}.local`)
    return `${name}.local`
  } catch {
    return null
  }
}

/**
 * Run all network detection probes and return the best addresses.
 */
export async function detectNetworkPaths (options?: {
  hostname?: string
}): Promise<NetworkPaths> {
  const tailscale = await detectTailscale()
  const mdns = await detectMdns(options?.hostname)
  const interfaceIp = detectTailscaleInterface()

  const addresses: Array<{ label: string, host: string }> = []
  addresses.push({ label: 'Local', host: '127.0.0.1' })

  // Prefer Tailscale CLI result, fall back to interface detection
  const tailscaleHost = tailscale.ip ?? interfaceIp
  if (tailscaleHost != null) {
    addresses.push({ label: 'Tailscale', host: tailscaleHost })
  }

  if (mdns != null) {
    addresses.push({ label: 'mDNS', host: mdns })
  }

  // Priority: tailscale > mdns > localhost
  let bestHost = '127.0.0.1'
  if (tailscaleHost != null) {
    bestHost = tailscaleHost
  } else if (mdns != null) {
    bestHost = mdns
  }

  return {
    tailscale: { ...tailscale, ip: tailscaleHost },
    mdns,
    bestHost,
    addresses
  }
}
