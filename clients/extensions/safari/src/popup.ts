// Safari popup message handling logic for BrowserBridge.
//
// Per ADR 0019, Safari uses a popup overlay (popup.html) instead of
// Chrome's setup page (opened as a new tab). These functions construct
// and parse messages sent to the background script using the browser.* namespace.
// This module contains only pure functions for testability; the DOM-side
// entry point lives in popup-entry.ts.

// --- Types ---

interface SettingsResponse {
  ok?: boolean
  data?: {
    websocketUrl?: string
  }
  error?: {
    message?: string
  }
}

interface StatusResponse {
  ok?: boolean
  data?: {
    connected?: boolean
  }
  error?: {
    message?: string
  }
}

// --- Message constructors ---

export function createGetSettingsMessage (): { type: string } {
  return { type: 'get_settings' }
}

export function createSaveSettingsMessage (websocketUrl: string): { type: string, websocketUrl: string } {
  return { type: 'save_settings', websocketUrl }
}

export function createConnectMessage (): { type: string } {
  return { type: 'connect' }
}

export function createDisconnectMessage (): { type: string } {
  return { type: 'disconnect' }
}

export function createGetStatusMessage (): { type: string } {
  return { type: 'get_status' }
}

// --- Response parsers ---

export function parseSettingsResponse (response: unknown): string | undefined {
  if (
    typeof response === 'object' && response !== null &&
    'ok' in response && (response as SettingsResponse).ok === true &&
    typeof (response as SettingsResponse).data?.websocketUrl === 'string'
  ) {
    return (response as SettingsResponse).data.websocketUrl as string
  }
  return undefined
}

export function parseStatusResponse (response: unknown): boolean {
  if (
    typeof response === 'object' && response !== null &&
    'ok' in response && (response as StatusResponse).ok === true &&
    typeof (response as StatusResponse).data?.connected === 'boolean'
  ) {
    return (response as StatusResponse).data.connected as boolean
  }
  return false
}

export function parseErrorResponse (response: unknown): string {
  if (
    typeof response === 'object' && response !== null &&
    'error' in response &&
    typeof (response as { error: { message?: string } }).error?.message === 'string'
  ) {
    return (response as { error: { message: string } }).error.message
  }
  return 'An unknown error occurred.'
}
