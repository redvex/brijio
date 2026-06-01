export function createGetSettingsMessage (): { type: 'get_settings' } {
  return { type: 'get_settings' }
}

export function createSaveSettingsMessage (settings: {
  websocketUrl: string
  pairingToken: string
  profileName: string
  label: string
}): { type: 'save_settings', websocketUrl: string, pairingToken: string, profileName: string, label: string } {
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
