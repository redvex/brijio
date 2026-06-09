import { randomBytes } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile, spawn } from 'node:child_process'

export type DaemonPlatform = 'darwin' | 'linux'

export type DaemonCommand =
  | { name: 'run', args: string[], dev?: boolean }
  | { name: 'print-config', agent?: string }
  | { name: 'doctor' }
  | { name: 'install', wsPort?: number, mcpPort?: number }
  | { name: 'uninstall' }
  | { name: 'start' }
  | { name: 'stop' }
  | { name: 'restart' }
  | { name: 'status' }
  | { name: 'logs', lines: number, live: boolean }
  | { name: 'help' }

export interface LoadedBrijioEnv {
  path?: string
  values: Record<string, string>
}

export interface LoadBrijioEnvOptions {
  cwd?: string
  home?: string
  envFile?: string
  exists?: (path: string) => boolean
  readFile?: (path: string) => string
}

export interface DaemonInstallPlanOptions {
  platform: DaemonPlatform
  home: string
  binaryPath: string
  wsPort?: number
  mcpPort?: number
  tokenFactory?: () => string
}

export interface DaemonInstallPlan {
  configDir: string
  envFilePath: string
  serviceFilePath: string
  linkPath: string
  env: Record<string, string>
  serviceDefinition: string
}

export interface DaemonStatus {
  platform: DaemonPlatform
  loaded: boolean
  wsHealth: HealthProbeResult
  mcpHealth: HealthProbeResult
  envFilePath: string
  binaryPath?: string
}

export interface HealthProbeResult {
  url: string
  ok: boolean
  statusCode?: number
  error?: string
}

export interface DaemonLogsCommand {
  command: string
  args: string[]
}

export interface CommandRunner {
  execFile: (command: string, args: string[]) => Promise<{ stdout: string, stderr: string, code: number }>
}

const label = 'com.redvex.brijio'
const serviceName = 'brijio.service'

export function parseDaemonCommand (args: string[]): DaemonCommand {
  // Handle top-level flags before subcommands

  // --help / -h
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    return { name: 'help' }
  }

  // --print-config [agent]
  if (args[0] === '--print-config') {
    const agent = args[1]
    // Only accept the positional arg if it doesn't look like a flag
    if (agent !== undefined && !agent.startsWith('-')) {
      return { name: 'print-config', agent }
    }
    return { name: 'print-config' }
  }

  // --doctor
  if (args.length === 1 && args[0] === '--doctor') {
    return { name: 'doctor' }
  }

  // Extract --dev flag, then proceed with subcommand parsing
  let dev = false
  const filteredArgs: string[] = []
  for (const arg of args) {
    if (arg === '--dev') {
      dev = true
    } else {
      filteredArgs.push(arg)
    }
  }

  const [first, ...rest] = filteredArgs

  if (first === undefined) {
    return { name: 'run', args: [], dev }
  }

  if (first === 'install') {
    return parseInstallCommand(rest)
  }

  if (first === 'uninstall') {
    ensureNoArgs(first, rest)
    return { name: 'uninstall' }
  }

  if (first === 'start') {
    ensureNoArgs(first, rest)
    return { name: 'start' }
  }

  if (first === 'stop') {
    ensureNoArgs(first, rest)
    return { name: 'stop' }
  }

  if (first === 'restart') {
    ensureNoArgs(first, rest)
    return { name: 'restart' }
  }

  if (first === 'status') {
    ensureNoArgs(first, rest)
    return { name: 'status' }
  }

  if (first === 'logs') {
    return parseLogsCommand(rest)
  }

  if (first === 'help') {
    return { name: 'help' }
  }

  // Unknown args → run mode, using filtered args (with --dev removed)
  return { name: 'run', args: filteredArgs, dev }
}

export function loadBrijioEnv (options: LoadBrijioEnvOptions = {}): LoadedBrijioEnv {
  const cwd = options.cwd ?? process.cwd()
  const home = options.home ?? homedir()
  const envFile = options.envFile ?? process.env.BRIJIO_ENV_FILE
  const exists = options.exists ?? existsSync
  const readFile = options.readFile ?? ((path: string) => readFileSync(path, 'utf8'))

  const candidates = [
    envFile,
    join(cwd, '.env'),
    join(home, '.brijio', '.env')
  ].filter((path): path is string => path !== undefined && path.trim() !== '')

  for (const path of candidates) {
    if (exists(path)) {
      return {
        path,
        values: parseEnvFile(readFile(path))
      }
    }
  }

  return { values: {} }
}

export function applyBrijioEnv (loaded: LoadedBrijioEnv, env: NodeJS.ProcessEnv = process.env): void {
  for (const [key, value] of Object.entries(loaded.values)) {
    if (env[key] === undefined || env[key]?.trim() === '') {
      env[key] = value
    }
  }
}

export function planDaemonInstall (options: DaemonInstallPlanOptions): DaemonInstallPlan {
  const configDir = join(options.home, '.brijio')
  const envFilePath = join(configDir, '.env')
  const envExamplePath = join(configDir, '.env.example')
  const binDir = join(configDir, 'bin')
  const serviceFilePath = options.platform === 'darwin'
    ? join(configDir, `${label}.plist`)
    : join(configDir, serviceName)
  const linkPath = options.platform === 'darwin'
    ? join(options.home, 'Library', 'LaunchAgents', `${label}.plist`)
    : join(options.home, '.config', 'systemd', 'user', serviceName)
  const tokenFactory = options.tokenFactory ?? (() => randomBytes(32).toString('base64url'))

  mkdirSync(configDir, { recursive: true })
  mkdirSync(binDir, { recursive: true })

  const existing = existsSync(envFilePath)
    ? parseEnvFile(readFileSync(envFilePath, 'utf8'))
    : {}

  const env: Record<string, string> = {
    ...existing,
    BRIJIO_PAIRING_TOKEN: existing.BRIJIO_PAIRING_TOKEN ?? tokenFactory(),
    MCP_HTTP_AUTH_TOKEN: existing.MCP_HTTP_AUTH_TOKEN ?? tokenFactory()
  }

  if (options.wsPort !== undefined) {
    env.WEBSOCKET_PORT = String(options.wsPort)
  }

  if (options.mcpPort !== undefined) {
    env.MCP_HTTP_PORT = String(options.mcpPort)
  }

  writeFileSync(envFilePath, formatEnvFile(env), { mode: 0o600 })
  chmodSync(envFilePath, 0o600)

  if (!existsSync(envExamplePath)) {
    writeFileSync(envExamplePath, formatEnvFile({
      BRIJIO_PAIRING_TOKEN: '<generated-on-install>',
      MCP_HTTP_AUTH_TOKEN: '<generated-on-install>',
      WEBSOCKET_PORT: '8787',
      MCP_HTTP_PORT: '8788'
    }))
  }

  const daemonBinaryPath = join(binDir, 'brijio')
  writeDaemonWrapper(daemonBinaryPath, options.binaryPath)

  const serviceDefinition = options.platform === 'darwin'
    ? buildLaunchAgentPlist({ home: options.home, binaryPath: daemonBinaryPath })
    : buildSystemdUserUnit()

  writeFileSync(serviceFilePath, serviceDefinition)
  mkdirSync(dirname(linkPath), { recursive: true })
  replaceSymlink(serviceFilePath, linkPath)

  return {
    configDir,
    envFilePath,
    serviceFilePath,
    linkPath,
    env,
    serviceDefinition
  }
}

export function buildLaunchAgentPlist (options: { home: string, binaryPath: string }): string {
  const configDir = join(options.home, '.brijio')
  const escapedBinaryPath = escapeXml(options.binaryPath)
  const escapedConfigDir = escapeXml(configDir)
  const escapedLogPath = escapeXml(join(configDir, 'brijio.log'))

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escapedBinaryPath}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${escapedConfigDir}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${escapedLogPath}</string>
  <key>StandardErrorPath</key>
  <string>${escapedLogPath}</string>
</dict>
</plist>
`
}

export function buildSystemdUserUnit (): string {
  return `[Unit]
Description=Brijio - AI agent to browser bridge
After=network.target

[Service]
Type=simple
WorkingDirectory=%h/.brijio
ExecStart=%h/.brijio/bin/brijio
Restart=on-failure
RestartSec=5
EnvironmentFile=%h/.brijio/.env

[Install]
WantedBy=default.target
`
}

export async function startDaemon (options: { platform?: NodeJS.Platform, home?: string, runner?: CommandRunner } = {}): Promise<{ linkPath: string }> {
  const platform = normalizePlatform(options.platform ?? process.platform)
  const home = options.home ?? homedir()
  const paths = getDaemonPaths(platform, home)
  const runner = options.runner ?? defaultRunner

  if (platform === 'darwin') {
    await runner.execFile('launchctl', ['load', paths.linkPath])
  } else {
    await runner.execFile('systemctl', ['--user', 'start', serviceName])
  }

  return { linkPath: paths.linkPath }
}

export async function stopDaemon (options: { platform?: NodeJS.Platform, home?: string, runner?: CommandRunner } = {}): Promise<{ linkPath: string }> {
  const platform = normalizePlatform(options.platform ?? process.platform)
  const home = options.home ?? homedir()
  const paths = getDaemonPaths(platform, home)
  const runner = options.runner ?? defaultRunner

  if (platform === 'darwin') {
    await runner.execFile('launchctl', ['unload', paths.linkPath])
  } else {
    await runner.execFile('systemctl', ['--user', 'stop', serviceName])
  }

  return { linkPath: paths.linkPath }
}

export async function restartDaemon (options: { platform?: NodeJS.Platform, home?: string, runner?: CommandRunner } = {}): Promise<{ linkPath: string }> {
  const platform = normalizePlatform(options.platform ?? process.platform)
  const home = options.home ?? homedir()
  const paths = getDaemonPaths(platform, home)
  const runner = options.runner ?? defaultRunner

  if (platform === 'darwin') {
    await runner.execFile('launchctl', ['unload', paths.linkPath]).catch(() => ({ stdout: '', stderr: '', code: 0 }))
    await runner.execFile('launchctl', ['load', paths.linkPath])
  } else {
    await runner.execFile('systemctl', ['--user', 'restart', serviceName])
  }

  return { linkPath: paths.linkPath }
}

export async function getDaemonLogs (options: { platform?: NodeJS.Platform, home?: string, lines?: number, runner?: CommandRunner } = {}): Promise<string> {
  const platform = normalizePlatform(options.platform ?? process.platform)
  const home = options.home ?? homedir()
  const lines = options.lines ?? 100

  assertValidLogLines(lines)

  if (platform === 'darwin') {
    const logPath = join(home, '.brijio', 'brijio.log')
    if (!existsSync(logPath)) {
      return `No Brijio log file found at ${logPath}`
    }
    return tailLines(readFileSync(logPath, 'utf8'), lines)
  }

  const runner = options.runner ?? defaultRunner
  const logCommand = buildDaemonLogsCommand({ platform, home, lines, live: false })
  const result = await runner.execFile(logCommand.command, logCommand.args)
  return result.stdout
}

export function buildDaemonLogsCommand (options: { platform?: NodeJS.Platform, home?: string, lines?: number, live?: boolean } = {}): DaemonLogsCommand {
  const platform = normalizePlatform(options.platform ?? process.platform)
  const home = options.home ?? homedir()
  const lines = options.lines ?? 100
  const live = options.live ?? false

  assertValidLogLines(lines)

  if (platform === 'darwin') {
    return {
      command: 'tail',
      args: live
        ? ['-n', String(lines), '-f', join(home, '.brijio', 'brijio.log')]
        : ['-n', String(lines), join(home, '.brijio', 'brijio.log')]
    }
  }

  return {
    command: 'journalctl',
    args: live
      ? ['--user', '-u', serviceName, '-n', String(lines), '--follow']
      : ['--user', '-u', serviceName, '-n', String(lines), '--no-pager']
  }
}

export async function streamDaemonLogs (options: { platform?: NodeJS.Platform, home?: string, lines?: number } = {}): Promise<number> {
  const logCommand = buildDaemonLogsCommand({
    platform: options.platform,
    home: options.home,
    lines: options.lines,
    live: true
  })
  const child = spawn(logCommand.command, logCommand.args, { stdio: 'inherit' })

  return await new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      resolve(code ?? (signal === null ? 0 : 1))
    })
  })
}

export async function installDaemon (command: Extract<DaemonCommand, { name: 'install' }>, options: { binaryUrl?: string, platform?: NodeJS.Platform, home?: string, runner?: CommandRunner } = {}): Promise<DaemonInstallPlan> {
  const platform = normalizePlatform(options.platform ?? process.platform)
  const home = options.home ?? homedir()
  const binaryPath = options.binaryUrl !== undefined
    ? fileURLToPath(options.binaryUrl)
    : resolveCurrentBinaryPath()
  const plan = planDaemonInstall({
    platform,
    home,
    binaryPath,
    wsPort: command.wsPort,
    mcpPort: command.mcpPort
  })
  const runner = options.runner ?? defaultRunner

  if (platform === 'darwin') {
    await runner.execFile('launchctl', ['unload', plan.linkPath]).catch(() => ({ stdout: '', stderr: '', code: 0 }))
    await runner.execFile('launchctl', ['load', plan.linkPath])
  } else {
    await runner.execFile('systemctl', ['--user', 'daemon-reload'])
    await runner.execFile('systemctl', ['--user', 'enable', '--now', serviceName])
  }

  return plan
}

export async function uninstallDaemon (options: { platform?: NodeJS.Platform, home?: string, runner?: CommandRunner } = {}): Promise<{ configDir: string, linkPath: string }> {
  const platform = normalizePlatform(options.platform ?? process.platform)
  const home = options.home ?? homedir()
  const configDir = join(home, '.brijio')
  const linkPath = platform === 'darwin'
    ? join(home, 'Library', 'LaunchAgents', `${label}.plist`)
    : join(home, '.config', 'systemd', 'user', serviceName)
  const runner = options.runner ?? defaultRunner

  if (platform === 'darwin') {
    await runner.execFile('launchctl', ['unload', linkPath]).catch(() => ({ stdout: '', stderr: '', code: 0 }))
  } else {
    await runner.execFile('systemctl', ['--user', 'disable', '--now', serviceName]).catch(() => ({ stdout: '', stderr: '', code: 0 }))
    await runner.execFile('systemctl', ['--user', 'daemon-reload']).catch(() => ({ stdout: '', stderr: '', code: 0 }))
  }

  rmSync(linkPath, { force: true })

  return { configDir, linkPath }
}

export async function getDaemonStatus (options: { platform?: NodeJS.Platform, home?: string, runner?: CommandRunner } = {}): Promise<DaemonStatus> {
  const platform = normalizePlatform(options.platform ?? process.platform)
  const home = options.home ?? homedir()
  const loadedEnv = loadBrijioEnv({ cwd: join(home, '.brijio'), home })
  const wsPort = loadedEnv.values.WEBSOCKET_PORT ?? '8787'
  const mcpPort = loadedEnv.values.MCP_HTTP_PORT ?? '8788'
  const runner = options.runner ?? defaultRunner
  const loaded = platform === 'darwin'
    ? (await runner.execFile('launchctl', ['list', label]).then((result) => result.code === 0).catch(() => false))
    : (await runner.execFile('systemctl', ['--user', 'is-active', '--quiet', serviceName]).then((result) => result.code === 0).catch(() => false))

  return {
    platform,
    loaded,
    wsHealth: await probeHealth(`http://127.0.0.1:${wsPort}/health`),
    mcpHealth: await probeHealth(`http://127.0.0.1:${mcpPort}/health`),
    envFilePath: join(home, '.brijio', '.env'),
    binaryPath: join(home, '.brijio', 'bin', 'brijio')
  }
}

export function formatStatus (status: DaemonStatus): string {
  const rows = [
    ['Daemon loaded', status.loaded ? 'yes' : 'no'],
    ['Config', status.envFilePath],
    ['Binary', status.binaryPath ?? 'unknown'],
    ['WebSocket health', formatHealth(status.wsHealth)],
    ['MCP health', formatHealth(status.mcpHealth)]
  ]
  const width = Math.max(...rows.map(([name]) => name.length))

  return rows
    .map(([name, value]) => `${name.padEnd(width)}  ${value}`)
    .join('\n')
}

export function usage (): string {
  return `Brijio

Usage:
  brijio                         Run WebSocket and MCP servers interactively
  brijio --dev                   Run in dev mode (bind to 127.0.0.1 only)
  brijio --print-config [agent]  Print MCP client config for an agent
  brijio --doctor                Run diagnostic checks
  brijio install [--ws-port N] [--mcp-port N]
  brijio uninstall
  brijio start
  brijio stop
  brijio restart
  brijio status
  brijio logs [--lines N] [--live]

Daemon config is stored in ~/.brijio/.env.
`
}

function parseInstallCommand (args: string[]): Extract<DaemonCommand, { name: 'install' }> {
  const command: Extract<DaemonCommand, { name: 'install' }> = { name: 'install' }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--ws-port') {
      command.wsPort = parseRequiredPort(arg, args[index + 1])
      index += 1
      continue
    }

    if (arg === '--mcp-port') {
      command.mcpPort = parseRequiredPort(arg, args[index + 1])
      index += 1
      continue
    }

    throw new Error(`Unknown install option: ${arg}`)
  }

  return command
}

function parseLogsCommand (args: string[]): Extract<DaemonCommand, { name: 'logs' }> {
  const command: Extract<DaemonCommand, { name: 'logs' }> = { name: 'logs', lines: 100, live: false }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--lines' || arg === '-n') {
      command.lines = parseRequiredPositiveInteger(arg, args[index + 1])
      index += 1
      continue
    }

    if (arg === '--live') {
      command.live = true
      continue
    }

    throw new Error(`Unknown logs option: ${arg}`)
  }

  return command
}

function parseRequiredPositiveInteger (flag: string, value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '', 10)

  if (!Number.isSafeInteger(parsed) || String(parsed) !== value || parsed < 1) {
    throw new Error(`Invalid ${flag}: ${value ?? '<missing>'}`)
  }

  return parsed
}

function parseRequiredPort (flag: string, value: string | undefined): number {
  const port = Number.parseInt(value ?? '', 10)

  if (!Number.isSafeInteger(port) || String(port) !== value || port < 1 || port > 65535) {
    throw new Error(`Invalid ${flag}: ${value ?? '<missing>'}`)
  }

  return port
}

function ensureNoArgs (command: string, args: string[]): void {
  if (args.length > 0) {
    throw new Error(`${command} does not accept arguments: ${args.join(' ')}`)
  }
}

function parseEnvFile (content: string): Record<string, string> {
  const values: Record<string, string> = {}

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (line === '' || line.startsWith('#')) {
      continue
    }

    const separator = line.indexOf('=')

    if (separator <= 0) {
      continue
    }

    const key = line.slice(0, separator).trim()
    const rawValue = line.slice(separator + 1).trim()
    values[key] = unquoteEnvValue(rawValue)
  }

  return values
}

function formatEnvFile (values: Record<string, string>): string {
  const keys = [
    'BRIJIO_PAIRING_TOKEN',
    'MCP_HTTP_AUTH_TOKEN',
    'WEBSOCKET_PORT',
    'MCP_HTTP_PORT',
    ...Object.keys(values).filter((key) => ![
      'BRIJIO_PAIRING_TOKEN',
      'MCP_HTTP_AUTH_TOKEN',
      'WEBSOCKET_PORT',
      'MCP_HTTP_PORT'
    ].includes(key)).sort()
  ]

  return keys
    .filter((key) => values[key] !== undefined)
    .map((key) => `${key}=${values[key]}`)
    .join('\n') + '\n'
}

function unquoteEnvValue (value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }

  return value
}

function writeDaemonWrapper (path: string, sourceBinaryPath: string): void {
  const source = `#!/bin/sh
exec ${shellQuote(process.execPath)} ${shellQuote(sourceBinaryPath)} "$@"
`
  writeFileSync(path, source, { mode: 0o755 })
  chmodSync(path, 0o755)
}

function replaceSymlink (target: string, linkPath: string): void {
  if (existsSync(linkPath)) {
    unlinkSync(linkPath)
  }
  symlinkSync(target, linkPath)
}

function getDaemonPaths (platform: DaemonPlatform, home: string): { configDir: string, linkPath: string } {
  const configDir = join(home, '.brijio')
  const linkPath = platform === 'darwin'
    ? join(home, 'Library', 'LaunchAgents', `${label}.plist`)
    : join(home, '.config', 'systemd', 'user', serviceName)

  return { configDir, linkPath }
}

function normalizePlatform (platform: NodeJS.Platform): DaemonPlatform {
  if (platform === 'darwin' || platform === 'linux') {
    return platform
  }

  throw new Error(`Brijio daemon install does not support ${platform} yet.`)
}

function resolveCurrentBinaryPath (): string {
  if (process.argv[1] !== undefined && process.argv[1] !== '') {
    return process.argv[1]
  }

  return fileURLToPath(import.meta.url)
}

function escapeXml (value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function shellQuote (value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

async function probeHealth (url: string): Promise<HealthProbeResult> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) })
    return {
      url,
      ok: response.ok,
      statusCode: response.status
    }
  } catch (error) {
    return {
      url,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

function assertValidLogLines (lines: number): void {
  if (!Number.isSafeInteger(lines) || lines < 1) {
    throw new Error(`Invalid log line count: ${lines}`)
  }
}

function tailLines (content: string, lines: number): string {
  const allLines = content.split(/\r?\n/)
  if (allLines.length > 0 && allLines[allLines.length - 1] === '') {
    allLines.pop()
  }
  return allLines.slice(-lines).join('\n')
}

function formatHealth (health: HealthProbeResult): string {
  if (health.ok) {
    return `ok (${health.url})`
  }

  if (health.statusCode !== undefined) {
    return `failed HTTP ${health.statusCode} (${health.url})`
  }

  return `failed: ${health.error ?? 'unknown error'} (${health.url})`
}

const defaultRunner: CommandRunner = {
  async execFile (command: string, args: string[]): Promise<{ stdout: string, stderr: string, code: number }> {
    return await new Promise((resolve, reject) => {
      execFile(command, args, (error, stdout, stderr) => {
        const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'number'
          ? error.code
          : 0
        const result = { stdout, stderr, code }

        if (error !== null && code !== 0) {
          reject(Object.assign(error, result))
          return
        }

        resolve(result)
      })
    })
  }
}
