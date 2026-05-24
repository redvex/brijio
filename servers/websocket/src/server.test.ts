import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import WebSocket from 'ws'
import { createWebSocketServer } from './server.js'

type JsonObject = Record<string, unknown>

const servers: Array<{ close: () => Promise<void> }> = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(async (server) => await server.close()))
})

void describe('WebSocket single-channel peer forwarding', () => {
  void it('does not echo a valid message back to the sender', async () => {
    const server = await startTestServer()
    const client = await connect(server.url)
    const message = { type: 'message', id: 'msg-1', payload: { text: 'hello' } }

    const received = waitForNoMessage(client)
    client.send(JSON.stringify(message))

    await received
    client.close()
  })

  void it('broadcasts a valid message to other connected clients', async () => {
    const server = await startTestServer()
    const sender = await connect(server.url)
    const subscriber = await connect(server.url)
    const message = { type: 'message', id: 'msg-2', payload: { text: 'fanout' } }

    const senderReceived = waitForNoMessage(sender)
    const subscriberReceived = waitForJsonMessage(subscriber)
    sender.send(JSON.stringify(message))

    await senderReceived
    assert.deepEqual(await subscriberReceived, message)
    sender.close()
    subscriber.close()
  })

  void it('does not forward extension keepalive messages to peers', async () => {
    const server = await startTestServer()
    const extension = await connect(server.url)
    const client = await connect(server.url)
    const keepalive = {
      type: 'message',
      id: 'keepalive-1',
      payload: { type: 'extension_keepalive' }
    }

    const received = waitForNoMessage(client)
    extension.send(JSON.stringify(keepalive))

    await received
    extension.close()
    client.close()
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

function rawDataToString (data: WebSocket.RawData): string {
  if (Buffer.isBuffer(data)) {
    return data.toString('utf8')
  }

  if (Array.isArray(data)) {
    return Buffer.concat(data).toString('utf8')
  }

  return Buffer.from(data).toString('utf8')
}
