import {
  McpServer,
  ResourceTemplate
} from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import {
  getCurrentPageContent,
  getCurrentPageContext,
  getPageContextConfigFromEnv,
  parsePageContentResourceIndex
} from './page-context.js'
import { clickElement } from './click-element-tool.js'
import { fillInput } from './fill-input-tool.js'
import {
  fillEditable,
  selectOptions,
  setChecked,
  submitForm
} from './form-action-tools.js'
import { readCurrentPage } from './page-reading-tool.js'

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

server.registerTool(
  'read_current_page',
  {
    title: 'Read Current Page',
    description:
      'Read the current browser page context and optional readable content chunks.',
    inputSchema: {
      includeContent: z.boolean().optional().describe(
        'Whether to include readable page content chunks. Defaults to true.'
      ),
      maxContentChunks: z.number().optional().describe(
        'Maximum readable content chunks to fetch. Defaults to 1.'
      )
    }
  },
  async (input) => {
    const result = await readCurrentPage(pageContextConfig, input)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result)
        }
      ]
    }
  }
)

server.registerTool(
  'click_element',
  {
    title: 'Click Element',
    description:
      'Click a visible link or button-like action from the current browser page.',
    inputSchema: {
      kind: z.string().describe(
        'Target collection from the latest page context: link or action.'
      ),
      id: z.string().describe(
        'Short-lived BrowserBridge target ID from the latest page context.'
      )
    }
  },
  async (input) => {
    const result = await clickElement(pageContextConfig, input)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result)
        }
      ]
    }
  }
)

server.registerTool(
  'fill_input',
  {
    title: 'Fill Input',
    description:
      'Write text into a visible form control from the current browser page.',
    inputSchema: {
      formId: z.string().describe(
        'Short-lived BrowserBridge form ID from the latest page context.'
      ),
      controlId: z.string().describe(
        'Short-lived BrowserBridge form control ID from the latest page context.'
      ),
      text: z.string().describe(
        'Text to write into the targeted form control.'
      )
    }
  },
  async (input) => {
    const result = await fillInput(pageContextConfig, input)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result)
        }
      ]
    }
  }
)

server.registerTool(
  'fill_editable',
  {
    title: 'Fill Editable',
    description:
      'Write text into a visible contenteditable target from the current browser page.',
    inputSchema: {
      id: z.string().describe(
        'Short-lived BrowserBridge editable target ID from the latest page context.'
      ),
      text: z.string().describe(
        'Text to write into the targeted contenteditable surface.'
      )
    }
  },
  async (input) => {
    const result = await fillEditable(pageContextConfig, input)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result)
        }
      ]
    }
  }
)

server.registerTool(
  'set_checked',
  {
    title: 'Set Checked',
    description:
      'Set the checked state for a checkbox or select a radio option from the current browser page.',
    inputSchema: {
      formId: z.string().describe(
        'Short-lived BrowserBridge form ID from the latest page context.'
      ),
      controlId: z.string().describe(
        'Short-lived BrowserBridge form control ID from the latest page context.'
      ),
      checked: z.boolean().describe('Desired checked state.')
    }
  },
  async (input) => {
    const result = await setChecked(pageContextConfig, input)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result)
        }
      ]
    }
  }
)

server.registerTool(
  'select_options',
  {
    title: 'Select Options',
    description:
      'Select option values in a visible select control from the current browser page.',
    inputSchema: {
      formId: z.string().describe(
        'Short-lived BrowserBridge form ID from the latest page context.'
      ),
      controlId: z.string().describe(
        'Short-lived BrowserBridge form control ID from the latest page context.'
      ),
      values: z.array(z.string()).describe(
        'Option values to select in the targeted select control.'
      )
    }
  },
  async (input) => {
    const result = await selectOptions(pageContextConfig, input)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result)
        }
      ]
    }
  }
)

server.registerTool(
  'submit_form',
  {
    title: 'Submit Form',
    description:
      'Submit a visible form from the current browser page.',
    inputSchema: {
      formId: z.string().describe(
        'Short-lived BrowserBridge form ID from the latest page context.'
      )
    }
  },
  async (input) => {
    const result = await submitForm(pageContextConfig, input)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result)
        }
      ]
    }
  }
)

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
