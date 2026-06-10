import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  type PageContext,
  createPerformBatchEnvelope,
  parseBatchResultEnvelope
} from './protocol.js'

void describe('MCP batch result protocol helpers', () => {
  void describe('createPerformBatchEnvelope', () => {
    void it('creates a perform_batch envelope with actions', () => {
      const envelope = createPerformBatchEnvelope('batch-1', [
        { type: 'click', target: { kind: 'link', id: 'bb-1' } },
        { type: 'write_text', target: { formId: 'bb-2', controlId: 'bb-3' }, text: 'hello' }
      ])

      assert.deepEqual(envelope, {
        type: 'message',
        id: 'batch-1',
        payload: {
          type: 'perform_batch',
          actions: [
            { type: 'click', target: { kind: 'link', id: 'bb-1' } },
            { type: 'write_text', target: { formId: 'bb-2', controlId: 'bb-3' }, text: 'hello' }
          ]
        }
      })
    })

    void it('creates a perform_batch envelope with options', () => {
      const envelope = createPerformBatchEnvelope('batch-2', [
        { type: 'submit_form', target: { formId: 'bb-1' } }
      ], { pageContextId: 5, continueOnError: true, readAfterActions: true })

      assert.deepEqual(envelope, {
        type: 'message',
        id: 'batch-2',
        payload: {
          type: 'perform_batch',
          actions: [
            { type: 'submit_form', target: { formId: 'bb-1' } }
          ],
          pageContextId: 5,
          continueOnError: true,
          readAfterActions: true
        }
      })
    })
  })

  void describe('parseBatchResultEnvelope', () => {
    void it('parses a fully successful batch result', () => {
      const raw = JSON.stringify({
        type: 'message',
        id: 'batch-1',
        payload: {
          type: 'batch_result',
          ok: true,
          results: [
            { ok: true, data: { action: 'click', target: { kind: 'link', id: 'bb-1' } } },
            { ok: true, data: { action: 'write_text', target: { formId: 'bb-2', controlId: 'bb-3' }, textLength: 5 } }
          ]
        }
      })

      const result = parseBatchResultEnvelope(JSON.parse(raw), 'batch-1')
      assert.equal(result.ok, true)
      if (result.ok) {
        assert.equal(result.data.ok, true)
        assert.equal(result.data.results.length, 2)
        assert.equal(result.data.results[0].ok, true)
      }
    })

    void it('parses a partial failure batch result with continueOnError', () => {
      const raw = JSON.stringify({
        type: 'message',
        id: 'batch-2',
        payload: {
          type: 'batch_result',
          ok: false,
          results: [
            { ok: true, data: { action: 'click', target: { kind: 'link', id: 'bb-1' } } },
            { ok: false, error: { code: 'target_not_found', message: 'Element not found', aborted: false } },
            { ok: false, error: { code: 'page_navigated', message: 'Page navigated', aborted: true } }
          ]
        }
      })

      const result = parseBatchResultEnvelope(JSON.parse(raw), 'batch-2')
      assert.equal(result.ok, false)
      if (!result.ok && 'data' in result) {
        assert.equal(result.data.ok, false)
        assert.equal(result.data.results.length, 3)
        assert.equal(result.data.results[0].ok, true)
        if (!result.data.results[1].ok) {
          assert.equal(result.data.results[1].error.aborted, false)
        }
        if (!result.data.results[2].ok) {
          assert.equal(result.data.results[2].error.aborted, true)
        }
      }
    })

    void it('parses a batch result with trailing read (readAfterActions)', () => {
      const pageContext = createPageContextFixture()

      const raw = JSON.stringify({
        type: 'message',
        id: 'batch-3',
        payload: {
          type: 'batch_result',
          ok: true,
          results: [
            { ok: true, data: { action: 'click', target: { kind: 'action', id: 'bb-5' } } },
            { ok: true, data: pageContext }
          ]
        }
      })

      const result = parseBatchResultEnvelope(JSON.parse(raw), 'batch-3')
      assert.equal(result.ok, true)
      if (result.ok) {
        assert.equal(result.data.results.length, 2)
      }
    })

    void it('parses a batch-level error response (no results)', () => {
      const raw = JSON.stringify({
        type: 'message',
        id: 'batch-4',
        payload: {
          type: 'batch_result',
          ok: false,
          error: {
            code: 'browser_unavailable',
            message: 'No browser connected'
          }
        }
      })

      const result = parseBatchResultEnvelope(JSON.parse(raw), 'batch-4')
      assert.equal(result.ok, false)
      if (!result.ok && !('data' in result) && 'error' in result) {
        assert.equal(result.error.code, 'browser_unavailable')
        assert.equal(result.error.message, 'No browser connected')
      }
    })

    void it('returns ignored for mismatched request ID', () => {
      const raw = JSON.stringify({
        type: 'message',
        id: 'batch-other',
        payload: {
          type: 'batch_result',
          ok: true,
          results: []
        }
      })

      const result = parseBatchResultEnvelope(JSON.parse(raw), 'batch-1')
      assert.deepEqual(result, { ok: false, ignored: true })
    })

    void it('returns invalid_response for wrong payload type', () => {
      const raw = JSON.stringify({
        type: 'message',
        id: 'batch-5',
        payload: {
          type: 'action_result',
          ok: true,
          data: { action: 'click', target: { kind: 'link', id: 'bb-1' } }
        }
      })

      const result = parseBatchResultEnvelope(JSON.parse(raw), 'batch-5')
      assert.equal(result.ok, false)
      if (!result.ok && 'error' in result) {
        assert.equal(result.error.code, 'invalid_response')
      }
    })

    void it('maps page_navigated error code to stale_context', () => {
      const raw = JSON.stringify({
        type: 'message',
        id: 'batch-6',
        payload: {
          type: 'batch_result',
          ok: false,
          results: [
            { ok: false, error: { code: 'page_navigated', message: 'Page navigated after action', aborted: true } }
          ]
        }
      })

      const result = parseBatchResultEnvelope(JSON.parse(raw), 'batch-6')
      if (!result.ok && 'data' in result) {
        const firstResult = result.data.results[0]
        if (!firstResult.ok) {
          assert.equal(firstResult.error.code, 'stale_context')
        }
      }
    })

    void it('preserves stale_context detail in batch action error', () => {
      const raw = JSON.stringify({
        type: 'message',
        id: 'batch-7',
        payload: {
          type: 'batch_result',
          ok: false,
          results: [
            { ok: false, error: { code: 'stale_context', message: 'Element changed', detail: { id: 'bb-1', kind: 'link', expectedText: 'Click', foundText: 'Submit' }, aborted: false } }
          ]
        }
      })

      const result = parseBatchResultEnvelope(JSON.parse(raw), 'batch-7')
      if (!result.ok && 'data' in result) {
        const firstResult = result.data.results[0]
        if (!firstResult.ok) {
          assert.notEqual(firstResult.error.detail, undefined)
          assert.equal(firstResult.error.detail?.id, 'bb-1')
        }
      }
    })

    void it('returns invalid for non-envelope values', () => {
      const result = parseBatchResultEnvelope('not an envelope', 'batch-1')
      assert.equal(result.ok, false)
      if (!result.ok && 'error' in result) {
        assert.equal(result.error.code, 'invalid_response')
      }
    })
  })
})

function createPageContextFixture (): PageContext {
  return {
    url: 'https://example.com/',
    title: 'Example Domain',
    timestamp: '2026-06-11T10:00:00.000Z',
    selectedText: null,
    preview: {
      content: '',
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
      requestType: 'get_page_content' as const,
      firstIndex: 1,
      defaultMaxPayloadBytes: 131072
    }
  }
}
