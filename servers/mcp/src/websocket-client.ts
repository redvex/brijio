import WebSocket, { type RawData } from 'ws'
import {
  type BrowserBridgeToolResult,
  connectionFailedResponse,
  createGetPageContextEnvelope,
  invalidResponse,
  parsePageContextEnvelope,
  timeoutResponse
} from './protocol.js'

export interface PageContextRequestOptions {
  websocketUrl: string
  timeoutMs: number
  createRequestId?: () => string
}

export async function requestPageContext (
  options: PageContextRequestOptions
): Promise<BrowserBridgeToolResult> {
  const requestId = options.createRequestId?.() ?? createRequestId()

  return await new Promise((resolve) => {
    const socket = new WebSocket(options.websocketUrl)
    let settled = false

    const timeout = setTimeout(() => {
      settle(timeoutResponse())
    }, options.timeoutMs)

    socket.once('open', () => {
      socket.send(JSON.stringify(createGetPageContextEnvelope(requestId)))
    })

    socket.on('message', (data) => {
      let parsed: unknown

      try {
        parsed = JSON.parse(rawDataToString(data))
      } catch {
        settle(invalidResponse())
        return
      }

      const result = parsePageContextEnvelope(parsed, requestId)

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

    function settle (result: BrowserBridgeToolResult): void {
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
