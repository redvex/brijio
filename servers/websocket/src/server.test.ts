import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import WebSocket from 'ws'
import { createWebSocketServer } from './server.js'

type JsonObject = Record<string, unknown>

const servers: Array<{ close: () => Promise<void> }> = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(async (server) => await server.close()))
})

void describe('WebSocket single-channel echo and pub/sub', () => {
  void it('echoes a valid message back to the sender', async () => {
    const server = await startTestServer()
    const client = await connect(server.url)
    const message = { type: 'message', id: 'msg-1', payload: { text: 'hello' } }

    const received = waitForJsonMessage(client)
    client.send(JSON.stringify(message))

    assert.deepEqual(await received, message)
    client.close()
  })

  void it('broadcasts a valid message to other connected clients', async () => {
    const server = await startTestServer()
    const sender = await connect(server.url)
    const subscriber = await connect(server.url)
    const message = { type: 'message', id: 'msg-2', payload: { text: 'fanout' } }

    const senderReceived = waitForJsonMessage(sender)
    const subscriberReceived = waitForJsonMessage(subscriber)
    sender.send(JSON.stringify(message))

    assert.deepEqual(await senderReceived, message)
    assert.deepEqual(await subscriberReceived, message)
    sender.close()
    subscriber.close()
  })

  void it('returns a structured error for invalid JSON', async () => {
    const server = await startTestServer()
    const client = await connect(server.url)

    const received = waitForJsonMessage(client)
    client.send('{not valid json')

    assert.deepEqual(await received, {
      type: 'error',
      error: {
        code: 'invalid_json',
        message: 'Message must be valid JSON.'
      }
    })
    client.close()
  })

  void it('returns a structured error for unsupported message envelopes', async () => {
    const server = await startTestServer()
    const client = await connect(server.url)

    const received = waitForJsonMessage(client)
    client.send(JSON.stringify({ type: 'unknown', payload: { text: 'hello' } }))

    assert.deepEqual(await received, {
      type: 'error',
      error: {
        code: 'invalid_message',
        message: 'Message must be an object with type "message" and a payload property.'
      }
    })
    client.close()
  })
})

async function startTestServer (): Promise<{ url: string }> {
  const server = await createWebSocketServer({ host: '127.0.0.1', port: 0 })
  servers.push(server)
  return { url: server.url }
}

async function connect (url: string): Promise<WebSocket> {
  return await new Promise((resolve, reject) => {
    const client = new WebSocket(url)
    client.once('open', () => resolve(client))
    client.once('error', reject)
  })
}

async function waitForJsonMessage (client: WebSocket): Promise<JsonObject> {
  return await new Promise((resolve, reject) => {
    client.once('message', (data) => {
      try {
        const message = rawDataToString(data)

        assert.equal(typeof message, 'string')
        resolve(JSON.parse(message) as JsonObject)
      } catch (error) {
        reject(error)
      }
    })
    client.once('error', reject)
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
