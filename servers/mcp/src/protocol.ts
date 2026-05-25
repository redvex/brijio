export interface WebSocketEnvelope {
  type: 'message'
  id?: string
  payload: unknown
}

export interface PageContext {
  url: string
  title: string
}

export type BrowserBridgeToolErrorCode =
  | 'connection_failed'
  | 'timeout'
  | 'invalid_response'
  | 'browser_error'

export type BrowserBridgeToolResult =
  | {
    ok: true
    data: PageContext
  }
  | {
    ok: false
    error: {
      code: BrowserBridgeToolErrorCode
      message: string
    }
  }

export type PageContextParseResult =
  | BrowserBridgeToolResult
  | { ok: false, ignored: true }

export function createGetPageContextEnvelope (
  requestId: string
): WebSocketEnvelope {
  return {
    type: 'message',
    id: requestId,
    payload: {
      type: 'get_page_context'
    }
  }
}

export function parsePageContextEnvelope (
  value: unknown,
  requestId: string
): PageContextParseResult {
  if (!isRecord(value) || value.type !== 'message') {
    return invalidResponse()
  }

  if (value.id !== requestId) {
    return { ok: false, ignored: true }
  }

  if (!isRecord(value.payload)) {
    return invalidResponse()
  }

  if (value.payload.type !== 'page_context_response') {
    return invalidResponse()
  }

  if (value.payload.ok === true) {
    return parseSuccessPayload(value.payload)
  }

  if (value.payload.ok === false) {
    return parseErrorPayload(value.payload)
  }

  return invalidResponse()
}

function parseSuccessPayload (
  payload: Record<PropertyKey, unknown>
): BrowserBridgeToolResult {
  if (!isRecord(payload.data)) {
    return invalidResponse()
  }

  if (
    typeof payload.data.url !== 'string' ||
    typeof payload.data.title !== 'string'
  ) {
    return invalidResponse()
  }

  return {
    ok: true,
    data: {
      url: payload.data.url,
      title: payload.data.title
    }
  }
}

function parseErrorPayload (
  payload: Record<PropertyKey, unknown>
): BrowserBridgeToolResult {
  if (!isRecord(payload.error) || typeof payload.error.message !== 'string') {
    return invalidResponse()
  }

  return {
    ok: false,
    error: {
      code: 'browser_error',
      message: payload.error.message
    }
  }
}

export function invalidResponse (): BrowserBridgeToolResult {
  return {
    ok: false,
    error: {
      code: 'invalid_response',
      message: 'Received an invalid page context response.'
    }
  }
}

export function timeoutResponse (): BrowserBridgeToolResult {
  return {
    ok: false,
    error: {
      code: 'timeout',
      message: 'Timed out waiting for a browser page context response.'
    }
  }
}

export function connectionFailedResponse (
  websocketUrl: string
): BrowserBridgeToolResult {
  return {
    ok: false,
    error: {
      code: 'connection_failed',
      message: `Unable to connect to BrowserBridge WebSocket at ${websocketUrl}.`
    }
  }
}

function isRecord (value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
