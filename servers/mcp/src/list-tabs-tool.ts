import { type BrijioTabListResult } from './protocol.js'
import { type BrijioPageContextConfig } from './page-context.js'
import { requestListTabs as defaultRequestListTabs } from './websocket-client.js'

export async function listTabs (
  config: BrijioPageContextConfig
): Promise<BrijioTabListResult> {
  return await defaultRequestListTabs({
    websocketUrl: config.websocketUrl,
    pairingToken: config.pairingToken ?? '',
    timeoutMs: config.timeoutMs
  })
}