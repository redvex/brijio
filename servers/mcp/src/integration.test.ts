import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import WebSocket, { type RawData } from 'ws'
import {
  createWebSocketServer,
  type BrijioWebSocketServer
} from '@brijio/websocket/server'
import {
  startBrijioMcpHttpServer,
  type BrijioMcpHttpRuntime
} from './http-server.js'

const testPairingToken = 'integration-test-token'
const testMcpAuthToken = 'test-mcp-token'

const servers: BrijioWebSocketServer[] = []
const mcpRuntimes: BrijioMcpHttpRuntime[] = []

afterEach(async () => {
  await Promise.all(mcpRuntimes.splice(0).map(async (runtime) => {
    await runtime.close()
  }))
  await Promise.all(servers.splice(0).map(async (server) => {
    await server.close()
  }))
})

void describe('Brijio integration: WS + MCP full-stack', () => {
  void it('rejects unauthenticated MCP requests', async () => {
    const { runtime } = await startIntegration({ skipExtension: true })
    try {
      const response = await fetch(runtime.url, {
        method: 'POST',
        headers: {
          accept: 'application/json, text/event-stream',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {}
        })
      })

      assert.equal(response.status, 401)
    } finally {
      await runtime.close()
    }
  })

  void it('lists browsers through full stack', async () => {
    const { runtime, extension } = await startIntegration()

    const client = createHttpClient()
    const transport = createHttpTransport(runtime.url)

    try {
      await client.connect(transport, { timeout: 2000 })

      const toolResult = await client.callTool(
        { name: 'list_browsers', arguments: {} },
        undefined,
        { timeout: 2000 }
      )

      const parsed = JSON.parse(getOnlyToolText(toolResult))
      assert.equal(parsed.ok, true)
      assert.equal(parsed.data.browsers.length, 1)
      assert.equal(parsed.data.browsers[0].browserInstanceId, 'chrome-int')
      assert.equal(parsed.data.browsers[0].label, 'Chrome Integration')
    } finally {
      await client.close()
      extension.close()
      await waitForClose(extension)
    }
  })

  void it('reads current page context through full stack', async () => {
    const { runtime, extension } = await startIntegration()

    const client = createHttpClient()
    const transport = createHttpTransport(runtime.url)

    try {
      await client.connect(transport, { timeout: 2000 })

      const toolResult = await client.callTool(
        { name: 'read_current_page', arguments: {} },
        undefined,
        { timeout: 2000 }
      )

      const parsed = JSON.parse(getOnlyToolText(toolResult))
      assert.equal(parsed.ok, true)
      assert.equal(parsed.data.context.url, 'https://example.com/')
      assert.equal(parsed.data.context.title, 'Integration Test')
      assert.ok(parsed.data.context.structure != null)
    } finally {
      await client.close()
      extension.close()
      await waitForClose(extension)
    }
  })

  void it('clicks an element through full stack', async () => {
    const { runtime, extension } = await startIntegration()

    const client = createHttpClient()
    const transport = createHttpTransport(runtime.url)

    try {
      await client.connect(transport, { timeout: 2000 })

      const toolResult = await client.callTool(
        {
          name: 'click_element',
          arguments: { kind: 'link', id: 'bb-1' }
        },
        undefined,
        { timeout: 2000 }
      )

      const parsed = JSON.parse(getOnlyToolText(toolResult))
      assert.equal(parsed.ok, true)
      assert.equal(parsed.data.action, 'click')
      assert.deepEqual(parsed.data.target, { kind: 'link', id: 'bb-1' })
    } finally {
      await client.close()
      extension.close()
      await waitForClose(extension)
    }
  })

  void it('fills an input through full stack', async () => {
    const { runtime, extension } = await startIntegration()

    const client = createHttpClient()
    const transport = createHttpTransport(runtime.url)

    try {
      await client.connect(transport, { timeout: 2000 })

      const toolResult = await client.callTool(
        {
          name: 'fill_input',
          arguments: {
            formId: 'form-1',
            controlId: 'control-1',
            text: 'hello integration'
          }
        },
        undefined,
        { timeout: 2000 }
      )

      const parsed = JSON.parse(getOnlyToolText(toolResult))
      assert.equal(parsed.ok, true)
      assert.equal(parsed.data.action, 'write_text')
      assert.equal(parsed.data.textLength, 17)
    } finally {
      await client.close()
      extension.close()
      await waitForClose(extension)
    }
  })

  void it('fills an editable through full stack', async () => {
    const { runtime, extension } = await startIntegration()

    const client = createHttpClient()
    const transport = createHttpTransport(runtime.url)

    try {
      await client.connect(transport, { timeout: 2000 })

      const toolResult = await client.callTool(
        {
          name: 'fill_editable',
          arguments: { id: 'bb-1', text: 'editable content' }
        },
        undefined,
        { timeout: 2000 }
      )

      const parsed = JSON.parse(getOnlyToolText(toolResult))
      assert.equal(parsed.ok, true)
      assert.equal(parsed.data.action, 'write_text')
      assert.equal(parsed.data.textLength, 16)
      assert.deepEqual(parsed.data.target, { kind: 'editable', id: 'bb-1' })
    } finally {
      await client.close()
      extension.close()
      await waitForClose(extension)
    }
  })

  void it('sets checked state through full stack', async () => {
    const { runtime, extension } = await startIntegration()

    const client = createHttpClient()
    const transport = createHttpTransport(runtime.url)

    try {
      await client.connect(transport, { timeout: 2000 })

      const toolResult = await client.callTool(
        {
          name: 'set_checked',
          arguments: {
            formId: 'form-1',
            controlId: 'control-1',
            checked: true
          }
        },
        undefined,
        { timeout: 2000 }
      )

      const parsed = JSON.parse(getOnlyToolText(toolResult))
      assert.equal(parsed.ok, true)
      assert.equal(parsed.data.action, 'set_checked')
      assert.equal(parsed.data.checked, true)
      assert.equal(parsed.data.changed, true)
    } finally {
      await client.close()
      extension.close()
      await waitForClose(extension)
    }
  })

  void it('selects options through full stack', async () => {
    const { runtime, extension } = await startIntegration()

    const client = createHttpClient()
    const transport = createHttpTransport(runtime.url)

    try {
      await client.connect(transport, { timeout: 2000 })

      const toolResult = await client.callTool(
        {
          name: 'select_options',
          arguments: {
            formId: 'form-1',
            controlId: 'control-1',
            values: ['alpha', 'gamma']
          }
        },
        undefined,
        { timeout: 2000 }
      )

      const parsed = JSON.parse(getOnlyToolText(toolResult))
      assert.equal(parsed.ok, true)
      assert.equal(parsed.data.action, 'select_options')
      assert.deepEqual(parsed.data.values, ['alpha', 'gamma'])
    } finally {
      await client.close()
      extension.close()
      await waitForClose(extension)
    }
  })

  void it('submits a form through full stack', async () => {
    const { runtime, extension } = await startIntegration()

    const client = createHttpClient()
    const transport = createHttpTransport(runtime.url)

    try {
      await client.connect(transport, { timeout: 2000 })

      const toolResult = await client.callTool(
        {
          name: 'submit_form',
          arguments: { formId: 'form-1' }
        },
        undefined,
        { timeout: 2000 }
      )

      const parsed = JSON.parse(getOnlyToolText(toolResult))
      assert.equal(parsed.ok, true)
      assert.equal(parsed.data.action, 'submit_form')
      assert.deepEqual(parsed.data.target, { formId: 'form-1' })
    } finally {
      await client.close()
      extension.close()
      await waitForClose(extension)
    }
  })

  void it('performs fill-and-submit form lifecycle through full stack', async () => {
    const { runtime, extension } = await startIntegration()

    const client = createHttpClient()
    const transport = createHttpTransport(runtime.url)

    try {
      await client.connect(transport, { timeout: 2000 })

      const fillResult = await client.callTool(
        {
          name: 'fill_input',
          arguments: {
            formId: 'form-1',
            controlId: 'control-1',
            text: 'lifecycle test'
          }
        },
        undefined,
        { timeout: 2000 }
      )

      const fillParsed = JSON.parse(getOnlyToolText(fillResult))
      assert.equal(fillParsed.ok, true)
      assert.equal(fillParsed.data.action, 'write_text')

      const submitResult = await client.callTool(
        {
          name: 'submit_form',
          arguments: { formId: 'form-1' }
        },
        undefined,
        { timeout: 2000 }
      )

      const submitParsed = JSON.parse(getOnlyToolText(submitResult))
      assert.equal(submitParsed.ok, true)
      assert.equal(submitParsed.data.action, 'submit_form')
    } finally {
      await client.close()
      extension.close()
      await waitForClose(extension)
    }
  })

  void it('returns browser_unavailable when no browser is connected', async () => {
    const { runtime } = await startIntegration({ skipExtension: true })

    const client = createHttpClient()
    const transport = createHttpTransport(runtime.url)

    try {
      await client.connect(transport, { timeout: 2000 })

      const toolResult = await client.callTool(
        { name: 'read_current_page', arguments: {} },
        undefined,
        { timeout: 2000 }
      )

      const parsed = JSON.parse(getOnlyToolText(toolResult))
      assert.equal(parsed.ok, false)
      assert.equal(parsed.error.code, 'browser_unavailable')
    } finally {
      await client.close()
    }
  })
})

// --- Integration test infrastructure ---

interface IntegrationRuntime {
  wsServer: BrijioWebSocketServer
  runtime: BrijioMcpHttpRuntime
  extension: WebSocket
}

interface IntegrationOptions {
  skipExtension?: boolean
}

async function startIntegration (options: IntegrationOptions = {}): Promise<IntegrationRuntime> {
  const wsServer = await createWebSocketServer({
    host: '127.0.0.1',
    port: 0,
    pairingToken: testPairingToken,
    now: () => new Date('2026-05-25T10:00:00.000Z')
  })
  servers.push(wsServer)

  const runtime = await startBrijioMcpHttpServer({
    host: '127.0.0.1',
    port: 0,
    path: '/mcp',
    authToken: testMcpAuthToken,
    allowedOrigins: [],
    pageContextConfig: {
      websocketUrl: wsServer.url,
      timeoutMs: 2000,
      pairingToken: testPairingToken
    }
  })
  mcpRuntimes.push(runtime)

  if (options.skipExtension === true) {
    return { wsServer, runtime, extension: null as unknown as WebSocket }
  }

  const extension = await connectAndAuth(wsServer.url)

  return { wsServer, runtime, extension }
}

async function connectAndAuth (url: string): Promise<WebSocket> {
  const ws = await connect(url)

  // After connecting, the WS server sends auth_success followed immediately by
  // browser_presence_request. Collect both in a single listener to avoid race
  // conditions where the second message is lost between listener swaps.
  const initMessages = waitForJsonMessages(ws, 2)
  ws.send(JSON.stringify({
    type: 'message',
    id: 'ext-auth',
    payload: { type: 'auth', role: 'extension', token: testPairingToken }
  }))
  const messages = await initMessages

  const authOk = messages.some((m) => {
    const payload = m.payload as Record<string, unknown> | undefined
    return payload?.type === 'auth_success'
  })
  const presenceReqOk = messages.some((m) => {
    const payload = m.payload as Record<string, unknown> | undefined
    return payload?.type === 'browser_presence_request'
  })
  assert.ok(authOk, 'Expected auth_success message from WS server')
  assert.ok(presenceReqOk, 'Expected browser_presence_request message from WS server')

  // Announce browser presence with valid capabilities
  ws.send(JSON.stringify({
    type: 'message',
    id: 'ext-presence',
    payload: {
      type: 'browser_presence_announce',
      browserInstanceId: 'chrome-int',
      label: 'Chrome Integration',
      browserName: 'Chrome',
      profileName: 'Default',
      capabilities: ['page_context', 'page_content', 'click', 'fill_input', 'fill_editable', 'set_checked', 'select_options', 'submit_form', 'navigate']
    }
  }))

  // Wire up the extension message handler to respond to MCP-forwarded requests
  ws.on('message', (data: RawData) => {
    handleExtensionRequest(ws, data)
  })

  // Give a moment for presence to propagate
  await new Promise((resolve) => setTimeout(resolve, 50))

  return ws
}

function handleExtensionRequest (socket: WebSocket, data: RawData): void {
  const message = JSON.parse(rawDataToString(data)) as {
    id?: string
    payload?: Record<string, unknown>
  }

  const payloadType = message.payload?.type

  if (payloadType === 'get_page_context') {
    socket.send(JSON.stringify({
      type: 'message',
      id: message.id,
      payload: {
        type: 'page_context_response',
        ok: true,
        data: createPageContext()
      }
    }))
    return
  }

  if (payloadType === 'get_page_content') {
    socket.send(JSON.stringify({
      type: 'message',
      id: message.id,
      payload: {
        type: 'page_content_response',
        ok: true,
        data: {
          url: 'https://example.com/',
          title: 'Integration Test',
          timestamp: '2026-05-25T10:00:00.000Z',
          index: message.payload?.index ?? 1,
          content: 'Page content',
          truncated: false,
          maxPayloadBytes: 131072
        }
      }
    }))
    return
  }

  if (payloadType === 'perform_action') {
    handleActionMessage(socket, message)
  }
}

function handleActionMessage (
  socket: WebSocket,
  message: { id?: string, payload?: Record<string, unknown> }
): void {
  const action = (message.payload as Record<string, unknown>).action as Record<string, unknown>

  switch (action.type) {
    case 'click':
      socket.send(JSON.stringify({
        type: 'message',
        id: message.id,
        payload: {
          type: 'action_result',
          ok: true,
          data: { action: 'click', target: action.target }
        }
      }))
      break
    case 'write_text':
      socket.send(JSON.stringify({
        type: 'message',
        id: message.id,
        payload: {
          type: 'action_result',
          ok: true,
          data: {
            action: 'write_text',
            target: action.target,
            textLength: (action.text as string).length
          }
        }
      }))
      break
    case 'set_checked':
      socket.send(JSON.stringify({
        type: 'message',
        id: message.id,
        payload: {
          type: 'action_result',
          ok: true,
          data: {
            action: 'set_checked',
            target: action.target,
            checked: action.checked,
            changed: true
          }
        }
      }))
      break
    case 'select_options':
      socket.send(JSON.stringify({
        type: 'message',
        id: message.id,
        payload: {
          type: 'action_result',
          ok: true,
          data: {
            action: 'select_options',
            target: action.target,
            values: action.values
          }
        }
      }))
      break
    case 'submit_form':
      socket.send(JSON.stringify({
        type: 'message',
        id: message.id,
        payload: {
          type: 'action_result',
          ok: true,
          data: { action: 'submit_form', target: action.target }
        }
      }))
      break
    default:
      socket.send(JSON.stringify({
        type: 'message',
        id: message.id,
        payload: {
          type: 'action_result',
          ok: true,
          data: { action: action.type, target: action.target }
        }
      }))
  }
}

function createPageContext (): Record<string, unknown> {
  return {
    url: 'https://example.com/',
    title: 'Integration Test',
    timestamp: '2026-05-25T10:00:00.000Z',
    selectedText: null,
    preview: {
      content: 'Test preview',
      truncated: false,
      maxBytes: 4096
    },
    structure: {
      headings: [{ id: 'bb-1', level: 1, text: 'Integration Test' }],
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

function createHttpClient (): Client {
  return new Client({
    name: 'brijio-integration-test',
    version: '0.0.0'
  })
}

function createHttpTransport (url: string): StreamableHTTPClientTransport {
  return new StreamableHTTPClientTransport(new URL(url), {
    requestInit: {
      headers: {
        authorization: `Bearer ${testMcpAuthToken}`
      }
    }
  })
}

async function connect (url: string): Promise<WebSocket> {
  return await new Promise((resolve, reject) => {
    const client = new WebSocket(url)
    client.once('open', () => resolve(client))
    client.once('error', reject)
  })
}

async function waitForJsonMessages (
  client: WebSocket,
  count: number
): Promise<Array<Record<string, unknown>>> {
  return await new Promise((resolve, reject) => {
    const messages: Array<Record<string, unknown>> = []
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Timed out waiting for WebSocket JSON messages.'))
    }, 500)

    client.on('message', onMessage)
    client.once('error', onError)

    function onMessage (data: RawData): void {
      try {
        const message = JSON.parse(rawDataToString(data)) as Record<string, unknown>
        messages.push(message)
        if (messages.length === count) {
          cleanup()
          resolve(messages)
        }
      } catch (error) {
        cleanup()
        reject(error)
      }
    }

    function onError (error: Error): void {
      cleanup()
      reject(error)
    }

    function cleanup (): void {
      clearTimeout(timeout)
      client.off('message', onMessage)
      client.off('error', onError)
    }
  })
}

async function waitForClose (client: WebSocket): Promise<void> {
  if (client.readyState === client.CLOSED) return

  return await new Promise((resolve) => {
    client.once('close', () => resolve())
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
