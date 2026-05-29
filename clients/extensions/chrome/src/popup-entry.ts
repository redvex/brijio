// Chrome popup DOM entry point.
//
// Per ADR 0030, Chrome uses a popup overlay (popup.html) for configuration
// and connection status. This file wires up the DOM elements and delegates
// message construction/parsing to popup.ts.
//
// The initPopup function is exported for testing with injected dependencies.
// In production, it is called immediately with the global chrome and document.

import {
  createGetSettingsMessage,
  createSaveSettingsMessage,
  createConnectMessage,
  createDisconnectMessage,
  createGetStatusMessage,
  parseSettingsResponse,
  parseStatusResponse,
  parseErrorResponse,
  sendMessage
} from './popup.js'

import type { ChromeRuntime } from './popup.js'

export async function initPopup (
  document: Document,
  chromeRuntime: ChromeRuntime
): Promise<void> {
  const form = document.querySelector<HTMLFormElement>('#settings-form')
  const input = document.querySelector<HTMLInputElement>('#websocket-url')
  const tokenInput = document.querySelector<HTMLInputElement>('#pairing-token')
  const profileInput = document.querySelector<HTMLInputElement>('#profile-name')
  const labelInput = document.querySelector<HTMLInputElement>('#browser-label')
  const connectButton = document.querySelector<HTMLButtonElement>('#connect-button')
  const disconnectButton = document.querySelector<HTMLButtonElement>('#disconnect-button')
  const status = document.querySelector<HTMLElement>('#status')

  if (
    form === null ||
    input === null ||
    tokenInput === null ||
    profileInput === null ||
    labelInput === null ||
    connectButton === null ||
    disconnectButton === null ||
    status === null
  ) {
    throw new Error('BrowserBridge popup is missing required elements.')
  }

  const settingsForm = form
  const websocketUrlInput = input
  const pairingTokenInput = tokenInput
  const profileNameInput = profileInput
  const browserLabelInput = labelInput
  const connectBtn = connectButton
  const disconnectBtn = disconnectButton
  const statusMessage = status

  await loadSettings()
  await updateConnectionStatus()

  settingsForm.addEventListener('submit', (event) => {
    event.preventDefault()
    void saveSettings(readSettingsForm())
  })

  connectBtn.addEventListener('click', () => {
    void connect()
  })

  disconnectBtn.addEventListener('click', () => {
    void disconnect()
  })

  async function loadSettings (): Promise<void> {
    try {
      const response = await sendMessage(chromeRuntime, createGetSettingsMessage())
      const settings = parseSettingsResponse(response)
      if (settings?.websocketUrl !== undefined) {
        websocketUrlInput.value = settings.websocketUrl
      }
      if (settings?.pairingToken !== undefined) {
        pairingTokenInput.value = settings.pairingToken
      }
      if (settings?.profileName !== undefined) {
        profileNameInput.value = settings.profileName
      }
      if (settings?.label !== undefined) {
        browserLabelInput.value = settings.label
      }
    } catch {
      statusMessage.textContent = 'Failed to load settings.'
    }
  }

  async function saveSettings (settings: {
    websocketUrl: string
    pairingToken: string
    profileName: string
    label: string
  }): Promise<void> {
    try {
      const response = await sendMessage(chromeRuntime, createSaveSettingsMessage(settings))
      if (
        typeof response === 'object' && response !== null &&
        'ok' in response && (response as { ok: boolean }).ok
      ) {
        statusMessage.textContent = 'Settings saved. Disconnected.'
      } else {
        statusMessage.textContent = parseErrorResponse(response)
      }
    } catch {
      statusMessage.textContent = 'Failed to save settings.'
    }
    void updateConnectionStatus()
  }

  async function connect (): Promise<void> {
    const settings = readSettingsForm()

    if (settings.websocketUrl.trim() === '') {
      statusMessage.textContent = 'Enter a WebSocket URL before connecting.'
      return
    }

    // Save current settings first, then connect.
    const saveResponse = await sendMessage(chromeRuntime, createSaveSettingsMessage(settings))
    if (
      typeof saveResponse !== 'object' ||
      saveResponse === null ||
      !('ok' in saveResponse) ||
      !(saveResponse as { ok: boolean }).ok
    ) {
      statusMessage.textContent = parseErrorResponse(saveResponse)
      return
    }

    try {
      const response = await sendMessage(chromeRuntime, createConnectMessage())
      if (
        typeof response === 'object' && response !== null &&
        'ok' in response && (response as { ok: boolean }).ok
      ) {
        statusMessage.textContent = 'Connecting...'
      } else {
        statusMessage.textContent = parseErrorResponse(response)
      }
    } catch {
      statusMessage.textContent = 'Failed to connect.'
    }
    void updateConnectionStatus()
  }

  function readSettingsForm (): {
    websocketUrl: string
    pairingToken: string
    profileName: string
    label: string
  } {
    return {
      websocketUrl: websocketUrlInput.value,
      pairingToken: pairingTokenInput.value,
      profileName: profileNameInput.value,
      label: browserLabelInput.value
    }
  }

  async function disconnect (): Promise<void> {
    try {
      const response = await sendMessage(chromeRuntime, createDisconnectMessage())
      if (
        typeof response === 'object' && response !== null &&
        'ok' in response && (response as { ok: boolean }).ok
      ) {
        statusMessage.textContent = 'Disconnected.'
      } else {
        statusMessage.textContent = parseErrorResponse(response)
      }
    } catch {
      statusMessage.textContent = 'Failed to disconnect.'
    }
    void updateConnectionStatus()
  }

  async function updateConnectionStatus (): Promise<void> {
    try {
      const response = await sendMessage(chromeRuntime, createGetStatusMessage())
      const statusResult = parseStatusResponse(response)
      if (statusResult === undefined) {
        statusMessage.textContent = 'Status: Unknown'
        return
      }

      if (statusResult.state === 'connected') {
        statusMessage.textContent = 'Status: Connected'
      } else if (statusResult.state === 'connecting') {
        statusMessage.textContent = 'Status: Connecting...'
      } else if (statusResult.state === 'error') {
        statusMessage.textContent = statusResult.lastError !== undefined
          ? `Status: Error — ${statusResult.lastError}`
          : 'Status: Error'
      } else {
        statusMessage.textContent = 'Status: Disconnected'
      }
    } catch {
      // Status update is non-critical; leave current text.
    }
  }
}

// Production entry: initialise with real Chrome globals.
//
// This self-executing block only runs when loaded as a browser <script>.
// In tests, initPopup is called directly with injected dependencies.
declare const chrome: ChromeRuntime

if (typeof (globalThis as { document?: unknown }).document !== 'undefined') {
  void initPopup((globalThis as { document: Document }).document, chrome)
}