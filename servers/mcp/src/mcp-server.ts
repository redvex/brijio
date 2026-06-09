import {
  McpServer,
  ResourceTemplate
} from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  type BrijioPageContextConfig,
  getCurrentPageContent,
  getCurrentPageContext,
  getPageContextConfigFromEnv,
  parsePageContentResourceIndex
} from './page-context.js'
import { listBrowsers } from './browser-list-tool.js'
import { clickElement } from './click-element-tool.js'
import { fillInput } from './fill-input-tool.js'
import {
  fillEditable,
  selectOptions,
  setChecked,
  submitForm
} from './form-action-tools.js'
import { readCurrentPage } from './page-reading-tool.js'
import {
  buildContextMessage,
  loadSkills,
  resolveSkillsDir,
  skillResourceUri
} from './skills.js'
import { createLogger } from '@brijio/shared'

const logger = createLogger('mcp')

function logToolCall (name: string, input: Record<string, unknown>): void {
  logger.info('tool_call', { tool: name, ...input })
}

const currentPageResourceUri = 'browser://page/current'
const currentPageContentResourceTemplateUri =
  'browser://page/current/content/{index}'

export async function createBrijioMcpServer (
  pageContextConfig: BrijioPageContextConfig = getPageContextConfigFromEnv()
): Promise<McpServer> {
  const server = new McpServer({
    name: 'brijio-mcp',
    version: '0.0.0'
  })

  const browserInstanceIdInput = z
    .string()
    .optional()
    .describe('Optional Brijio browser instance ID to target.')

  server.server.registerCapabilities({
    tools: {
      listChanged: true
    }
  })

  server.registerTool(
    'list_browsers',
    {
      title: 'List Browsers',
      description:
        'List Brijio browser instances currently online for the configured pairing token.',
      inputSchema: {}
    },
    async () => {
      logger.info('tool_call', { tool: 'list_browsers' })
      const result = await listBrowsers(pageContextConfig)

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
    'read_current_page',
    {
      title: 'Read Current Page',
      description:
        'Read the current browser page context and optional readable content chunks.',
      inputSchema: {
        includeContent: z
          .boolean()
          .optional()
          .describe(
            'Whether to include readable page content chunks. Defaults to true.'
          ),
        maxContentChunks: z
          .number()
          .optional()
          .describe('Maximum readable content chunks to fetch. Defaults to 1, max 10.'),
        browserInstanceId: browserInstanceIdInput
      }
    },
    async (input) => {
      logToolCall('read_current_page', input as Record<string, unknown>)
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
        kind: z
          .string()
          .describe(
            'Target collection from the latest page context: link or action.'
          ),
        id: z
          .string()
          .describe(
            'Short-lived Brijio target ID from the latest page context.'
          ),
        expectedText: z
          .string()
          .optional()
          .describe(
            'Optional: validate element text contains this substring (case-insensitive) before clicking. Stale IDs will return stale_context error.'
          ),
        expectedHref: z
          .string()
          .optional()
          .describe(
            'Optional: for links, validate href pathname matches before clicking.'
          ),
        expectedRole: z
          .string()
          .optional()
          .describe(
            'Optional: for actions, validate element role matches before clicking.'
          ),
        browserInstanceId: browserInstanceIdInput
      }
    },
    async (input) => {
      logToolCall('click_element', input as Record<string, unknown>)
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
        formId: z
          .string()
          .describe(
            'Short-lived Brijio form ID from the latest page context.'
          ),
        controlId: z
          .string()
          .describe(
            'Short-lived Brijio form control ID from the latest page context.'
          ),
        text: z
          .string()
          .describe('Text to write into the targeted form control.'),
        browserInstanceId: browserInstanceIdInput
      }
    },
    async (input) => {
      logToolCall('fill_input', input as Record<string, unknown>)
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
        id: z
          .string()
          .describe(
            'Short-lived Brijio editable target ID from the latest page context.'
          ),
        text: z
          .string()
          .describe('Text to write into the targeted contenteditable surface.'),
        browserInstanceId: browserInstanceIdInput
      }
    },
    async (input) => {
      logToolCall('fill_editable', input as Record<string, unknown>)
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
        formId: z
          .string()
          .describe(
            'Short-lived Brijio form ID from the latest page context.'
          ),
        controlId: z
          .string()
          .describe(
            'Short-lived Brijio form control ID from the latest page context.'
          ),
        checked: z.boolean().describe('Desired checked state.'),
        browserInstanceId: browserInstanceIdInput
      }
    },
    async (input) => {
      logToolCall('set_checked', input as Record<string, unknown>)
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
        formId: z
          .string()
          .describe(
            'Short-lived Brijio form ID from the latest page context.'
          ),
        controlId: z
          .string()
          .describe(
            'Short-lived Brijio form control ID from the latest page context.'
          ),
        values: z
          .array(z.string())
          .describe('Option values to select in the targeted select control.'),
        browserInstanceId: browserInstanceIdInput
      }
    },
    async (input) => {
      logToolCall('select_options', input as Record<string, unknown>)
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
      description: 'Submit a visible form from the current browser page.',
      inputSchema: {
        formId: z
          .string()
          .describe(
            'Short-lived Brijio form ID from the latest page context.'
          ),
        browserInstanceId: browserInstanceIdInput
      }
    },
    async (input) => {
      logToolCall('submit_form', input as Record<string, unknown>)
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
        'Read the current browser page context through Brijio.',
      mimeType: 'application/json'
    },
    async () => {
      logger.info('resource_read', { resource: 'current-page-context' })
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
        'Read a chunk of normalized current browser page content through Brijio.',
      mimeType: 'application/json'
    },
    async (uri) => {
      logger.info('resource_read', {
        resource: 'current-page-content',
        uri: uri.href
      })
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

  // ── Skill Resources ─────────────────────────────────────────────────────
  //
  // Each skill markdown file in the `skills/` directory is exposed as an MCP
  // resource so that any MCP client (not just Hermes) can discover and read
  // the full workflow instructions. This follows the pattern established by
  // the Superpowers MCP server.

  const skillsDir = resolveSkillsDir()
  const skills = await loadSkills(skillsDir)

  for (const skill of skills) {
    const uri = skillResourceUri(skill.name)

    server.registerResource(
      skill.name,
      uri,
      {
        title: skill.title,
        description: skill.description,
        mimeType: 'text/markdown'
      },
      async () => ({
        contents: [
          {
            uri,
            mimeType: 'text/markdown',
            text: skill.content
          }
        ]
      })
    )
  }

  // ── Session-Start Prompt ───────────────────────────────────────────────
  //
  // The `brijio-context` prompt injects a summary of connected
  // browsers, available skills, and key pitfalls into the agent's context.
  // MCP clients can call this prompt at the start of a session to get
  // oriented.

  server.registerPrompt(
    'brijio-context',
    {
      title: 'Brijio Context',
      description:
        'Inject Brijio context: connected browsers, available skills, pitfalls.'
    },
    async () => {
      logger.info('prompt_called', { prompt: 'brijio-context' })
      const skillSummaries = skills.map((s) => ({
        name: s.name,
        title: s.title,
        description: s.description
      }))

      const message = buildContextMessage(skillSummaries)

      return {
        messages: [
          {
            role: 'user',
            content: { type: 'text', text: message }
          }
        ]
      }
    }
  )

  return server
}
