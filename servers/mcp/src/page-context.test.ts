import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getCurrentPageContent,
  getCurrentPageContext,
  parsePageContentResourceIndex
} from './page-context.js'
import { type PageContext } from './protocol.js'

void describe('MCP page context resource helpers', () => {
  void it('returns page context from the configured WebSocket request function', async () => {
    const result = await getCurrentPageContext({
      websocketUrl: 'ws://127.0.0.1:8787',
      timeoutMs: 5000,
      requestPageContext: async (options) => {
        assert.equal(options.websocketUrl, 'ws://127.0.0.1:8787')
        assert.equal(options.timeoutMs, 5000)

        return {
          ok: true,
          data: createRichPageContext()
        }
      }
    })

    assert.deepEqual(result, {
      ok: true,
      data: createRichPageContext()
    })
  })

  void it('returns page content from the configured WebSocket request function', async () => {
    const result = await getCurrentPageContent(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestPageContent: async (options) => {
          assert.equal(options.websocketUrl, 'ws://127.0.0.1:8787')
          assert.equal(options.timeoutMs, 5000)
          assert.equal(options.index, 3)

          return {
            ok: true,
            data: {
              url: 'https://example.com/',
              title: 'Example',
              timestamp: '2026-05-25T10:00:00.000Z',
              index: 3,
              content: 'Third chunk',
              truncated: false,
              maxPayloadBytes: 131072
            }
          }
        }
      },
      3
    )

    assert.deepEqual(result, {
      ok: true,
      data: {
        url: 'https://example.com/',
        title: 'Example',
        timestamp: '2026-05-25T10:00:00.000Z',
        index: 3,
        content: 'Third chunk',
        truncated: false,
        maxPayloadBytes: 131072
      }
    })
  })

  void it('returns structured errors from the WebSocket request function', async () => {
    const result = await getCurrentPageContext({
      websocketUrl: 'ws://127.0.0.1:8787',
      timeoutMs: 5000,
      requestPageContext: async () => ({
        ok: false,
        error: {
          code: 'timeout',
          message: 'Timed out waiting for a browser page context response.'
        }
      })
    })

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'timeout',
        message: 'Timed out waiting for a browser page context response.'
      }
    })
  })

  void it('parses 1-based page content resource indexes', () => {
    assert.equal(
      parsePageContentResourceIndex('browser://page/current/content/12'),
      12
    )
  })

  void it('rejects invalid page content resource indexes', () => {
    assert.deepEqual(
      parsePageContentResourceIndex('browser://page/current/content/0'),
      {
        ok: false,
        error: {
          code: 'invalid_resource_uri',
          message:
            'Page content resource URI must end with a positive 1-based index.'
        }
      }
    )

    assert.deepEqual(
      parsePageContentResourceIndex('browser://page/current/content/latest'),
      {
        ok: false,
        error: {
          code: 'invalid_resource_uri',
          message:
            'Page content resource URI must end with a positive 1-based index.'
        }
      }
    )
  })
})

function createRichPageContext (): PageContext {
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
      headings: [],
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
