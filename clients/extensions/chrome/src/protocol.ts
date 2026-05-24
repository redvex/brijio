export interface WebSocketEnvelope {
  type: 'message'
  id?: string
  payload: unknown
}

export interface GetPageContextRequest {
  type: 'get_page_context'
}

export interface PageContext {
  url: string
  title: string
}

export type PageContextErrorCode =
  | 'not_connected'
  | 'no_active_tab'
  | 'unsupported_request'

export interface PageContextResponse {
  type: 'page_context_response'
  ok: true
  data: PageContext
}

export interface PageContextErrorResponse {
  type: 'page_context_response'
  ok: false
  error: {
    code: PageContextErrorCode
    message: string
  }
}

export type ExtensionResponse = PageContextResponse | PageContextErrorResponse

export function isGetPageContextEnvelope (
  value: unknown
): value is WebSocketEnvelope & { payload: GetPageContextRequest } {
  if (!isRecord(value)) {
    return false
  }

  if (value.type !== 'message') {
    return false
  }

  if (Object.hasOwn(value, 'id') && typeof value.id !== 'string') {
    return false
  }

  if (!isRecord(value.payload)) {
    return false
  }

  return value.payload.type === 'get_page_context'
}

export function createPageContextResponse (
  id: string | undefined,
  context: PageContext
): WebSocketEnvelope {
  return createEnvelope(id, {
    type: 'page_context_response',
    ok: true,
    data: context
  })
}

export function createPageContextErrorResponse (
  id: string | undefined,
  code: PageContextErrorCode,
  message: string
): WebSocketEnvelope {
  return createEnvelope(id, {
    type: 'page_context_response',
    ok: false,
    error: {
      code,
      message
    }
  })
}

function createEnvelope (
  id: string | undefined,
  payload: ExtensionResponse
): WebSocketEnvelope {
  if (id === undefined) {
    return {
      type: 'message',
      payload
    }
  }

  return {
    type: 'message',
    id,
    payload
  }
}

function isRecord (value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
