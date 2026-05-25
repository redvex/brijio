import WebSocket, { type RawData } from 'ws'
import {
  type BrowserBridgePageContentResult,
  type BrowserBridgePageContextResult,
  type BrowserBridgeResourceResult,
  connectionFailedResponse,
  createGetPageContentEnvelope,
  createGetPageContextEnvelope,
  invalidResponse,
  parsePageContentEnvelope,
  parsePageContextEnvelope,
  timeoutResponse
} from './protocol.js'

export interface PageContextRequestOptions {
  websocketUrl: string
  timeoutMs: number
  createRequestId?: () => string
}

export interface PageContentRequestOptions extends PageContextRequestOptions {
  index: number
}

export async function requestPageContext (
  options: PageContextRequestOptions
): Promise<BrowserBridgePageContextResult> {
  const requestId = options.createRequestId?.() ?? createRequestId()

  return await requestBrowserBridge({
    websocketUrl: options.websocketUrl,
    timeoutMs: options.timeoutMs,
    requestEnvelope: createGetPageContextEnvelope(requestId),
    parseEnvelope: (value) => parsePageContextEnvelope(value, requestId)
  })
}

export async function requestPageContent (
  options: PageContentRequestOptions
): Promise<BrowserBridgePageContentResult> {
  const requestId = options.createRequestId?.() ?? createRequestId()

  return await requestBrowserBridge({
    websocketUrl: options.websocketUrl,
    timeoutMs: options.timeoutMs,
    requestEnvelope: createGetPageContentEnvelope(requestId, options.index),
    parseEnvelope: (value) => parsePageContentEnvelope(value, requestId)
  })
}

async function requestBrowserBridge<T> (options: {
  websocketUrl: string
  timeoutMs: number
  requestEnvelope: unknown
  parseEnvelope: (
    value: unknown
  ) => BrowserBridgeResourceResult<T> | { ok: false, ignored: true }
}): Promise<BrowserBridgeResourceResult<T>> {
  return await new Promise((resolve) => {
    const socket = new WebSocket(options.websocketUrl)
    let settled = false

    const timeout = setTimeout(() => {
      settle(timeoutResponse())
    }, options.timeoutMs)

    socket.once('open', () => {
      socket.send(JSON.stringify(options.requestEnvelope))
    })

    socket.on('message', (data) => {
      let parsed: unknown

      try {
        parsed = JSON.parse(rawDataToString(data))
      } catch {
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
