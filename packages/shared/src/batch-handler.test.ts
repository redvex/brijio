import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseHTML } from 'linkedom'
import { executeBatch, batchActionToContentRequest } from './batch-handler.js'
import type { ContentEnvironment } from './content-handler.js'

function createEnvironment (overrides?: Partial<ContentEnvironment>): ContentEnvironment {
  const { document } = parseHTML(`
    <main>
      <a href="/page2">Click me</a>
      <a href="/page3">Another link</a>
      <form>
        <label>Name <input type="text" value="" /></label>
        <label>Search <input type="search" value="" /></label>
        <label>Agree <input type="checkbox" /></label>
        <label>Color
          <select>
            <option value="red">Red</option>
            <option value="blue">Blue</option>
          </select>
        </label>
        <button type="submit">Submit</button>
      </form>
    </main>
  `)
  return {
    document,
    locationHref: overrides?.locationHref ?? 'https://example.com/',
    title: overrides?.title ?? 'Test Page',
    selectedText: overrides?.selectedText ?? '',
    now: overrides?.now ?? (() => '2026-06-10T10:00:00.000Z')
  }
}

void describe('batch-handler', () => {
  void describe('batchActionToContentRequest', () => {
    void it('converts click action', () => {
      const request = batchActionToContentRequest({
        type: 'click',
        target: { kind: 'link', id: 'bb-1' }
      })
      assert.equal(request.type, 'perform_click')
      if (request.type === 'perform_click') {
        assert.deepEqual(request.target, { kind: 'link', id: 'bb-1' })
      }
    })

    void it('converts write_text action', () => {
      const request = batchActionToContentRequest({
        type: 'write_text',
        target: { formId: 'bb-1', controlId: 'bb-2' },
        text: 'hello'
      })
      assert.equal(request.type, 'perform_write_text')
      if (request.type === 'perform_write_text') {
        assert.equal(request.text, 'hello')
      }
    })

    void it('converts set_checked action', () => {
      const request = batchActionToContentRequest({
        type: 'set_checked',
        target: { formId: 'bb-1', controlId: 'bb-3' },
        checked: true
      })
      assert.equal(request.type, 'perform_set_checked')
      if (request.type === 'perform_set_checked') {
        assert.equal(request.checked, true)
      }
    })

    void it('converts select_options action', () => {
      const request = batchActionToContentRequest({
        type: 'select_options',
        target: { formId: 'bb-1', controlId: 'bb-4' },
        values: ['red']
      })
      assert.equal(request.type, 'perform_select_options')
      if (request.type === 'perform_select_options') {
        assert.deepEqual(request.values, ['red'])
      }
    })

    void it('converts submit_form action', () => {
      const request = batchActionToContentRequest({
        type: 'submit_form',
        target: { formId: 'bb-1' }
      })
      assert.equal(request.type, 'perform_submit_form')
      if (request.type === 'perform_submit_form') {
        assert.equal(request.target.formId, 'bb-1')
      }
    })
  })

  void describe('executeBatch', () => {
    void it('executes a single click action successfully', () => {
      const env = createEnvironment()
      const result = executeBatch({
        actions: [
          { type: 'click', target: { kind: 'link', id: 'bb-1' } }
        ]
      }, env)

      assert.equal(result.ok, true)
      assert.equal(result.results.length, 1)
      assert.equal(result.results[0].ok, true)
    })

    void it('executes a single write_text action successfully', () => {
      const env = createEnvironment()
      const result = executeBatch({
        actions: [
          { type: 'write_text', target: { formId: 'bb-1', controlId: 'bb-2' }, text: 'hello' }
        ]
      }, env)

      assert.equal(result.ok, true)
      assert.equal(result.results.length, 1)
      assert.equal(result.results[0].ok, true)
    })

    void it('executes multiple actions successfully', () => {
      const env = createEnvironment()
      const result = executeBatch({
        actions: [
          { type: 'write_text', target: { formId: 'bb-1', controlId: 'bb-2' }, text: 'hello' },
          { type: 'set_checked', target: { formId: 'bb-1', controlId: 'bb-3' }, checked: true }
        ]
      }, env)

      assert.equal(result.ok, true)
      assert.equal(result.results.length, 2)
      assert.equal(result.results[0].ok, true)
      assert.equal(result.results[1].ok, true)
    })

    void it('aborts remaining actions on error by default (continueOnError=false)', () => {
      const env = createEnvironment()
      const result = executeBatch({
        actions: [
          // Non-existent link → target_not_found error
          { type: 'click', target: { kind: 'link', id: 'bb-99' } },
          // This should be aborted
          { type: 'write_text', target: { formId: 'bb-1', controlId: 'bb-2' }, text: 'hello' }
        ]
      }, env)

      assert.equal(result.ok, false)
      assert.equal(result.results.length, 2)
      // First action: target_not_found
      assert.equal(result.results[0].ok, false)
      if (!result.results[0].ok) {
        assert.equal(result.results[0].error.code, 'target_not_found')
        assert.equal(result.results[0].error.aborted, false)
      }
      // Second action: aborted
      assert.equal(result.results[1].ok, false)
      if (!result.results[1].ok) {
        assert.equal(result.results[1].error.code, 'page_navigated')
        assert.equal(result.results[1].error.aborted, true)
      }
    })

    void it('continues on error when continueOnError=true', () => {
      const env = createEnvironment()
      const result = executeBatch({
        actions: [
          // Non-existent link → error, but continue
          { type: 'click', target: { kind: 'link', id: 'bb-99' } },
          // Should still execute
          { type: 'write_text', target: { formId: 'bb-1', controlId: 'bb-2' }, text: 'hello' }
        ],
        continueOnError: true
      }, env)

      assert.equal(result.ok, false)
      assert.equal(result.results.length, 2)
      // First action: target_not_found but continues
      assert.equal(result.results[0].ok, false)
      if (!result.results[0].ok) {
        assert.equal(result.results[0].error.code, 'target_not_found')
        assert.equal(result.results[0].error.aborted, false)
      }
      // Second action: succeeds because continueOnError=true
      assert.equal(result.results[1].ok, true)
    })

    void it('always aborts on page navigation even with continueOnError=true', () => {
      // Simulate navigation by changing locationHref after the first action.
      // executeBatch captures urlBeforeBatch at start, then checks locationHref
      // after each action. We use a getter that changes after the first read.
      const { document } = parseHTML(`
        <main>
          <a href="/page2">Click me</a>
          <form>
            <label>Name <input type="text" value="" /></label>
          </form>
        </main>
      `)
      let urlCallCount = 0
      const env: ContentEnvironment = {
        document,
        get locationHref () {
          urlCallCount++
          // After 2 reads (initial urlBeforeBatch + action execution), simulate navigation
          return urlCallCount > 2 ? 'https://example.com/page2' : 'https://example.com/'
        },
        title: 'Test Page',
        selectedText: '',
        now: () => '2026-06-10T10:00:00.000Z'
      }

      const result = executeBatch({
        actions: [
          { type: 'click', target: { kind: 'link', id: 'bb-1' } },
          { type: 'write_text', target: { formId: 'bb-1', controlId: 'bb-2' }, text: 'hello' }
        ],
        continueOnError: true
      }, env)

      assert.equal(result.ok, false)
      assert.equal(result.results.length, 2)
      // First action succeeded
      assert.equal(result.results[0].ok, true)
      // Second action: aborted due to navigation
      assert.equal(result.results[1].ok, false)
      if (!result.results[1].ok) {
        assert.equal(result.results[1].error.code, 'page_navigated')
        assert.equal(result.results[1].error.aborted, true)
      }
    })

    void it('appends page context when readAfterActions=true', () => {
      const env = createEnvironment()
      const result = executeBatch({
        actions: [
          { type: 'click', target: { kind: 'link', id: 'bb-1' } }
        ],
        readAfterActions: true
      }, env)

      assert.equal(result.ok, true)
      assert.equal(result.results.length, 2)
      // Second entry is the read result (PageContext)
      assert.equal(result.results[1].ok, true)
      if (result.results[1].ok) {
        const data = result.results[1].data as { url: string, title: string }
        assert.equal(typeof data.url, 'string')
        assert.equal(typeof data.title, 'string')
      }
    })

    void it('returns ok=true for empty actions array with no read', () => {
      const env = createEnvironment()
      const result = executeBatch({
        actions: []
      }, env)

      assert.equal(result.ok, true)
      assert.equal(result.results.length, 0)
    })

    void it('handles three actions with mixed success when continueOnError=true', () => {
      const env = createEnvironment()
      const result = executeBatch({
        actions: [
          // Fails: non-existent link
          { type: 'click', target: { kind: 'link', id: 'bb-99' } },
          // Succeeds: write text
          { type: 'write_text', target: { formId: 'bb-1', controlId: 'bb-2' }, text: 'hello' },
          // Fails: non-existent link
          { type: 'click', target: { kind: 'link', id: 'bb-98' } }
        ],
        continueOnError: true
      }, env)

      assert.equal(result.ok, false)
      assert.equal(result.results.length, 3)
      assert.equal(result.results[0].ok, false)
      assert.equal(result.results[1].ok, true)
      assert.equal(result.results[2].ok, false)
    })

    void it('skips all remaining after abort with continueOnError=false', () => {
      const env = createEnvironment()
      const result = executeBatch({
        actions: [
          { type: 'click', target: { kind: 'link', id: 'bb-99' } },
          { type: 'write_text', target: { formId: 'bb-1', controlId: 'bb-2' }, text: 'hello' },
          { type: 'set_checked', target: { formId: 'bb-1', controlId: 'bb-3' }, checked: true }
        ]
      }, env)

      assert.equal(result.ok, false)
      assert.equal(result.results.length, 3)
      // First: error (not aborted)
      assert.equal(result.results[0].ok, false)
      if (!result.results[0].ok) {
        assert.equal(result.results[0].error.aborted, false)
      }
      // Second and third: aborted
      assert.equal(result.results[1].ok, false)
      if (!result.results[1].ok) {
        assert.equal(result.results[1].error.aborted, true)
      }
      assert.equal(result.results[2].ok, false)
      if (!result.results[2].ok) {
        assert.equal(result.results[2].error.aborted, true)
      }
    })

    void it('appends read result with readAfterActions even when all actions fail', () => {
      const env = createEnvironment()
      const result = executeBatch({
        actions: [
          { type: 'click', target: { kind: 'link', id: 'bb-99' } }
        ],
        continueOnError: true,
        readAfterActions: true
      }, env)

      // Action failed but read still appended
      assert.equal(result.ok, false)
      assert.equal(result.results.length, 2)
      assert.equal(result.results[0].ok, false)
      // Read result succeeds
      assert.equal(result.results[1].ok, true)
    })

    void it('aborted entries use page_navigated error code', () => {
      const env = createEnvironment()
      const result = executeBatch({
        actions: [
          { type: 'click', target: { kind: 'link', id: 'bb-99' } },
          { type: 'click', target: { kind: 'link', id: 'bb-1' } }
        ],
        continueOnError: false
      }, env)

      assert.equal(result.results[1].ok, false)
      if (!result.results[1].ok) {
        assert.equal(result.results[1].error.code, 'page_navigated')
      }
    })

    void it('sets ok=true when all actions succeed', () => {
      const env = createEnvironment()
      const result = executeBatch({
        actions: [
          { type: 'click', target: { kind: 'link', id: 'bb-1' } },
          { type: 'write_text', target: { formId: 'bb-1', controlId: 'bb-2' }, text: 'test' }
        ]
      }, env)

      assert.equal(result.ok, true)
      assert.equal(result.results.length, 2)
      assert.equal(result.results.every(r => r.ok), true)
    })

    void it('sets ok=false when any action fails with continueOnError=true', () => {
      const env = createEnvironment()
      const result = executeBatch({
        actions: [
          { type: 'click', target: { kind: 'link', id: 'bb-99' } },
          { type: 'write_text', target: { formId: 'bb-1', controlId: 'bb-2' }, text: 'ok' }
        ],
        continueOnError: true
      }, env)

      // Even though second action succeeds, overall ok is false
      assert.equal(result.ok, false)
    })
  })
})