// Safari background script entry point.
//
// Per ADR 0019, Safari uses persistent background scripts (not service workers),
// the browser.* namespace (not chrome.*), and text-only badges (no color API).
//
// This file instantiates the controller with Safari-specific adapters and
// registers the browser.action.onClicked and browser.runtime.onMessage listeners.

import {
  BrowserBridgeBackgroundController,
  createGlobalTimers,
  type BrowserBridgeSocket
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
import {
  hasRegularPageAccess,
  isRegularPageUrl
} from './permissions.js'

import type {
  ClickActionTarget,
  WriteTextActionTarget,
  WriteTextEditableTarget,
  PageActionResult
} from '@browserbridge/shared'

declare const browser: BrowserApi

const action = new SafariActionBadge(browser.action)
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

browser.action.onClicked.addListener(() => {
  void controller.handleActionClicked()
})

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'get_settings') {
    void controller.getWebSocketUrl().then((websocketUrl) => {
      sendResponse({ ok: true, data: { websocketUrl } })
    })
    return true
  }

  if (
    message.type === 'save_settings' &&
    typeof message.websocketUrl === 'string'
  ) {
    void controller.saveWebSocketUrl(message.websocketUrl).then(() => {
      sendResponse({ ok: true })
    })
    return true
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