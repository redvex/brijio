import { readFile, readdir, stat } from 'node:fs/promises'
import { join, basename } from 'node:path'

/**
 * Represents a BrowserBridge skill exposed via MCP resources, prompts,
 * and plugin manifests.
 */
export interface BrowserBridgeSkill {
  /** Skill identifier (derived from directory name, e.g. "form-filling") */
  name: string
  /** Human-readable title extracted from the first H1 in the markdown */
  title: string
  /** Short description for MCP resource/prompt listings (from frontmatter) */
  description: string
  /** Full markdown content (without frontmatter) */
  content: string
}

/**
 * Parsed YAML frontmatter from a SKILL.md file.
 */
interface SkillFrontmatter {
  name?: string
  description?: string
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load all skill directories from the skills root directory.
 *
 * Each skill is a directory under `skillsDir` containing a `SKILL.md` file
 * with optional YAML frontmatter:
 *
 * ```
 * ---
 * name: form-filling
 * description: "Complete forms on authenticated pages..."
 * ---
 *
 * # Smart Form Filling
 * ...
 * ```
 *
 * The `name` defaults to the directory name if not specified in frontmatter.
 * The `description` defaults to the first non-heading paragraph if not in
 * frontmatter.
 *
 * @param skillsDir - Absolute path to the skills root directory.
 * @returns Array of parsed skills, sorted alphabetically by name.
 */
export async function loadSkills (
  skillsDir: string
): Promise<BrowserBridgeSkill[]> {
  let entries: string[]
  try {
    entries = await readdir(skillsDir)
  } catch {
    return []
  }

  const skillDirs: string[] = []
  for (const entry of entries) {
    const fullPath = join(skillsDir, entry)
    const s = await stat(fullPath)
    if (s.isDirectory()) {
      skillDirs.push(entry)
    }
  }

  const skills = await Promise.all(
    skillDirs.map(async (dirName) => {
      const skillFilePath = join(skillsDir, dirName, 'SKILL.md')
      let rawContent: string
      try {
        rawContent = await readFile(skillFilePath, 'utf-8')
      } catch {
        return null
      }

      const { frontmatter, body } = parseFrontmatter(rawContent)
      const name = frontmatter.name ?? dirName
      const title = extractTitle(body)
      const description = frontmatter.description ?? extractDescription(body)

      return { name, title, description, content: body } as BrowserBridgeSkill
    })
  )

  return skills
    .filter((s): s is BrowserBridgeSkill => s !== null)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Build the MCP skill resource URI for a given skill name.
 *
 * Format: `skill://browserbridge/{name}`
 */
export function skillResourceUri (name: string): string {
  return `skill://browserbridge/${name}`
}

/**
 * Build the combined context message for the `browserbridge-context`
 * prompt. This includes connected browsers, pitfalls, and skill descriptions.
 *
 * @param skillSummaries - Array of skill name/title/description summaries.
 * @returns Formatted context string to inject into the MCP session.
 */
export function buildContextMessage (
  skillSummaries: Array<{ name: string, title: string, description: string }>
): string {
  const skillList = skillSummaries
    .map((s) => `- **${s.title}** (${s.name}): ${s.description}`)
    .join('\n')

  return [
    'You have access to BrowserBridge, a bridge to the user\'s real browser.',
    '',
    '## Connected Browsers',
    '',
    'Call `list_browsers` to see which browsers are currently connected.',
    'Always specify `browserInstanceId` when multiple browsers are available.',
    '',
    '## Available Skills',
    '',
    'Skills are detailed workflow guides available as MCP resources.',
    'Read a skill\'s full instructions with `read_resource` using the URI format:',
    '`skill://browserbridge/{skill_name}`',
    '',
    skillList,
    '',
    '## Key Pitfalls',
    '',
    '- **Password fields**: `fill_input` returns `browser_error` for type="password". Skip them.',
    '- **Radio buttons**: You cannot uncheck a radio button. Select a different option instead.',
    '- **Readonly/disabled inputs**: `fill_input` returns `browser_error`. Skip these fields.',
    '- **Short-lived IDs**: Element IDs (e5, f2, a1) expire when the page changes. Re-read the page after any navigation or DOM update.',
    '- **Never auto-submit**: Always ask the user to review and submit forms manually, unless explicitly asked to submit.',
    '- **Multiple browsers**: When both Chrome and Safari are connected, always specify `browserInstanceId`.',
    ''
  ].join('\n')
}

/**
 * Resolve the skills directory path. In production, looks next to the
 * compiled JS output. In development, looks next to the TS source.
 */
export function resolveSkillsDir (sourceDir?: string): string {
  const base = sourceDir ?? import.meta.dirname
  return join(base, '..', 'skills')
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Parse YAML frontmatter from a markdown file.
 *
 * Frontmatter is delimited by `---` on its own line at the start of the file.
 * Returns the parsed frontmatter keys and the body (content after the closing
 * `---`). If no frontmatter is found, returns empty frontmatter and the
 * original content as body.
 */
function parseFrontmatter (content: string): {
  frontmatter: SkillFrontmatter
  body: string
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/m.exec(content)
  if (!match) {
    return { frontmatter: {}, body: content }
  }

  const rawFrontmatter = match[1]
  const rawBody = match[2]
  const body = rawBody.startsWith('\n') ? rawBody.slice(1) : rawBody

  const frontmatter: SkillFrontmatter = {}
  for (const line of rawFrontmatter.split('\n')) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue
    const key = line.slice(0, colonIndex).trim()
    let value: string = line.slice(colonIndex + 1).trim()
    // Strip surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key === 'name') frontmatter.name = value
    if (key === 'description') frontmatter.description = value
  }

  return { frontmatter, body }
}

/**
 * Extract the title from the first H1 heading in a skill markdown file.
 * Falls back to an empty string if no H1 is found.
 */
function extractTitle (content: string): string {
  const match = /^#\s+(.+)$/m.exec(content)
  return match?.[1]?.trim() ?? ''
}

/**
 * Extract a short description from the first non-heading paragraph.
 * Collapses whitespace and truncates at 200 characters.
 */
function extractDescription (content: string): string {
  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue
    const collapsed = trimmed.replace(/\s+/g, ' ')
    if (collapsed.length > 200) {
      return collapsed.slice(0, 197) + '...'
    }
    return collapsed
  }
  return ''
}