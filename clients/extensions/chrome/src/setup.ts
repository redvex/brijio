import { requestRegularPageAccess } from './permissions.js'

interface RuntimeResponse {
  ok?: unknown
  data?: {
    websocketUrl?: unknown
  }
  error?: {
    message?: unknown
  }
}

interface ChromeApi {
  permissions: {
    contains: (permissions: { origins: string[] }) => Promise<boolean>
    request: (permissions: { origins: string[] }) => Promise<boolean>
  }
  runtime: {
    sendMessage: (message: unknown) => Promise<RuntimeResponse>
  }
}

declare const chrome: ChromeApi

const form = document.querySelector<HTMLFormElement>('#settings-form')
const input = document.querySelector<HTMLInputElement>('#websocket-url')
const regularPageAccessButton = document.querySelector<HTMLButtonElement>(
  '#regular-page-access'
)
const status = document.querySelector<HTMLElement>('#status')

if (
  form === null ||
  input === null ||
  regularPageAccessButton === null ||
  status === null
) {
  throw new Error('BrowserBridge setup page is missing required elements.')
}

const settingsForm = form
const websocketUrlInput = input
const regularPageAccess = regularPageAccessButton
const statusMessage = status

void loadSettings()

settingsForm.addEventListener('submit', (event) => {
  event.preventDefault()
  void saveSettings(websocketUrlInput.value)
})

regularPageAccess.addEventListener('click', () => {
  void enableRegularPageAccess()
})

async function loadSettings (): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: 'get_settings' })

  if (
    response.ok === true &&
    typeof response.data?.websocketUrl === 'string'
  ) {
    websocketUrlInput.value = response.data.websocketUrl
  }
}

async function saveSettings (websocketUrl: string): Promise<void> {
  const response = await chrome.runtime.sendMessage({
    type: 'save_settings',
    websocketUrl
  })

  if (response.ok === true) {
    statusMessage.textContent =
      'Saved. Use the extension toolbar button to start or stop the bridge.'
    return
  }

  statusMessage.textContent =
    typeof response.error?.message === 'string'
      ? response.error.message
      : 'Unable to save settings.'
}

async function enableRegularPageAccess (): Promise<void> {
  const granted = await requestRegularPageAccess(chrome.permissions)

  statusMessage.textContent = granted
    ? 'Regular page access enabled for HTTP and HTTPS pages.'
    : 'Regular page access was not enabled.'
}
