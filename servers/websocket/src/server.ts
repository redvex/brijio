import { WebSocketServer, type RawData, type WebSocket } from 'ws'
import { parseWebSocketMessage } from './protocol.js'

export interface WebSocketServerOptions {
  host?: string
  port?: number
}

export interface BrowserBridgeWebSocketServer {
  url: string
  close: () => Promise<void>
}

export async function createWebSocketServer (
  options: WebSocketServerOptions = {}
): Promise<BrowserBridgeWebSocketServer> {
  const host = options.host ?? '127.0.0.1'
  const port = options.port ?? 8787
  const server = new WebSocketServer({ host, port })

  server.on('connection', (socket) => {
    socket.on('message', (data) => {
      const result = parseWebSocketMessage(rawDataToString(data))

      if (!result.ok) {
        sendJson(socket, result.error)
        return
      }

      if (isExtensionKeepalive(result.message.payload)) {
        return
      }

      forwardJson(server, socket, result.message)
    })
  })

  await waitForListening(server)

  return {
    url: `ws://${host}:${getPort(server)}`,
    close: async () => await closeServer(server)
  }
}

function forwardJson (
  server: WebSocketServer,
  sender: WebSocket,
  message: unknown
): void {
  const serialized = JSON.stringify(message)

  for (const client of server.clients) {
    if (client !== sender && client.readyState === client.OPEN) {
      client.send(serialized)
    }
  }
}

function isExtensionKeepalive (payload: unknown): boolean {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    !Array.isArray(payload) &&
    'type' in payload &&
    payload.type === 'extension_keepalive'
  )
}

function sendJson (socket: WebSocket, message: unknown): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message))
  }
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

async function waitForListening (server: WebSocketServer): Promise<void> {
  if (server.address() !== null) {
    return await Promise.resolve()
  }

  return await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
}

function getPort (server: WebSocketServer): number {
  const address = server.address()

  if (address === null || typeof address === 'string') {
    throw new Error('WebSocket server is not listening on a TCP port.')
  }

  return address.port
}

async function closeServer (server: WebSocketServer): Promise<void> {
  for (const client of server.clients) {
    client.close()
  }

  return await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error != null) {
        reject(error)
        return
      }

      resolve()
    })
  })
}
