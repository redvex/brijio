export interface EditableBridgeSettings {
  websocketUrl?: string
  pairingToken?: string
  profileName?: string
  label?: string
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

export function parseStatusResponse (response: unknown): { state: string, lastError?: string, reconnectAttempt?: number, pendingRequests?: number } | undefined {
  if (
    typeof response === 'object' && response !== null &&
    'ok' in response && Boolean((response as { ok: boolean }).ok) &&
    'data' in response &&
    typeof (response as { data: unknown }).data === 'object' &&
    (response as { data: unknown }).data !== null &&
    typeof (response as { data: { state: unknown } }).data.state === 'string'
  ) {
    const data = (response as { data: { state: string, lastError?: string, reconnectAttempt?: number, pendingRequests?: number } }).data
    return {
      state: data.state,
      lastError: data.lastError,
      reconnectAttempt: data.reconnectAttempt,
      pendingRequests: data.pendingRequests
    }
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
