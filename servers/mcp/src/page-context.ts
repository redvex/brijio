import {
  type BrijioPageContentResult,
  type BrijioPageContextResult,
  invalidResourceUriResponse
} from './protocol.js'
import {
  requestPageContent as defaultRequestPageContent,
  requestPageContext as defaultRequestPageContext,
  type PageContentRequestOptions,
  type PageContextRequestOptions
} from './websocket-client.js'

export interface BrijioPageContextConfig {
  websocketUrl: string
  pairingToken?: string
  timeoutMs: number
  defaultBrowserInstanceId?: string
  requestPageContext?: (
    options: PageContextRequestOptions
  ) => Promise<BrijioPageContextResult>
  requestPageContent?: (
    options: PageContentRequestOptions
  ) => Promise<BrijioPageContentResult>
}

export function getPageContextConfigFromEnv (
  env: NodeJS.ProcessEnv = process.env,
  warn: (message: string) => void = console.warn
): Omit<BrijioPageContextConfig, 'requestPageContext'> {
  const websocketUrl = resolveRenamedEnv({
    env,
    newName: 'BRIJIO_WS_URL',
    oldNames: ['BROWSERBRIDGE_WEBSOCKET_URL', 'BRIJIO_WEBSOCKET_URL', 'WEBSOCKET_URL'],
    defaultValue: 'ws://127.0.0.1:8787',
    warn
  }) ?? 'ws://127.0.0.1:8787'
  const pairingToken = resolveRenamedEnv({
    env,
    newName: 'BRIJIO_PAIRING_TOKEN',
    oldNames: ['BROWSERBRIDGE_PAIRING_TOKEN', 'BRIJIO_TOKEN'],
    defaultValue: '',
    warn
  }) ?? ''
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
    timeoutMs,
    ...(defaultBrowserInstanceId !== undefined
      ? { defaultBrowserInstanceId }
      : {})
  }
}

export async function getCurrentPageContext (
  config: BrijioPageContextConfig,
  browserInstanceId?: string
): Promise<BrijioPageContextResult> {
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
  config: BrijioPageContextConfig,
  index: number,
  browserInstanceId?: string
): Promise<BrijioPageContentResult> {
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
): number | BrijioPageContentResult {
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
