/**
 * Shell command formatters for CLI-based agents (codex, claude-code, gemini).
 */

import type { PrintConfigOptions, FormatterOutput } from './print-config.js'

/** Build an Authorization header value */
function authTokenHeader (token: string): string {
  return ['Authorization', 'Bearer', token].join(' ')
}

/** codex - shell command */
export function formatCodex (opts: PrintConfigOptions): FormatterOutput {
  const cmd = 'codex mcp add brijio --url ' + opts.mcpUrl + ' --bearer-token-env-var ' + opts.authTokenEnvVar
  const ephemeralNote = opts.isEphemeral ? '\n# Note: Token is ephemeral \u2014 it changes on restart.' : ''
  return {
    stdout: '# Add Brijio to Codex:\n' + cmd + ephemeralNote,
    stderr: '# Run this command in your shell to add Brijio to Codex'
  }
}

/** claude-code - shell command */
export function formatClaudeCode (opts: PrintConfigOptions): FormatterOutput {
  const hdr = authTokenHeader(opts.authToken)
  const cmd = 'claude mcp add brijio --transport http --url ' + opts.mcpUrl + ' --header "' + hdr + '"'
  const ephemeralNote = opts.isEphemeral ? '\n# Note: Token is ephemeral \u2014 it changes on restart.' : ''
  return {
    stdout: '# Add Brijio to Claude Code:\n' + cmd + ephemeralNote,
    stderr: '# Run this command in your shell to add Brijio to Claude Code'
  }
}

/** gemini - shell command */
export function formatGemini (opts: PrintConfigOptions): FormatterOutput {
  const hdr = authTokenHeader(opts.authToken)
  const cmd = 'gemini mcp add --transport http brijio ' + opts.mcpUrl + ' --header "' + hdr + '"'
  const ephemeralNote = opts.isEphemeral ? '\n# Note: Token is ephemeral \u2014 it changes on restart.' : ''
  return {
    stdout: '# Add Brijio to Gemini CLI:\n' + cmd + ephemeralNote,
    stderr: '# Run this command in your shell to add Brijio to Gemini CLI'
  }
}
