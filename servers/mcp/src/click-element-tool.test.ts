import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { clickElement } from './click-element-tool.js'

void describe('MCP click element tool', () => {
  void it('returns invalid tool input for unsupported target kinds', async () => {
    const result = await clickElement(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestClickElement: async () => {
          throw new Error('click should not be requested')
        }
      },
      {
        kind: 'image',
        id: 'bb-1'
      }
    )

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'invalid_tool_input',
        message: 'kind must be either "link" or "action".'
      }
    })
  })

  void it('returns invalid tool input for empty target IDs', async () => {
    const result = await clickElement(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestClickElement: async () => {
          throw new Error('click should not be requested')
        }
      },
      {
        kind: 'link',
        id: ''
      }
    )

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'invalid_tool_input',
        message: 'id must be a non-empty string.'
      }
    })
  })

  void it('clicks a valid page context target', async () => {
    const requestedTargets: unknown[] = []
    const requestedBrowserInstanceIds: Array<string | undefined> = []

    const result = await clickElement(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestClickElement: async (options) => {
          requestedTargets.push(options.target)
          requestedBrowserInstanceIds.push(options.browserInstanceId)
          return {
            ok: true,
            data: {
              action: 'click',
              target: options.target
            }
          }
        }
      },
      {
        kind: 'action',
        id: 'bb-2',
        browserInstanceId: 'chrome-default-test'
      }
    )

    assert.deepEqual(requestedBrowserInstanceIds, ['chrome-default-test'])
    assert.deepEqual(requestedTargets, [
      {
        kind: 'action',
        id: 'bb-2'
      }
    ])
    assert.deepEqual(result, {
      ok: true,
      data: {
        action: 'click',
        target: {
          kind: 'action',
          id: 'bb-2'
        }
      }
    })
  })

  void it('returns WebSocket and browser errors without rewriting them', async () => {
    const result = await clickElement(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestClickElement: async () => ({
          ok: false,
          error: {
            code: 'browser_error',
            message: 'No matching click target was found.'
          }
        })
      },
      {
        kind: 'link',
        id: 'bb-9'
      }
    )

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'browser_error',
        message: 'No matching click target was found.'
      }
    })
  })
})
