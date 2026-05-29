import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  hasRegularPageAccess,
  isRegularPageUrl
} from './permissions.js'

void describe('Chrome regular page permissions', () => {
  void it('recognizes regular HTTP and HTTPS page URLs', () => {
    assert.equal(isRegularPageUrl('http://example.com/'), true)
    assert.equal(isRegularPageUrl('https://example.com/docs'), true)
    assert.equal(isRegularPageUrl('chrome://extensions'), false)
    assert.equal(isRegularPageUrl('chrome-extension://abc/popup.html'), false)
    assert.equal(isRegularPageUrl('file:///Users/example/report.html'), false)
  })

  void it('always has regular page access because broad host permission is granted at install time', async () => {
    const granted = await hasRegularPageAccess()

    assert.equal(granted, true)
  })
})