// Safari background script entry point.
//
// Per ADR 0019, Safari uses persistent background scripts (not service workers),
// the browser.* namespace (not chrome.*), and text-only badges (no color API).
//
// This file instantiates the controller with Safari-specific adapters and
// registers the browser.browserAction.onClicked and browser.runtime.onMessage listeners.

import {
  BrowserBridgeBackgroundController,
  createGlobalTimers,
  type BridgeSettings,
  type BrowserBridgeSocket,
  type ClickActionTarget,
  type WriteTextActionTarget,
  type WriteTextEditableTarget,
  type PageActionResult
} from '@browserbridge/shared'
import {
  SafariActionBadge,
  SafariStorageAdapter,
  SafariSetupAdapter,
  SafariPageReaderAdapter,
  SafariWebSocketConnection,
  performActiveTabAction,
  type BrowserApi
} from './background.js'

declare const browser: BrowserApi

const action = new SafariActionBadge(browser.browserAction)
const storage = new SafariStorageAdapter(browser.storage)
const setup = new SafariSetupAdapter()
const pageReader = new SafariPageReaderAdapter(browser.tabs, browser.scripting)

const pageActions = {
  async click (target: ClickActionTarget): Promise<PageActionResult> {
    return await performActiveTabAction({ type: 'perform_click', target }, browser.tabs, browser.scripting)
  },
  async writeText (
    target: WriteTextActionTarget | WriteTextEditableTarget,
    text: string
  ): Promise<PageActionResult> {
    return await performActiveTabAction({ type: 'perform_write_text', target, text }, browser.tabs, browser.scripting)
  },
  async setChecked (
    target: WriteTextActionTarget,
    checked: boolean
  ): Promise<PageActionResult> {
    return await performActiveTabAction({ type: 'perform_set_checked', target, checked }, browser.tabs, browser.scripting)
  },
  async selectOptions (
    target: WriteTextActionTarget,
    values: string[]
  ): Promise<PageActionResult> {
    return await performActiveTabAction({ type: 'perform_select_options', target, values }, browser.tabs, browser.scripting)
  },
  async submitForm (target: { formId: string }): Promise<PageActionResult> {
    return await performActiveTabAction({ type: 'perform_submit_form', target }, browser.tabs, browser.scripting)
  }
}

const controller = new BrowserBridgeBackgroundController({
  action,
  createWebSocket (url: string): BrowserBridgeSocket {
    const ws = new SafariWebSocketConnection(url)
    ws.connect()
    return ws
  },
  setup,
  storage,
  pageReader,
  pageActions,
  timers: createGlobalTimers()
})

browser.browserAction.onClicked.addListener(() => {
  void controller.handleActionClicked()
})

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'get_settings') {
    void controller.getBridgeSettings().then((settings) => {
      sendResponse({ ok: true, data: { websocketUrl: settings?.websocketUrl } })
    })
    return true
  }

  if (
    message.type === 'save_settings' &&
    typeof message.websocketUrl === 'string'
  ) {
    void saveRuntimeSettings(message.websocketUrl).then(() => {
      sendResponse({ ok: true })
    })
    return true
  }

  if (message.type === 'connect') {
    void controller.requestConnect().then(() => {
      sendResponse({ ok: true })
    })
    return true
  }

  if (message.type === 'disconnect') {
    void controller.requestDisconnect().then(() => {
      sendResponse({ ok: true })
    })
    return true
  }

  if (message.type === 'get_status') {
    sendResponse({ ok: true, data: { connected: controller.isConnected() } })
    return undefined
  }

  sendResponse({
    ok: false,
    error: {
      code: 'unsupported_message',
      message: 'Unsupported setup message.'
    }
  })
  return undefined
})

async function saveRuntimeSettings (websocketUrl: string): Promise<void> {
  const existing = await controller.getBridgeSettings()
  const browserName = existing?.browserName ?? 'Safari'
  const profileName = existing?.profileName ?? 'Default'
  const settings: BridgeSettings = {
    websocketUrl,
    pairingToken: existing?.pairingToken ?? '',
    browserInstanceId:
      existing?.browserInstanceId ?? createBrowserInstanceId(),
    browserName,
    profileName,
    label: existing?.label ?? `${browserName} ${profileName}`
  }

  await controller.saveBridgeSettings(settings)
}

function createBrowserInstanceId (): string {
  return `safari-${crypto.randomUUID()}`
}
