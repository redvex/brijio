import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFileSync } from 'node:fs'
import { WebSocketServer, type RawData, type WebSocket } from 'ws'
import {
  createAuthSuccessEnvelope,
  createBrowserPresenceRequestEnvelope,
  createErrorEnvelope,
  createScopeKey,
  isAuthPayload,
  isBrowserPresenceAnnouncePayload,
  parseBrijioEnvelope,
  type BrijioEnvelope,
  type BrijioRole,
  type BrowserPresence,
  type BrowserPresenceAnnouncePayload
} from './protocol.js'
import { createLogger } from '@brijio/shared'

const version: string = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
).version
const logger = createLogger('websocket')

export interface WebSocketServerOptions {
  host?: string
  port?: number
  pairingToken?: string
  additionalPairingTokens?: string[]
  now?: () => Date
}

export interface WebSocketHealthStatus {
  status: 'ok'
  version: string
  uptimeSeconds: number
  extensions: {
    count: number
    browsers: Array<{ browserInstanceId: string, label: string }>
  }
}

export interface BrijioWebSocketServer {
  url: string
  getStatus: () => WebSocketHealthStatus
  close: () => Promise<void>
}

interface ConnectionState {
  role: BrijioRole | undefined
  scopeKey: string | undefined
  browserInstanceId: string | undefined
}

interface PresenceRecord extends Required<BrowserPresence> {
  scopeKey: string
  socket: WebSocket
}

export async function createWebSocketServer (
  options: WebSocketServerOptions = {}
): Promise<BrijioWebSocketServer> {
  const host = options.host ?? '0.0.0.0'
  const port = options.port ?? 8787
  const pairingTokens = getPairingTokens(options)
  const now = options.now ?? (() => new Date())
  const startTime = Date.now()
  const presence = new Map<string, PresenceRecord>()
  const pendingRequests = new Map<string, WebSocket>()

  function getStatus (): WebSocketHealthStatus {
    const browsers = Array.from(presence.values())
      .filter((record) => record.socket.readyState === record.socket.OPEN)
      .map((record) => ({
        browserInstanceId: record.browserInstanceId,
        label: record.label
      }))

    return {
      status: 'ok',
      version,
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      extensions: {
        count: browsers.length,
        browsers
      }
    }
  }

  const httpServer = createServer((req, res) => handleHealthRequest(req, res, getStatus))
  const server = new WebSocketServer({ server: httpServer })

  httpServer.listen(port, host)

  server.on('connection', (socket) => {
    const state: ConnectionState = {
      role: undefined,
      scopeKey: undefined,
      browserInstanceId: undefined
    }

    socket.on('message', (data) => {
      const result = parseBrijioEnvelope(rawDataToString(data))

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
        logger.info('client_disconnected', { role: state.role, browserInstanceId: state.browserInstanceId })
      }

      cleanupPendingRequestsForSocket(pendingRequests, socket)
    })
  })

  await waitForListening(httpServer)

  return {
    url: `ws://${host}:${getPort(httpServer)}`,
    getStatus,
    close: async () => await closeBoth(server, httpServer)
  }
}

function getPairingTokens (options: WebSocketServerOptions): Set<string> {
  const token =
    options.pairingToken ??
    process.env.BRIJIO_PAIRING_TOKEN ??
    process.env.BRIJIO_TOKEN

  if (token === undefined || token.length === 0) {
    throw new Error('BRIJIO_PAIRING_TOKEN must be configured.')
  }

  return new Set([token, ...(options.additionalPairingTokens ?? [])])
}

function handleUnauthenticatedMessage (
  socket: WebSocket,
  state: ConnectionState,
  message: BrijioEnvelope,
  pairingTokens: Set<string>
): void {
  if (!isAuthPayload(message.payload)) {
    sendJson(
      socket,
      createErrorEnvelope(
        'auth_required',
        'Authenticate before sending Brijio messages.'
      )
    )
    return
  }

  if (!pairingTokens.has(message.payload.token)) {
    logger.warn('auth_failed', { role: message.payload.role })
    sendJson(
      socket,
      createErrorEnvelope(
        'auth_failed',
        'Brijio pairing token was not accepted.'
      )
    )
    return
  }

  state.role = message.payload.role
  state.scopeKey = createScopeKey(message.payload.token)
  sendJson(socket, createAuthSuccessEnvelope(message.id))
  logger.info('client_authenticated', { role: state.role, scopeKey: state.scopeKey })

  if (state.role === 'extension') {
    sendJson(socket, createBrowserPresenceRequestEnvelope('presence-1'))
  }
}

function handleAuthenticatedMessage (
  socket: WebSocket,
  state: ConnectionState,
  message: BrijioEnvelope,
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
  message: BrijioEnvelope,
  presence: Map<string, PresenceRecord>,
  pendingRequests: Map<string, WebSocket>,
  now: () => Date
): void {
  if (isBrowserPresenceAnnouncePayload(message.payload)) {
    if (state.scopeKey === undefined) {
      return
    }

    state.browserInstanceId = message.payload.browserInstanceId
    logger.info('presence_announce', {
      role: state.role,
      browserInstanceId: message.payload.browserInstanceId,
      label: message.payload.label
    })
    upsertPresence(socket, state.scopeKey, message.payload, presence, now)
    return
  }

  if (isKeepalivePayload(message.payload)) {
    logger.debug('extension_keepalive', { role: state.role, browserInstanceId: state.browserInstanceId })
    return
  }

  if (state.scopeKey !== undefined && routeExtensionResponse(
    state.scopeKey,
    message,
    pendingRequests
  )) {
    logger.debug('extension_response_routed', { role: state.role, messageId: message.id })
    return
  }

  const payload = message.payload as Record<string, unknown>
  const missing: string[] = []
  if (payload.type === 'browser_presence_announce') {
    if (typeof payload.browserInstanceId !== 'string' || payload.browserInstanceId.length === 0) missing.push('browserInstanceId')
    if (typeof payload.label !== 'string' || payload.label.length === 0) missing.push('label')
    if (typeof payload.browserName !== 'string' || payload.browserName.length === 0) missing.push('browserName')
    if (typeof payload.profileName !== 'string' || payload.profileName.length === 0) missing.push('profileName')
    if (!Array.isArray(payload.capabilities)) missing.push('capabilities')
  }
  logger.warn('invalid_message', { role: state.role, messageType: payload.type as string, missingFields: missing, payload })
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
  message: BrijioEnvelope,
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
  message: BrijioEnvelope,
  presence: Map<string, PresenceRecord>,
  pendingRequests: Map<string, WebSocket>
): void {
  if (isListBrowsersMessage(message.payload)) {
    const count = listRecordsForScope(presence, scopeKey).length
    logger.info('list_browsers', { scopeKey: scopeKey.slice(0, 8), browserCount: count })
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
    logger.warn('mcp_request_no_browser', { scopeKey: scopeKey.slice(0, 8), error: selected.error.error.code })
    sendJson(socket, selected.error)
    return
  }

  const payload = message.payload as Record<string, unknown>
  if (message.id !== undefined) {
    pendingRequests.set(pendingRequestKey(scopeKey, message.id), socket)
  }

  logger.info('mcp_request_routed', {
    scopeKey: scopeKey.slice(0, 8),
    type: payload.type,
    browserInstanceId: selected.record.browserInstanceId,
    label: selected.record.label
  })
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
          'No matching Brijio browser is online.'
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
        'No Brijio browser is online.'
      )
    }
  }

  if (records.length > 1) {
    return {
      ok: false,
      error: createErrorEnvelope(
        'ambiguous_browser_target',
        'Multiple Brijio browsers are online. Specify browserInstanceId.',
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

function isKeepalivePayload (payload: unknown): boolean {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    !Array.isArray(payload) &&
    'type' in payload &&
    (payload as Record<string, unknown>).type === 'extension_keepalive'
  )
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

async function waitForListening (server: import('node:http').Server): Promise<void> {
  if (server.listening) {
    return await Promise.resolve()
  }

  return await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
}

function getPort (server: import('node:http').Server): number {
  const address = server.address()

  if (address === null || typeof address === 'string') {
    throw new Error('HTTP server is not listening on a TCP port.')
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

async function closeHttpServer (server: import('node:http').Server): Promise<void> {
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

async function closeBoth (wsServer: WebSocketServer, httpServer: import('node:http').Server): Promise<void> {
  await closeServer(wsServer)
  await closeHttpServer(httpServer)
}

function handleHealthRequest (req: IncomingMessage, res: ServerResponse, getStatus: () => WebSocketHealthStatus): void {
  if (req.method === 'GET' && req.url === '/health') {
    const status = getStatus()
    logger.debug('health_check', { extensions: status.extensions.count })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(status))
    return
  }

  res.writeHead(404)
  res.end()
}
