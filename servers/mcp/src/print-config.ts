/**
 * Config formatters for --print-config (ADR-0038).
 *
 * Each agent has a formatter that produces a ready-to-copy config block.
 * Output goes to stdout; hints go to stderr.
 */
import type { NetworkPaths } from './network.js'

import { formatCodex, formatClaudeCode, formatGemini } from './print-config-commands.js'

/** Options passed to all formatters */
export interface PrintConfigOptions {
  /** MCP server URL (e.g. http://100.64.0.42:8788/mcp) */
  mcpUrl: string
  /** WS server URL (e.g. ws://100.64.0.42:8787) */
  wsUrl: string
  /** Resolved auth token */
  authToken: string
  /** Env var name for the auth token (for agents that reference by env var) */
  authTokenEnvVar: string
  /** Whether this token was auto-generated / ephemeral */
  isEphemeral: boolean
  /** Dev mode flag */
  isDev: boolean
  /** Detected network paths (for choosing best URL) */
  networkPaths?: NetworkPaths
  /** @internal Agent name for hint selection (set by formatConfig) */
  _agent?: string
}

/** Output of a formatter: stdout content + stderr hint */
export interface FormatterOutput {
  /** The config block to print to stdout */
  stdout: string
  /** A short hint to print to stderr (where to paste) */
  stderr: string
}

/** Canonical agent names and their display labels */
export const AGENTS: Array<{ name: string, label: string, aliases: string[] }> = [
  { name: 'claude-desktop', label: 'Claude Desktop app', aliases: ['claude'] },
  { name: 'cursor', label: 'Cursor IDE', aliases: ['cur'] },
  { name: 'vscode', label: 'VS Code + GitHub Copilot', aliases: ['vs'] },
  { name: 'cline', label: 'Cline (VS Code extension)', aliases: [] },
  { name: 'codex', label: 'OpenAI Codex CLI', aliases: [] },
  { name: 'hermes', label: 'Hermes Agent', aliases: [] },
  { name: 'claude-code', label: 'Claude Code CLI', aliases: ['code'] },
  { name: 'gemini', label: 'Gemini CLI', aliases: [] },
  { name: 'windsurf', label: 'Windsurf (Codeium)', aliases: [] },
  { name: 'zed', label: 'Zed editor', aliases: [] },
  { name: 'continue', label: 'Continue (VS Code/JetBrains)', aliases: [] },
  { name: 'goose', label: 'Goose AI agent', aliases: [] }
]

/** Map from all names+aliases to canonical name */
export function resolveAgentName (input: string): string | null {
  const lower = input.toLowerCase()
  for (const agent of AGENTS) {
    if (agent.name === lower || agent.aliases.includes(lower)) {
      return agent.name
    }
  }
  return null
}

/** Generate the interactive agent picker prompt */
export function formatInteractivePrompt (): string {
  const lines = ['\nWhich agent are you configuring?\n']
  AGENTS.forEach((agent, i) => {
    const num = String(i + 1).padStart(2, ' ')
    lines.push(`  ${num}. ${agent.name.padEnd(18)}${agent.label}`)
  })
  lines.push(`\nEnter a number [1-${AGENTS.length}]:`)
  return lines.join('\n')
}

// ─── Formatters ──────────────────────────────────────────────────────

function jsonBlock (obj: object): string {
  return JSON.stringify(obj, null, 2)
}

/** claude-desktop, cursor, cline — standard mcpServers JSON */
function formatMcpServers (opts: PrintConfigOptions): FormatterOutput {
  const config = {
    mcpServers: {
      brijio: {
        url: opts.mcpUrl,
        headers: {
          Authorization: `Bearer ${opts.authToken}`
        }
      }
    }
  }

  const hintMap: Record<string, string> = {
    'claude-desktop': '# Paste this into your claude_desktop_config.json (macOS: ~/Library/Application Support/Claude/)',
    cursor: '# Paste this into .cursor/mcp.json or ~/.cursor/mcp.json',
    cline: '# Configure in Cline settings → MCP Servers → Add server'
  }

  return {
    stdout: jsonBlock(config),
    stderr: hintMap[opts._agent ?? 'claude-desktop'] ?? '# Paste this into your MCP client config'
  }
}

/** vscode — servers key with type: http */
function formatVscode (opts: PrintConfigOptions): FormatterOutput {
  const config = {
    servers: {
      brijio: {
        type: 'http',
        url: opts.mcpUrl,
        headers: {
          Authorization: `Bearer ${opts.authToken}`
        }
      }
    }
  }
  return {
    stdout: jsonBlock(config),
    stderr: '# Paste this into .vscode/mcp.json (project) or your VS Code settings'
  }
}

/** hermes — YAML config */
function formatHermes (opts: PrintConfigOptions): FormatterOutput {
  const tokenLine = opts.isEphemeral
    ? '    Authorization: "Bearer ' + opts.authToken + '"  # [ephemeral — changes on restart]'
    : '    Authorization: "Bearer ' + opts.authToken + '"'
  const stdout = [
    '# Brijio MCP server — add to ~/.hermes/config.yaml',
    'mcp_servers:',
    '  brijio:',
    '    url: "' + opts.mcpUrl + '"',
    '    headers:',
    tokenLine
  ].join('\n')
  return {
    stdout,
    stderr: '# Add this to ~/.hermes/config.yaml under mcp_servers'
  }
}

/** windsurf — mcpServers with serverUrl and ${env:} interpolation */
function formatWindsurf (opts: PrintConfigOptions): FormatterOutput {
  const config = {
    mcpServers: {
      brijio: {
        serverUrl: opts.mcpUrl,
        headers: {
          Authorization: 'Bearer ${env:' + opts.authTokenEnvVar + '}'
        }
      }
    }
  }
  return {
    stdout: jsonBlock(config),
    stderr: '# Paste this into ~/.codeium/windsurf/mcp_config.json'
  }
}

/** zed — context_servers key */
function formatZed (opts: PrintConfigOptions): FormatterOutput {
  const config = {
    context_servers: {
      brijio: {
        url: opts.mcpUrl,
        headers: {
          Authorization: `Bearer ${opts.authToken}`
        }
      }
    }
  }
  return {
    stdout: jsonBlock(config),
    stderr: '# Add to .zed/settings.json (project) or ~/.config/zed/settings.json (global)'
  }
}

/** continue — YAML with metadata */
function formatContinue (opts: PrintConfigOptions): FormatterOutput {
  const description = opts.isDev
    ? '  description: "[dev/ephemeral] Brijio — tokens change on restart"\n'
    : ''
  const tokenValue = opts.isEphemeral
    ? opts.authToken + '  # [ephemeral — changes on restart]'
    : opts.authToken
  const stdout = [
    'name: Brijio MCP Server',
    'version: 0.0.1',
    'schema: v1',
    'mcpServers:',
    '  - name: brijio',
    '    type: streamable-http',
    '    url: ' + opts.mcpUrl,
    description + '    headers:',
    '      Authorization: "Bearer ' + tokenValue + '"'
  ].filter(l => l !== '').join('\n')
  return {
    stdout,
    stderr: '# Save as .continue/mcpServers/brijio.yaml in your project'
  }
}

/** goose — not supported (instructional) */
function formatGoose (_opts: PrintConfigOptions): FormatterOutput {
  return {
    stdout: [
      '\u26A0  Goose only supports stdio-based MCP servers. Brijio runs as an HTTP server.',
      '',
      '   No direct configuration is possible. If Goose adds HTTP transport support,',
      '   this output will be updated to provide a working config.',
      '',
      '   In the meantime, you can use a stdio-to-HTTP bridge (e.g. mcp-proxy)',
      '   as a manual workaround \u2014 see https://github.com/nicholasgasior/mcp-proxy'
    ].join('\n'),
    stderr: ''
  }
}

/** Formatter map: canonical name -> formatter function */
const FORMATTERS: Record<string, (opts: PrintConfigOptions) => FormatterOutput> = {
  'claude-desktop': formatMcpServers,
  cursor: formatMcpServers,
  cline: formatMcpServers,
  vscode: formatVscode,
  codex: formatCodex,
  hermes: formatHermes,
  'claude-code': formatClaudeCode,
  gemini: formatGemini,
  windsurf: formatWindsurf,
  zed: formatZed,
  continue: formatContinue,
  goose: formatGoose
}

/**
 * Format a config block for the given agent.
 * Returns { stdout, stderr } where stdout is the config and stderr is
 * a hint about where to paste it.
 */
export function formatConfig (agent: string, opts: PrintConfigOptions): FormatterOutput {
  const canonical = resolveAgentName(agent)
  if (canonical == null) {
    throw new Error(`Unknown agent: "${agent}". Run "brijio --print-config" to see available agents.`)
  }
  const formatter = FORMATTERS[canonical]
  if (formatter == null) {
    throw new Error(`No formatter for agent: "${canonical}"`)
  }
  // Stamp the agent name on opts so formatters can use it for hints
  const enriched = { ...opts, _agent: canonical }
  return formatter(enriched)
}

/** Default JSON format (widest-compatible mcpServers envelope) */
export function formatDefaultJson (opts: PrintConfigOptions): FormatterOutput {
  return formatMcpServers(opts)
}
