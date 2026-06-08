import {
  BrijioBackgroundController,
  type BridgeSettings,
  type ClickActionTarget,
  createGlobalTimers,
  defaultPageContentMaxPayloadBytes,
  type PageActionResult,
  type BrijioSocket,
  type PageNavigationResult,
  type WriteTextEditableTarget,
  type WriteTextActionTarget,
  type FormSubmitTarget,
  stringValue,
  requireString,
  createBrowserInstanceId,
  normalizeBridgeSettings,
  readActiveTabPage as sharedReadActiveTabPage,
  performActiveTabAction as sharedPerformActiveTabAction,
  type ActiveTabDeps
} from '@brijio/shared'
import { isRegularPageUrl } from './permissions.js'

interface RuntimeMessage {
  type?: unknown
  websocketUrl?: unknown
  pairingToken?: unknown
  browserInstanceId?: unknown
  browserName?: unknown
  profileName?: unknown
  label?: unknown
}

type SendResponse = (response: unknown) => void
type MessageListener = (event: { data: string }) => void | Promise<void>

export interface ChromeApi {
  action: {
    setBadgeText: (details: { text: string }) => Promise<void>
    setBadgeBackgroundColor: (details: { color: string }) => Promise<void>
    setBadgeTextColor: (details: { color: string }) => Promise<void>
    setTitle: (details: { title: string }) => Promise<void>
  }
  runtime: {
    getURL: (path: string) => string
    onMessage: {
      addListener: (
        callback: (
          message: RuntimeMessage,
          sender: unknown,
          sendResponse: SendResponse,
        ) => boolean | undefined,
      ) => void
    }
  }
  storage: {
    local: {
      get: (keys: string[]) => Promise<Record<string, unknown>>
      set: (items: Record<string, unknown>) => Promise<void>
    }
  }
  scripting: {
    executeScript: (details: {
      target: { tabId: number }
      files: string[]
    }) => Promise<unknown>
  }
  tabs: {
    create: (properties: { url: string }) => Promise<unknown>
    query: (queryInfo: { active: boolean, currentWindow: boolean }) => Promise<
    Array<{
      id?: number
      title?: string
      url?: string
    }>
    >
    sendMessage: (tabId: number, message: unknown) => Promise<unknown>
    update: (tabId: number, updateProperties: { url: string }) => Promise<
    { id?: number, title?: string, url?: string }
    >
  }
}

declare const chrome: ChromeApi

const chromeDeps: ActiveTabDeps = {
  get tabs () {
    return chrome.tabs
  },
  get scripting () {
    return chrome.scripting
  },
  isRegularPageUrl
}

const bridgeSettingsKeys = [
  'websocketUrl',
  'pairingToken',
  'browserInstanceId',
  'browserName',
  'profileName',
  'label'
]
const previewMaxBytes = 4096
const maxContentBytes = 120000

const controller = new BrijioBackgroundController({
  action: {
    async setBadgeText (text) {
      await chrome.action.setBadgeText({ text })
    },
    async setBadgeColor (color) {
      await chrome.action.setBadgeBackgroundColor({ color })
    },
    async setBadgeTextColor (color) {
      await chrome.action.setBadgeTextColor({ color })
    },
    async setTitle (title) {
      await chrome.action.setTitle({ title })
    }
  },
  createWebSocket (url) {
    return new DomWebSocketAdapter(new WebSocket(url))
  },
  setup: {
    async openSetupPage () {
      await chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') })
    }
  },
  storage: {
    async getBridgeSettings () {
      const values = await chrome.storage.local.get(bridgeSettingsKeys)

      return normalizeBridgeSettings(values, 'Chrome')
    },
    async setBridgeSettings (settings) {
      await chrome.storage.local.set({ ...settings })
    }
  },
  pageReader: {
    async getPageContext () {
      return await sharedReadActiveTabPage(
        {
          type: 'extract_page_context',
          previewMaxBytes,
          defaultMaxPayloadBytes: defaultPageContentMaxPayloadBytes
        },
        chromeDeps
      )
    },
    async getPageContent (index) {
      return await sharedReadActiveTabPage(
        {
          type: 'extract_page_content',
          index,
          maxContentBytes,
          maxPayloadBytes: defaultPageContentMaxPayloadBytes
        },
        chromeDeps
      )
    }
  },
  pageActions: {
    async click (target, pageContextId) {
      return await performActiveTabClick(target, pageContextId)
    },
    async writeText (target, text, pageContextId) {
      return await performActiveTabWriteText(target, text, pageContextId)
    },
    async setChecked (target, checked, pageContextId) {
      return await performActiveTabSetChecked(target, checked, pageContextId)
    },
    async selectOptions (target, values, pageContextId) {
      return await performActiveTabSelectOptions(target, values, pageContextId)
    },
    async submitForm (target, pageContextId) {
      return await performActiveTabSubmitForm(target, pageContextId)
    }
  },
  pageNavigation: {
    async navigateToUrl (url) {
      return await navigateActiveTabToUrl(url)
    }
  },
  timers: createGlobalTimers()
})

async function performActiveTabClick (
  target: ClickActionTarget,
  pageContextId?: number
): Promise<PageActionResult> {
  return await sharedPerformActiveTabAction(
    {
      type: 'perform_click',
      target,
      ...(pageContextId !== undefined ? { pageContextId } : {})
    },
    chromeDeps
  )
}

async function performActiveTabWriteText (
  target: WriteTextActionTarget | WriteTextEditableTarget,
  text: string,
  pageContextId?: number
): Promise<PageActionResult> {
  return await sharedPerformActiveTabAction(
    {
      type: 'perform_write_text',
      target,
      text,
      ...(pageContextId !== undefined ? { pageContextId } : {})
    },
    chromeDeps
  )
}

async function performActiveTabSetChecked (
  target: WriteTextActionTarget,
  checked: boolean,
  pageContextId?: number
): Promise<PageActionResult> {
  return await sharedPerformActiveTabAction(
    {
      type: 'perform_set_checked',
      target,
      checked,
      ...(pageContextId !== undefined ? { pageContextId } : {})
    },
    chromeDeps
  )
}

async function performActiveTabSelectOptions (
  target: WriteTextActionTarget,
  values: string[],
  pageContextId?: number
): Promise<PageActionResult> {
  return await sharedPerformActiveTabAction(
    {
      type: 'perform_select_options',
      target,
      values,
      ...(pageContextId !== undefined ? { pageContextId } : {})
    },
    chromeDeps
  )
}

async function performActiveTabSubmitForm (
  target: FormSubmitTarget,
  pageContextId?: number
): Promise<PageActionResult> {
  return await sharedPerformActiveTabAction(
    {
      type: 'perform_submit_form',
      target,
      ...(pageContextId !== undefined ? { pageContextId } : {})
    },
    chromeDeps
  )
}

export async function navigateActiveTabToUrl (url: string): Promise<PageNavigationResult> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })

  if (tabs.length === 0 || tabs[0].id === undefined) {
    return {
      ok: false,
      error: {
        code: 'no_active_tab',
        message: 'No active tab is available.'
      }
    }
  }

  const tabId = tabs[0].id
  const startTime = Date.now()

  try {
    const updatedTab = await chrome.tabs.update(tabId, { url })

    const navigatedUrl = typeof updatedTab.url === 'string' && updatedTab.url !== ''
      ? updatedTab.url
      : url
    const navigatedTitle = typeof updatedTab.title === 'string' ? updatedTab.title : ''

    return {
      ok: true,
      data: {
        url: navigatedUrl,
        title: navigatedTitle,
        timestamp: new Date(startTime).toISOString(),
        redirected: navigatedUrl !== url,
        navigationMs: Date.now() - startTime
      }
    }
  } catch {
    return {
      ok: false,
      error: {
        code: 'navigation_failed',
        message: `Failed to navigate tab to ${url}.`
      }
    }
  }
}

class DomWebSocketAdapter implements BrijioSocket {
  private openListener: (() => void) | undefined

  private messageListener: MessageListener | undefined

  private closeListener: (() => void) | undefined

  private errorListener: (() => void) | undefined

  constructor (private readonly socket: WebSocket) {}

  get onopen (): (() => void) | undefined {
    return this.openListener
  }

  set onopen (listener: (() => void) | undefined) {
    this.openListener = listener
    this.socket.onopen =
      listener === undefined
        ? null
        : () => {
            listener()
          }
  }

  get onmessage (): MessageListener | undefined {
    return this.messageListener
  }

  set onmessage (listener: MessageListener | undefined) {
    this.messageListener = listener
    this.socket.onmessage =
      listener === undefined
        ? null
        : (event) => {
            if (typeof event.data === 'string') {
              void listener({ data: event.data })
            }
          }
  }

  get onclose (): (() => void) | undefined {
    return this.closeListener
  }

  set onclose (listener: (() => void) | undefined) {
    this.closeListener = listener
    this.socket.onclose =
      listener === undefined
        ? null
        : () => {
            listener()
          }
  }

  get onerror (): (() => void) | undefined {
    return this.errorListener
  }

  set onerror (listener: (() => void) | undefined) {
    this.errorListener = listener
    this.socket.onerror =
      listener === undefined
        ? null
        : () => {
            listener()
          }
  }

  send (message: string): void {
    this.socket.send(message)
  }

  close (): void {
    this.socket.close()
  }
}

// --- Message handler (exported for testing) ---

export function createMessageHandler (
  ctrl: BrijioBackgroundController
): (
    message: RuntimeMessage,
    sender: unknown,
    sendResponse: SendResponse,
  ) => boolean | undefined {
  return (message, _sender, sendResponse) => {
    if (message.type === 'get_settings') {
      void ctrl.getBridgeSettings().then((settings) => {
        sendResponse({ ok: true, data: settings })
      })
      return true
    }

    if (
      message.type === 'save_settings' &&
      typeof message.websocketUrl === 'string' &&
      typeof message.pairingToken === 'string' &&
      typeof message.profileName === 'string' &&
      typeof message.label === 'string'
    ) {
      void saveRuntimeSettings(ctrl, message).then(
        () => {
          sendResponse({ ok: true })
        },
        (error: unknown) => {
          sendResponse({
            ok: false,
            error: {
              code: 'invalid_settings',
              message:
                error instanceof Error
                  ? error.message
                  : 'Unable to save settings.'
            }
          })
        }
      )
      return true
    }

    if (message.type === 'get_status') {
      const status = ctrl.getConnectionStatus()
      sendResponse({ ok: true, data: status })
      return undefined
    }

    if (message.type === 'connect') {
      void ctrl.requestConnect().then(
        () => {
          sendResponse({ ok: true })
        },
        (error: unknown) => {
          sendResponse({
            ok: false,
            error: {
              code: 'connect_failed',
              message:
                error instanceof Error ? error.message : 'Unable to connect.'
            }
          })
        }
      )
      return true
    }

    if (message.type === 'disconnect') {
      void ctrl.requestDisconnect().then(
        () => {
          sendResponse({ ok: true })
        },
        (error: unknown) => {
          sendResponse({
            ok: false,
            error: {
              code: 'disconnect_failed',
              message:
                error instanceof Error
                  ? error.message
                  : 'Unable to disconnect.'
            }
          })
        }
      )
      return true
    }

    sendResponse({
      ok: false,
      error: {
        code: 'unsupported_message',
        message: 'Unsupported extension message.'
      }
    })
    return undefined
  }
}

// Register the message listener only in the Chrome extension runtime.
// In test environments, chrome.runtime is not available.
const chromeGlobal = globalThis as unknown as {
  chrome?: {
    runtime?: { onMessage?: { addListener?: (callback: unknown) => void } }
  }
}
if (
  typeof chromeGlobal.chrome?.runtime?.onMessage?.addListener === 'function'
) {
  chromeGlobal.chrome.runtime.onMessage.addListener(
    createMessageHandler(controller)
  )
}

async function saveRuntimeSettings (
  ctrl: BrijioBackgroundController,
  message: RuntimeMessage
): Promise<void> {
  const existing = await ctrl.getBridgeSettings()
  const websocketUrl = requireString(message.websocketUrl, 'WebSocket URL')
  const pairingToken = requireString(message.pairingToken, 'Pairing token')
  const profileName = requireString(message.profileName, 'Profile name')
  const label = requireString(message.label, 'Browser label')

  const settings: BridgeSettings = {
    websocketUrl,
    pairingToken,
    browserInstanceId:
      stringValue(message.browserInstanceId) ??
      existing?.browserInstanceId ??
      createBrowserInstanceId('Chrome'),
    browserName:
      stringValue(message.browserName) ?? existing?.browserName ?? 'Chrome',
    profileName,
    label
  }

  await ctrl.saveBridgeSettings(settings)
}
