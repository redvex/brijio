import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getCurrentPageContent,
  getCurrentPageContext,
  getPageContextConfigFromEnv,
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

  void it('prefers Brijio environment variables while preserving BrowserBridge fallbacks', () => {
    const warnings: string[] = []
    const config = getPageContextConfigFromEnv(
      {
        BRIJIO_WS_URL: 'ws://brijio.example:8787',
        BROWSERBRIDGE_WEBSOCKET_URL: 'ws://browserbridge.example:8787',
        BRIJIO_PAIRING_TOKEN: 'new-token',
        BROWSERBRIDGE_PAIRING_TOKEN: 'old-token',
        BRIJIO_BROWSER_INSTANCE_ID: 'brijio-browser',
        BROWSERBRIDGE_BROWSER_INSTANCE_ID: 'browserbridge-browser',
        BRIJIO_REQUEST_TIMEOUT_MS: '9000',
        BROWSERBRIDGE_REQUEST_TIMEOUT_MS: '1000'
      },
      (message) => warnings.push(message)
    )

    assert.deepEqual(config, {
      websocketUrl: 'ws://brijio.example:8787',
      pairingToken: 'new-token',
      defaultBrowserInstanceId: 'brijio-browser',
      timeoutMs: 9000
    })
    assert.deepEqual(warnings, [
      'Both BRIJIO_WS_URL and BROWSERBRIDGE_WEBSOCKET_URL are set; preferring BRIJIO_WS_URL.',
      'Both BRIJIO_PAIRING_TOKEN and BROWSERBRIDGE_PAIRING_TOKEN are set; preferring BRIJIO_PAIRING_TOKEN.',
      'Both BRIJIO_BROWSER_INSTANCE_ID and BROWSERBRIDGE_BROWSER_INSTANCE_ID are set; preferring BRIJIO_BROWSER_INSTANCE_ID.',
      'Both BRIJIO_REQUEST_TIMEOUT_MS and BROWSERBRIDGE_REQUEST_TIMEOUT_MS are set; preferring BRIJIO_REQUEST_TIMEOUT_MS.'
    ])
  })

  void it('uses BrowserBridge environment variables as backwards-compatible aliases', () => {
    const config = getPageContextConfigFromEnv({
      BROWSERBRIDGE_WEBSOCKET_URL: 'ws://old.example:8787',
      BROWSERBRIDGE_PAIRING_TOKEN: 'old-token',
      BROWSERBRIDGE_BROWSER_INSTANCE_ID: 'old-browser',
      BROWSERBRIDGE_REQUEST_TIMEOUT_MS: '7000'
    })

    assert.deepEqual(config, {
      websocketUrl: 'ws://old.example:8787',
      pairingToken: 'old-token',
      defaultBrowserInstanceId: 'old-browser',
      timeoutMs: 7000
    })
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
