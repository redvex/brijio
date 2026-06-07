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
  pairingToken?: string
  timeoutMs: number
  defaultBrowserInstanceId?: string
  requestPageContext?: (
    options: PageContextRequestOptions
  ) => Promise<BrowserBridgePageContextResult>
  requestPageContent?: (
    options: PageContentRequestOptions
  ) => Promise<BrowserBridgePageContentResult>
}

export function getPageContextConfigFromEnv (
  env: NodeJS.ProcessEnv = process.env,
  warn: (message: string) => void = console.warn
): Omit<BrowserBridgePageContextConfig, 'requestPageContext'> {
  const websocketUrl = resolveRenamedEnv({
    env,
    newName: 'BRIJIO_WS_URL',
    oldNames: ['BROWSERBRIDGE_WEBSOCKET_URL', 'BROWSERBRIDGE_WS_URL', 'WEBSOCKET_URL'],
    defaultValue: 'ws://127.0.0.1:8787',
    warn
  })
  const pairingToken = resolveRenamedEnv({
    env,
    newName: 'BRIJIO_PAIRING_TOKEN',
    oldNames: ['BROWSERBRIDGE_PAIRING_TOKEN', 'BROWSERBRIDGE_TOKEN'],
    defaultValue: '',
    warn
  })
  const defaultBrowserInstanceId = resolveRenamedEnv({
    env,
    newName: 'BRIJIO_BROWSER_INSTANCE_ID',
    oldNames: ['BROWSERBRIDGE_BROWSER_INSTANCE_ID'],
    warn
  })
  const timeoutMs = parseTimeoutMs(resolveRenamedEnv({
    env,
    newName: 'BRIJIO_REQUEST_TIMEOUT_MS',
    oldNames: ['BROWSERBRIDGE_REQUEST_TIMEOUT_MS'],
    warn
  }))

  return {
    websocketUrl,
    pairingToken,
    defaultBrowserInstanceId,
    timeoutMs
  }
}

export async function getCurrentPageContext (
  config: BrowserBridgePageContextConfig,
  browserInstanceId?: string
): Promise<BrowserBridgePageContextResult> {
  const requestPageContext =
    config.requestPageContext ?? defaultRequestPageContext

  return await requestPageContext({
    websocketUrl: config.websocketUrl,
    pairingToken: config.pairingToken ?? '',
    timeoutMs: config.timeoutMs,
    browserInstanceId: browserInstanceId ?? config.defaultBrowserInstanceId
  })
}

export async function getCurrentPageContent (
  config: BrowserBridgePageContextConfig,
  index: number,
  browserInstanceId?: string
): Promise<BrowserBridgePageContentResult> {
  const requestPageContent =
    config.requestPageContent ?? defaultRequestPageContent

  return await requestPageContent({
    websocketUrl: config.websocketUrl,
    pairingToken: config.pairingToken ?? '',
    timeoutMs: config.timeoutMs,
    index,
    browserInstanceId: browserInstanceId ?? config.defaultBrowserInstanceId
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

function resolveRenamedEnv (options: {
  env: NodeJS.ProcessEnv
  newName: string
  oldNames: string[]
  defaultValue?: string
  warn: (message: string) => void
}): string | undefined {
  const newValue = normalizedEnvValue(options.env[options.newName])

  for (const oldName of options.oldNames) {
    const oldValue = normalizedEnvValue(options.env[oldName])

    if (newValue !== undefined && oldValue !== undefined && newValue !== oldValue) {
      options.warn(
        `Both ${options.newName} and ${oldName} are set; preferring ${options.newName}.`
      )
    }
  }

  if (newValue !== undefined) {
    return newValue
  }

  for (const oldName of options.oldNames) {
    const oldValue = normalizedEnvValue(options.env[oldName])

    if (oldValue !== undefined) {
      return oldValue
    }
  }

  return options.defaultValue
}

function normalizedEnvValue (value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined
  }

  return value
}
