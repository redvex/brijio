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
import { navigateToUrl } from './navigate-to-url-tool.js'
import {
  fillEditable,
  selectOptions,
  setChecked,
  submitForm,
  uploadFile
} from './form-action-tools.js'
import { readCurrentPage } from './page-reading-tool.js'
import { performBatchTool } from './batch-tool.js'
import { downloadStatus } from './download-status-tool.js'
import { downloadFile } from './download-file-tool.js'
import { fetchResource } from './fetch-resource-tool.js'
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
        startContentIndex: z
          .number()
          .optional()
          .describe(
            '1-based index of the first content chunk to fetch. Use the nextContentIndex from a previous truncated response to continue reading. Defaults to 1.'
          ),
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
        pageContextId: z
          .number()
          .optional()
          .describe(
            'Optional: page context version from the last read. If the page has navigated since, the action will fail with page_navigated.'
          ),
        visibleContextId: z
          .string()
          .optional()
          .describe(
            'Optional: visible form-state ID from the last read. If visible form state has changed, the action will fail with stale_context.'
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
        expectedLabel: z
          .string()
          .optional()
          .describe(
            'Optional: validate the form control label contains this substring (case-insensitive) before writing. Stale IDs will return stale_context error.'
          ),
        pageContextId: z
          .number()
          .optional()
          .describe(
            'Optional: page context version from the last read. If the page has navigated since, the action will fail with page_navigated.'
          ),
        visibleContextId: z
          .string()
          .optional()
          .describe(
            'Optional: visible form-state ID from the last read. If visible form state has changed, the action will fail with stale_context.'
          ),
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
        expectedText: z
          .string()
          .optional()
          .describe(
            'Optional: validate the editable element visible text contains this substring (case-insensitive) before writing. Stale IDs will return stale_context error.'
          ),
        pageContextId: z
          .number()
          .optional()
          .describe(
            'Optional: page context version from the last read. If the page has navigated since, the action will fail with page_navigated.'
          ),
        visibleContextId: z
          .string()
          .optional()
          .describe(
            'Optional: visible form-state ID from the last read. If visible form state has changed, the action will fail with stale_context.'
          ),
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
        expectedLabel: z
          .string()
          .optional()
          .describe(
            'Optional: validate the form control label contains this substring (case-insensitive) before acting. Stale IDs will return stale_context error.'
          ),
        pageContextId: z
          .number()
          .optional()
          .describe(
            'Optional: page context version from the last read. If the page has navigated since, the action will fail with page_navigated.'
          ),
        visibleContextId: z
          .string()
          .optional()
          .describe(
            'Optional: visible form-state ID from the last read. If visible form state has changed, the action will fail with stale_context.'
          ),
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
        expectedLabel: z
          .string()
          .optional()
          .describe(
            'Optional: validate the select control label contains this substring (case-insensitive) before acting. Stale IDs will return stale_context error.'
          ),
        pageContextId: z
          .number()
          .optional()
          .describe(
            'Optional: page context version from the last read. If the page has navigated since, the action will fail with page_navigated.'
          ),
        visibleContextId: z
          .string()
          .optional()
          .describe(
            'Optional: visible form-state ID from the last read. If visible form state has changed, the action will fail with stale_context.'
          ),
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
    'upload_file',
    {
      title: 'Upload File',
      description:
        'Write text into a visible file input from the current browser page.',
      inputSchema: {
        formId: z.string().describe('Short-lived Brijio form ID from the latest page context.'),
        controlId: z.string().describe('Short-lived Brijio file input control ID from the latest page context.'),
        dataBase64: z.string().describe('Base64-encoded file content to upload.'),
        fileName: z.string().optional().describe('Optional browser-visible filename. Defaults to "upload".'),
        mimeType: z.string().optional().describe('Optional MIME type. Defaults to application/octet-stream.'),
        expectedLabel: z.string().optional().describe('Optional: validate the form control label contains this substring before uploading.'),
        pageContextId: z.number().optional().describe('Optional page context version from the last read.'),
        visibleContextId: z.string().optional().describe('Optional visible form-state ID from the last read.'),
        browserInstanceId: browserInstanceIdInput
      }
    },
    async (input) => {
      logToolCall('upload_file', input as Record<string, unknown>)
      const result = await uploadFile(pageContextConfig, input)

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
        expectedLabel: z
          .string()
          .optional()
          .describe(
            'Optional: validate the form label/heading contains this substring (case-insensitive) before submitting. Stale IDs will return stale_context error.'
          ),
        pageContextId: z
          .number()
          .optional()
          .describe(
            'Optional: page context version from the last read. If the page has navigated since, the action will fail with page_navigated.'
          ),
        visibleContextId: z
          .string()
          .optional()
          .describe(
            'Optional: visible form-state ID from the last read. If visible form state has changed, the action will fail with stale_context.'
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

  server.registerTool(
    'navigate_to_url',
    {
      title: 'Navigate to URL',
      description:
        'Navigate the browser to an HTTP or HTTPS URL and wait for the page to load.',
      inputSchema: {
        url: z
          .string()
          .describe('The HTTP or HTTPS URL to navigate to.'),
        browserInstanceId: browserInstanceIdInput
      }
    },
    async (input) => {
      logToolCall('navigate_to_url', input as Record<string, unknown>)
      const result = await navigateToUrl(pageContextConfig, input)

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
    'perform_batch',
    {
      title: 'Perform Batch Actions',
      description:
        'Execute multiple browser actions (click, write_text, set_checked, select_options, upload_file, submit_form) in a single request. ' +
        'Actions are executed sequentially. If continueOnError is false (default), execution stops on the first error. ' +
        'If continueOnError is true, execution continues and errors are reported per-action. ' +
        'Optionally reads page context after all actions by setting readAfterActions to true.',
      inputSchema: {
        actions: z
          .array(
            z.object({
              type: z
                .enum(['click', 'write_text', 'set_checked', 'select_options', 'upload_file', 'submit_form'])
                .describe('The action type.'),
              target: z
                .record(z.unknown())
                .describe('The Brijio target ID object (e.g. { kind: "link", id: "bb-1" } or { formId: "bb-2", controlId: "bb-3" }).'),
              text: z
                .string()
                .optional()
                .describe('Text to write (required for write_text actions).'),
              checked: z
                .boolean()
                .optional()
                .describe('Checked state (required for set_checked actions).'),
              values: z
                .array(z.string())
                .optional()
                .describe('Option values (required for select_options actions).'),
              dataBase64: z
                .string()
                .optional()
                .describe('Base64-encoded file content (required for upload_file actions).'),
              fileName: z
                .string()
                .optional()
                .describe('Optional uploaded filename override for upload_file actions.'),
              mimeType: z
                .string()
                .optional()
                .describe('Optional uploaded MIME type override for upload_file actions.')
            })
          )
          .min(1)
          .max(20)
          .describe('Array of actions to execute (1–20).'),
        continueOnError: z
          .boolean()
          .optional()
          .default(false)
          .describe('If true, continue executing actions after an error. Default: false.'),
        readAfterActions: z
          .boolean()
          .optional()
          .default(false)
          .describe('If true, read page context after all actions complete. Default: false.'),
        pageContextId: z
          .number()
          .optional()
          .describe('Page context ID for stale-context detection.'),
        visibleContextId: z
          .string()
          .optional()
          .describe('Visible form-state ID for stale-context detection.'),
        browserInstanceId: browserInstanceIdInput
      }
    },
    async (input) => {
      logToolCall('perform_batch', input as Record<string, unknown>)
      const result = await performBatchTool(pageContextConfig, {
        actions: input.actions,
        continueOnError: input.continueOnError,
        readAfterActions: input.readAfterActions,
        pageContextId: input.pageContextId,
        visibleContextId: input.visibleContextId,
        browserInstanceId: input.browserInstanceId
      })

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
    'download_status',
    {
      title: 'Download Status',
      description:
        'Get the status of browser downloads by optional IDs or all session downloads. ' +
        'Returns a capability field ("full" or "not_supported") and a list of download items. ' +
        'On Safari, returns capability "not_supported" with an empty items list.',
      inputSchema: {
        ids: z
          .array(z.union([z.number(), z.string()]))
          .optional()
          .describe('Optional: filter by specific download IDs.'),
        browserInstanceId: browserInstanceIdInput
      }
    },
    async (input) => {
      logToolCall('download_status', input as Record<string, unknown>)
      const result = await downloadStatus(pageContextConfig, input)

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
    'download_file',
    {
      title: 'Download File',
      description:
        'Initiate a file download in the browser. On Chrome/Firefox, uses the chrome.downloads API and returns a download ID. ' +
        'On Safari, triggers a content-script download (fire-and-forget) and returns status "initiated_fire_and_forget" with a null download ID.',
      inputSchema: {
        url: z
          .string()
          .describe('The URL of the file to download.'),
        filename: z
          .string()
          .optional()
          .describe('Optional: suggested filename for the download.'),
        conflictAction: z
          .enum(['uniquify', 'overwrite'])
          .optional()
          .describe('Optional: how to handle filename conflicts. "uniquify" adds a suffix, "overwrite" replaces.'),
        browserInstanceId: browserInstanceIdInput
      }
    },
    async (input) => {
      logToolCall('download_file', input as Record<string, unknown>)
      const result = await downloadFile(pageContextConfig, input)

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
    'fetch_resource',
    {
      title: 'Fetch Resource',
      description:
        'Fetch a resource URL using the browser\'s session (cookies, auth). ' +
        'The browser performs a fetch with credentials included and streams the response back. ' +
        'On Safari or when CORS blocks the request, returns error "cors_blocked". ' +
        'This is a high-risk tool that exposes session-protected content to the agent.',
      inputSchema: {
        url: z
          .string()
          .describe('The URL to fetch with browser credentials.'),
        maxSizeBytes: z
          .number()
          .optional()
          .describe('Optional: maximum response size in bytes. Defaults to server limit.'),
        fetchTimeout: z
          .number()
          .optional()
          .describe('Optional: timeout in milliseconds for the fetch operation.'),
        browserInstanceId: browserInstanceIdInput
      }
    },
    async (input) => {
      logToolCall('fetch_resource', input as Record<string, unknown>)
      const result = await fetchResource(pageContextConfig, input)

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

  // ── Resources ────────────────────────────────────────────────────────────

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
