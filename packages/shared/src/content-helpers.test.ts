import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isRecord,
  isPageContentErrorCode,
  isContentResponse,
  contentScriptUnavailable,
  actionContentScriptUnavailable
} from './content-helpers.js'

void describe('isRecord', () => {
  void it('returns true for plain objects', () => {
    assert.strictEqual(isRecord({}), true)
  })

  void it('returns true for objects with properties', () => {
    assert.strictEqual(isRecord({ a: 1 }), true)
  })

  void it('returns false for null', () => {
    assert.strictEqual(isRecord(null), false)
  })

  void it('returns false for arrays', () => {
    assert.strictEqual(isRecord([1, 2, 3]), false)
  })

  void it('returns false for strings', () => {
    assert.strictEqual(isRecord('hello'), false)
  })

  void it('returns false for numbers', () => {
    assert.strictEqual(isRecord(42), false)
  })

  void it('returns false for undefined', () => {
    assert.strictEqual(isRecord(undefined), false)
  })
})

void describe('isPageContentErrorCode', () => {
  void it('returns true for content_script_unavailable', () => {
    assert.strictEqual(isPageContentErrorCode('content_script_unavailable'), true)
  })

  void it('returns true for no_active_tab', () => {
    assert.strictEqual(isPageContentErrorCode('no_active_tab'), true)
  })

  void it('returns true for unsupported_page', () => {
    assert.strictEqual(isPageContentErrorCode('unsupported_page'), true)
  })

  void it('returns true for regular_page_permission_required', () => {
    assert.strictEqual(isPageContentErrorCode('regular_page_permission_required'), true)
  })

  void it('returns true for action_failed', () => {
    assert.strictEqual(isPageContentErrorCode('action_failed'), true)
  })

  void it('returns false for unknown code', () => {
    assert.strictEqual(isPageContentErrorCode('unknown_error'), false)
  })

  void it('returns false for non-string', () => {
    assert.strictEqual(isPageContentErrorCode(42), false)
  })
})

void describe('isContentResponse', () => {
  void it('returns true for successful response with data', () => {
    assert.strictEqual(isContentResponse({ ok: true, data: { title: 'Test' } }), true)
  })

  void it('returns true for error response with valid error', () => {
    assert.strictEqual(
      isContentResponse({ ok: false, error: { code: 'content_script_unavailable', message: 'Failed' } }),
      true
    )
  })

  void it('returns false for non-record', () => {
    assert.strictEqual(isContentResponse(null), false)
  })

  void it('returns false when ok is not boolean', () => {
    assert.strictEqual(isContentResponse({ ok: 'true', data: {} }), false)
  })

  void it('returns false when ok is true but data is missing', () => {
    assert.strictEqual(isContentResponse({ ok: true }), false)
  })

  void it('returns false when ok is false but error is invalid', () => {
    assert.strictEqual(isContentResponse({ ok: false, error: 'bad' }), false)
  })

  void it('returns false when error code is not a valid error code', () => {
    assert.strictEqual(
      isContentResponse({ ok: false, error: { code: 'unknown_code', message: 'Failed' } }),
      false
    )
  })
})

void describe('contentScriptUnavailable', () => {
  void it('returns content_script_unavailable error', () => {
    const result = contentScriptUnavailable()
    assert.deepStrictEqual(result, {
      ok: false,
      error: {
        code: 'content_script_unavailable',
        message: 'Unable to reach the page content script.'
      }
    })
  })
})

void describe('actionContentScriptUnavailable', () => {
  void it('returns content_script_unavailable error', () => {
    const result = actionContentScriptUnavailable()
    assert.deepStrictEqual(result, {
      ok: false,
      error: {
        code: 'content_script_unavailable',
        message: 'Unable to reach the page content script.'
      }
    })
  })
})
