import { createWebSocketServer } from './server.js'
import { createLogger } from '@browserbridge/shared'

const logger = createLogger('websocket')

const host = process.env.WEBSOCKET_HOST ?? '0.0.0.0'
const port = Number.parseInt(process.env.WEBSOCKET_PORT ?? '8787', 10)

if (Number.isNaN(port)) {
  throw new Error('WEBSOCKET_PORT must be a number.')
}

const server = await createWebSocketServer({ host, port })

logger.info('server_started', { url: server.url })
