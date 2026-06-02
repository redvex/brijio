import {
  getMcpHttpServerOptionsFromEnv,
  startBrowserBridgeMcpHttpServer
} from './http-server.js'
import { createLogger } from '@browserbridge/shared'

const logger = createLogger('mcp')

async function main (): Promise<void> {
  const options = getMcpHttpServerOptionsFromEnv()
  const runtime = await startBrowserBridgeMcpHttpServer(options)

  logger.info('server_started', { url: runtime.url })
}

main().catch((error: unknown) => {
  logger.error('fatal_error', { message: error instanceof Error ? error.message : String(error) })
  process.exit(1)
})
