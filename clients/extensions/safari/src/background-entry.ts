// Safari background script entry point.
//
// Per ADR 0019 and ADR 0051, Safari uses MV2 background scripts with
// platform-specific persistence, the browser.* namespace (not chrome.*), and
// text-only badges (no color API).
//
// This file instantiates the controller with Safari-specific adapters and
// registers the browser.browserAction.onClicked and browser.runtime.onMessage listeners.

import {
  BrijioBackgroundController,
  createGlobalTimers,
  type BridgeSettings,
  type BrijioSocket,
  type ClickActionTarget,
  type WriteTextActionTarget,
  type WriteTextEditableTarget,
  type FileUploadPayload,
  type FormSubmitTarget,
  type PageActionResult,
  stringValue,
  requireString,
  createBrowserInstanceId,
  performActiveTabAction as sharedPerformActiveTabAction,
  performActiveTabBatch as sharedPerformActiveTabBatch,
  type ContentBatchRequest,
  type BatchResult,
  type ActiveTabDeps
} from '@brijio/shared'
import {
  SafariActionBadge,
  SafariStorageAdapter,
  SafariSetupAdapter,
  SafariPageReaderAdapter,
  SafariWebSocketConnection,
  SafariDownloadAdapter,
  SafariPageNavigationAdapter,
  createSafariApprovalAdapter,
  type BrowserApi
} from './background.js'
import { hasRegularPageAccess, isRegularPageUrl } from './permissions.js'

declare const browser: BrowserApi

const desiredConnectionStateKey = 'desiredConnectionState'

const action = new SafariActionBadge(browser.browserAction)
const storage = new SafariStorageAdapter(browser.storage)
const setup = new SafariSetupAdapter()
const pageReader = new SafariPageReaderAdapter(browser.tabs, browser.scripting)

const safariDeps: ActiveTabDeps = {
  tabs: browser.tabs,
  scripting: browser.scripting,
  isRegularPageUrl,
  onCatchPermissionCheck: hasRegularPageAccess
}

const pageActions = {
  async click (target: ClickActionTarget, pageContextId?: number): Promise<PageActionResult> {
    return await sharedPerformActiveTabAction(
      { type: 'perform_click', target, ...(pageContextId !== undefined ? { pageContextId } : {}) },
      safariDeps
    )
  },
  async writeText (
    target: WriteTextActionTarget | WriteTextEditableTarget,
    text: string,
    pageContextId?: number
  ): Promise<PageActionResult> {
    return await sharedPerformActiveTabAction(
      { type: 'perform_write_text', target, text, ...(pageContextId !== undefined ? { pageContextId } : {}) },
      safariDeps
    )
  },
  async setChecked (
    target: WriteTextActionTarget,
    checked: boolean,
    pageContextId?: number
  ): Promise<PageActionResult> {
    return await sharedPerformActiveTabAction(
      { type: 'perform_set_checked', target, checked, ...(pageContextId !== undefined ? { pageContextId } : {}) },
      safariDeps
    )
  },
  async selectOptions (
    target: WriteTextActionTarget,
    values: string[],
    pageContextId?: number
  ): Promise<PageActionResult> {
    return await sharedPerformActiveTabAction(
      { type: 'perform_select_options', target, values, ...(pageContextId !== undefined ? { pageContextId } : {}) },
      safariDeps
    )
  },
  async submitForm (target: FormSubmitTarget, pageContextId?: number): Promise<PageActionResult> {
    return await sharedPerformActiveTabAction(
      { type: 'perform_submit_form', target, ...(pageContextId !== undefined ? { pageContextId } : {}) },
      safariDeps
    )
  },
  async uploadFile (target: WriteTextActionTarget, file: FileUploadPayload, pageContextId?: number): Promise<PageActionResult> {
    return await sharedPerformActiveTabAction(
      { type: 'perform_upload_file', target, file, ...(pageContextId !== undefined ? { pageContextId } : {}) },
      safariDeps
    )
  }
}

const pageBatch = {
  async performBatch (message: ContentBatchRequest): Promise<BatchResult> {
    return await sharedPerformActiveTabBatch(message, safariDeps)
  }
}

const pageNavigation = new SafariPageNavigationAdapter(browser.tabs)
const download = new SafariDownloadAdapter(browser.tabs)
const approval = createSafariApprovalAdapter(browser)

const controller = new BrijioBackgroundController({
  action,
  createWebSocket (url: string): BrijioSocket {
    const ws = new SafariWebSocketConnection(url)
    ws.connect()
    return ws
  },
  setup,
  storage,
  download,
  pageReader,
  pageActions,
  pageBatch,
  pageNavigation,
  approval,
  timers: createGlobalTimers()
})

browser.browserAction.onClicked.addListener(() => {
  void controller.handleActionClicked()
})

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'get_settings') {
    void controller.getBridgeSettings().then((settings) => {
      sendResponse({ ok: true, data: settings })
    })
    return true
  }

  if (message.type === 'save_settings') {
    void saveRuntimeSettings(message).then(
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

  if (message.type === 'connect') {
    void setDesiredConnectionState('connected').then(async () => {
      await controller.requestConnect()
      sendResponse({ ok: true })
    })
    return true
  }

  if (message.type === 'disconnect') {
    void setDesiredConnectionState('disconnected').then(async () => {
      await controller.requestDisconnect()
      sendResponse({ ok: true })
    })
    return true
  }

  if (message.type === 'brijio_page_active') {
    void reconnectIfDesired().then(() => {
      sendResponse({ ok: true })
    })
    return true
  }

  if (message.type === 'get_status') {
    sendResponse({ ok: true, data: controller.getConnectionStatus() })
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

void reconnectIfDesired()

async function getDesiredConnectionState (): Promise<'connected' | 'disconnected'> {
  const values = await browser.storage.local.get([desiredConnectionStateKey])
  return values[desiredConnectionStateKey] === 'connected'
    ? 'connected'
    : 'disconnected'
}

async function setDesiredConnectionState (
  state: 'connected' | 'disconnected'
): Promise<void> {
  await browser.storage.local.set({ [desiredConnectionStateKey]: state })
}

async function reconnectIfDesired (): Promise<void> {
  if (controller.isConnected()) {
    return
  }

  if (await getDesiredConnectionState() !== 'connected') {
    return
  }

  await controller.requestConnect()
}

async function saveRuntimeSettings (message: {
  websocketUrl?: unknown
  pairingToken?: unknown
  browserInstanceId?: unknown
  browserName?: unknown
  profileName?: unknown
  label?: unknown
}): Promise<void> {
  const existing = await controller.getBridgeSettings()
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
      createBrowserInstanceId('Safari'),
    browserName:
      stringValue(message.browserName) ?? existing?.browserName ?? 'Safari',
    profileName,
    label
  }

  await controller.saveBridgeSettings(settings)
}
