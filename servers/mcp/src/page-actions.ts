import {
  type BrowserBridgeClickElementResult,
  type ClickElementTarget
} from './protocol.js'
import {
  requestClickElement as defaultRequestClickElement,
  type ClickElementRequestOptions
} from './websocket-client.js'

export interface BrowserBridgePageActionsConfig {
  websocketUrl: string
  timeoutMs: number
  requestClickElement?: (
    options: ClickElementRequestOptions
  ) => Promise<BrowserBridgeClickElementResult>
}

export async function clickCurrentPageElement (
  config: BrowserBridgePageActionsConfig,
  target: ClickElementTarget
): Promise<BrowserBridgeClickElementResult> {
  const requestClickElement =
    config.requestClickElement ?? defaultRequestClickElement

  return await requestClickElement({
    websocketUrl: config.websocketUrl,
    timeoutMs: config.timeoutMs,
    target
  })
}
