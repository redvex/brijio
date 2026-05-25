import {
  McpServer,
  ResourceTemplate
} from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError
} from '@modelcontextprotocol/sdk/types.js'
import {
  getCurrentPageContent,
  getCurrentPageContext,
  getPageContextConfigFromEnv,
  parsePageContentResourceIndex
} from './page-context.js'

const currentPageResourceUri = 'browser://page/current'
const currentPageContentResourceTemplateUri =
  'browser://page/current/content/{index}'

const server = new McpServer({
  name: 'browserbridge-mcp',
  version: '0.0.0'
})

const pageContextConfig = getPageContextConfigFromEnv()

server.server.registerCapabilities({
  tools: {
    listChanged: true
  }
})

server.server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: []
}))

server.server.setRequestHandler(CallToolRequestSchema, (request) => {
  throw new McpError(
    ErrorCode.MethodNotFound,
    `Tool is not registered: ${request.params.name}`
  )
})

server.registerResource(
  'current-page-context',
  currentPageResourceUri,
  {
    title: 'Current Page Context',
    description:
      'Read the current browser page context through BrowserBridge.',
    mimeType: 'application/json'
  },
  async () => {
    const result = await getCurrentPageContext(pageContextConfig)

    return {
      contents: [
        {
          uri: currentPageResourceUri,
          mimeType: 'application/json',
          text: JSON.stringify(result)
        }
      ]
    }
  }
)

server.registerResource(
  'current-page-content',
  new ResourceTemplate(currentPageContentResourceTemplateUri, {
    list: undefined
  }),
  {
    title: 'Current Page Content',
    description:
      'Read a chunk of normalized current browser page content through BrowserBridge.',
    mimeType: 'application/json'
  },
  async (uri) => {
    const index = parsePageContentResourceIndex(uri.href)
    const result =
      typeof index === 'number'
        ? await getCurrentPageContent(pageContextConfig, index)
        : index

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(result)
        }
      ]
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
