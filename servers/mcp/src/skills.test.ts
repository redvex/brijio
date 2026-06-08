import assert from 'node:assert/strict'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, it } from 'node:test'
import {
  buildContextMessage,
  loadSkills,
  resolveSkillsDir,
  skillResourceUri
} from './skills.js'

// ---------------------------------------------------------------------------
// Internal logic replicated for unit testing (not exported from module)
// ---------------------------------------------------------------------------

function extractTitle (content: string): string {
  const match = /^#\s+(.+)$/m.exec(content)
  return match?.[1]?.trim() ?? ''
}

function extractDescription (content: string): string {
  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue
    const collapsed = trimmed.replace(/\s+/g, ' ')
    if (collapsed.length > 200) return collapsed.slice(0, 197) + '...'
    return collapsed
  }
  return ''
}

function parseFrontmatter (content: string): {
  frontmatter: { name?: string, description?: string }
  body: string
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/m.exec(content)
  if (match === null) return { frontmatter: {}, body: content }

  const rawFrontmatter = match[1]
  const rawBody = match[2]
  const body = rawBody.startsWith('\n') ? rawBody.slice(1) : rawBody
  const frontmatter: { name?: string, description?: string } = {}

  for (const line of rawFrontmatter.split('\n')) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue
    const key = line.slice(0, colonIndex).trim()
    let value: string = line.slice(colonIndex + 1).trim()
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

const tmpDirs: string[] = []

afterEach(async () => {
  await Promise.all(
    tmpDirs.splice(0).map(async (dir) => {
      await rm(dir, { recursive: true, force: true })
    })
  )
})

void describe('skills', () => {
  void describe('loadSkills', () => {
    void it('returns an empty array when the directory does not exist', async () => {
      const skills = await loadSkills('/nonexistent/path')
      assert.deepEqual(skills, [])
    })

    void it('loads skill directories with SKILL.md files', async () => {
      const tmpDir = await mkdtemp()
      await mkdir(join(tmpDir, 'form-filling'), { recursive: true })
      await writeFile(
        join(tmpDir, 'form-filling', 'SKILL.md'),
        '---\nname: form-filling\ndescription: "Complete forms on authenticated pages."\n---\n\n# Smart Form Filling\n\nComplete forms on authenticated pages.',
        'utf-8'
      )
      await mkdir(join(tmpDir, 'data-extraction'), { recursive: true })
      await writeFile(
        join(tmpDir, 'data-extraction', 'SKILL.md'),
        '---\nname: data-extraction\ndescription: "Extract structured data."\n---\n\n# Data Extraction\n\nExtract structured data.',
        'utf-8'
      )

      const skills = await loadSkills(tmpDir)
      assert.equal(skills.length, 2)
      assert.equal(skills[0].name, 'data-extraction')
      assert.equal(skills[0].title, 'Data Extraction')
      assert.equal(skills[0].description, 'Extract structured data.')
      assert.equal(skills[1].name, 'form-filling')
      assert.equal(skills[1].title, 'Smart Form Filling')
      assert.equal(skills[1].description, 'Complete forms on authenticated pages.')
    })

    void it('uses directory name as fallback when frontmatter name is missing', async () => {
      const tmpDir = await mkdtemp()
      await mkdir(join(tmpDir, 'my-skill'), { recursive: true })
      await writeFile(
        join(tmpDir, 'my-skill', 'SKILL.md'),
        '# My Skill\n\nA valid skill.',
        'utf-8'
      )

      const skills = await loadSkills(tmpDir)
      assert.equal(skills.length, 1)
      assert.equal(skills[0].name, 'my-skill')
    })

    void it('ignores directories without SKILL.md', async () => {
      const tmpDir = await mkdtemp()
      await mkdir(join(tmpDir, 'no-skill-dir'), { recursive: true })
      await writeFile(join(tmpDir, 'no-skill-dir', 'notes.txt'), 'not a skill', 'utf-8')
      await mkdir(join(tmpDir, 'valid'), { recursive: true })
      await writeFile(
        join(tmpDir, 'valid', 'SKILL.md'),
        '---\nname: valid\ndescription: "A valid skill."\n---\n\n# Valid\n\nA valid skill.',
        'utf-8'
      )

      const skills = await loadSkills(tmpDir)
      assert.equal(skills.length, 1)
      assert.equal(skills[0].name, 'valid')
    })

    void it('returns skills sorted alphabetically by name', async () => {
      const tmpDir = await mkdtemp()
      for (const name of ['zebra', 'alpha', 'mid']) {
        await mkdir(join(tmpDir, name), { recursive: true })
        await writeFile(
          join(tmpDir, name, 'SKILL.md'),
          `---\nname: ${name}\ndescription: "${name} desc."\n---\n\n# ${name}\n\n${name} desc.`,
          'utf-8'
        )
      }

      const skills = await loadSkills(tmpDir)
      assert.deepEqual(
        skills.map((s) => s.name),
        ['alpha', 'mid', 'zebra']
      )
    })

    void it('includes full markdown body content (without frontmatter)', async () => {
      const tmpDir = await mkdtemp()
      await mkdir(join(tmpDir, 'my-skill'), { recursive: true })
      const body = '# My Skill\n\nBody paragraph.\n\n## Section\n\nMore details.'
      await writeFile(
        join(tmpDir, 'my-skill', 'SKILL.md'),
        `---\nname: my-skill\ndescription: "A skill."\n---\n\n${body}`,
        'utf-8'
      )

      const skills = await loadSkills(tmpDir)
      assert.equal(skills[0].content, body)
    })

    void it('handles empty skill files gracefully', async () => {
      const tmpDir = await mkdtemp()
      await mkdir(join(tmpDir, 'empty'), { recursive: true })
      await writeFile(join(tmpDir, 'empty', 'SKILL.md'), '', 'utf-8')

      const skills = await loadSkills(tmpDir)
      assert.equal(skills.length, 1)
      assert.equal(skills[0].title, '')
      assert.equal(skills[0].description, '')
    })

    void it('uses frontmatter description over body paragraph', async () => {
      const tmpDir = await mkdtemp()
      await mkdir(join(tmpDir, 'test-skill'), { recursive: true })
      await writeFile(
        join(tmpDir, 'test-skill', 'SKILL.md'),
        '---\nname: test-skill\ndescription: "Frontmatter description."\n---\n\n# Test Skill\n\nBody paragraph that should be ignored for the description.',
        'utf-8'
      )

      const skills = await loadSkills(tmpDir)
      assert.equal(skills[0].description, 'Frontmatter description.')
    })

    void it('extracts description from body when frontmatter lacks it', async () => {
      const tmpDir = await mkdtemp()
      await mkdir(join(tmpDir, 'body-desc'), { recursive: true })
      await writeFile(
        join(tmpDir, 'body-desc', 'SKILL.md'),
        '---\nname: body-desc\n---\n\n# Body Desc\n\nThis is extracted from the body.',
        'utf-8'
      )

      const skills = await loadSkills(tmpDir)
      assert.equal(skills[0].description, 'This is extracted from the body.')
    })
  })

  void describe('skillResourceUri', () => {
    void it('builds a skill URI from a name', () => {
      assert.equal(
        skillResourceUri('form-filling'),
        'skill://brijio/form-filling'
      )
    })

    void it('handles names with hyphens', () => {
      assert.equal(
        skillResourceUri('web-qa'),
        'skill://brijio/web-qa'
      )
    })
  })

  void describe('parseFrontmatter', () => {
    void it('parses valid YAML frontmatter', () => {
      const content = '---\nname: my-skill\ndescription: "A test skill."\n---\n\n# My Skill\n\nBody.'
      const { frontmatter, body } = parseFrontmatter(content)
      assert.equal(frontmatter.name, 'my-skill')
      assert.equal(frontmatter.description, 'A test skill.')
      assert.equal(body, '# My Skill\n\nBody.')
    })

    void it('returns empty frontmatter and original content when no frontmatter', () => {
      const content = '# No Frontmatter\n\nJust body.'
      const { frontmatter, body } = parseFrontmatter(content)
      assert.deepEqual(frontmatter, {})
      assert.equal(body, content)
    })

    void it('handles single-quoted values', () => {
      const content = "---\nname: test\ndescription: 'A description'\n---\n\n# Test"
      const { frontmatter } = parseFrontmatter(content)
      assert.equal(frontmatter.description, 'A description')
    })

    void it('ignores unknown frontmatter keys', () => {
      const content = '---\nname: test\nversion: 1.0\n---\n\n# Test'
      const { frontmatter } = parseFrontmatter(content)
      assert.equal(frontmatter.name, 'test')
      assert.equal(frontmatter.description, undefined)
    })
  })

  void describe('extractTitle', () => {
    void it('extracts the first H1 heading', () => {
      assert.equal(extractTitle('# Hello World\n\nBody'), 'Hello World')
    })

    void it('returns empty string when no H1 is present', () => {
      assert.equal(extractTitle('No heading here'), '')
    })

    void it('ignores H2 and lower headings', () => {
      assert.equal(extractTitle('## Not H1\n\nBody'), '')
    })

    void it('trims whitespace from the title', () => {
      assert.equal(extractTitle('#   Spaced Title  \n\nBody'), 'Spaced Title')
    })
  })

  void describe('extractDescription', () => {
    void it('extracts the first non-heading paragraph', () => {
      assert.equal(
        extractDescription('# Title\n\nThis is the description.'),
        'This is the description.'
      )
    })

    void it('skips blank lines', () => {
      assert.equal(
        extractDescription('# Title\n\n\n\nActual description.'),
        'Actual description.'
      )
    })

    void it('skips H2 headings', () => {
      assert.equal(
        extractDescription('# Title\n\n## Section\n\nReal description.'),
        'Real description.'
      )
    })

    void it('truncates long descriptions at 200 characters', () => {
      const longLine = 'A'.repeat(250)
      const result = extractDescription(`# Title\n\n${longLine}`)
      assert.equal(result.length, 200)
      assert.ok(result.endsWith('...'))
    })

    void it('returns empty string when no content paragraph exists', () => {
      assert.equal(extractDescription('# Only Heading'), '')
    })

    void it('collapses whitespace in descriptions', () => {
      assert.equal(
        extractDescription('# Title\n\n  Multiple   spaces   here  '),
        'Multiple spaces here'
      )
    })
  })

  void describe('buildContextMessage', () => {
    void it('includes skill summaries', () => {
      const message = buildContextMessage([
        { name: 'form-filling', title: 'Smart Form Filling', description: 'Complete forms.' },
        { name: 'data-extraction', title: 'Data Extraction', description: 'Extract data.' }
      ])

      assert.ok(message.includes('Smart Form Filling'))
      assert.ok(message.includes('form-filling'))
      assert.ok(message.includes('Complete forms.'))
      assert.ok(message.includes('Data Extraction'))
      assert.ok(message.includes('data-extraction'))
    })

    void it('includes pitfalls section', () => {
      const message = buildContextMessage([])
      assert.ok(message.includes('Password fields'))
      assert.ok(message.includes('Radio buttons'))
      assert.ok(message.includes('Short-lived IDs'))
    })

    void it('includes skill URI format', () => {
      const message = buildContextMessage([])
      assert.ok(message.includes('skill://brijio/'))
    })

    void it('handles empty skill list', () => {
      const message = buildContextMessage([])
      assert.ok(message.includes('Available Skills'))
      assert.ok(message.includes('Key Pitfalls'))
    })
  })

  void describe('resolveSkillsDir', () => {
    void it('returns a path that includes skills as the final directory', () => {
      const dir = resolveSkillsDir()
      const normalized = dir.replace(/\\/g, '/')
      assert.ok(normalized.endsWith('/skills'), `Expected dir to end with /skills, got: ${normalized}`)
    })
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function mkdtemp (): Promise<string> {
  const dir = join(
    import.meta.dirname,
    `.test-skills-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  )
  await mkdir(dir, { recursive: true })
  tmpDirs.push(dir)
  return dir
}
