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
  parseErrorResponse
} from './popup.js'

interface BrowserRuntime {
  sendMessage: (message: unknown) => Promise<unknown>
}

interface BrowserApi {
  runtime: BrowserRuntime
}

declare const browser: BrowserApi

const form = document.querySelector<HTMLFormElement>('#settings-form')
const input = document.querySelector<HTMLInputElement>('#websocket-url')
const connectButton = document.querySelector<HTMLButtonElement>('#connect-button')
const disconnectButton = document.querySelector<HTMLButtonElement>('#disconnect-button')
const status = document.querySelector<HTMLElement>('#status')

if (
  form === null ||
  input === null ||
  connectButton === null ||
  disconnectButton === null ||
  status === null
) {
  throw new Error('BrowserBridge popup is missing required elements.')
}

const settingsForm = form
const websocketUrlInput = input
const connectBtn = connectButton
const disconnectBtn = disconnectButton
const statusMessage = status

void loadSettings()
void updateConnectionStatus()

settingsForm.addEventListener('submit', (event) => {
  event.preventDefault()
  void saveSettings(websocketUrlInput.value)
})

connectBtn.addEventListener('click', () => {
  void connect()
})

disconnectBtn.addEventListener('click', () => {
  void disconnect()
})

async function loadSettings (): Promise<void> {
  try {
    const response = await browser.runtime.sendMessage(createGetSettingsMessage())
    const url = parseSettingsResponse(response)
    if (url !== undefined) {
      websocketUrlInput.value = url
    }
  } catch {
    statusMessage.textContent = 'Failed to load settings.'
  }
}

async function saveSettings (websocketUrl: string): Promise<void> {
  try {
    const response = await browser.runtime.sendMessage(createSaveSettingsMessage(websocketUrl))
    if (
      typeof response === 'object' && response !== null &&
      'ok' in response && (response as { ok: boolean }).ok === true
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
  const websocketUrl = websocketUrlInput.value.trim()

  if (websocketUrl === '') {
    statusMessage.textContent = 'Enter a WebSocket URL before connecting.'
    return
  }

  // Save the URL first, then connect
  await browser.runtime.sendMessage(createSaveSettingsMessage(websocketUrl))

  try {
    const response = await browser.runtime.sendMessage(createConnectMessage())
    if (
      typeof response === 'object' && response !== null &&
      'ok' in response && (response as { ok: boolean }).ok === true
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

async function disconnect (): Promise<void> {
  try {
    const response = await browser.runtime.sendMessage(createDisconnectMessage())
    if (
      typeof response === 'object' && response !== null &&
      'ok' in response && (response as { ok: boolean }).ok === true
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
    const response = await browser.runtime.sendMessage(createGetStatusMessage())
    const connected = parseStatusResponse(response)
    statusMessage.textContent = connected ? 'Status: Connected' : 'Status: Disconnected'
  } catch {
    // Status update is non-critical; leave current text.
  }
}