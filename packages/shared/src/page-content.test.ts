import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  chunkReadableContent,
  renderMarkdownImage,
  renderMarkdownLink,
  renderMarkdownTable
} from './page-content.js'

void describe('page content helpers', () => {
  void it('renders links as minimal Markdown', () => {
    assert.equal(
      renderMarkdownLink('Example Domain', 'https://example.com/'),
      '[Example Domain](https://example.com/)'
    )
  })

  void it('renders images as minimal Markdown', () => {
    assert.equal(
      renderMarkdownImage('Company logo', 'https://example.com/logo.png'),
      '![Company logo](https://example.com/logo.png)'
    )
  })

  void it('renders simple tables as Markdown tables', () => {
    assert.equal(
      renderMarkdownTable({
        headers: ['Name', 'Role'],
        rows: [
          ['Ava', 'Admin'],
          ['Noah', 'Viewer']
        ]
      }),
      '| Name | Role |\n| --- | --- |\n| Ava | Admin |\n| Noah | Viewer |'
    )
  })

  void it('chunks content under the serialized message limit', () => {
    const content = ['alpha', 'beta', 'gamma', 'delta'].join('\n')

    assert.deepEqual(chunkReadableContent(content, 1, 100), {
      index: 1,
      content,
      truncated: false
    })
  })

  void it('returns later chunks using 1-based indexes', () => {
    const content = 'first paragraph\n\nsecond paragraph\n\nthird paragraph'

    assert.deepEqual(chunkReadableContent(content, 2, 42), {
      index: 2,
      content: 'third paragraph',
      truncated: false
    })
  })

  void it('throws invalid_index when chunk index is unavailable', () => {
    assert.throws(
      () => chunkReadableContent('only chunk', 2, 100),
      /invalid_index/
    )
  })
})
