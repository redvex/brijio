import { type BrowserBridgePageContextResult } from './protocol.js'
import {
  requestPageContext as defaultRequestPageContext,
  type PageContextRequestOptions
} from './websocket-client.js'

export interface BrowserBridgePageContextConfig {
  websocketUrl: string
  timeoutMs: number
  requestPageContext?: (
    options: PageContextRequestOptions
  ) => Promise<BrowserBridgePageContextResult>
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
