// Safari popup DOM entry point.
//
// Per ADR 0019, Safari uses a popup overlay (popup.html) instead of
// Chrome's setup page (opened as a new tab). This file wires up the DOM
// elements and delegates message construction/parsing to popup.ts.

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

export interface BrowserRuntime {
  sendMessage: (message: unknown, options?: unknown, callback?: (response: unknown) => void) => void
}

export interface BrowserApi {
  runtime: BrowserRuntime
}

declare const browser: BrowserApi

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

void loadSettings()
void updateConnectionStatus()

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
    const response = await sendMessage(browser, createGetSettingsMessage())
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
    const response = await sendMessage(browser, createSaveSettingsMessage(settings))
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
  const saveResponse = await sendMessage(browser, createSaveSettingsMessage(settings))
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
    const response = await sendMessage(browser, createConnectMessage())
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
    const response = await sendMessage(browser, createDisconnectMessage())
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
    const response = await sendMessage(browser, createGetStatusMessage())
    const connected = parseStatusResponse(response)
    statusMessage.textContent = connected ? 'Status: Connected' : 'Status: Disconnected'
  } catch {
    // Status update is non-critical; leave current text.
  }
}
