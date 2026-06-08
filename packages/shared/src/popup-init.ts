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
  statusSpinner: HTMLElement
  statusText: HTMLElement
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
  const statusSpinner = document.querySelector<HTMLElement>('#status-spinner')
  const statusText = document.querySelector<HTMLElement>('#status-text')

  if (
    settingsForm === null ||
    websocketUrlInput === null ||
    pairingTokenInput === null ||
    profileNameInput === null ||
    browserLabelInput === null ||
    connectBtn === null ||
    disconnectBtn === null ||
    statusMessage === null ||
    statusSpinner === null ||
    statusText === null
  ) {
    throw new Error('Brijio popup is missing required elements.')
  }

  return {
    settingsForm,
    websocketUrlInput,
    pairingTokenInput,
    profileNameInput,
    browserLabelInput,
    connectBtn,
    disconnectBtn,
    statusMessage,
    statusSpinner,
    statusText
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
    elements.statusText.textContent = 'Failed to load settings.'
  }
}

async function saveSettings (
  settings: BridgeSettingsForm,
  elements: PopupElements,
  sendMessage: SendMessageFn
): Promise<void> {
  const validationError = validateForm(settings)
  if (validationError !== undefined) {
    elements.statusText.textContent = validationError
    return
  }

  try {
    const response = await sendMessage(createSaveSettingsMessage(settings))
    if (isOkResponse(response)) {
      elements.statusText.textContent = 'Settings saved. Disconnected.'
    } else {
      elements.statusText.textContent = parseErrorResponse(response)
    }
  } catch {
    elements.statusText.textContent = 'Failed to save settings.'
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
    elements.statusText.textContent = 'Enter a WebSocket URL before connecting.'
    return
  }

  // Save current settings first, then connect.
  const saveResponse = await sendMessage(createSaveSettingsMessage(settings))
  if (!isOkResponse(saveResponse)) {
    elements.statusText.textContent = parseErrorResponse(saveResponse)
    return
  }

  try {
    const response = await sendMessage(createConnectMessage())
    if (isOkResponse(response)) {
      elements.statusText.textContent = 'Connecting...'
      applyStatusUI(elements, 'connecting')
      void pollConnectionStatus(elements, sendMessage)
    } else {
      elements.statusText.textContent = parseErrorResponse(response)
    }
  } catch {
    elements.statusText.textContent = 'Failed to connect.'
  }
}

async function disconnect (
  elements: PopupElements,
  sendMessage: SendMessageFn
): Promise<void> {
  try {
    const response = await sendMessage(createDisconnectMessage())
    if (isOkResponse(response)) {
      elements.statusText.textContent = 'Disconnected.'
    } else {
      elements.statusText.textContent = parseErrorResponse(response)
    }
  } catch {
    elements.statusText.textContent = 'Failed to disconnect.'
  }
}

export function formatStatusText (
  state: string,
  lastError?: string,
  reconnectAttempt?: number,
  pendingRequests?: number
): string {
  const pending = pendingRequests !== undefined && pendingRequests > 0
    ? ` (${pendingRequests} request${pendingRequests > 1 ? 's' : ''} in flight)`
    : ''
  switch (state) {
    case 'connected':
      return `Connected${pending}`
    case 'connecting':
      return `Connecting...${pending}`
    case 'reconnecting':
      return reconnectAttempt !== undefined
        ? `Reconnecting (attempt ${reconnectAttempt})...${pending}`
        : `Reconnecting...${pending}`
    case 'error':
      return lastError !== undefined
        ? `Error — ${lastError}`
        : `Error${pending}`
    case 'disconnected':
      return 'Disconnected'
    default:
      return `${state}${pending}`
  }
}

/** Apply state CSS class and spinner visibility based on status fields. */
export function applyStatusUI (
  elements: PopupElements,
  state: string,
  pendingRequests: number = 0
): void {
  // Remove any previous state-* classes
  elements.statusMessage.classList.remove(
    'state-connected', 'state-connecting', 'state-reconnecting',
    'state-error', 'state-disconnected'
  )
  const stateClass = `state-${state}`
  if (stateClass.startsWith('state-')) {
    elements.statusMessage.classList.add(stateClass)
  }

  // Show spinner when connecting, reconnecting, or requests are in flight
  const showSpinner = state === 'connecting' || state === 'reconnecting' || pendingRequests > 0
  if (showSpinner) {
    elements.statusSpinner.classList.remove('hidden')
  } else {
    elements.statusSpinner.classList.add('hidden')
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
      elements.statusText.textContent = 'Status: Unknown'
      return
    }

    const text = formatStatusText(
      statusResult.state,
      statusResult.lastError,
      statusResult.reconnectAttempt,
      statusResult.pendingRequests
    )
    elements.statusText.textContent = `Status: ${text}`
    applyStatusUI(elements, statusResult.state, statusResult.pendingRequests)
  } catch {
    // Status update is non-critical; leave current text.
  }
}

/**
 * Poll connection status after a connect request.
 * Waits 500ms then checks if the state has moved past "connecting".
 * Retries up to 10 times (5 seconds total) while the state is still
 * "connecting" or "reconnecting".
 */
async function pollConnectionStatus (
  elements: PopupElements,
  sendMessage: SendMessageFn,
  maxAttempts: number = 10,
  delayMs: number = 500
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, delayMs))

    try {
      const response = await sendMessage(createGetStatusMessage())
      const statusResult = parseStatusResponse(response)
      if (statusResult === undefined) {
        elements.statusText.textContent = 'Status: Unknown'
        return
      }

      const text = formatStatusText(
        statusResult.state,
        statusResult.lastError,
        statusResult.reconnectAttempt,
        statusResult.pendingRequests
      )
      elements.statusText.textContent = `Status: ${text}`
      applyStatusUI(elements, statusResult.state, statusResult.pendingRequests)

      if (statusResult.state === 'connecting' || statusResult.state === 'reconnecting') {
        continue
      }

      // Reached a terminal state — update and stop polling.
      return
    } catch {
      // Retry on transient errors.
    }
  }
  // If we exhausted retries while still "connecting"/"reconnecting", just leave the current text.
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
