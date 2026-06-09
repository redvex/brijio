import { createHash } from 'node:crypto'
import WebSocket, { type RawData } from 'ws'
import {
  type BrijioClickElementResult,
  type BrijioBrowserListResult,
  type BrijioFillInputResult,
  type BrijioPageContentResult,
  type BrijioPageContextResult,
  type BrijioResourceResult,
  type BrijioSelectOptionsResult,
  type BrijioSetCheckedResult,
  type BrijioSubmitFormResult,
  type ClickElementTarget,
  createAuthEnvelope,
  createClickElementEnvelope,
  createFillInputEnvelope,
  createSelectOptionsEnvelope,
  createSetCheckedEnvelope,
  createSubmitFormEnvelope,
  createWriteEditableEnvelope,
  connectionFailedResponse,
  createGetPageContentEnvelope,
  createGetPageContextEnvelope,
  type EditableTarget,
  type FillInputTarget,
  authRequiredResponse,
  invalidResponse,
  parseActionResultEnvelope,
  parseBrowserListEnvelope,
  parsePageContentEnvelope,
  parsePageContextEnvelope,
  parseRouterErrorEnvelope,
  type SubmitFormTarget,
  timeoutResponse
} from './protocol.js'
import { createLogger } from '@brijio/shared'

const wsLogger = createLogger('mcp-ws')

export interface PageContextRequestOptions {
  websocketUrl: string
  pairingToken: string
  timeoutMs: number
  browserInstanceId?: string
  createRequestId?: () => string
}

export interface PageContentRequestOptions extends PageContextRequestOptions {
  index: number
}

export interface ClickElementRequestOptions extends PageContextRequestOptions {
  target: ClickElementTarget
}

export interface FillInputRequestOptions extends PageContextRequestOptions {
  target: FillInputTarget
  text: string
}

export interface WriteEditableRequestOptions extends PageContextRequestOptions {
  target: EditableTarget
  text: string
}

export interface SetCheckedRequestOptions extends PageContextRequestOptions {
  target: FillInputTarget
  checked: boolean
}

export interface SelectOptionsRequestOptions extends PageContextRequestOptions {
  target: FillInputTarget
  values: string[]
}

export interface SubmitFormRequestOptions extends PageContextRequestOptions {
  target: SubmitFormTarget
}

export async function requestPageContext (
  options: PageContextRequestOptions
): Promise<BrijioPageContextResult> {
  const requestId = options.createRequestId?.() ?? createRequestId()

  return await requestBrijio({
    websocketUrl: options.websocketUrl,
    pairingToken: options.pairingToken,
    timeoutMs: options.timeoutMs,
    browserInstanceId: options.browserInstanceId,
    requestEnvelope: createGetPageContextEnvelope(requestId),
    parseEnvelope: (value) => parsePageContextEnvelope(value, requestId),
    timeoutMessage: 'Timed out waiting for a browser page context response.'
  })
}

export async function requestPageContent (
  options: PageContentRequestOptions
): Promise<BrijioPageContentResult> {
  const requestId = options.createRequestId?.() ?? createRequestId()

  return await requestBrijio({
    websocketUrl: options.websocketUrl,
    pairingToken: options.pairingToken,
    timeoutMs: options.timeoutMs,
    browserInstanceId: options.browserInstanceId,
    requestEnvelope: createGetPageContentEnvelope(requestId, options.index),
    parseEnvelope: (value) => parsePageContentEnvelope(value, requestId),
    timeoutMessage: 'Timed out waiting for a browser page content response.'
  })
}

export async function requestClickElement (
  options: ClickElementRequestOptions
): Promise<BrijioClickElementResult> {
  const requestId = options.createRequestId?.() ?? createRequestId()

  return await requestBrijio({
    websocketUrl: options.websocketUrl,
    pairingToken: options.pairingToken,
    timeoutMs: options.timeoutMs,
    browserInstanceId: options.browserInstanceId,
    requestEnvelope: createClickElementEnvelope(requestId, options.target),
    parseEnvelope: (value) => parseClickActionResultEnvelope(value, requestId),
    timeoutMessage: 'Timed out waiting for a browser action result.'
  })
}

export async function requestFillInput (
  options: FillInputRequestOptions
): Promise<BrijioFillInputResult> {
  const requestId = options.createRequestId?.() ?? createRequestId()

  return await requestBrijio({
    websocketUrl: options.websocketUrl,
    pairingToken: options.pairingToken,
    timeoutMs: options.timeoutMs,
    browserInstanceId: options.browserInstanceId,
    requestEnvelope: createFillInputEnvelope(
      requestId,
      options.target,
      options.text
    ),
    parseEnvelope: (value) => parseFillActionResultEnvelope(value, requestId),
    timeoutMessage: 'Timed out waiting for a browser action result.'
  })
}

export async function requestWriteEditable (
  options: WriteEditableRequestOptions
): Promise<BrijioFillInputResult> {
  const requestId = options.createRequestId?.() ?? createRequestId()

  return await requestBrijio({
    websocketUrl: options.websocketUrl,
    pairingToken: options.pairingToken,
    timeoutMs: options.timeoutMs,
    browserInstanceId: options.browserInstanceId,
    requestEnvelope: createWriteEditableEnvelope(
      requestId,
      options.target,
      options.text
    ),
    parseEnvelope: (value) => parseWriteTextActionResultEnvelope(value, requestId),
    timeoutMessage: 'Timed out waiting for a browser action result.'
  })
}

export async function requestSetChecked (
  options: SetCheckedRequestOptions
): Promise<BrijioSetCheckedResult> {
  const requestId = options.createRequestId?.() ?? createRequestId()

  return await requestBrijio({
    websocketUrl: options.websocketUrl,
    pairingToken: options.pairingToken,
    timeoutMs: options.timeoutMs,
    browserInstanceId: options.browserInstanceId,
    requestEnvelope: createSetCheckedEnvelope(
      requestId,
      options.target,
      options.checked
    ),
    parseEnvelope: (value) => parseSetCheckedActionResultEnvelope(value, requestId),
    timeoutMessage: 'Timed out waiting for a browser action result.'
  })
}

export async function requestSelectOptions (
  options: SelectOptionsRequestOptions
): Promise<BrijioSelectOptionsResult> {
  const requestId = options.createRequestId?.() ?? createRequestId()

  return await requestBrijio({
    websocketUrl: options.websocketUrl,
    pairingToken: options.pairingToken,
    timeoutMs: options.timeoutMs,
    browserInstanceId: options.browserInstanceId,
    requestEnvelope: createSelectOptionsEnvelope(
      requestId,
      options.target,
      options.values
    ),
    parseEnvelope: (value) => parseSelectOptionsActionResultEnvelope(value, requestId),
    timeoutMessage: 'Timed out waiting for a browser action result.'
  })
}

export async function requestSubmitForm (
  options: SubmitFormRequestOptions
): Promise<BrijioSubmitFormResult> {
  const requestId = options.createRequestId?.() ?? createRequestId()

  return await requestBrijio({
    websocketUrl: options.websocketUrl,
    pairingToken: options.pairingToken,
    timeoutMs: options.timeoutMs,
    browserInstanceId: options.browserInstanceId,
    requestEnvelope: createSubmitFormEnvelope(requestId, options.target),
    parseEnvelope: (value) => parseSubmitFormActionResultEnvelope(value, requestId),
    timeoutMessage: 'Timed out waiting for a browser action result.'
  })
}

export async function requestBrowserList (options: {
  websocketUrl: string
  pairingToken: string
  timeoutMs: number
  createRequestId?: () => string
}): Promise<BrijioBrowserListResult> {
  const requestId = options.createRequestId?.() ?? createRequestId()

  return await requestBrijio({
    websocketUrl: options.websocketUrl,
    pairingToken: options.pairingToken,
    timeoutMs: options.timeoutMs,
    requestEnvelope: {
      type: 'message',
      id: requestId,
      payload: {
        type: 'list_browsers'
      }
    },
    parseEnvelope: (value) => parseBrowserListEnvelope(value, requestId),
    timeoutMessage: 'Timed out waiting for a browser list response.'
  })
}

function parseClickActionResultEnvelope (
  value: unknown,
  requestId: string
): BrijioClickElementResult | { ok: false, ignored: true } {
  const result = parseActionResultEnvelope(value, requestId)

  if ('ignored' in result || !result.ok) {
    return result
  }

  if (result.data.action === 'click') {
    return {
      ok: true,
      data: result.data
    }
  }

  return invalidResponse()
}

function parseFillActionResultEnvelope (
  value: unknown,
  requestId: string
): BrijioFillInputResult | { ok: false, ignored: true } {
  return parseWriteTextActionResultEnvelope(value, requestId)
}

function parseWriteTextActionResultEnvelope (
  value: unknown,
  requestId: string
): BrijioFillInputResult | { ok: false, ignored: true } {
  const result = parseActionResultEnvelope(value, requestId)

  if ('ignored' in result || !result.ok) {
    return result
  }

  if (result.data.action === 'write_text') {
    return {
      ok: true,
      data: result.data
    }
  }

  return invalidResponse()
}

function parseSetCheckedActionResultEnvelope (
  value: unknown,
  requestId: string
): BrijioSetCheckedResult | { ok: false, ignored: true } {
  const result = parseActionResultEnvelope(value, requestId)

  if ('ignored' in result || !result.ok) {
    return result
  }

  if (result.data.action === 'set_checked') {
    return {
      ok: true,
      data: result.data
    }
  }

  return invalidResponse()
}

function parseSelectOptionsActionResultEnvelope (
  value: unknown,
  requestId: string
): BrijioSelectOptionsResult | { ok: false, ignored: true } {
  const result = parseActionResultEnvelope(value, requestId)

  if ('ignored' in result || !result.ok) {
    return result
  }

  if (result.data.action === 'select_options') {
    return {
      ok: true,
      data: result.data
    }
  }

  return invalidResponse()
}

function parseSubmitFormActionResultEnvelope (
  value: unknown,
  requestId: string
): BrijioSubmitFormResult | { ok: false, ignored: true } {
  const result = parseActionResultEnvelope(value, requestId)

  if ('ignored' in result || !result.ok) {
    return result
  }

  if (result.data.action === 'submit_form') {
    return {
      ok: true,
      data: result.data
    }
  }

  return invalidResponse()
}

async function requestBrijio<T> (options: {
  websocketUrl: string
  pairingToken: string
  timeoutMs: number
  browserInstanceId?: string
  requestEnvelope: {
    type: 'message'
    id?: string
    target?: { browserInstanceId?: string }
    payload: unknown
  }
  timeoutMessage: string
  parseEnvelope: (
    value: unknown
  ) => BrijioResourceResult<T> | { ok: false, ignored: true }
}): Promise<BrijioResourceResult<T>> {
  if (options.pairingToken.trim() === '') {
    return authRequiredResponse()
  }

  const tokenScopeKey = createHash('sha256').update(options.pairingToken).digest('hex')
  wsLogger.debug('ws_connecting', { url: options.websocketUrl, scopeKey: tokenScopeKey.slice(0, 8) })

  return await new Promise((resolve) => {
    const socket = new WebSocket(options.websocketUrl)
    let settled = false
    let authenticated = false

    const timeout = setTimeout(() => {
      wsLogger.warn('ws_timeout', { url: options.websocketUrl })
      settle(timeoutResponse(options.timeoutMessage))
    }, options.timeoutMs)

    socket.once('open', () => {
      socket.send(JSON.stringify(createAuthEnvelope(options.pairingToken)))
    })

    socket.on('message', (data) => {
      let parsed: unknown

      try {
        parsed = JSON.parse(rawDataToString(data))
      } catch {
        settle(invalidResponse())
        return
      }

      const routerError = parseRouterErrorEnvelope(parsed)

      if (!('ignored' in routerError)) {
        settle(routerError)
        return
      }

      if (!authenticated) {
        if (isAuthSuccessEnvelope(parsed)) {
          authenticated = true
          wsLogger.debug('ws_authenticated', { url: options.websocketUrl })
          socket.send(JSON.stringify(targetEnvelope(options)))
          return
        }

        settle(invalidResponse())
        return
      }

      const result = options.parseEnvelope(parsed)

      if ('ignored' in result) {
        return
      }

      settle(result)
    })

    socket.once('error', (error) => {
      wsLogger.error('ws_error', { url: options.websocketUrl, message: error.message })
      settle(connectionFailedResponse(options.websocketUrl))
    })

    socket.once('close', () => {
      if (!settled) {
        wsLogger.warn('ws_closed_unexpectedly', { url: options.websocketUrl })
      }
      settle(connectionFailedResponse(options.websocketUrl))
    })

    function settle (result: BrijioResourceResult<T>): void {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timeout)
      socket.close()
      resolve(result)
    }
  })
}

function targetEnvelope (options: {
  browserInstanceId?: string
  requestEnvelope: {
    type: 'message'
    id?: string
    target?: { browserInstanceId?: string }
    payload: unknown
  }
}): {
    type: 'message'
    id?: string
    target?: { browserInstanceId?: string }
    payload: unknown
  } {
  if (options.browserInstanceId === undefined) {
    return options.requestEnvelope
  }

  return {
    ...options.requestEnvelope,
    target: {
      browserInstanceId: options.browserInstanceId
    }
  }
}

function isAuthSuccessEnvelope (value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'type' in value &&
    value.type === 'message' &&
    'payload' in value &&
    typeof value.payload === 'object' &&
    value.payload !== null &&
    !Array.isArray(value.payload) &&
    'type' in value.payload &&
    value.payload.type === 'auth_success'
  )
}

function createRequestId (): string {
  return `mcp-${Date.now()}-${Math.random().toString(16).slice(2)}`
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
