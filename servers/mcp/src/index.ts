import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { getCurrentPageContext, getToolConfigFromEnv } from './tools.js'

const server = new McpServer({
  name: 'browserbridge-mcp',
  version: '0.0.0'
})

const toolConfig = getToolConfigFromEnv()

server.registerTool(
  'get_current_page_context',
  {
    description:
      'Request the active browser tab URL and title through BrowserBridge.'
  },
  async () => {
    const result = await getCurrentPageContext(toolConfig)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result)
        }
      ],
      isError: !result.ok
    }
  }
)

async function main (): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('BrowserBridge MCP server running on stdio')
}

main().catch((error: unknown) => {
  console.error('Fatal error in BrowserBridge MCP server:', error)
  process.exit(1)
})
