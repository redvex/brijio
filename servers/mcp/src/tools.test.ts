import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getCurrentPageContext } from './tools.js'

void describe('MCP browser tools', () => {
  void it('returns page context from the configured WebSocket request function', async () => {
    const result = await getCurrentPageContext({
      websocketUrl: 'ws://127.0.0.1:8787',
      timeoutMs: 5000,
      requestPageContext: async (options) => {
        assert.equal(options.websocketUrl, 'ws://127.0.0.1:8787')
        assert.equal(options.timeoutMs, 5000)

        return {
          ok: true,
          data: {
            url: 'https://example.com/',
            title: 'Example'
          }
        }
      }
    })

    assert.deepEqual(result, {
      ok: true,
      data: {
        url: 'https://example.com/',
        title: 'Example'
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
})
