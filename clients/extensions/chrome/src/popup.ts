// Chrome popup message helpers.
//
// Per ADR 0030, Chrome uses a popup overlay (popup.html) for configuration
// and connection status. This file provides message creation and response
// parsing helpers.
//
// Chrome's chrome.runtime.sendMessage() returns a Promise in MV3.
// The sendMessage wrapper here uses the promise-based API directly.

export interface EditableBridgeSettings {
  websocketUrl?: string
  pairingToken?: string
  profileName?: string
  label?: string
}

export interface RequiredEditableBridgeSettings {
  websocketUrl: string
  pairingToken: string
  profileName: string
  label: string
}

export interface ChromeRuntime {
  runtime: {
    sendMessage: (message: unknown) => Promise<unknown>
  }
}

export function createGetSettingsMessage (): { type: 'get_settings' } {
  return { type: 'get_settings' }
}

export function createSaveSettingsMessage (
  settings: RequiredEditableBridgeSettings
): {
    type: 'save_settings'
    websocketUrl: string
    pairingToken: string
    profileName: string
    label: string
  } {
  return {
    type: 'save_settings',
    websocketUrl: settings.websocketUrl,
    pairingToken: settings.pairingToken,
    profileName: settings.profileName,
    label: settings.label
  }
}

export function createConnectMessage (): { type: 'connect' } {
  return { type: 'connect' }
}

export function createDisconnectMessage (): { type: 'disconnect' } {
  return { type: 'disconnect' }
}

export function createGetStatusMessage (): { type: 'get_status' } {
  return { type: 'get_status' }
}

/**
 * Send a message to the background script and return a Promise with the response.
 *
 * Chrome's chrome.runtime.sendMessage() returns a Promise natively in MV3.
 */
export async function sendMessage (chromeRuntime: ChromeRuntime, message: unknown): Promise<unknown> {
  return await chromeRuntime.runtime.sendMessage(message)
}

export function parseSettingsResponse (response: unknown): EditableBridgeSettings | undefined {
  if (
    typeof response === 'object' && response !== null &&
    'ok' in response && Boolean((response as { ok: boolean }).ok) &&
    'data' in response &&
    typeof (response as { data: unknown }).data === 'object' &&
    (response as { data: unknown }).data !== null
  ) {
    const data = (response as { data: Record<string, unknown> }).data
    const settings: EditableBridgeSettings = {}

    if (typeof data.websocketUrl === 'string') {
      settings.websocketUrl = data.websocketUrl
    }

    if (typeof data.pairingToken === 'string') {
      settings.pairingToken = data.pairingToken
    }

    if (typeof data.profileName === 'string') {
      settings.profileName = data.profileName
    }

    if (typeof data.label === 'string') {
      settings.label = data.label
    }

    if (Object.keys(settings).length > 0) {
      return settings
    }
  }
  return undefined
}

export function parseStatusResponse (response: unknown): { state: string, lastError?: string } | undefined {
  if (
    typeof response === 'object' && response !== null &&
    'ok' in response && Boolean((response as { ok: boolean }).ok) &&
    'data' in response &&
    typeof (response as { data: unknown }).data === 'object' &&
    (response as { data: unknown }).data !== null &&
    typeof (response as { data: { state: unknown } }).data.state === 'string'
  ) {
    const data = (response as { data: { state: string, lastError?: string } }).data
    return { state: data.state, lastError: data.lastError }
  }
  return undefined
}

export function parseErrorResponse (response: unknown): string {
  if (
    typeof response === 'object' && response !== null &&
    'error' in response && typeof ((response as { error: { message: string } }).error?.message) === 'string'
  ) {
    return (response as { error: { message: string } }).error.message
  }
  return 'An unknown error occurred.'
}
