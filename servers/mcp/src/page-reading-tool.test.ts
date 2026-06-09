import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readCurrentPage } from './page-reading-tool.js'
import { type PageContent, type PageContext } from './protocol.js'

void describe('MCP page reading tool', () => {
  void it('reads only page context when content is disabled', async () => {
    const requestedContentIndexes: number[] = []

    const result = await readCurrentPage(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestPageContext: async () => ({
          ok: true,
          data: createPageContext()
        }),
        requestPageContent: async (options) => {
          requestedContentIndexes.push(options.index)
          return {
            ok: true,
            data: createPageContent(options.index, false)
          }
        }
      },
      { includeContent: false }
    )

    assert.deepEqual(requestedContentIndexes, [])
    assert.deepEqual(result, {
      ok: true,
      data: {
        context: createPageContext(),
        content: [],
        contentTruncated: false,
        nextContentIndex: null
      }
    })
  })

  void it('reads the first available content chunk by default', async () => {
    const requestedContentIndexes: number[] = []
    const requestedBrowserInstanceIds: Array<string | undefined> = []

    const result = await readCurrentPage(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestPageContext: async (options) => {
          requestedBrowserInstanceIds.push(options.browserInstanceId)
          return {
            ok: true,
            data: createPageContext()
          }
        },
        requestPageContent: async (options) => {
          requestedContentIndexes.push(options.index)
          requestedBrowserInstanceIds.push(options.browserInstanceId)
          return {
            ok: true,
            data: createPageContent(options.index, false)
          }
        }
      },
      { browserInstanceId: 'chrome-default-test' }
    )

    assert.deepEqual(requestedContentIndexes, [1])
    assert.deepEqual(requestedBrowserInstanceIds, [
      'chrome-default-test',
      'chrome-default-test'
    ])
    assert.deepEqual(result, {
      ok: true,
      data: {
        context: createPageContext(),
        content: [createPageContent(1, false)],
        contentTruncated: false,
        nextContentIndex: null
      }
    })
  })

  void it('reads multiple chunks up to the requested maximum', async () => {
    const requestedContentIndexes: number[] = []

    const result = await readCurrentPage(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestPageContext: async () => ({
          ok: true,
          data: createPageContext()
        }),
        requestPageContent: async (options) => {
          requestedContentIndexes.push(options.index)
          return {
            ok: true,
            data: createPageContent(options.index, options.index < 3)
          }
        }
      },
      { maxContentChunks: 3 }
    )

    assert.deepEqual(requestedContentIndexes, [1, 2, 3])
    assert.deepEqual(result, {
      ok: true,
      data: {
        context: createPageContext(),
        content: [
          createPageContent(1, true),
          createPageContent(2, true),
          createPageContent(3, false)
        ],
        contentTruncated: false,
        nextContentIndex: null
      }
    })
  })

  void it('reports the next content index when the maximum stops a truncated read', async () => {
    const result = await readCurrentPage(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestPageContext: async () => ({
          ok: true,
          data: createPageContext()
        }),
        requestPageContent: async (options) => ({
          ok: true,
          data: createPageContent(options.index, true)
        })
      },
      { maxContentChunks: 2 }
    )

    assert.deepEqual(result, {
      ok: true,
      data: {
        context: createPageContext(),
        content: [createPageContent(1, true), createPageContent(2, true)],
        contentTruncated: true,
        nextContentIndex: 3
      }
    })
  })

  void it('returns invalid tool input for out-of-range content chunk limits', async () => {
    const result = await readCurrentPage(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestPageContext: async () => {
          throw new Error('context should not be requested')
        }
      },
      { maxContentChunks: 11 }
    )

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'invalid_tool_input',
        message: 'maxContentChunks must be an integer from 0 through 10.'
      }
    })
  })

  void it('returns context request errors without requesting content', async () => {
    const result = await readCurrentPage(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestPageContext: async () => ({
          ok: false,
          error: {
            code: 'timeout',
            message: 'Timed out waiting for a browser page context response.'
          }
        }),
        requestPageContent: async () => {
          throw new Error('content should not be requested')
        }
      },
      {}
    )

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'timeout',
        message: 'Timed out waiting for a browser page context response.'
      }
    })
  })
})

function createPageContext (): PageContext {
  return {
    url: 'https://example.com/',
    title: 'Example',
    timestamp: '2026-05-25T10:00:00.000Z',
    selectedText: null,
    preview: {
      content: 'Example preview',
      truncated: false,
      maxBytes: 4096
    },
    structure: {
      headings: [{ id: 'bb-1', level: 1, text: 'Example' }],
      landmarks: [],
      links: [],
      images: [],
      forms: [],
      actions: []
    },
    content: {
      available: true,
      requestType: 'get_page_content',
      firstIndex: 1,
      defaultMaxPayloadBytes: 131072
    }
  }
}

function createPageContent (
  index: number,
  truncated: boolean
): PageContent {
  return {
    url: 'https://example.com/',
    title: 'Example',
    timestamp: '2026-05-25T10:00:00.000Z',
    index,
    content: `# Example\n\nReadable content ${index}`,
    truncated,
    maxPayloadBytes: 131072
  }
}
