import assert from 'node:assert/strict'
import { type AddressInfo } from 'node:net'
import { afterEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { WebSocketServer, type RawData, type WebSocket } from 'ws'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const currentPageResourceUri = 'browser://page/current'
const currentPageContentTemplateUri = 'browser://page/current/content/{index}'
const servers: WebSocketServer[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(closeServer))
})

void describe('BrowserBridge MCP stdio server', () => {
  void it('uses the official MCP lifecycle for initialize, resource discovery, and ping', async () => {
    const client = new Client({
      name: 'browserbridge-mcp-test',
      version: '0.0.0'
    })
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['--import', 'tsx', 'src/index.ts'],
      cwd: packageRoot,
      env: {
        BROWSERBRIDGE_WEBSOCKET_URL: 'ws://127.0.0.1:1',
        BROWSERBRIDGE_REQUEST_TIMEOUT_MS: '100',
        BROWSERBRIDGE_PAIRING_TOKEN: 'local-token'
      },
      stderr: 'pipe'
    })

    try {
      await client.connect(transport, { timeout: 1000 })

      assert.deepEqual(client.getServerVersion(), {
        name: 'browserbridge-mcp',
        version: '0.0.0'
      })

      const resources = await client.listResources(undefined, { timeout: 1000 })
      assert.deepEqual(
        resources.resources.map((resource) => ({
          uri: resource.uri,
          name: resource.name,
          mimeType: resource.mimeType
        })),
        [
          {
            uri: currentPageResourceUri,
            name: 'current-page-context',
            mimeType: 'application/json'
          }
        ]
      )

      const resourceTemplates = await client.listResourceTemplates(undefined, {
        timeout: 1000
      })
      assert.deepEqual(
        resourceTemplates.resourceTemplates.map((template) => ({
          uriTemplate: template.uriTemplate,
          name: template.name,
          mimeType: template.mimeType
        })),
        [
          {
            uriTemplate: currentPageContentTemplateUri,
            name: 'current-page-content',
            mimeType: 'application/json'
          }
        ]
      )

      const tools = await client.listTools(undefined, { timeout: 1000 })
      assert.deepEqual(
        tools.tools.map((tool) => ({
          name: tool.name,
          title: tool.title,
          description: tool.description
        })),
        [
          {
            name: 'list_browsers',
            title: 'List Browsers',
            description:
              'List BrowserBridge browser instances currently online for the configured pairing token.'
          },
          {
            name: 'read_current_page',
            title: 'Read Current Page',
            description:
              'Read the current browser page context and optional readable content chunks.'
          },
          {
            name: 'click_element',
            title: 'Click Element',
            description:
              'Click a visible link or button-like action from the current browser page.'
          },
          {
            name: 'fill_input',
            title: 'Fill Input',
            description:
              'Write text into a visible form control from the current browser page.'
          },
          {
            name: 'fill_editable',
            title: 'Fill Editable',
            description:
              'Write text into a visible contenteditable target from the current browser page.'
          },
          {
            name: 'set_checked',
            title: 'Set Checked',
            description:
              'Set the checked state for a checkbox or select a radio option from the current browser page.'
          },
          {
            name: 'select_options',
            title: 'Select Options',
            description:
              'Select option values in a visible select control from the current browser page.'
          },
          {
            name: 'submit_form',
            title: 'Submit Form',
            description:
              'Submit a visible form from the current browser page.'
          }
        ]
      )
      assert.deepEqual(tools.tools[0].inputSchema, {
        type: 'object',
        properties: {},
        $schema: 'http://json-schema.org/draft-07/schema#'
      })
      assert.deepEqual(tools.tools[1].inputSchema, {
        type: 'object',
        properties: {
          browserInstanceId: {
            type: 'string',
            description:
              'Optional BrowserBridge browser instance ID to target.'
          },
          includeContent: {
            type: 'boolean',
            description:
              'Whether to include readable page content chunks. Defaults to true.'
          },
          maxContentChunks: {
            type: 'number',
            description:
              'Maximum readable content chunks to fetch. Defaults to 1.'
          }
        },
        additionalProperties: false,
        $schema: 'http://json-schema.org/draft-07/schema#'
      })
      assert.deepEqual(tools.tools[2].inputSchema, {
        type: 'object',
        properties: {
          browserInstanceId: {
            type: 'string',
            description:
              'Optional BrowserBridge browser instance ID to target.'
          },
          id: {
            type: 'string',
            description:
              'Short-lived BrowserBridge target ID from the latest page context.'
          },
          kind: {
            type: 'string',
            description:
              'Target collection from the latest page context: link or action.'
          }
        },
        required: ['kind', 'id'],
        additionalProperties: false,
        $schema: 'http://json-schema.org/draft-07/schema#'
      })
      assert.deepEqual(tools.tools[3].inputSchema, {
        type: 'object',
        properties: {
          browserInstanceId: {
            type: 'string',
            description:
              'Optional BrowserBridge browser instance ID to target.'
          },
          controlId: {
            type: 'string',
            description:
              'Short-lived BrowserBridge form control ID from the latest page context.'
          },
          formId: {
            type: 'string',
            description:
              'Short-lived BrowserBridge form ID from the latest page context.'
          },
          text: {
            type: 'string',
            description: 'Text to write into the targeted form control.'
          }
        },
        required: ['formId', 'controlId', 'text'],
        additionalProperties: false,
        $schema: 'http://json-schema.org/draft-07/schema#'
      })
      assert.deepEqual(tools.tools[4].inputSchema, {
        type: 'object',
        properties: {
          browserInstanceId: {
            type: 'string',
            description:
              'Optional BrowserBridge browser instance ID to target.'
          },
          id: {
            type: 'string',
            description:
              'Short-lived BrowserBridge editable target ID from the latest page context.'
          },
          text: {
            type: 'string',
            description:
              'Text to write into the targeted contenteditable surface.'
          }
        },
        required: ['id', 'text'],
        additionalProperties: false,
        $schema: 'http://json-schema.org/draft-07/schema#'
      })
      assert.deepEqual(tools.tools[5].inputSchema, {
        type: 'object',
        properties: {
          browserInstanceId: {
            type: 'string',
            description:
              'Optional BrowserBridge browser instance ID to target.'
          },
          checked: {
            type: 'boolean',
            description: 'Desired checked state.'
          },
          controlId: {
            type: 'string',
            description:
              'Short-lived BrowserBridge form control ID from the latest page context.'
          },
          formId: {
            type: 'string',
            description:
              'Short-lived BrowserBridge form ID from the latest page context.'
          }
        },
        required: ['formId', 'controlId', 'checked'],
        additionalProperties: false,
        $schema: 'http://json-schema.org/draft-07/schema#'
      })
      assert.deepEqual(tools.tools[6].inputSchema, {
        type: 'object',
        properties: {
          browserInstanceId: {
            type: 'string',
            description:
              'Optional BrowserBridge browser instance ID to target.'
          },
          controlId: {
            type: 'string',
            description:
              'Short-lived BrowserBridge form control ID from the latest page context.'
          },
          formId: {
            type: 'string',
            description:
              'Short-lived BrowserBridge form ID from the latest page context.'
          },
          values: {
            type: 'array',
            items: {
              type: 'string'
            },
            description:
              'Option values to select in the targeted select control.'
          }
        },
        required: ['formId', 'controlId', 'values'],
        additionalProperties: false,
        $schema: 'http://json-schema.org/draft-07/schema#'
      })
      assert.deepEqual(tools.tools[7].inputSchema, {
        type: 'object',
        properties: {
          browserInstanceId: {
            type: 'string',
            description:
              'Optional BrowserBridge browser instance ID to target.'
          },
          formId: {
            type: 'string',
            description:
              'Short-lived BrowserBridge form ID from the latest page context.'
          }
        },
        required: ['formId'],
        additionalProperties: false,
        $schema: 'http://json-schema.org/draft-07/schema#'
      })

      const currentPage = await client.readResource(
        {
          uri: currentPageResourceUri
        },
        { timeout: 1000 }
      )

      assert.equal(currentPage.contents.length, 1)
      const content = currentPage.contents[0]
      assert.ok('text' in content)
      assert.deepEqual(JSON.parse(content.text), {
        ok: false,
        error: {
          code: 'connection_failed',
          message:
            'Unable to connect to BrowserBridge WebSocket at ws://127.0.0.1:1.'
        }
      })

      await assert.doesNotReject(async () => {
        await client.ping({ timeout: 1000 })
      })
    } finally {
      await client.close()
    }
  })

  void it('reads rich page context and paginated page content resources', async () => {
    const server = await startServer((socket) => {
      onAuthenticatedMessage(socket, (data) => {
        const request = JSON.parse(rawDataToString(data)) as {
          id: string
          payload: {
            type: string
            index?: number
            action?: {
              type: string
              target: unknown
              text?: string
              checked?: boolean
              values?: string[]
            }
          }
        }

        if (request.payload.type === 'get_page_context') {
          socket.send(
            JSON.stringify({
              type: 'message',
              id: request.id,
              payload: {
                type: 'page_context_response',
                ok: true,
                data: createRichPageContext()
              }
            })
          )
          return
        }

        if (request.payload.type === 'list_browsers') {
          socket.send(
            JSON.stringify({
              type: 'message',
              id: request.id,
              payload: {
                type: 'browser_list',
                ok: true,
                data: {
                  browsers: [
                    {
                      browserInstanceId: 'chrome-default-test',
                      browserName: 'Chrome',
                      profileName: 'Default',
                      label: 'Chrome Default on MacBook Pro',
                      connectedAt: '2026-05-25T10:00:00.000Z',
                      lastSeenAt: '2026-05-25T10:00:01.000Z',
                      capabilities: ['page_context', 'page_actions']
                    }
                  ]
                }
              }
            })
          )
          return
        }

        if (request.payload.type === 'perform_action') {
          if (request.payload.action?.type === 'write_text') {
            socket.send(
              JSON.stringify({
                type: 'message',
                id: request.id,
                payload: {
                  type: 'action_result',
                  ok: true,
                  data: {
                    action: 'write_text',
                    target: request.payload.action.target,
                    textLength: request.payload.action.text?.length
                  }
                }
              })
            )
            return
          }

          if (request.payload.action?.type === 'set_checked') {
            socket.send(
              JSON.stringify({
                type: 'message',
                id: request.id,
                payload: {
                  type: 'action_result',
                  ok: true,
                  data: {
                    action: 'set_checked',
                    target: request.payload.action.target,
                    checked: request.payload.action.checked,
                    changed: true
                  }
                }
              })
            )
            return
          }

          if (request.payload.action?.type === 'select_options') {
            socket.send(
              JSON.stringify({
                type: 'message',
                id: request.id,
                payload: {
                  type: 'action_result',
                  ok: true,
                  data: {
                    action: 'select_options',
                    target: request.payload.action.target,
                    values: request.payload.action.values
                  }
                }
              })
            )
            return
          }

          if (request.payload.action?.type === 'submit_form') {
            socket.send(
              JSON.stringify({
                type: 'message',
                id: request.id,
                payload: {
                  type: 'action_result',
                  ok: true,
                  data: {
                    action: 'submit_form',
                    target: request.payload.action.target
                  }
                }
              })
            )
            return
          }

          socket.send(
            JSON.stringify({
              type: 'message',
              id: request.id,
              payload: {
                type: 'action_result',
                ok: true,
                data: {
                  action: 'click',
                  target: request.payload.action?.target
                }
              }
            })
          )
          return
        }

        socket.send(
          JSON.stringify({
            type: 'message',
            id: request.id,
            payload: {
              type: 'page_content_response',
              ok: true,
              data: {
                url: 'https://example.com/',
                title: 'Example',
                timestamp: '2026-05-25T10:00:00.000Z',
                index: request.payload.index,
                content: '# Example\n\nReadable content',
                truncated: false,
                maxPayloadBytes: 131072
              }
            }
          })
        )
      })
    })
    const client = new Client({
      name: 'browserbridge-mcp-test',
      version: '0.0.0'
    })
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['--import', 'tsx', 'src/index.ts'],
      cwd: packageRoot,
      env: {
        BROWSERBRIDGE_WEBSOCKET_URL: server.url,
        BROWSERBRIDGE_REQUEST_TIMEOUT_MS: '100',
        BROWSERBRIDGE_PAIRING_TOKEN: 'local-token'
      },
      stderr: 'pipe'
    })

    try {
      await client.connect(transport, { timeout: 1000 })

      const currentPage = await client.readResource(
        {
          uri: currentPageResourceUri
        },
        { timeout: 1000 }
      )
      assert.equal(currentPage.contents.length, 1)
      const currentPageContent = currentPage.contents[0]
      assert.ok('text' in currentPageContent)
      assert.deepEqual(JSON.parse(currentPageContent.text), {
        ok: true,
        data: createRichPageContext()
      })

      const pageContent = await client.readResource(
        {
          uri: 'browser://page/current/content/1'
        },
        { timeout: 1000 }
      )
      assert.equal(pageContent.contents.length, 1)
      const content = pageContent.contents[0]
      assert.ok('text' in content)
      assert.deepEqual(JSON.parse(content.text), {
        ok: true,
        data: {
          url: 'https://example.com/',
          title: 'Example',
          timestamp: '2026-05-25T10:00:00.000Z',
          index: 1,
          content: '# Example\n\nReadable content',
          truncated: false,
          maxPayloadBytes: 131072
        }
      })

      const toolResult = await client.callTool(
        {
          name: 'read_current_page',
          arguments: {}
        },
        undefined,
        { timeout: 1000 }
      )
      assert.deepEqual(JSON.parse(getOnlyToolText(toolResult)), {
        ok: true,
        data: {
          context: createRichPageContext(),
          content: [
            {
              url: 'https://example.com/',
              title: 'Example',
              timestamp: '2026-05-25T10:00:00.000Z',
              index: 1,
              content: '# Example\n\nReadable content',
              truncated: false,
              maxPayloadBytes: 131072
            }
          ],
          contentTruncated: false,
          nextContentIndex: null
        }
      })

      const browserListResult = await client.callTool(
        {
          name: 'list_browsers',
          arguments: {}
        },
        undefined,
        { timeout: 1000 }
      )
      assert.deepEqual(JSON.parse(getOnlyToolText(browserListResult)), {
        ok: true,
        data: {
          browsers: [
            {
              browserInstanceId: 'chrome-default-test',
              browserName: 'Chrome',
              profileName: 'Default',
              label: 'Chrome Default on MacBook Pro',
              connectedAt: '2026-05-25T10:00:00.000Z',
              lastSeenAt: '2026-05-25T10:00:01.000Z',
              capabilities: ['page_context', 'page_actions']
            }
          ]
        }
      })

      const clickResult = await client.callTool(
        {
          name: 'click_element',
          arguments: {
            kind: 'link',
            id: 'bb-1'
          }
        },
        undefined,
        { timeout: 1000 }
      )
      assert.deepEqual(JSON.parse(getOnlyToolText(clickResult)), {
        ok: true,
        data: {
          action: 'click',
          target: {
            kind: 'link',
            id: 'bb-1'
          }
        }
      })

      const fillResult = await client.callTool(
        {
          name: 'fill_input',
          arguments: {
            formId: 'form-1',
            controlId: 'control-1',
            text: 'hello'
          }
        },
        undefined,
        { timeout: 1000 }
      )
      assert.deepEqual(JSON.parse(getOnlyToolText(fillResult)), {
        ok: true,
        data: {
          action: 'write_text',
          target: {
            formId: 'form-1',
            controlId: 'control-1'
          },
          textLength: 5
        }
      })

      const fillEditableResult = await client.callTool(
        {
          name: 'fill_editable',
          arguments: {
            id: 'bb-1',
            text: 'hello'
          }
        },
        undefined,
        { timeout: 1000 }
      )
      assert.deepEqual(JSON.parse(getOnlyToolText(fillEditableResult)), {
        ok: true,
        data: {
          action: 'write_text',
          target: {
            kind: 'editable',
            id: 'bb-1'
          },
          textLength: 5
        }
      })

      const setCheckedResult = await client.callTool(
        {
          name: 'set_checked',
          arguments: {
            formId: 'form-1',
            controlId: 'control-1',
            checked: true
          }
        },
        undefined,
        { timeout: 1000 }
      )
      assert.deepEqual(JSON.parse(getOnlyToolText(setCheckedResult)), {
        ok: true,
        data: {
          action: 'set_checked',
          target: {
            formId: 'form-1',
            controlId: 'control-1'
          },
          checked: true,
          changed: true
        }
      })

      const selectOptionsResult = await client.callTool(
        {
          name: 'select_options',
          arguments: {
            formId: 'form-1',
            controlId: 'control-1',
            values: ['alpha', 'gamma']
          }
        },
        undefined,
        { timeout: 1000 }
      )
      assert.deepEqual(JSON.parse(getOnlyToolText(selectOptionsResult)), {
        ok: true,
        data: {
          action: 'select_options',
          target: {
            formId: 'form-1',
            controlId: 'control-1'
          },
          values: ['alpha', 'gamma']
        }
      })

      const submitFormResult = await client.callTool(
        {
          name: 'submit_form',
          arguments: {
            formId: 'form-1'
          }
        },
        undefined,
        { timeout: 1000 }
      )
      assert.deepEqual(JSON.parse(getOnlyToolText(submitFormResult)), {
        ok: true,
        data: {
          action: 'submit_form',
          target: {
            formId: 'form-1'
          }
        }
      })
    } finally {
      await client.close()
    }
  })

  void it('returns a structured error for invalid page content resource indexes', async () => {
    const client = new Client({
      name: 'browserbridge-mcp-test',
      version: '0.0.0'
    })
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['--import', 'tsx', 'src/index.ts'],
      cwd: packageRoot,
      env: {
        BROWSERBRIDGE_WEBSOCKET_URL: 'ws://127.0.0.1:1',
        BROWSERBRIDGE_REQUEST_TIMEOUT_MS: '100',
        BROWSERBRIDGE_PAIRING_TOKEN: 'local-token'
      },
      stderr: 'pipe'
    })

    try {
      await client.connect(transport, { timeout: 1000 })

      const pageContent = await client.readResource(
        {
          uri: 'browser://page/current/content/0'
        },
        { timeout: 1000 }
      )
      assert.equal(pageContent.contents.length, 1)
      const content = pageContent.contents[0]
      assert.ok('text' in content)
      assert.deepEqual(JSON.parse(content.text), {
        ok: false,
        error: {
          code: 'invalid_resource_uri',
          message:
            'Page content resource URI must end with a positive 1-based index.'
        }
      })
    } finally {
      await client.close()
    }
  })

  void it('returns a structured tool error for invalid page reading input', async () => {
    const client = new Client({
      name: 'browserbridge-mcp-test',
      version: '0.0.0'
    })
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['--import', 'tsx', 'src/index.ts'],
      cwd: packageRoot,
      env: {
        BROWSERBRIDGE_WEBSOCKET_URL: 'ws://127.0.0.1:1',
        BROWSERBRIDGE_REQUEST_TIMEOUT_MS: '100',
        BROWSERBRIDGE_PAIRING_TOKEN: 'local-token'
      },
      stderr: 'pipe'
    })

    try {
      await client.connect(transport, { timeout: 1000 })

      const toolResult = await client.callTool(
        {
          name: 'read_current_page',
          arguments: {
            maxContentChunks: 6
          }
        },
        undefined,
        { timeout: 1000 }
      )
      assert.deepEqual(JSON.parse(getOnlyToolText(toolResult)), {
        ok: false,
        error: {
          code: 'invalid_tool_input',
          message: 'maxContentChunks must be an integer from 0 through 5.'
        }
      })
    } finally {
      await client.close()
    }
  })

  void it('returns a structured tool error for invalid click input', async () => {
    const client = new Client({
      name: 'browserbridge-mcp-test',
      version: '0.0.0'
    })
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['--import', 'tsx', 'src/index.ts'],
      cwd: packageRoot,
      env: {
        BROWSERBRIDGE_WEBSOCKET_URL: 'ws://127.0.0.1:1',
        BROWSERBRIDGE_REQUEST_TIMEOUT_MS: '100',
        BROWSERBRIDGE_PAIRING_TOKEN: 'local-token'
      },
      stderr: 'pipe'
    })

    try {
      await client.connect(transport, { timeout: 1000 })

      const toolResult = await client.callTool(
        {
          name: 'click_element',
          arguments: {
            kind: 'image',
            id: 'bb-1'
          }
        },
        undefined,
        { timeout: 1000 }
      )
      assert.deepEqual(JSON.parse(getOnlyToolText(toolResult)), {
        ok: false,
        error: {
          code: 'invalid_tool_input',
          message: 'kind must be either "link" or "action".'
        }
      })
    } finally {
      await client.close()
    }
  })

  void it('returns a structured tool error for invalid fill input', async () => {
    const client = new Client({
      name: 'browserbridge-mcp-test',
      version: '0.0.0'
    })
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['--import', 'tsx', 'src/index.ts'],
      cwd: packageRoot,
      env: {
        BROWSERBRIDGE_WEBSOCKET_URL: 'ws://127.0.0.1:1',
        BROWSERBRIDGE_REQUEST_TIMEOUT_MS: '100',
        BROWSERBRIDGE_PAIRING_TOKEN: 'local-token'
      },
      stderr: 'pipe'
    })

    try {
      await client.connect(transport, { timeout: 1000 })

      const toolResult = await client.callTool(
        {
          name: 'fill_input',
          arguments: {
            formId: '',
            controlId: 'control-1',
            text: 'hello'
          }
        },
        undefined,
        { timeout: 1000 }
      )
      assert.deepEqual(JSON.parse(getOnlyToolText(toolResult)), {
        ok: false,
        error: {
          code: 'invalid_tool_input',
          message: 'formId must be a non-empty string.'
        }
      })
    } finally {
      await client.close()
    }
  })
})

async function startServer (
  onConnection: (socket: WebSocket) => void
): Promise<{ server: WebSocketServer, url: string }> {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  server.on('connection', onConnection)

  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })

  servers.push(server)

  const address = getAddress(server)

  return {
    server,
    url: `ws://127.0.0.1:${address.port}`
  }
}

function onAuthenticatedMessage (
  socket: WebSocket,
  onMessage: (data: RawData) => void
): void {
  socket.on('message', (data) => {
    const request = JSON.parse(rawDataToString(data)) as {
      id?: string
      payload?: {
        type?: string
      }
    }

    if (request.payload?.type === 'auth') {
      socket.send(
        JSON.stringify({
          type: 'message',
          id: request.id,
          payload: {
            type: 'auth_success'
          }
        })
      )
      return
    }

    onMessage(data)
  })
}

function getAddress (server: WebSocketServer): AddressInfo {
  const address = server.address()

  if (address === null || typeof address === 'string') {
    throw new Error('WebSocket test server is not listening on a TCP port.')
  }

  return address
}

async function closeServer (server: WebSocketServer): Promise<void> {
  for (const client of server.clients) {
    client.close()
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error != null && !String(error.message).includes('not running')) {
        reject(error)
        return
      }

      resolve()
    })
  })
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

function getOnlyToolText (result: unknown): string {
  assert.ok(isRecord(result))
  const contents = result.content
  assert.ok(Array.isArray(contents))
  assert.equal(contents.length, 1)

  const content = contents[0]
  assert.ok(isRecord(content))
  assert.equal(content.type, 'text')
  const text = content.text
  if (typeof text !== 'string') {
    throw new Error('Expected MCP tool content text to be a string.')
  }

  return text
}

function isRecord (value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null
}

function createRichPageContext (): unknown {
  return {
    url: 'https://example.com/',
    title: 'Example',
    timestamp: '2026-05-25T10:00:00.000Z',
    selectedText: 'selected words',
    preview: {
      content: 'Example preview',
      truncated: false,
      maxBytes: 4096
    },
    structure: {
      headings: [{ id: 'bb-1', level: 1, text: 'Example' }],
      landmarks: [],
      links: [],
      images: [],
      forms: [],
      actions: []
    },
    content: {
      available: true,
      requestType: 'get_page_content',
      firstIndex: 1,
      defaultMaxPayloadBytes: 131072
    }
  }
}
