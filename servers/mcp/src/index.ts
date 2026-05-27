import {
  getMcpHttpServerOptionsFromEnv,
  startBrowserBridgeMcpHttpServer
} from './http-server.js'

async function main (): Promise<void> {
  const options = getMcpHttpServerOptionsFromEnv()
  const runtime = await startBrowserBridgeMcpHttpServer(options)

  console.error(`BrowserBridge MCP server listening at ${runtime.url}`)
}

main().catch((error: unknown) => {
  console.error('Fatal error in BrowserBridge MCP server:', error)
  process.exit(1)
})
