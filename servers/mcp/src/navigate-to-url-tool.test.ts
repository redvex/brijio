import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { navigateToUrl } from './navigate-to-url-tool.js'

void describe('MCP navigate to url tool', () => {
  void it('returns invalid tool input for empty URL', async () => {
    const result = await navigateToUrl(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestNavigateToUrl: async () => {
          throw new Error('navigate should not be requested')
        }
      },
      {
        url: ''
      }
    )

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'invalid_tool_input',
        message: 'url must be a non-empty string.'
      }
    })
  })

  void it('returns invalid tool input for non-string URL', async () => {
    const result = await navigateToUrl(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestNavigateToUrl: async () => {
          throw new Error('navigate should not be requested')
        }
      },
      {
        url: 42
      }
    )

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'invalid_tool_input',
        message: 'url must be a non-empty string.'
      }
    })
  })

  void it('returns unsupported_scheme for ftp URLs', async () => {
    const result = await navigateToUrl(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestNavigateToUrl: async () => {
          throw new Error('navigate should not be requested')
        }
      },
      {
        url: 'ftp://example.com/'
      }
    )

    assert.equal(result.ok, false)
    if (result.ok) {
      assert.fail('Expected error')
      return
    }
    assert.equal(result.error.code, 'unsupported_scheme')
  })

  void it('returns unsupported_scheme for javascript URLs', async () => {
    const result = await navigateToUrl(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestNavigateToUrl: async () => {
          throw new Error('navigate should not be requested')
        }
      },
      {
        url: 'javascript:void(0)'
      }
    )

    assert.equal(result.ok, false)
    if (result.ok) {
      assert.fail('Expected error')
      return
    }
    assert.equal(result.error.code, 'unsupported_scheme')
  })

  void it('returns unsupported_scheme for data URLs', async () => {
    const result = await navigateToUrl(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestNavigateToUrl: async () => {
          throw new Error('navigate should not be requested')
        }
      },
      {
        url: 'data:text/html,<h1>Hello</h1>'
      }
    )

    assert.equal(result.ok, false)
    if (result.ok) {
      assert.fail('Expected error')
      return
    }
    assert.equal(result.error.code, 'unsupported_scheme')
  })

  void it('returns unsupported_scheme for file URLs', async () => {
    const result = await navigateToUrl(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestNavigateToUrl: async () => {
          throw new Error('navigate should not be requested')
        }
      },
      {
        url: 'file:///etc/passwd'
      }
    )

    assert.equal(result.ok, false)
    if (result.ok) {
      assert.fail('Expected error')
      return
    }
    assert.equal(result.error.code, 'unsupported_scheme')
  })

  void it('passes a valid HTTPS URL to the WS client', async () => {
    const requestedUrls: string[] = []
    const result = await navigateToUrl(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestNavigateToUrl: async (options) => {
          requestedUrls.push(options.url)
          return {
            ok: true,
            data: {
              url: 'https://example.com/',
              title: 'Example Domain',
              timestamp: '2026-06-08T10:00:00.000Z',
              redirected: false,
              navigationMs: 250
            }
          }
        }
      },
      {
        url: 'https://example.com/',
        browserInstanceId: 'chrome-default-test'
      }
    )

    assert.deepEqual(requestedUrls, ['https://example.com/'])
    assert.deepEqual(result, {
      ok: true,
      data: {
        url: 'https://example.com/',
        title: 'Example Domain',
        timestamp: '2026-06-08T10:00:00.000Z',
        redirected: false,
        navigationMs: 250
      }
    })
  })

  void it('passes a valid HTTP URL to the WS client', async () => {
    const requestedUrls: string[] = []
    const result = await navigateToUrl(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestNavigateToUrl: async (options) => {
          requestedUrls.push(options.url)
          return {
            ok: true,
            data: {
              url: 'http://localhost:3000/',
              title: 'Local Dev',
              timestamp: '2026-06-08T10:00:00.000Z',
              redirected: true,
              navigationMs: 100
            }
          }
        }
      },
      {
        url: 'http://localhost:3000/'
      }
    )

    assert.deepEqual(requestedUrls, ['http://localhost:3000/'])
    assert.equal(result.ok, true)
    if (!result.ok) {
      assert.fail('Expected success')
      return
    }
    assert.equal(result.data.url, 'http://localhost:3000/')
    assert.equal(result.data.title, 'Local Dev')
    assert.equal(result.data.redirected, true)
  })

  void it('propagates browser unavailable error', async () => {
    const result = await navigateToUrl(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestNavigateToUrl: async () => ({
          ok: false as const,
          error: {
            code: 'browser_unavailable' as const,
            message: 'No Brijio browser is online.'
          }
        })
      },
      {
        url: 'https://example.com/'
      }
    )

    assert.equal(result.ok, false)
    if (result.ok) {
      assert.fail('Expected error')
      return
    }
    assert.equal(result.error.code, 'browser_unavailable')
    assert.equal(result.error.message, 'No Brijio browser is online.')
  })

  void it('propagates navigation_failed error from browser', async () => {
    const result = await navigateToUrl(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestNavigateToUrl: async () => ({
          ok: false as const,
          error: {
            code: 'browser_error' as const,
            message: 'navigation_failed: The page failed to load.'
          }
        })
      },
      {
        url: 'https://example.com/'
      }
    )

    assert.equal(result.ok, false)
    if (result.ok) {
      assert.fail('Expected error')
      return
    }
    assert.equal(result.error.code, 'browser_error')
    assert.equal(result.error.message, 'navigation_failed: The page failed to load.')
  })

  void it('propagates timeout error from browser', async () => {
    const result = await navigateToUrl(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestNavigateToUrl: async () => ({
          ok: false as const,
          error: {
            code: 'timeout' as const,
            message: 'Timed out waiting for a browser navigation response.'
          }
        })
      },
      {
        url: 'https://example.com/'
      }
    )

    assert.equal(result.ok, false)
    if (result.ok) {
      assert.fail('Expected error')
      return
    }
    assert.equal(result.error.code, 'timeout')
  })

  void it('returns invalid tool input for invalid browserInstanceId', async () => {
    const result = await navigateToUrl(
      {
        websocketUrl: 'ws://127.0.0.1:8787',
        timeoutMs: 5000,
        requestNavigateToUrl: async () => {
          throw new Error('navigate should not be requested')
        }
      },
      {
        url: 'https://example.com/',
        browserInstanceId: ''
      }
    )

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'invalid_tool_input',
        message: 'browserInstanceId must be a non-empty string when provided.'
      }
    })
  })
})