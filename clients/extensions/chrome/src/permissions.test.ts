import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  hasRegularPageAccess,
  isRegularPageUrl,
  regularPageOrigins,
  requestRegularPageAccess,
  type ChromePermissionsApi
} from './permissions.js'

void describe('Chrome regular page permissions', () => {
  void it('defines optional host origins for regular pages only', () => {
    assert.deepEqual(regularPageOrigins, ['http://*/*', 'https://*/*'])
  })

  void it('recognizes regular HTTP and HTTPS page URLs', () => {
    assert.equal(isRegularPageUrl('http://example.com/'), true)
    assert.equal(isRegularPageUrl('https://example.com/docs'), true)
    assert.equal(isRegularPageUrl('chrome://extensions'), false)
    assert.equal(isRegularPageUrl('chrome-extension://abc/setup.html'), false)
    assert.equal(isRegularPageUrl('file:///Users/example/report.html'), false)
  })

  void it('checks whether regular page host access is granted', async () => {
    const permissions = new FakePermissionsApi(true)

    const granted = await hasRegularPageAccess(permissions)

    assert.equal(granted, true)
    assert.deepEqual(permissions.containsRequests, [
      {
        origins: regularPageOrigins
      }
    ])
  })

  void it('requests regular page host access from a user action', async () => {
    const permissions = new FakePermissionsApi(false, true)

    const granted = await requestRegularPageAccess(permissions)

    assert.equal(granted, true)
    assert.deepEqual(permissions.requestRequests, [
      {
        origins: regularPageOrigins
      }
    ])
  })
})

class FakePermissionsApi implements ChromePermissionsApi {
  readonly containsRequests: Array<{ origins: string[] }> = []
  readonly requestRequests: Array<{ origins: string[] }> = []

  constructor (
    private readonly containsResult: boolean,
    private readonly requestResult = false
  ) {}

  async contains (permissions: { origins: string[] }): Promise<boolean> {
    this.containsRequests.push(permissions)
    return this.containsResult
  }

  async request (permissions: { origins: string[] }): Promise<boolean> {
    this.requestRequests.push(permissions)
    return this.requestResult
  }
}
