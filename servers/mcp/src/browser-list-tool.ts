import { type BrijioBrowserListResult } from './protocol.js'
import { type BrijioPageContextConfig } from './page-context.js'
import { requestBrowserList as defaultRequestBrowserList } from './websocket-client.js'

export async function listBrowsers (
  config: BrijioPageContextConfig
): Promise<BrijioBrowserListResult> {
  return await defaultRequestBrowserList({
    websocketUrl: config.websocketUrl,
    pairingToken: config.pairingToken ?? '',
    timeoutMs: config.timeoutMs
  })
}
