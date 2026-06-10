import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  readActiveTabPage,
  performActiveTabAction,
  regularPagePermissionRequired,
  actionRegularPagePermissionRequired,
  type ActiveTabDeps,
  type ContentRequest,
  type PageReadResult,
  type PageActionResult
} from './index.js'

function makeDeps (overrides: Partial<ActiveTabDeps> = {}): ActiveTabDeps {
  return {
    tabs: {
      query: async () => [{ id: 1, url: 'https://example.com' }],
      sendMessage: async () => ({ ok: true, data: { title: 'Test' } }),
      ...overrides.tabs
    },
    scripting: {
      executeScript: async () => {},
      ...overrides.scripting
    },
    isRegularPageUrl: () => true,
    ...overrides
  }
}

const extractContext: ContentRequest = {
  type: 'extract_page_context',
  previewMaxBytes: 4096,
  defaultMaxPayloadBytes: 100000
}

const clickMessage: ContentRequest = {
  type: 'perform_click',
  target: { kind: 'link', id: 'test-link' }
}

void describe('page-reader', () => {
  void describe('readActiveTabPage', () => {
    void it('returns content when response is ok', async () => {
      const deps = makeDeps()
      const result = await readActiveTabPage<{ title: string }>(
        extractContext,
        deps
      )
      assert.deepStrictEqual(result, { ok: true, data: { title: 'Test' } })
    })

    void it('returns no_active_tab when no active tab with URL', async () => {
      const deps = makeDeps({
        tabs: {
          query: async () => [],
          sendMessage: async () => ({})
        }
      })
      const result = await readActiveTabPage(extractContext, deps)
      assert.strictEqual(result.ok, false)
      if (!result.ok) {
        assert.strictEqual(result.error.code, 'no_active_tab')
      }
    })

    void it('returns unsupported_page for non-regular URLs', async () => {
      const deps = makeDeps({
        isRegularPageUrl: () => false,
        tabs: {
          query: async () => [{ id: 1, url: 'chrome://settings' }],
          sendMessage: async () => ({})
        }
      })
      const result = await readActiveTabPage(extractContext, deps)
      assert.strictEqual(result.ok, false)
      if (!result.ok) {
        assert.strictEqual(result.error.code, 'unsupported_page')
      }
    })

    void it('returns content_script_unavailable when response is not ContentResponse', async () => {
      const deps = makeDeps({
        tabs: {
          query: async () => [{ id: 1, url: 'https://example.com' }],
          sendMessage: async () => 'not-a-response'
        }
      })
      const result = await readActiveTabPage(extractContext, deps)
      assert.strictEqual(result.ok, false)
      if (!result.ok) {
        assert.strictEqual(result.error.code, 'content_script_unavailable')
      }
    })

    void it('returns error from failed content response', async () => {
      const deps = makeDeps({
        tabs: {
          query: async () => [{ id: 1, url: 'https://example.com' }],
          sendMessage: async () => ({
            ok: false,
            error: { code: 'extraction_failed', message: 'Boom' }
          })
        }
      })
      const message: ContentRequest = {
        type: 'extract_page_content',
        index: 0,
        maxContentBytes: 50000,
        maxPayloadBytes: 100000
      }
      const result = await readActiveTabPage(message, deps)
      assert.strictEqual(result.ok, false)
      if (!result.ok) {
        assert.strictEqual(result.error.code, 'extraction_failed')
        assert.strictEqual(result.error.message, 'Boom')
      }
    })

    void it('returns content_script_unavailable on catch without permission check', async () => {
      const deps = makeDeps({
        scripting: {
          executeScript: async () => {
            throw new Error('inject failed')
          }
        }
      })
      const result = await readActiveTabPage(extractContext, deps)
      assert.strictEqual(result.ok, false)
      if (!result.ok) {
        assert.strictEqual(result.error.code, 'content_script_unavailable')
      }
    })

    void it('returns regular_page_permission_required on catch when permission check returns false', async () => {
      const deps = makeDeps({
        scripting: {
          executeScript: async () => {
            throw new Error('inject failed')
          }
        },
        onCatchPermissionCheck: async () => false
      })
      const result = await readActiveTabPage(extractContext, deps)
      assert.strictEqual(result.ok, false)
      if (!result.ok) {
        assert.strictEqual(
          result.error.code,
          'regular_page_permission_required'
        )
      }
    })

    void it('returns content_script_unavailable on catch when permission check returns true', async () => {
      const deps = makeDeps({
        scripting: {
          executeScript: async () => {
            throw new Error('inject failed')
          }
        },
        onCatchPermissionCheck: async () => true
      })
      const result = await readActiveTabPage(extractContext, deps)
      assert.strictEqual(result.ok, false)
      if (!result.ok) {
        assert.strictEqual(result.error.code, 'content_script_unavailable')
      }
    })

    void it('returns no_active_tab when tab has no URL', async () => {
      const deps = makeDeps({
        tabs: {
          query: async () => [{ id: 1 }],
          sendMessage: async () => ({})
        }
      })
      const result = await readActiveTabPage(extractContext, deps)
      assert.strictEqual(result.ok, false)
      if (!result.ok) {
        assert.strictEqual(result.error.code, 'no_active_tab')
      }
    })

    void it('returns content_script_unavailable when sendMessage returns undefined', async () => {
      const deps = makeDeps({
        tabs: {
          query: async () => [{ id: 1, url: 'https://example.com' }],
          sendMessage: async () => undefined
        }
      })
      const result = await readActiveTabPage(extractContext, deps)
      assert.strictEqual(result.ok, false)
      if (!result.ok) {
        assert.strictEqual(result.error.code, 'content_script_unavailable')
      }
    })
  })

  void describe('performActiveTabAction', () => {
    void it('returns action result when response is ok', async () => {
      const deps = makeDeps({
        tabs: {
          query: async () => [{ id: 1, url: 'https://example.com' }],
          sendMessage: async () => ({ ok: true, data: { clicked: true } })
        }
      })
      const result = await performActiveTabAction(clickMessage, deps)
      assert.deepStrictEqual(result, { ok: true, data: { clicked: true } })
    })

    void it('returns action_content_script_unavailable on catch without permission check', async () => {
      const deps = makeDeps({
        scripting: {
          executeScript: async () => {
            throw new Error('inject failed')
          }
        }
      })
      const result = await performActiveTabAction(clickMessage, deps)
      assert.strictEqual(result.ok, false)
      if (!result.ok) {
        assert.strictEqual(result.error.code, 'content_script_unavailable')
      }
    })

    void it('returns action regular_page_permission_required on catch when permission check returns false', async () => {
      const deps = makeDeps({
        scripting: {
          executeScript: async () => {
            throw new Error('inject failed')
          }
        },
        onCatchPermissionCheck: async () => false
      })
      const result = await performActiveTabAction(clickMessage, deps)
      assert.strictEqual(result.ok, false)
      if (!result.ok) {
        assert.strictEqual(
          result.error.code,
          'regular_page_permission_required'
        )
      }
    })

    void it('returns error from failed action response', async () => {
      const deps = makeDeps({
        tabs: {
          query: async () => [{ id: 1, url: 'https://example.com' }],
          sendMessage: async () => ({
            ok: false,
            error: { code: 'target_not_found', message: 'No such element' }
          })
        }
      })
      const result = await performActiveTabAction(clickMessage, deps)
      assert.strictEqual(result.ok, false)
      if (!result.ok) {
        assert.strictEqual(result.error.code, 'target_not_found')
      }
    })
  })

  void describe('regularPagePermissionRequired', () => {
    void it('returns regular_page_permission_required error for reads', () => {
      const result: PageReadResult<unknown> = regularPagePermissionRequired()
      assert.strictEqual(result.ok, false)
      if (!result.ok) {
        assert.strictEqual(
          result.error.code,
          'regular_page_permission_required'
        )
        assert.ok(result.error.message.includes('regular page access'))
      }
    })
  })

  void describe('actionRegularPagePermissionRequired', () => {
    void it('returns regular_page_permission_required error for actions', () => {
      const result: PageActionResult = actionRegularPagePermissionRequired()
      assert.strictEqual(result.ok, false)
      if (!result.ok) {
        assert.strictEqual(
          result.error.code,
          'regular_page_permission_required'
        )
      }
    })
  })
})
