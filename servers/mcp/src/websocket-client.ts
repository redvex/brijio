import WebSocket, { type RawData } from 'ws'
import {
  type BrowserBridgeClickElementResult,
  type BrowserBridgeBrowserListResult,
  type BrowserBridgeFillInputResult,
  type BrowserBridgePageContentResult,
  type BrowserBridgePageContextResult,
  type BrowserBridgeResourceResult,
  type BrowserBridgeSelectOptionsResult,
  type BrowserBridgeSetCheckedResult,
  type BrowserBridgeSubmitFormResult,
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
): Promise<BrowserBridgePageContextResult> {
  const requestId = options.createRequestId?.() ?? createRequestId()

  return await requestBrowserBridge({
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
): Promise<BrowserBridgePageContentResult> {
  const requestId = options.createRequestId?.() ?? createRequestId()

  return await requestBrowserBridge({
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
): Promise<BrowserBridgeClickElementResult> {
  const requestId = options.createRequestId?.() ?? createRequestId()

  return await requestBrowserBridge({
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
): Promise<BrowserBridgeFillInputResult> {
  const requestId = options.createRequestId?.() ?? createRequestId()

  return await requestBrowserBridge({
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
): Promise<BrowserBridgeFillInputResult> {
  const requestId = options.createRequestId?.() ?? createRequestId()

  return await requestBrowserBridge({
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
): Promise<BrowserBridgeSetCheckedResult> {
  const requestId = options.createRequestId?.() ?? createRequestId()

  return await requestBrowserBridge({
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
): Promise<BrowserBridgeSelectOptionsResult> {
  const requestId = options.createRequestId?.() ?? createRequestId()

  return await requestBrowserBridge({
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
): Promise<BrowserBridgeSubmitFormResult> {
  const requestId = options.createRequestId?.() ?? createRequestId()

  return await requestBrowserBridge({
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
}): Promise<BrowserBridgeBrowserListResult> {
  const requestId = options.createRequestId?.() ?? createRequestId()

  return await requestBrowserBridge({
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
): BrowserBridgeClickElementResult | { ok: false, ignored: true } {
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
): BrowserBridgeFillInputResult | { ok: false, ignored: true } {
  return parseWriteTextActionResultEnvelope(value, requestId)
}

function parseWriteTextActionResultEnvelope (
  value: unknown,
  requestId: string
): BrowserBridgeFillInputResult | { ok: false, ignored: true } {
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
): BrowserBridgeSetCheckedResult | { ok: false, ignored: true } {
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
): BrowserBridgeSelectOptionsResult | { ok: false, ignored: true } {
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
): BrowserBridgeSubmitFormResult | { ok: false, ignored: true } {
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

async function requestBrowserBridge<T> (options: {
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
  ) => BrowserBridgeResourceResult<T> | { ok: false, ignored: true }
}): Promise<BrowserBridgeResourceResult<T>> {
  if (options.pairingToken.trim() === '') {
    return authRequiredResponse()
  }

  return await new Promise((resolve) => {
    const socket = new WebSocket(options.websocketUrl)
    let settled = false
    let authenticated = false

    const timeout = setTimeout(() => {
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

    socket.once('error', () => {
      settle(connectionFailedResponse(options.websocketUrl))
    })

    socket.once('close', () => {
      settle(connectionFailedResponse(options.websocketUrl))
    })

    function settle (result: BrowserBridgeResourceResult<T>): void {
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
