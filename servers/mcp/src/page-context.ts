import {
  type BrowserBridgePageContentResult,
  type BrowserBridgePageContextResult,
  invalidResourceUriResponse
} from './protocol.js'
import {
  requestPageContent as defaultRequestPageContent,
  requestPageContext as defaultRequestPageContext,
  type PageContentRequestOptions,
  type PageContextRequestOptions
} from './websocket-client.js'

export interface BrowserBridgePageContextConfig {
  websocketUrl: string
  timeoutMs: number
  requestPageContext?: (
    options: PageContextRequestOptions
  ) => Promise<BrowserBridgePageContextResult>
  requestPageContent?: (
    options: PageContentRequestOptions
  ) => Promise<BrowserBridgePageContentResult>
}

export function getPageContextConfigFromEnv (
  env: NodeJS.ProcessEnv = process.env
): Omit<BrowserBridgePageContextConfig, 'requestPageContext'> {
  return {
    websocketUrl:
      env.BROWSERBRIDGE_WEBSOCKET_URL ?? env.WEBSOCKET_URL ?? 'ws://127.0.0.1:8787',
    timeoutMs: parseTimeoutMs(env.BROWSERBRIDGE_REQUEST_TIMEOUT_MS)
  }
}

export async function getCurrentPageContext (
  config: BrowserBridgePageContextConfig
): Promise<BrowserBridgePageContextResult> {
  const requestPageContext =
    config.requestPageContext ?? defaultRequestPageContext

  return await requestPageContext({
    websocketUrl: config.websocketUrl,
    timeoutMs: config.timeoutMs
  })
}

export async function getCurrentPageContent (
  config: BrowserBridgePageContextConfig,
  index: number
): Promise<BrowserBridgePageContentResult> {
  const requestPageContent =
    config.requestPageContent ?? defaultRequestPageContent

  return await requestPageContent({
    websocketUrl: config.websocketUrl,
    timeoutMs: config.timeoutMs,
    index
  })
}

export function parsePageContentResourceIndex (
  resourceUri: string
): number | BrowserBridgePageContentResult {
  const match = /^browser:\/\/page\/current\/content\/([^/]+)$/.exec(resourceUri)

  if (match === null) {
    return invalidResourceUriResponse()
  }

  const index = Number.parseInt(match[1], 10)

  if (!/^[1-9]\d*$/.test(match[1]) || !Number.isSafeInteger(index)) {
    return invalidResourceUriResponse()
  }

  return index
}

function parseTimeoutMs (value: string | undefined): number {
  if (value === undefined) {
    return 5000
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 5000
  }

  return parsed
}
