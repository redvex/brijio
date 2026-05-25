import assert from 'node:assert/strict'
import { type AddressInfo } from 'node:net'
import { afterEach, describe, it } from 'node:test'
import { WebSocketServer, type RawData, type WebSocket } from 'ws'
import { requestPageContext } from './websocket-client.js'

const servers: WebSocketServer[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(closeServer))
})

void describe('BrowserBridge WebSocket client', () => {
  void it('requests page context and returns the matching response', async () => {
    const server = await startServer((socket) => {
      socket.on('message', (data) => {
        const request = JSON.parse(rawDataToString(data)) as { id: string }

        socket.send(
          JSON.stringify({
            type: 'message',
            id: request.id,
            payload: {
              type: 'page_context_response',
              ok: true,
              data: {
                url: 'https://example.com/',
                title: 'Example'
              }
            }
          })
        )
      })
    })

    assert.deepEqual(
      await requestPageContext({
        websocketUrl: server.url,
        timeoutMs: 100,
        createRequestId: () => 'request-1'
      }),
      {
        ok: true,
        data: {
          url: 'https://example.com/',
          title: 'Example'
        }
      }
    )
  })

  void it('times out when no matching response arrives', async () => {
    const server = await startServer((socket) => {
      socket.on('message', () => {
        socket.send(
          JSON.stringify({
            type: 'message',
            id: 'other-request',
            payload: {
              type: 'page_context_response',
              ok: true,
              data: {
                url: 'https://example.com/',
                title: 'Example'
              }
            }
          })
        )
      })
    })

    assert.deepEqual(
      await requestPageContext({
        websocketUrl: server.url,
        timeoutMs: 25,
        createRequestId: () => 'request-2'
      }),
      {
        ok: false,
        error: {
          code: 'timeout',
          message: 'Timed out waiting for a browser page context response.'
        }
      }
    )
  })

  void it('returns connection_failed when the WebSocket cannot connect', async () => {
    const closedServer = await startServer(() => {})
    await closeServer(closedServer.server)

    assert.deepEqual(
      await requestPageContext({
        websocketUrl: closedServer.url,
        timeoutMs: 100,
        createRequestId: () => 'request-3'
      }),
      {
        ok: false,
        error: {
          code: 'connection_failed',
          message: `Unable to connect to BrowserBridge WebSocket at ${closedServer.url}.`
        }
      }
    )
  })
})

async function startServer (
  onConnection: (socket: WebSocket) => void
): Promise<{ server: WebSocketServer, url: string }> {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  server.on('connection', onConnection)

  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })

  servers.push(server)

  const address = getAddress(server)

  return {
    server,
    url: `ws://127.0.0.1:${address.port}`
  }
}

function getAddress (server: WebSocketServer): AddressInfo {
  const address = server.address()

  if (address === null || typeof address === 'string') {
    throw new Error('WebSocket test server is not listening on a TCP port.')
  }

  return address
}

async function closeServer (server: WebSocketServer): Promise<void> {
  for (const client of server.clients) {
    client.close()
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error != null && !String(error.message).includes('not running')) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function rawDataToString (data: RawData): string {
  if (Buffer.isBuffer(data)) {
    return data.toString('utf8')
  }

  if (Array.isArray(data)) {
    return Buffer.concat(data).toString('utf8')
  }

  return Buffer.from(data).toString('utf8')
}
