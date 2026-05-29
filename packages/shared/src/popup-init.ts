// Shared popup initialisation with dependency injection.
//
// Per ADR 0031, Chrome and Safari popup logic is unified via initPopup.
// Browser-specific code (sendMessage wrapper, entry point) stays in each
// client package. This module provides the shared DOM setup, validation,
// and message flow used by both extensions.

import {
  createGetSettingsMessage,
  createSaveSettingsMessage,
  createConnectMessage,
  createDisconnectMessage,
  createGetStatusMessage
} from './popup-messages.js'

import {
  parseSettingsResponse,
  parseStatusResponse,
  parseErrorResponse
} from './popup-parsers.js'

export interface PopupElements {
  settingsForm: HTMLFormElement
  websocketUrlInput: HTMLInputElement
  pairingTokenInput: HTMLInputElement
  profileNameInput: HTMLInputElement
  browserLabelInput: HTMLInputElement
  connectBtn: HTMLButtonElement
  disconnectBtn: HTMLButtonElement
  statusMessage: HTMLElement
}

export type SendMessageFn = (message: unknown) => Promise<unknown>

export interface BridgeSettingsForm {
  websocketUrl: string
  pairingToken: string
  profileName: string
  label: string
}

export function isOkResponse (response: unknown): boolean {
  if (typeof response !== 'object' || response === null) {
    return false
  }
  return Boolean((response as { ok: boolean }).ok) &&
    typeof (response as { ok: boolean }).ok === 'boolean'
}

export function validateForm (settings: BridgeSettingsForm): string | undefined {
  if (settings.websocketUrl.trim() === '') {
    return 'WebSocket URL is required.'
  }
  if (settings.pairingToken.trim() === '') {
    return 'Pairing token is required.'
  }
  if (settings.profileName.trim() === '') {
    return 'Profile name is required.'
  }
  if (settings.label.trim() === '') {
    return 'Browser label is required.'
  }
  return undefined
}

export function queryPopupElements (document: Document): PopupElements {
  const settingsForm = document.querySelector<HTMLFormElement>('#settings-form')
  const websocketUrlInput = document.querySelector<HTMLInputElement>('#websocket-url')
  const pairingTokenInput = document.querySelector<HTMLInputElement>('#pairing-token')
  const profileNameInput = document.querySelector<HTMLInputElement>('#profile-name')
  const browserLabelInput = document.querySelector<HTMLInputElement>('#browser-label')
  const connectBtn = document.querySelector<HTMLButtonElement>('#connect-button')
  const disconnectBtn = document.querySelector<HTMLButtonElement>('#disconnect-button')
  const statusMessage = document.querySelector<HTMLElement>('#status')

  if (
    settingsForm === null ||
    websocketUrlInput === null ||
    pairingTokenInput === null ||
    profileNameInput === null ||
    browserLabelInput === null ||
    connectBtn === null ||
    disconnectBtn === null ||
    statusMessage === null
  ) {
    throw new Error('BrowserBridge popup is missing required elements.')
  }

  return {
    settingsForm,
    websocketUrlInput,
    pairingTokenInput,
    profileNameInput,
    browserLabelInput,
    connectBtn,
    disconnectBtn,
    statusMessage
  }
}

async function loadSettings (
  elements: PopupElements,
  sendMessage: SendMessageFn
): Promise<void> {
  try {
    const response = await sendMessage(createGetSettingsMessage())
    const settings = parseSettingsResponse(response)
    if (settings?.websocketUrl !== undefined) {
      elements.websocketUrlInput.value = settings.websocketUrl
    }
    if (settings?.pairingToken !== undefined) {
      elements.pairingTokenInput.value = settings.pairingToken
    }
    if (settings?.profileName !== undefined) {
      elements.profileNameInput.value = settings.profileName
    }
    if (settings?.label !== undefined) {
      elements.browserLabelInput.value = settings.label
    }
  } catch {
    elements.statusMessage.textContent = 'Failed to load settings.'
  }
}

async function saveSettings (
  settings: BridgeSettingsForm,
  elements: PopupElements,
  sendMessage: SendMessageFn
): Promise<void> {
  const validationError = validateForm(settings)
  if (validationError !== undefined) {
    elements.statusMessage.textContent = validationError
    return
  }

  try {
    const response = await sendMessage(createSaveSettingsMessage(settings))
    if (isOkResponse(response)) {
      elements.statusMessage.textContent = 'Settings saved. Disconnected.'
    } else {
      elements.statusMessage.textContent = parseErrorResponse(response)
    }
  } catch {
    elements.statusMessage.textContent = 'Failed to save settings.'
  }
}

function readSettingsForm (elements: PopupElements): BridgeSettingsForm {
  return {
    websocketUrl: elements.websocketUrlInput.value,
    pairingToken: elements.pairingTokenInput.value,
    profileName: elements.profileNameInput.value,
    label: elements.browserLabelInput.value
  }
}

async function connect (
  elements: PopupElements,
  sendMessage: SendMessageFn
): Promise<void> {
  const settings = readSettingsForm(elements)

  if (settings.websocketUrl.trim() === '') {
    elements.statusMessage.textContent = 'Enter a WebSocket URL before connecting.'
    return
  }

  // Save current settings first, then connect.
  const saveResponse = await sendMessage(createSaveSettingsMessage(settings))
  if (!isOkResponse(saveResponse)) {
    elements.statusMessage.textContent = parseErrorResponse(saveResponse)
    return
  }

  try {
    const response = await sendMessage(createConnectMessage())
    if (isOkResponse(response)) {
      elements.statusMessage.textContent = 'Connecting...'
    } else {
      elements.statusMessage.textContent = parseErrorResponse(response)
    }
  } catch {
    elements.statusMessage.textContent = 'Failed to connect.'
  }
}

async function disconnect (
  elements: PopupElements,
  sendMessage: SendMessageFn
): Promise<void> {
  try {
    const response = await sendMessage(createDisconnectMessage())
    if (isOkResponse(response)) {
      elements.statusMessage.textContent = 'Disconnected.'
    } else {
      elements.statusMessage.textContent = parseErrorResponse(response)
    }
  } catch {
    elements.statusMessage.textContent = 'Failed to disconnect.'
  }
}

async function updateConnectionStatus (
  elements: PopupElements,
  sendMessage: SendMessageFn
): Promise<void> {
  try {
    const response = await sendMessage(createGetStatusMessage())
    const statusResult = parseStatusResponse(response)
    if (statusResult === undefined) {
      elements.statusMessage.textContent = 'Status: Unknown'
      return
    }

    switch (statusResult.state) {
      case 'connected':
        elements.statusMessage.textContent = 'Status: Connected'
        break
      case 'connecting':
        elements.statusMessage.textContent = 'Status: Connecting...'
        break
      case 'error':
        elements.statusMessage.textContent = statusResult.lastError !== undefined
          ? `Status: Error — ${statusResult.lastError}`
          : 'Status: Error'
        break
      case 'disconnected':
        elements.statusMessage.textContent = 'Status: Disconnected'
        break
      default:
        elements.statusMessage.textContent = `Status: ${statusResult.state}`
    }
  } catch {
    // Status update is non-critical; leave current text.
  }
}

export async function initPopup (
  document: Document,
  sendMessage: SendMessageFn
): Promise<void> {
  const elements = queryPopupElements(document)

  await loadSettings(elements, sendMessage)
  await updateConnectionStatus(elements, sendMessage)

  elements.settingsForm.addEventListener('submit', (event) => {
    event.preventDefault()
    void saveSettings(readSettingsForm(elements), elements, sendMessage)
  })

  elements.connectBtn.addEventListener('click', () => {
    void connect(elements, sendMessage)
  })

  elements.disconnectBtn.addEventListener('click', () => {
    void disconnect(elements, sendMessage)
  })
}
