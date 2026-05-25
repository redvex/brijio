export interface MarkdownTable {
  headers: string[]
  rows: string[][]
}

export interface ContentChunk {
  index: number
  content: string
  truncated: boolean
}

const textEncoder = new TextEncoder()

export function renderMarkdownLink (text: string, href: string): string {
  return `[${escapeMarkdownLabel(text)}](${href})`
}

export function renderMarkdownImage (alt: string, src: string): string {
  return `![${escapeMarkdownLabel(alt)}](${src})`
}

export function renderMarkdownTable (table: MarkdownTable): string {
  const headers = table.headers.map(escapeTableCell)
  const separator = headers.map(() => '---')
  const rows = table.rows.map((row) => row.map(escapeTableCell))

  return [headers, separator, ...rows]
    .map((row) => `| ${row.join(' | ')} |`)
    .join('\n')
}

export function chunkReadableContent (
  content: string,
  index: number,
  maxContentBytes: number
): ContentChunk {
  if (!Number.isInteger(index) || index < 1 || maxContentBytes < 1) {
    throw new Error('invalid_index')
  }

  const chunks = splitContent(content, maxContentBytes)

  if (index > chunks.length) {
    throw new Error('invalid_index')
  }

  return {
    index,
    content: chunks[index - 1],
    truncated: index < chunks.length
  }
}

function splitContent (content: string, maxContentBytes: number): string[] {
  if (byteLength(content) <= maxContentBytes) {
    return [content]
  }

  const chunks: string[] = []
  let current = ''

  for (const block of content.split(/\n{2,}/u)) {
    const next = current === '' ? block : `${current}\n\n${block}`

    if (byteLength(next) <= maxContentBytes) {
      current = next
      continue
    }

    if (current !== '') {
      chunks.push(current)
      current = ''
    }

    if (byteLength(block) <= maxContentBytes) {
      current = block
      continue
    }

    chunks.push(...splitLongBlock(block, maxContentBytes))
  }

  if (current !== '') {
    chunks.push(current)
  }

  return chunks.length === 0 ? [''] : chunks
}

function splitLongBlock (block: string, maxContentBytes: number): string[] {
  const chunks: string[] = []
  let current = ''

  for (const character of block) {
    const next = `${current}${character}`

    if (byteLength(next) > maxContentBytes) {
      if (current !== '') {
        chunks.push(current)
      }
      current = character
      continue
    }

    current = next
  }

  if (current !== '') {
    chunks.push(current)
  }

  return chunks
}

function byteLength (value: string): number {
  return textEncoder.encode(value).byteLength
}

function escapeMarkdownLabel (value: string): string {
  return value.replaceAll('[', '\\[').replaceAll(']', '\\]')
}

function escapeTableCell (value: string): string {
  return value.replaceAll('|', '\\|').replace(/\s+/gu, ' ').trim()
}
