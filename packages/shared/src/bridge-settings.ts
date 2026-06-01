import type { BridgeSettings } from './background-controller.js'

export function stringValue (value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

export function requireString (value: unknown, label: string): string {
  const normalized = stringValue(value)

  if (normalized === undefined) {
    throw new Error(`${label} is required.`)
  }

  return normalized
}

export function createBrowserInstanceId (browserName: string): string {
  return `${browserName.toLowerCase()}-${crypto.randomUUID()}`
}

export function normalizeBridgeSettings (
  values: Record<string, unknown>,
  defaultBrowserName: string
): BridgeSettings | undefined {
  const websocketUrl = stringValue(values.websocketUrl)
  const pairingToken = stringValue(values.pairingToken)
  const browserInstanceId = stringValue(values.browserInstanceId)
  const browserName = stringValue(values.browserName) ?? defaultBrowserName
  const profileName = stringValue(values.profileName) ?? 'Default'
  const label = stringValue(values.label) ?? `${browserName} ${profileName}`

  if (
    websocketUrl === undefined ||
    pairingToken === undefined ||
    browserInstanceId === undefined
  ) {
    return undefined
  }

  return {
    websocketUrl,
    pairingToken,
    browserInstanceId,
    browserName,
    profileName,
    label
  }
}
