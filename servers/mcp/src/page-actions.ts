import {
  type BrowserBridgeClickElementResult,
  type BrowserBridgeFillInputResult,
  type ClickElementTarget,
  type FillInputTarget
} from './protocol.js'
import {
  requestClickElement as defaultRequestClickElement,
  type ClickElementRequestOptions,
  requestFillInput as defaultRequestFillInput,
  type FillInputRequestOptions
} from './websocket-client.js'

export interface BrowserBridgePageActionsConfig {
  websocketUrl: string
  timeoutMs: number
  requestClickElement?: (
    options: ClickElementRequestOptions
  ) => Promise<BrowserBridgeClickElementResult>
  requestFillInput?: (
    options: FillInputRequestOptions
  ) => Promise<BrowserBridgeFillInputResult>
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

export async function fillCurrentPageInput (
  config: BrowserBridgePageActionsConfig,
  target: FillInputTarget,
  text: string
): Promise<BrowserBridgeFillInputResult> {
  const requestFillInput = config.requestFillInput ?? defaultRequestFillInput

  return await requestFillInput({
    websocketUrl: config.websocketUrl,
    timeoutMs: config.timeoutMs,
    target,
    text
  })
}
