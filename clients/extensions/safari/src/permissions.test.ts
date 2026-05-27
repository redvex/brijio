import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  hasRegularPageAccess,
  isRegularPageUrl,
  requestRegularPageAccess,
  type SafariPermissionsApi
} from './permissions.js'

void describe('Safari regular page permissions', () => {
  void it('recognizes regular HTTP and HTTPS page URLs', () => {
    assert.equal(isRegularPageUrl('http://example.com'), true)
    assert.equal(isRegularPageUrl('https://example.com/path'), true)
  })

  void it('rejects non-HTTP URLs as not regular pages', () => {
    assert.equal(isRegularPageUrl('chrome://extensions'), false)
    assert.equal(isRegularPageUrl('safari-extension://abc'), false)
    assert.equal(isRegularPageUrl('about:blank'), false)
  })

  void it('always has regular page access because broad host permission is granted at install time', async () => {
    const granted = await hasRegularPageAccess()

    assert.equal(granted, true)
  })

  void it('always resolves request for regular page access because permission is already granted', async () => {
    const granted = await requestRegularPageAccess()

    assert.equal(granted, true)
  })

  void it('exposes SafariPermissionsApi type for cross-browser reference', () => {
    // Type-level check: SafariPermissionsApi should be usable as a shape reference.
    // We verify the shape by constructing a compatible object.
    const api: SafariPermissionsApi = {
      hasRegularPageAccess: async () => true,
      requestRegularPageAccess: async () => true
    }
    assert.equal(typeof api.hasRegularPageAccess, 'function')
    assert.equal(typeof api.requestRegularPageAccess, 'function')
  })
})