import { WebSocketServer, type RawData, type WebSocket } from 'ws'
import {
  createAuthSuccessEnvelope,
  createBrowserPresenceRequestEnvelope,
  createErrorEnvelope,
  createScopeKey,
  isAuthPayload,
  isBrowserPresenceAnnouncePayload,
  parseBrowserBridgeEnvelope,
  type BrowserBridgeEnvelope,
  type BrowserBridgeRole,
  type BrowserPresence,
  type BrowserPresenceAnnouncePayload
} from './protocol.js'

export interface WebSocketServerOptions {
  host?: string
  port?: number
  pairingToken?: string
  additionalPairingTokens?: string[]
  now?: () => Date
}

export interface BrowserBridgeWebSocketServer {
  url: string
  close: () => Promise<void>
}

interface ConnectionState {
  role: BrowserBridgeRole | undefined
  scopeKey: string | undefined
  browserInstanceId: string | undefined
}

interface PresenceRecord extends Required<BrowserPresence> {
  scopeKey: string
  socket: WebSocket
}

export async function createWebSocketServer (
  options: WebSocketServerOptions = {}
): Promise<BrowserBridgeWebSocketServer> {
  const host = options.host ?? '127.0.0.1'
  const port = options.port ?? 8787
  const pairingTokens = getPairingTokens(options)
  const now = options.now ?? (() => new Date())
  const presence = new Map<string, PresenceRecord>()
  const pendingRequests = new Map<string, WebSocket>()
  const server = new WebSocketServer({ host, port })

  server.on('connection', (socket) => {
    const state: ConnectionState = {
      role: undefined,
      scopeKey: undefined,
      browserInstanceId: undefined
    }

    socket.on('message', (data) => {
      const result = parseBrowserBridgeEnvelope(rawDataToString(data))

      if (!result.ok) {
        sendJson(socket, result.error)
        return
      }

      if (state.scopeKey === undefined) {
        handleUnauthenticatedMessage(
          socket,
          state,
          result.message,
          pairingTokens
        )
        return
      }

      handleAuthenticatedMessage(
        socket,
        state,
        result.message,
        presence,
        pendingRequests,
        now
      )
    })

    socket.on('close', () => {
      if (
        state.scopeKey !== undefined &&
        state.browserInstanceId !== undefined
      ) {
        presence.delete(presenceKey(state.scopeKey, state.browserInstanceId))
      }

      cleanupPendingRequestsForSocket(pendingRequests, socket)
    })
  })

  await waitForListening(server)

  return {
    url: `ws://${host}:${getPort(server)}`,
    close: async () => await closeServer(server)
  }
}

function getPairingTokens (options: WebSocketServerOptions): Set<string> {
  const token =
    options.pairingToken ??
    process.env.BROWSERBRIDGE_PAIRING_TOKEN ??
    process.env.BROWSERBRIDGE_TOKEN

  if (token === undefined || token.length === 0) {
    throw new Error('BROWSERBRIDGE_PAIRING_TOKEN must be configured.')
  }

  return new Set([token, ...(options.additionalPairingTokens ?? [])])
}

function handleUnauthenticatedMessage (
  socket: WebSocket,
  state: ConnectionState,
  message: BrowserBridgeEnvelope,
  pairingTokens: Set<string>
): void {
  if (!isAuthPayload(message.payload)) {
    sendJson(
      socket,
      createErrorEnvelope(
        'auth_required',
        'Authenticate before sending BrowserBridge messages.'
      )
    )
    return
  }

  if (!pairingTokens.has(message.payload.token)) {
    sendJson(
      socket,
      createErrorEnvelope(
        'auth_failed',
        'BrowserBridge pairing token was not accepted.'
      )
    )
    return
  }

  state.role = message.payload.role
  state.scopeKey = createScopeKey(message.payload.token)
  sendJson(socket, createAuthSuccessEnvelope(message.id))

  if (state.role === 'extension') {
    sendJson(socket, createBrowserPresenceRequestEnvelope('presence-1'))
  }
}

function handleAuthenticatedMessage (
  socket: WebSocket,
  state: ConnectionState,
  message: BrowserBridgeEnvelope,
  presence: Map<string, PresenceRecord>,
  pendingRequests: Map<string, WebSocket>,
  now: () => Date
): void {
  if (state.scopeKey === undefined || state.role === undefined) {
    return
  }

  if (state.role === 'extension') {
    handleExtensionMessage(
      socket,
      state,
      message,
      presence,
      pendingRequests,
      now
    )
    return
  }

  handleMcpMessage(socket, state.scopeKey, message, presence, pendingRequests)
}

function handleExtensionMessage (
  socket: WebSocket,
  state: ConnectionState,
  message: BrowserBridgeEnvelope,
  presence: Map<string, PresenceRecord>,
  pendingRequests: Map<string, WebSocket>,
  now: () => Date
): void {
  if (isBrowserPresenceAnnouncePayload(message.payload)) {
    if (state.scopeKey === undefined) {
      return
    }

    state.browserInstanceId = message.payload.browserInstanceId
    upsertPresence(socket, state.scopeKey, message.payload, presence, now)
    return
  }

  if (state.scopeKey !== undefined && routeExtensionResponse(
    state.scopeKey,
    message,
    pendingRequests
  )) {
    return
  }

  sendJson(
    socket,
    createErrorEnvelope(
      'invalid_message',
      'Extension messages must announce browser presence or respond to a pending request.'
    )
  )
}

function routeExtensionResponse (
  scopeKey: string,
  message: BrowserBridgeEnvelope,
  pendingRequests: Map<string, WebSocket>
): boolean {
  if (message.id === undefined) {
    return false
  }

  const key = pendingRequestKey(scopeKey, message.id)
  const mcpSocket = pendingRequests.get(key)

  if (mcpSocket === undefined) {
    return false
  }

  pendingRequests.delete(key)
  sendJson(mcpSocket, message)

  return true
}

function upsertPresence (
  socket: WebSocket,
  scopeKey: string,
  payload: BrowserPresenceAnnouncePayload,
  presence: Map<string, PresenceRecord>,
  now: () => Date
): void {
  const key = presenceKey(scopeKey, payload.browserInstanceId)
  const existing = presence.get(key)
  const timestamp = now().toISOString()

  presence.set(key, {
    scopeKey,
    socket,
    browserInstanceId: payload.browserInstanceId,
    label: payload.label,
    browserName: payload.browserName,
    profileName: payload.profileName,
    connectedAt: existing?.connectedAt ?? timestamp,
    lastSeenAt: timestamp,
    capabilities: payload.capabilities
  })
}

function handleMcpMessage (
  socket: WebSocket,
  scopeKey: string,
  message: BrowserBridgeEnvelope,
  presence: Map<string, PresenceRecord>,
  pendingRequests: Map<string, WebSocket>
): void {
  if (isListBrowsersMessage(message.payload)) {
    sendJson(socket, {
      type: 'message',
      id: message.id,
      payload: {
        type: 'browser_list',
        ok: true,
        data: {
          browsers: listPresenceForScope(presence, scopeKey)
        }
      }
    })
    return
  }

  const selected = selectBrowser(
    listRecordsForScope(presence, scopeKey),
    message.target?.browserInstanceId
  )

  if (!selected.ok) {
    sendJson(socket, selected.error)
    return
  }

  if (message.id !== undefined) {
    pendingRequests.set(pendingRequestKey(scopeKey, message.id), socket)
  }

  sendJson(selected.record.socket, message)
}

function selectBrowser (
  records: PresenceRecord[],
  browserInstanceId: string | undefined
):
  | { ok: true, record: PresenceRecord }
  | { ok: false, error: ReturnType<typeof createErrorEnvelope> } {
  if (browserInstanceId !== undefined) {
    const record = records.find(
      (candidate) => candidate.browserInstanceId === browserInstanceId
    )

    if (record === undefined) {
      return {
        ok: false,
        error: createErrorEnvelope(
          'browser_unavailable',
          'No matching BrowserBridge browser is online.'
        )
      }
    }

    return { ok: true, record }
  }

  if (records.length === 0) {
    return {
      ok: false,
      error: createErrorEnvelope(
        'browser_unavailable',
        'No BrowserBridge browser is online.'
      )
    }
  }

  if (records.length > 1) {
    return {
      ok: false,
      error: createErrorEnvelope(
        'ambiguous_browser_target',
        'Multiple BrowserBridge browsers are online. Specify browserInstanceId.',
        records.map(presenceForResponse)
      )
    }
  }

  return { ok: true, record: records[0] }
}

function listPresenceForScope (
  presence: Map<string, PresenceRecord>,
  scopeKey: string
): BrowserPresence[] {
  return listRecordsForScope(presence, scopeKey).map(presenceForResponse)
}

function listRecordsForScope (
  presence: Map<string, PresenceRecord>,
  scopeKey: string
): PresenceRecord[] {
  return Array.from(presence.values()).filter(
    (record) =>
      record.scopeKey === scopeKey && record.socket.readyState === record.socket.OPEN
  )
}

function presenceForResponse (record: PresenceRecord): BrowserPresence {
  return {
    browserInstanceId: record.browserInstanceId,
    label: record.label,
    browserName: record.browserName,
    profileName: record.profileName,
    connectedAt: record.connectedAt,
    lastSeenAt: record.lastSeenAt,
    capabilities: record.capabilities
  }
}

function presenceKey (scopeKey: string, browserInstanceId: string): string {
  return `${scopeKey}:${browserInstanceId}`
}

function pendingRequestKey (scopeKey: string, requestId: string): string {
  return `${scopeKey}:${requestId}`
}

function cleanupPendingRequestsForSocket (
  pendingRequests: Map<string, WebSocket>,
  socket: WebSocket
): void {
  for (const [key, pendingSocket] of pendingRequests) {
    if (pendingSocket === socket) {
      pendingRequests.delete(key)
    }
  }
}

function isListBrowsersMessage (payload: unknown): boolean {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    !Array.isArray(payload) &&
    'type' in payload &&
    payload.type === 'list_browsers'
  )
}

function sendJson (socket: WebSocket, message: unknown): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message))
  }
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

async function waitForListening (server: WebSocketServer): Promise<void> {
  if (server.address() !== null) {
    return await Promise.resolve()
  }

  return await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
}

function getPort (server: WebSocketServer): number {
  const address = server.address()

  if (address === null || typeof address === 'string') {
    throw new Error('WebSocket server is not listening on a TCP port.')
  }

  return address.port
}

async function closeServer (server: WebSocketServer): Promise<void> {
  for (const client of server.clients) {
    client.close()
  }

  return await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error != null) {
        reject(error)
        return
      }

      resolve()
    })
  })
}
