// Safari popup message helpers.
//
// Per ADR 0019, Safari uses a popup overlay (popup.html) instead of Chrome's
// setup page. This file provides message creation and response parsing helpers.
//
// Safari's browser.runtime.sendMessage() does not return a Promise in MV2.
// The sendMessage wrapper here promisifies the callback-based API.

import type { BrowserApi } from './popup-entry.js'

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
 * Safari's browser.runtime.sendMessage() uses a callback pattern in MV2,
 * not a promise-based API. This wrapper promisifies it for async/await usage.
 */
export async function sendMessage (browser: BrowserApi, message: unknown): Promise<unknown> {
  return await new Promise((resolve) => {
    browser.runtime.sendMessage(message, undefined, (response: unknown) => {
      resolve(response)
    })
  })
}

export function parseSettingsResponse (response: unknown): EditableBridgeSettings | undefined {
  if (
    typeof response === 'object' && response !== null &&
    'ok' in response && Boolean((response as unknown as { ok: boolean }).ok) &&
    'data' in response &&
    typeof (response as unknown as { data: unknown }).data === 'object' &&
    (response as unknown as { data: unknown }).data !== null
  ) {
    const data = (response as unknown as { data: Record<string, unknown> }).data
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

export function parseStatusResponse (response: unknown): boolean {
  if (
    typeof response === 'object' && response !== null &&
    'ok' in response && Boolean((response as unknown as { ok: boolean }).ok) &&
    'data' in response && typeof ((response as unknown as { data: { connected: boolean } }).data?.connected) === 'boolean'
  ) {
    const data: { connected: boolean } | undefined = (response as unknown as { data: { connected: boolean } }).data
    if (data != null) {
      return data.connected
    }
  }
  return false
}

export function parseErrorResponse (response: unknown): string {
  if (
    typeof response === 'object' && response !== null &&
    'error' in response && typeof ((response as unknown as { error: { message: string } }).error?.message) === 'string'
  ) {
    return (response as unknown as { error: { message: string } }).error.message
  }
  return 'An unknown error occurred.'
}
