import { createHash } from 'node:crypto'

export type BrowserBridgeRole = 'extension' | 'mcp'

export type BrowserCapability =
  | 'page_context'
  | 'page_content'
  | 'click'
  | 'fill_input'
  | 'fill_editable'
  | 'set_checked'
  | 'select_options'
  | 'submit_form'

export interface BrowserPresence {
  browserInstanceId: string
  label: string
  browserName: string
  profileName: string
  connectedAt?: string
  lastSeenAt?: string
  capabilities: BrowserCapability[]
}

export interface BrowserBridgeEnvelope {
  type: 'message'
  id?: string
  target?: {
    browserInstanceId?: string
  }
  payload: unknown
}

export interface AuthPayload {
  type: 'auth'
  role: BrowserBridgeRole
  token: string
}

export interface AuthSuccessPayload {
  type: 'auth_success'
}

export interface BrowserPresenceRequestPayload {
  type: 'browser_presence_request'
}

export interface BrowserPresenceAnnouncePayload extends BrowserPresence {
  type: 'browser_presence_announce'
}

export type BrowserBridgeErrorCode =
  | 'invalid_json'
  | 'invalid_message'
  | 'auth_required'
  | 'auth_failed'
  | 'invalid_auth_message'
  | 'browser_unavailable'
  | 'ambiguous_browser_target'
  | 'invalid_browser_target'
  | 'timeout'
  | 'unsupported_action'

export interface BrowserBridgeErrorEnvelope {
  type: 'error'
  error: {
    code: BrowserBridgeErrorCode
    message: string
    browsers?: BrowserPresence[]
  }
}

export type ParseBrowserBridgeEnvelopeResult =
  | { ok: true, message: BrowserBridgeEnvelope }
  | { ok: false, error: BrowserBridgeErrorEnvelope }

export function createScopeKey (token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function createAuthEnvelope (input: {
  requestId?: string
  token: string
  role: BrowserBridgeRole
}): BrowserBridgeEnvelope {
  return {
    type: 'message',
    id: input.requestId,
    payload: {
      type: 'auth',
      role: input.role,
      token: input.token
    }
  }
}

export function createAuthSuccessEnvelope (
  requestId: string | undefined
): BrowserBridgeEnvelope {
  return {
    type: 'message',
    id: requestId,
    payload: {
      type: 'auth_success'
    }
  }
}

export function createBrowserPresenceRequestEnvelope (
  requestId?: string
): BrowserBridgeEnvelope {
  return {
    type: 'message',
    id: requestId,
    payload: {
      type: 'browser_presence_request'
    }
  }
}

export function createBrowserPresenceAnnounceEnvelope (
  input: BrowserPresence & { requestId?: string }
): BrowserBridgeEnvelope {
  return {
    type: 'message',
    id: input.requestId,
    payload: {
      type: 'browser_presence_announce',
      browserInstanceId: input.browserInstanceId,
      label: input.label,
      browserName: input.browserName,
      profileName: input.profileName,
      capabilities: input.capabilities
    }
  }
}

export function createErrorEnvelope (
  code: BrowserBridgeErrorCode,
  message: string,
  browsers?: BrowserPresence[]
): BrowserBridgeErrorEnvelope {
  return {
    type: 'error',
    error: {
      code,
      message,
      ...(browsers === undefined ? {} : { browsers })
    }
  }
}

export function parseBrowserBridgeEnvelope (
  rawMessage: string
): ParseBrowserBridgeEnvelopeResult {
  let parsed: unknown

  try {
    parsed = JSON.parse(rawMessage)
  } catch {
    return {
      ok: false,
      error: createErrorEnvelope('invalid_json', 'Message must be valid JSON.')
    }
  }

  if (!isEnvelope(parsed)) {
    return {
      ok: false,
      error: createErrorEnvelope(
        'invalid_message',
        'Message must be an object with type "message" and a payload property.'
      )
    }
  }

  return { ok: true, message: parsed }
}

export function isAuthPayload (value: unknown): value is AuthPayload {
  return (
    isRecord(value) &&
    value.type === 'auth' &&
    (value.role === 'extension' || value.role === 'mcp') &&
    typeof value.token === 'string' &&
    value.token.length > 0
  )
}

export function isBrowserPresenceAnnouncePayload (
  value: unknown
): value is BrowserPresenceAnnouncePayload {
  return (
    isRecord(value) &&
    value.type === 'browser_presence_announce' &&
    typeof value.browserInstanceId === 'string' &&
    value.browserInstanceId.length > 0 &&
    typeof value.label === 'string' &&
    value.label.length > 0 &&
    typeof value.browserName === 'string' &&
    value.browserName.length > 0 &&
    typeof value.profileName === 'string' &&
    value.profileName.length > 0 &&
    Array.isArray(value.capabilities) &&
    value.capabilities.every(isBrowserCapability)
  )
}

export function isBrowserPresenceRequestPayload (
  value: unknown
): value is BrowserPresenceRequestPayload {
  return isRecord(value) && value.type === 'browser_presence_request'
}

function isEnvelope (value: unknown): value is BrowserBridgeEnvelope {
  return (
    isRecord(value) &&
    value.type === 'message' &&
    (!Object.hasOwn(value, 'id') || typeof value.id === 'string') &&
    (!Object.hasOwn(value, 'target') || isTarget(value.target)) &&
    Object.hasOwn(value, 'payload')
  )
}

function isTarget (value: unknown): value is { browserInstanceId?: string } {
  return (
    isRecord(value) &&
    (!Object.hasOwn(value, 'browserInstanceId') ||
      typeof value.browserInstanceId === 'string')
  )
}

function isBrowserCapability (value: unknown): value is BrowserCapability {
  return (
    value === 'page_context' ||
    value === 'page_content' ||
    value === 'click' ||
    value === 'fill_input' ||
    value === 'fill_editable' ||
    value === 'set_checked' ||
    value === 'select_options' ||
    value === 'submit_form'
  )
}

function isRecord (value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
