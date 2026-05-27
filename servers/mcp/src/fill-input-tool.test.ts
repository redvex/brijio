import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fillInput } from './fill-input-tool.js'

void describe('MCP fill input tool', () => {
  void it('returns invalid tool input for empty form IDs', async () => {
    const result = await fillInput(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestFillInput: async () => {
          throw new Error('fill should not be requested')
        }
      },
      {
        formId: '',
        controlId: 'control-1',
        text: 'hello'
      }
    )

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'invalid_tool_input',
        message: 'formId must be a non-empty string.'
      }
    })
  })

  void it('returns invalid tool input for empty control IDs', async () => {
    const result = await fillInput(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestFillInput: async () => {
          throw new Error('fill should not be requested')
        }
      },
      {
        formId: 'form-1',
        controlId: '',
        text: 'hello'
      }
    )

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'invalid_tool_input',
        message: 'controlId must be a non-empty string.'
      }
    })
  })

  void it('returns invalid tool input for non-string text', async () => {
    const result = await fillInput(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestFillInput: async () => {
          throw new Error('fill should not be requested')
        }
      },
      {
        formId: 'form-1',
        controlId: 'control-1',
        text: 42
      }
    )

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'invalid_tool_input',
        message: 'text must be a string.'
      }
    })
  })

  void it('fills a valid page context form control', async () => {
    const requestedInputs: unknown[] = []

    const result = await fillInput(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestFillInput: async (options) => {
          requestedInputs.push({
            target: options.target,
            text: options.text,
            browserInstanceId: options.browserInstanceId
          })
          return {
            ok: true,
            data: {
              action: 'write_text',
              target: options.target,
              textLength: options.text.length
            }
          }
        }
      },
      {
        formId: 'form-1',
        controlId: 'control-1',
        text: '',
        browserInstanceId: 'chrome-default-test'
      }
    )

    assert.deepEqual(requestedInputs, [
      {
        target: {
          formId: 'form-1',
          controlId: 'control-1'
        },
        text: '',
        browserInstanceId: 'chrome-default-test'
      }
    ])
    assert.deepEqual(result, {
      ok: true,
      data: {
        action: 'write_text',
        target: {
          formId: 'form-1',
          controlId: 'control-1'
        },
        textLength: 0
      }
    })
  })

  void it('returns WebSocket and browser errors without rewriting them', async () => {
    const result = await fillInput(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestFillInput: async () => ({
          ok: false,
          error: {
            code: 'browser_error',
            message: 'No matching form control was found.'
          }
        })
      },
      {
        formId: 'form-9',
        controlId: 'control-9',
        text: 'hello'
      }
    )

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'browser_error',
        message: 'No matching form control was found.'
      }
    })
  })
})
