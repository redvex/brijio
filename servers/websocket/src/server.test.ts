import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import http from 'node:http'
import WebSocket from 'ws'
import { createWebSocketServer, type BrijioWebSocketServer } from './server.js'

type JsonObject = Record<string, unknown>

const validToken = 'local-token'
const otherToken = 'other-local-token'
const servers: Array<{ close: () => Promise<void> }> = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(async (server) => await server.close()))
})

void describe('GET /health', () => {
  void it('returns 200 with enriched health data', async () => {
    const server = await startTestServer()
    const url = new URL(server.url)
    const healthUrl = `http://${url.hostname}:${url.port}/health`

    const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
      http.get(healthUrl, (res) => {
        resolve(res)
      }).on('error', reject)
    })

    assert.equal(response.statusCode, 200)
    const body = await collectBody(response)
    const health = JSON.parse(body) as JsonObject

    assert.equal(health.status, 'ok')
    assert.equal(typeof health.version, 'string')
    assert.equal(typeof health.uptimeSeconds, 'number')
    assert.ok(health.extensions != null)
    const extensions = health.extensions as JsonObject
    assert.equal(typeof extensions.count, 'number')
    assert.ok(Array.isArray(extensions.browsers))
  })

  void it('includes connected extensions via getStatus', async () => {
    const server = await startTestServer()
    const extension = await authenticatedExtension(server.url)
    // Allow event loop to settle after presence registration
    await new Promise((resolve) => setTimeout(resolve, 10))

    const status = server.getStatus()

    assert.equal(status.extensions.count, 1)
    assert.equal(status.extensions.browsers[0]?.browserInstanceId, 'chrome-default')
    assert.equal(status.extensions.browsers[0]?.label, 'Chrome Default')

    extension.close()
  })

  void it('excludes disconnected extensions from getStatus', async () => {
    const server = await startTestServer()
    const extension = await authenticatedExtension(server.url)
    await new Promise((resolve) => setTimeout(resolve, 10))

    extension.close()
    await waitForClose(extension)

    const status = server.getStatus()

    assert.equal(status.extensions.count, 0)
    assert.deepEqual(status.extensions.browsers, [])
  })
})

void describe('WebSocket authenticated browser routing', () => {
  void it('rejects messages before authentication with auth_required', async () => {
    const server = await startTestServer()
    const client = await connect(server.url)

    const received = waitForJsonMessage(client)
    client.send(JSON.stringify(pageContextMessage()))

    assert.deepEqual(await received, {
      type: 'error',
      error: {
        code: 'auth_required',
        message: 'Authenticate before sending Brijio messages.'
      }
    })
    client.close()
  })

  void it('rejects invalid tokens with auth_failed', async () => {
    const server = await startTestServer()
    const client = await connect(server.url)

    const received = waitForJsonMessage(client)
    client.send(JSON.stringify(authMessage('mcp', 'wrong-token')))

    assert.deepEqual(await received, {
      type: 'error',
      error: {
        code: 'auth_failed',
        message: 'Brijio pairing token was not accepted.'
      }
    })
    client.close()
  })

  void it('requests presence after extension authentication', async () => {
    const server = await startTestServer()
    const extension = await connect(server.url)

    const received = waitForJsonMessages(extension, 2)
    extension.send(JSON.stringify(authMessage('extension')))
    assert.deepEqual(await received, [
      authSuccessMessage('extension-auth'),
      {
        type: 'message',
        id: 'presence-1',
        payload: {
          type: 'browser_presence_request'
        }
      }
    ])
    extension.close()
  })

  void it('lists only browsers in the authenticated token scope', async () => {
    const server = await startTestServer()
    const extension = await authenticatedExtension(server.url)
    const otherExtension = await authenticatedExtension(
      server.url,
      otherToken,
      'chrome-other',
      'Chrome Other'
    )
    const mcp = await authenticatedMcp(server.url)

    extension.send(
      JSON.stringify(presenceMessage('chrome-default', 'Chrome Default'))
    )
    otherExtension.send(
      JSON.stringify(presenceMessage('chrome-other', 'Chrome Other'))
    )

    const received = waitForJsonMessage(mcp)
    mcp.send(JSON.stringify(listBrowsersMessage()))

    assert.deepEqual(await received, {
      type: 'message',
      id: 'list-1',
      payload: {
        type: 'browser_list',
        ok: true,
        data: {
          browsers: [
            {
              browserInstanceId: 'chrome-default',
              label: 'Chrome Default',
              browserName: 'Chrome',
              profileName: 'Default',
              connectedAt: '2026-05-25T10:00:00.000Z',
              lastSeenAt: '2026-05-25T10:00:00.000Z',
              capabilities: ['page_context', 'click']
            }
          ]
        }
      }
    })
    extension.close()
    otherExtension.close()
    mcp.close()
  })

  void it('forwards list_tabs to the connected extension', async () => {
    const server = await startTestServer()
    const extension = await authenticatedExtension(server.url)
    const mcp = await authenticatedMcp(server.url)

    extension.send(
      JSON.stringify(presenceMessage('chrome-default', 'Chrome Default'))
    )

    const routed = waitForJsonMessage(extension)
    mcp.send(JSON.stringify(listTabsMessage()))

    assert.deepEqual(await routed, listTabsMessage())
    extension.close()
    mcp.close()
  })

  void it('routes to the only online browser by default', async () => {
    const server = await startTestServer()
    const extension = await authenticatedExtension(server.url)
    const mcp = await authenticatedMcp(server.url)

    extension.send(
      JSON.stringify(presenceMessage('chrome-default', 'Chrome Default'))
    )

    const routed = waitForJsonMessage(extension)
    mcp.send(JSON.stringify(pageContextMessage()))

    assert.deepEqual(await routed, pageContextMessage())
    extension.close()
    mcp.close()
  })

  void it('routes browser responses back to the requesting MCP connection', async () => {
    const server = await startTestServer()
    const extension = await authenticatedExtension(server.url)
    const mcp = await authenticatedMcp(server.url)

    const routed = waitForJsonMessage(extension)
    mcp.send(JSON.stringify(pageContextMessage()))
    await routed

    const response = waitForJsonMessage(mcp)
    extension.send(JSON.stringify(pageContextResponseMessage()))

    assert.deepEqual(await response, pageContextResponseMessage())
    extension.close()
    mcp.close()
  })

  void it('returns ambiguous_browser_target when multiple browsers are online', async () => {
    const server = await startTestServer()
    const first = await authenticatedExtension(
      server.url,
      validToken,
      'chrome-default',
      'Chrome Default'
    )
    const second = await authenticatedExtension(
      server.url,
      validToken,
      'chrome-work',
      'Chrome Work'
    )
    const mcp = await authenticatedMcp(server.url)

    first.send(JSON.stringify(presenceMessage('chrome-default', 'Chrome Default')))
    second.send(JSON.stringify(presenceMessage('chrome-work', 'Chrome Work')))

    const received = waitForJsonMessage(mcp)
    mcp.send(JSON.stringify(pageContextMessage()))

    assert.deepEqual(await received, {
      type: 'error',
      error: {
        code: 'ambiguous_browser_target',
        message:
          'Multiple Brijio browsers are online. Specify browserInstanceId.',
        browsers: [
          {
            browserInstanceId: 'chrome-default',
            label: 'Chrome Default',
            browserName: 'Chrome',
            profileName: 'Default',
            connectedAt: '2026-05-25T10:00:00.000Z',
            lastSeenAt: '2026-05-25T10:00:00.000Z',
            capabilities: ['page_context', 'click']
          },
          {
            browserInstanceId: 'chrome-work',
            label: 'Chrome Work',
            browserName: 'Chrome',
            profileName: 'Default',
            connectedAt: '2026-05-25T10:00:00.000Z',
            lastSeenAt: '2026-05-25T10:00:00.000Z',
            capabilities: ['page_context', 'click']
          }
        ]
      }
    })
    first.close()
    second.close()
    mcp.close()
  })

  void it('routes to an explicit browser instance', async () => {
    const server = await startTestServer()
    const first = await authenticatedExtension(
      server.url,
      validToken,
      'chrome-default',
      'Chrome Default'
    )
    const second = await authenticatedExtension(
      server.url,
      validToken,
      'chrome-work',
      'Chrome Work'
    )
    const mcp = await authenticatedMcp(server.url)

    first.send(JSON.stringify(presenceMessage('chrome-default', 'Chrome Default')))
    second.send(JSON.stringify(presenceMessage('chrome-work', 'Chrome Work')))

    const firstReceived = waitForNoMessage(first)
    const secondReceived = waitForJsonMessage(second)
    mcp.send(JSON.stringify(pageContextMessage('chrome-work')))

    await firstReceived
    assert.deepEqual(await secondReceived, pageContextMessage('chrome-work'))
    first.close()
    second.close()
    mcp.close()
  })

  void it('returns browser_unavailable for a missing explicit browser', async () => {
    const server = await startTestServer()
    const extension = await authenticatedExtension(server.url)
    const mcp = await authenticatedMcp(server.url)

    extension.send(
      JSON.stringify(presenceMessage('chrome-default', 'Chrome Default'))
    )

    const received = waitForJsonMessage(mcp)
    mcp.send(JSON.stringify(pageContextMessage('missing-browser')))

    assert.deepEqual(await received, {
      type: 'error',
      error: {
        code: 'browser_unavailable',
        message: 'No matching Brijio browser is online.'
      }
    })
    extension.close()
    mcp.close()
  })

  void it('accepts extension keepalive without error', async () => {
    const server = await startTestServer()
    const extension = await authenticatedExtension(server.url)
    const mcp = await authenticatedMcp(server.url)

    // Keepalive should be silently accepted (no error sent back)
    const noMessage = waitForNoMessage(extension)
    extension.send(JSON.stringify(keepaliveMessage()))
    await noMessage

    // MCP client should not receive anything either
    const noMcpMessage = waitForNoMessage(mcp)
    await noMcpMessage

    extension.close()
    mcp.close()
  })

  void it('removes browser presence after disconnect', async () => {
    const server = await startTestServer()
    const extension = await authenticatedExtension(server.url)
    const mcp = await authenticatedMcp(server.url)

    extension.send(
      JSON.stringify(presenceMessage('chrome-default', 'Chrome Default'))
    )
    extension.close()
    await waitForClose(extension)

    const received = waitForJsonMessage(mcp)
    mcp.send(JSON.stringify(listBrowsersMessage()))

    assert.deepEqual(await received, {
      type: 'message',
      id: 'list-1',
      payload: {
        type: 'browser_list',
        ok: true,
        data: {
          browsers: []
        }
      }
    })
    mcp.close()
  })
})

async function startTestServer (): Promise<BrijioWebSocketServer> {
  const server = await createWebSocketServer({
    host: '127.0.0.1',
    port: 0,
    pairingToken: validToken,
    additionalPairingTokens: [otherToken],
    now: () => new Date('2026-05-25T10:00:00.000Z')
  })
  servers.push(server)
  return server
}

async function authenticatedExtension (
  url: string,
  token = validToken,
  browserInstanceId = 'chrome-default',
  label = 'Chrome Default'
): Promise<WebSocket> {
  const extension = await connect(url)
  const authResponses = waitForJsonMessages(extension, 2)
  extension.send(JSON.stringify(authMessage('extension', token)))
  await authResponses
  extension.send(JSON.stringify(presenceMessage(browserInstanceId, label)))
  return extension
}

async function authenticatedMcp (
  url: string,
  token = validToken
): Promise<WebSocket> {
  const mcp = await connect(url)
  const authResponse = waitForJsonMessage(mcp)
  mcp.send(JSON.stringify(authMessage('mcp', token)))
  await authResponse
  return mcp
}

function authMessage (
  role: 'extension' | 'mcp',
  token = validToken
): unknown {
  return {
    type: 'message',
    id: `${role}-auth`,
    payload: {
      type: 'auth',
      role,
      token
    }
  }
}

function authSuccessMessage (id: string): unknown {
  return {
    type: 'message',
    id,
    payload: {
      type: 'auth_success'
    }
  }
}

function presenceMessage (browserInstanceId: string, label: string): unknown {
  return {
    type: 'message',
    id: `presence-${browserInstanceId}`,
    payload: {
      type: 'browser_presence_announce',
      browserInstanceId,
      label,
      browserName: 'Chrome',
      profileName: 'Default',
      capabilities: ['page_context', 'click']
    }
  }
}

function listBrowsersMessage (): unknown {
  return {
    type: 'message',
    id: 'list-1',
    payload: {
      type: 'list_browsers'
    }
  }
}

function listTabsMessage (): unknown {
  return {
    type: 'message',
    id: 'list-tabs-1',
    payload: {
      type: 'list_tabs'
    }
  }
}

function pageContextMessage (browserInstanceId?: string): unknown {
  return {
    type: 'message',
    id: 'context-1',
    ...(browserInstanceId === undefined
      ? {}
      : { target: { browserInstanceId } }),
    payload: {
      type: 'get_page_context'
    }
  }
}

function keepaliveMessage (): unknown {
  return {
    type: 'message',
    payload: {
      type: 'extension_keepalive'
    }
  }
}

function pageContextResponseMessage (): unknown {
  return {
    type: 'message',
    id: 'context-1',
    payload: {
      type: 'page_context_response',
      ok: true,
      data: {
        url: 'https://example.com/',
        title: 'Example',
        timestamp: '2026-05-25T10:00:00.000Z',
        selectedText: null,
        preview: {
          content: 'Example preview',
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
        }
      }
    }
  }
}

async function connect (url: string): Promise<WebSocket> {
  return await new Promise((resolve, reject) => {
    const client = new WebSocket(url)
    client.once('open', () => resolve(client))
    client.once('error', reject)
  })
}

async function waitForJsonMessage (client: WebSocket): Promise<JsonObject> {
  const [message] = await waitForJsonMessages(client, 1)

  return message
}

async function waitForJsonMessages (
  client: WebSocket,
  count: number
): Promise<JsonObject[]> {
  return await new Promise((resolve, reject) => {
    const messages: JsonObject[] = []
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for WebSocket JSON message.'))
    }, 100)

    client.on('message', onMessage)
    client.once('error', onError)

    function onMessage (data: WebSocket.RawData): void {
      try {
        const message = rawDataToString(data)
        messages.push(JSON.parse(message) as JsonObject)

        if (messages.length === count) {
          cleanup()
          resolve(messages)
        }
      } catch (error) {
        cleanup()
        reject(error)
      }
    }

    function onError (error: Error): void {
      cleanup()
      reject(error)
    }

    function cleanup (): void {
      clearTimeout(timeout)
      client.off('message', onMessage)
      client.off('error', onError)
    }
  })
}

async function waitForNoMessage (client: WebSocket): Promise<void> {
  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, 25)

    client.once('message', (data) => {
      clearTimeout(timeout)
      reject(new Error(`Expected no message, received ${rawDataToString(data)}`))
    })
    client.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
  })
}

async function waitForClose (client: WebSocket): Promise<void> {
  if (client.readyState === client.CLOSED) {
    return
  }

  return await new Promise((resolve) => {
    client.once('close', () => resolve())
  })
}

async function collectBody (response: http.IncomingMessage): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    response.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })
    response.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
    response.on('error', reject)
  })
}

function rawDataToString (data: WebSocket.RawData): string {
  if (Buffer.isBuffer(data)) {
    return data.toString('utf8')
  }

  if (Array.isArray(data)) {
    return Buffer.concat(data).toString('utf8')
  }

  return Buffer.from(data).toString('utf8')
}
