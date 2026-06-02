import { type BrowserBridgeBrowserListResult } from './protocol.js'
import { type BrowserBridgePageContextConfig } from './page-context.js'
import { requestBrowserList as defaultRequestBrowserList } from './websocket-client.js'

export async function listBrowsers (
  config: BrowserBridgePageContextConfig
): Promise<BrowserBridgeBrowserListResult> {
  return await defaultRequestBrowserList({
    websocketUrl: config.websocketUrl,
    pairingToken: config.pairingToken ?? '',
    timeoutMs: config.timeoutMs
  })
}
