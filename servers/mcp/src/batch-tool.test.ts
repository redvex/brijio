import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { performBatchTool, type PerformBatchInput } from './batch-tool.js'
import type { BrijioPageActionsConfig } from './page-actions.js'
import type { BrijioBatchResult, BrijioResourceResult } from './protocol.js'

void describe('MCP perform batch tool', () => {
  const successResult: BrijioBatchResult = {
    ok: true,
    results: [
      { ok: true, data: { action: 'click', target: { kind: 'link', id: 'bb-1' } } }
    ],
    aborted: false
  }

  const defaultConfig: BrijioPageActionsConfig = {
    websocketUrl: 'ws://127.0.0.1:8787',
    pairingToken: 'test-token',
    timeoutMs: 5000,
    requestPerformBatch: async () => {
      return { ok: true, data: successResult } as BrijioResourceResult<BrijioBatchResult>
    }
  }

  void it('rejects non-array actions', async () => {
    const result = await performBatchTool(defaultConfig, { actions: 'not-array' })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.code, 'invalid_tool_input')
    }
  })

  void it('rejects empty actions array', async () => {
    const result = await performBatchTool(defaultConfig, { actions: [] })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.code, 'invalid_tool_input')
      assert.match(result.error.message, /at least one/)
    }
  })

  void it('rejects actions array exceeding max size (20)', async () => {
    const actions = Array.from({ length: 21 }, (_, i) => ({ type: 'click', target: { kind: 'link', id: `bb-${i + 1}` } }))
    const result = await performBatchTool(defaultConfig, { actions })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.code, 'invalid_tool_input')
      assert.match(result.error.message, /at most 20/)
    }
  })

  void it('rejects action with invalid type', async () => {
    const result = await performBatchTool(defaultConfig, {
      actions: [{ type: 'read', target: { kind: 'link', id: 'bb-1' } }]
    })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.code, 'invalid_tool_input')
      assert.match(result.error.message, /type must be one of/)
    }
  })

  void it('rejects action that is not an object', async () => {
    const result = await performBatchTool(defaultConfig, {
      actions: ['not-an-object' as unknown] as unknown[]
    })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.code, 'invalid_tool_input')
      assert.match(result.error.message, /must be an object/)
    }
  })

  void it('rejects null action', async () => {
    const result = await performBatchTool(defaultConfig, {
      actions: [null as unknown] as unknown[]
    })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.code, 'invalid_tool_input')
    }
  })

  void it('rejects non-boolean continueOnError', async () => {
    const result = await performBatchTool(defaultConfig, {
      actions: [{ type: 'click', target: { kind: 'link', id: 'bb-1' } }],
      continueOnError: 'yes'
    })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.code, 'invalid_tool_input')
      assert.match(result.error.message, /continueOnError/)
    }
  })

  void it('rejects non-boolean readAfterActions', async () => {
    const result = await performBatchTool(defaultConfig, {
      actions: [{ type: 'click', target: { kind: 'link', id: 'bb-1' } }],
      readAfterActions: 1
    })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.code, 'invalid_tool_input')
      assert.match(result.error.message, /readAfterActions/)
    }
  })

  void it('rejects non-number pageContextId', async () => {
    const result = await performBatchTool(defaultConfig, {
      actions: [{ type: 'click', target: { kind: 'link', id: 'bb-1' } }],
      pageContextId: 'abc'
    })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.code, 'invalid_tool_input')
      assert.match(result.error.message, /pageContextId/)
    }
  })

  void it('rejects non-string browserInstanceId', async () => {
    const result = await performBatchTool(defaultConfig, {
      actions: [{ type: 'click', target: { kind: 'link', id: 'bb-1' } }],
      browserInstanceId: 123
    })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.code, 'invalid_tool_input')
      assert.match(result.error.message, /browserInstanceId/)
    }
  })

  void it('accepts empty string browserInstanceId as invalid', async () => {
    const result = await performBatchTool(defaultConfig, {
      actions: [{ type: 'click', target: { kind: 'link', id: 'bb-1' } }],
      browserInstanceId: ''
    })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.code, 'invalid_tool_input')
    }
  })

  void it('calls requestPerformBatch with valid single action', async () => {
    let calledWith: unknown = null
    const config: BrijioPageActionsConfig = {
      websocketUrl: 'ws://127.0.0.1:8787',
      pairingToken: 'test-token',
      timeoutMs: 5000,
      requestPerformBatch: async (options) => {
        calledWith = options
        return { ok: true, data: successResult } as BrijioResourceResult<BrijioBatchResult>
      }
    }

    const result = await performBatchTool(config, {
      actions: [{ type: 'click', target: { kind: 'link', id: 'bb-1' } }]
    })

    assert.equal(result.ok, true)
    if (result.ok) {
      assert.deepEqual(result.data, successResult)
    }
    assert.ok(calledWith !== null)
  })

  void it('calls requestPerformBatch with all action types', async () => {
    let calledWith: unknown = null
    const config: BrijioPageActionsConfig = {
      websocketUrl: 'ws://127.0.0.1:8787',
      pairingToken: 'test-token',
      timeoutMs: 5000,
      requestPerformBatch: async (options) => {
        calledWith = options
        return { ok: true, data: successResult } as BrijioResourceResult<BrijioBatchResult>
      }
    }

    const result = await performBatchTool(config, {
      actions: [
        { type: 'click', target: { kind: 'link', id: 'bb-1' } },
        { type: 'write_text', target: { formId: 'bb-2', controlId: 'bb-3' }, text: 'hello' },
        { type: 'set_checked', target: { formId: 'bb-4', controlId: 'bb-5' }, checked: true },
        { type: 'select_options', target: { formId: 'bb-6', controlId: 'bb-7' }, values: ['opt1'] },
        { type: 'submit_form', target: { kind: 'action', id: 'bb-8' } }
      ],
      continueOnError: true,
      readAfterActions: true,
      pageContextId: 42,
      browserInstanceId: 'chrome-1'
    })

    assert.equal(result.ok, true)
    const opts = calledWith as Record<string, unknown>
    assert.equal(opts.continueOnError, true)
    assert.equal(opts.readAfterActions, true)
    assert.equal(opts.pageContextId, 42)
    assert.equal(opts.browserInstanceId, 'chrome-1')
  })

  void it('propagates errors from requestPerformBatch', async () => {
    const config: BrijioPageActionsConfig = {
      websocketUrl: 'ws://127.0.0.1:8787',
      pairingToken: 'test-token',
      timeoutMs: 5000,
      requestPerformBatch: async () => {
        return {
          ok: false as const,
          error: { code: 'connection_failed' as const, message: 'WS connection failed' }
        }
      }
    }

    const result = await performBatchTool(config, {
      actions: [{ type: 'click', target: { kind: 'link', id: 'bb-1' } }]
    })

    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.code, 'connection_failed')
    }
  })

  void it('accepts valid action with all valid action types', async () => {
    const validTypes = ['click', 'write_text', 'set_checked', 'select_options', 'submit_form']
    for (const type of validTypes) {
      const action: Record<string, unknown> = { type, target: { kind: 'link', id: 'bb-1' } }
      if (type === 'write_text') action.text = 'hello'
      if (type === 'set_checked') action.checked = true
      if (type === 'select_options') action.values = ['opt1']

      const result = await performBatchTool(defaultConfig, { actions: [action] })
      assert.equal(result.ok, true, `Expected ok for type: ${type}`)
    }
  })
})