import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createPerformBatchEnvelope,
  createBatchResultResponse,
  createBatchResultErrorResponse,
  isPerformBatchEnvelope,
  parseBrijioEnvelope
} from './protocol.js'

void describe('batch request protocol', () => {
  void describe('isPerformBatchEnvelope', () => {
    void it('recognizes a valid perform_batch envelope with click action', () => {
      assert.equal(
        isPerformBatchEnvelope({
          type: 'message',
          id: 'batch-1',
          payload: {
            type: 'perform_batch',
            actions: [
              {
                type: 'click',
                target: { kind: 'link', id: 'bb-1' }
              }
            ],
            continueOnError: false
          }
        }),
        true
      )
    })

    void it('recognizes a valid perform_batch envelope with multiple action types', () => {
      assert.equal(
        isPerformBatchEnvelope({
          type: 'message',
          id: 'batch-2',
          payload: {
            type: 'perform_batch',
            actions: [
              {
                type: 'write_text',
                target: { formId: 'bb-1', controlId: 'bb-2' },
                text: 'Ada Lovelace'
              },
              {
                type: 'set_checked',
                target: { formId: 'bb-1', controlId: 'bb-3' },
                checked: true
              },
              {
                type: 'select_options',
                target: { formId: 'bb-1', controlId: 'bb-4' },
                values: ['alpha', 'beta']
              },
              {
                type: 'submit_form',
                target: { formId: 'bb-1' }
              }
            ],
            continueOnError: true,
            readAfterActions: true
          }
        }),
        true
      )
    })

    void it('recognizes perform_batch envelope with write_text editable target', () => {
      assert.equal(
        isPerformBatchEnvelope({
          type: 'message',
          payload: {
            type: 'perform_batch',
            actions: [
              {
                type: 'write_text',
                target: { kind: 'editable', id: 'bb-5' },
                text: 'Plain text'
              }
            ],
            continueOnError: false
          }
        }),
        true
      )
    })

    void it('recognizes perform_batch envelope without optional fields', () => {
      assert.equal(
        isPerformBatchEnvelope({
          type: 'message',
          payload: {
            type: 'perform_batch',
            actions: [
              {
                type: 'click',
                target: { kind: 'action', id: 'bb-1' }
              }
            ]
          }
        }),
        true
      )
    })

    void it('recognizes perform_batch envelope with pageContextId', () => {
      assert.equal(
        isPerformBatchEnvelope({
          type: 'message',
          id: 'batch-3',
          payload: {
            type: 'perform_batch',
            pageContextId: 42,
            actions: [
              {
                type: 'click',
                target: { kind: 'link', id: 'bb-1' }
              }
            ]
          }
        }),
        true
      )
    })

    void it('rejects perform_batch with empty actions array', () => {
      assert.equal(
        isPerformBatchEnvelope({
          type: 'message',
          payload: {
            type: 'perform_batch',
            actions: []
          }
        }),
        false
      )
    })

    void it('rejects perform_batch with too many actions (> 20)', () => {
      const actions = Array.from({ length: 21 }, (_, i) => ({
        type: 'click',
        target: { kind: 'link', id: `bb-${i}` }
      }))

      assert.equal(
        isPerformBatchEnvelope({
          type: 'message',
          payload: {
            type: 'perform_batch',
            actions
          }
        }),
        false
      )
    })

    void it('accepts perform_batch with exactly 20 actions', () => {
      const actions = Array.from({ length: 20 }, (_, i) => ({
        type: 'click',
        target: { kind: 'link', id: `bb-${i}` }
      }))

      assert.equal(
        isPerformBatchEnvelope({
          type: 'message',
          payload: {
            type: 'perform_batch',
            actions
          }
        }),
        true
      )
    })

    void it('rejects perform_batch with invalid action type', () => {
      assert.equal(
        isPerformBatchEnvelope({
          type: 'message',
          payload: {
            type: 'perform_batch',
            actions: [
              {
                type: 'navigate',
                url: 'https://example.com'
              }
            ]
          }
        }),
        false
      )
    })

    void it('rejects perform_batch with invalid click target', () => {
      assert.equal(
        isPerformBatchEnvelope({
          type: 'message',
          payload: {
            type: 'perform_batch',
            actions: [
              {
                type: 'click',
                target: { kind: 'image', id: 'bb-1' }
              }
            ]
          }
        }),
        false
      )
    })

    void it('rejects perform_batch with invalid write_text target', () => {
      assert.equal(
        isPerformBatchEnvelope({
          type: 'message',
          payload: {
            type: 'perform_batch',
            actions: [
              {
                type: 'write_text',
                target: { formId: 'bb-1', controlId: '' },
                text: 'hello'
              }
            ]
          }
        }),
        false
      )
    })

    void it('rejects perform_batch with non-boolean continueOnError', () => {
      assert.equal(
        isPerformBatchEnvelope({
          type: 'message',
          payload: {
            type: 'perform_batch',
            actions: [
              { type: 'click', target: { kind: 'link', id: 'bb-1' } }
            ],
            continueOnError: 'yes'
          }
        }),
        false
      )
    })

    void it('rejects perform_batch with non-boolean readAfterActions', () => {
      assert.equal(
        isPerformBatchEnvelope({
          type: 'message',
          payload: {
            type: 'perform_batch',
            actions: [
              { type: 'click', target: { kind: 'link', id: 'bb-1' } }
            ],
            readAfterActions: 1
          }
        }),
        false
      )
    })

    void it('rejects envelopes that are not perform_batch', () => {
      assert.equal(
        isPerformBatchEnvelope({
          type: 'message',
          payload: {
            type: 'perform_action',
            action: { type: 'click', target: { kind: 'link', id: 'bb-1' } }
          }
        }),
        false
      )
    })

    void it('rejects non-envelope values', () => {
      assert.equal(isPerformBatchEnvelope(null), false)
      assert.equal(isPerformBatchEnvelope('not an envelope'), false)
      assert.equal(isPerformBatchEnvelope(42), false)
    })
  })

  void describe('createPerformBatchEnvelope', () => {
    void it('creates a perform_batch envelope with required fields', () => {
      const envelope = createPerformBatchEnvelope('batch-1', [
        { type: 'click', target: { kind: 'link', id: 'bb-1' } }
      ])

      assert.deepEqual(envelope, {
        type: 'message',
        id: 'batch-1',
        payload: {
          type: 'perform_batch',
          actions: [
            { type: 'click', target: { kind: 'link', id: 'bb-1' } }
          ]
        }
      })
    })

    void it('creates a perform_batch envelope with all options', () => {
      const envelope = createPerformBatchEnvelope(
        'batch-2',
        [
          { type: 'write_text', target: { formId: 'bb-1', controlId: 'bb-2' }, text: 'hello' }
        ],
        { pageContextId: 5, continueOnError: true, readAfterActions: true }
      )

      assert.deepEqual(envelope, {
        type: 'message',
        id: 'batch-2',
        payload: {
          type: 'perform_batch',
          pageContextId: 5,
          actions: [
            { type: 'write_text', target: { formId: 'bb-1', controlId: 'bb-2' }, text: 'hello' }
          ],
          continueOnError: true,
          readAfterActions: true
        }
      })
    })

    void it('creates a perform_batch envelope without id', () => {
      const envelope = createPerformBatchEnvelope(undefined, [
        { type: 'submit_form', target: { formId: 'bb-1' } }
      ])

      assert.deepEqual(envelope, {
        type: 'message',
        payload: {
          type: 'perform_batch',
          actions: [
            { type: 'submit_form', target: { formId: 'bb-1' } }
          ]
        }
      })
    })
  })

  void describe('createBatchResultResponse', () => {
    void it('creates a batch_result response with all successful actions', () => {
      const response = createBatchResultResponse('batch-1', [
        { ok: true, data: { action: 'click', target: { kind: 'link', id: 'bb-1' } } },
        { ok: true, data: { action: 'write_text', target: { formId: 'bb-1', controlId: 'bb-2' }, textLength: 5 } }
      ])

      assert.deepEqual(response, {
        type: 'message',
        id: 'batch-1',
        payload: {
          type: 'batch_result',
          ok: true,
          results: [
            { ok: true, data: { action: 'click', target: { kind: 'link', id: 'bb-1' } } },
            { ok: true, data: { action: 'write_text', target: { formId: 'bb-1', controlId: 'bb-2' }, textLength: 5 } }
          ],
          aborted: false
        }
      })
    })
  })

  void describe('createBatchResultErrorResponse', () => {
    void it('creates a batch_result error response', () => {
      const response = createBatchResultErrorResponse('batch-1', 'browser_unavailable', 'No browser connected')

      assert.deepEqual(response, {
        type: 'message',
        id: 'batch-1',
        payload: {
          type: 'batch_result',
          ok: false,
          error: {
            code: 'browser_unavailable',
            message: 'No browser connected'
          }
        }
      })
    })
  })

  void describe('round-trip through parseBrijioEnvelope', () => {
    void it('round-trips a perform_batch envelope', () => {
      const envelope = createPerformBatchEnvelope('batch-rt-1', [
        { type: 'click', target: { kind: 'action', id: 'bb-5' } },
        { type: 'set_checked', target: { formId: 'bb-1', controlId: 'bb-3' }, checked: true }
      ], { continueOnError: true })

      const parsed = parseBrijioEnvelope(JSON.stringify(envelope))
      assert.equal(parsed.ok, true)
      if (parsed.ok) {
        assert.equal(isPerformBatchEnvelope(parsed.message), true)
      }
    })
  })
})
