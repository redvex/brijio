import {
  BrowserBridgeBackgroundController,
  type PageActionResult,
  type PageReadResult,
  type BrowserBridgeSocket
} from './background-controller.js'
import type { ContentRequest, ContentResponse } from './content.js'
import {
  type ActionResultErrorCode,
  type ClickActionTarget,
  defaultPageContentMaxPayloadBytes,
  type PageContentErrorCode,
  type WriteTextEditableTarget,
  type WriteTextActionTarget
} from './protocol.js'
import {
  hasRegularPageAccess,
  isRegularPageUrl,
  type ChromePermissionsApi
} from './permissions.js'
import { createGlobalTimers } from './timers.js'

interface RuntimeMessage {
  type?: unknown
  websocketUrl?: unknown
}

type SendResponse = (response: unknown) => void
type MessageListener = (event: { data: string }) => void | Promise<void>

interface ChromeApi {
  action: {
    onClicked: {
      addListener: (callback: () => void | Promise<void>) => void
    }
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
  permissions: ChromePermissionsApi
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
  }
}

declare const chrome: ChromeApi

const storageKey = 'websocketUrl'
const previewMaxBytes = 4096
const maxContentBytes = 120000

const controller = new BrowserBridgeBackgroundController({
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
      await chrome.tabs.create({ url: chrome.runtime.getURL('setup.html') })
    }
  },
  storage: {
    async getWebSocketUrl () {
      const values = await chrome.storage.local.get([storageKey])
      const websocketUrl = values[storageKey]

      return typeof websocketUrl === 'string' ? websocketUrl : undefined
    },
    async setWebSocketUrl (url) {
      await chrome.storage.local.set({ [storageKey]: url })
    }
  },
  pageReader: {
    async getPageContext () {
      return await readActiveTabPage({
        type: 'extract_page_context',
        previewMaxBytes,
        defaultMaxPayloadBytes: defaultPageContentMaxPayloadBytes
      })
    },
    async getPageContent (index) {
      return await readActiveTabPage({
        type: 'extract_page_content',
        index,
        maxContentBytes,
        maxPayloadBytes: defaultPageContentMaxPayloadBytes
      })
    }
  },
  pageActions: {
    async click (target) {
      return await performActiveTabClick(target)
    },
    async writeText (target, text) {
      return await performActiveTabWriteText(target, text)
    },
    async setChecked (target, checked) {
      return await performActiveTabSetChecked(target, checked)
    },
    async selectOptions (target, values) {
      return await performActiveTabSelectOptions(target, values)
    },
    async submitForm (target) {
      return await performActiveTabSubmitForm(target)
    }
  },
  timers: createGlobalTimers()
})

async function readActiveTabPage<T> (
  message: ContentRequest
): Promise<PageReadResult<T>> {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  })

  if (activeTab?.id === undefined || activeTab.url === undefined) {
    return {
      ok: false,
      error: {
        code: 'no_active_tab',
        message: 'No active tab with a URL is available.'
      }
    }
  }

  if (!isRegularPageUrl(activeTab.url)) {
    return {
      ok: false,
      error: {
        code: 'unsupported_page',
        message:
          'BrowserBridge can read page content only from HTTP and HTTPS tabs.'
      }
    }
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ['content.js']
    })

    const response = await chrome.tabs.sendMessage(activeTab.id, message)

    if (!isContentResponse(response)) {
      return contentScriptUnavailable()
    }

    if (response.ok) {
      return {
        ok: true,
        data: response.data as T
      }
    }

    return {
      ok: false,
      error: {
        code: response.error.code as PageContentErrorCode,
        message: response.error.message
      }
    }
  } catch {
    if (!(await hasRegularPageAccess(chrome.permissions))) {
      return regularPagePermissionRequired()
    }

    return contentScriptUnavailable()
  }
}

async function performActiveTabClick (
  target: ClickActionTarget
): Promise<PageActionResult> {
  return await performActiveTabAction({
    type: 'perform_click',
    target
  })
}

async function performActiveTabWriteText (
  target: WriteTextActionTarget | WriteTextEditableTarget,
  text: string
): Promise<PageActionResult> {
  return await performActiveTabAction({
    type: 'perform_write_text',
    target,
    text
  })
}

async function performActiveTabSetChecked (
  target: WriteTextActionTarget,
  checked: boolean
): Promise<PageActionResult> {
  return await performActiveTabAction({
    type: 'perform_set_checked',
    target,
    checked
  })
}

async function performActiveTabSelectOptions (
  target: WriteTextActionTarget,
  values: string[]
): Promise<PageActionResult> {
  return await performActiveTabAction({
    type: 'perform_select_options',
    target,
    values
  })
}

async function performActiveTabSubmitForm (target: {
  formId: string
}): Promise<PageActionResult> {
  return await performActiveTabAction({
    type: 'perform_submit_form',
    target
  })
}

async function performActiveTabAction (
  message: ContentRequest
): Promise<PageActionResult> {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  })

  if (activeTab?.id === undefined || activeTab.url === undefined) {
    return {
      ok: false,
      error: {
        code: 'no_active_tab',
        message: 'No active tab with a URL is available.'
      }
    }
  }

  if (!isRegularPageUrl(activeTab.url)) {
    return {
      ok: false,
      error: {
        code: 'unsupported_page',
        message:
          'BrowserBridge can perform actions only on HTTP and HTTPS tabs.'
      }
    }
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ['content.js']
    })

    const response = await chrome.tabs.sendMessage(activeTab.id, message)

    if (!isContentResponse(response)) {
      return actionContentScriptUnavailable()
    }

    if (response.ok) {
      return {
        ok: true,
        data: response.data as PageActionResult extends {
          ok: true
          data: infer T
        }
          ? T
          : never
      }
    }

    return {
      ok: false,
      error: {
        code: response.error.code as ActionResultErrorCode,
        message: response.error.message
      }
    }
  } catch {
    if (!(await hasRegularPageAccess(chrome.permissions))) {
      return actionRegularPagePermissionRequired()
    }

    return actionContentScriptUnavailable()
  }
}

function regularPagePermissionRequired<T> (): PageReadResult<T> {
  return {
    ok: false,
    error: {
      code: 'regular_page_permission_required',
      message:
        'Regular page access is not enabled. Open BrowserBridge setup and enable regular page access.'
    }
  }
}

function actionRegularPagePermissionRequired (): PageActionResult {
  return {
    ok: false,
    error: {
      code: 'regular_page_permission_required',
      message:
        'Regular page access is not enabled. Open BrowserBridge setup and enable regular page access.'
    }
  }
}

function contentScriptUnavailable<T> (): PageReadResult<T> {
  return {
    ok: false,
    error: {
      code: 'content_script_unavailable',
      message: 'Unable to reach the page content script.'
    }
  }
}

function actionContentScriptUnavailable (): PageActionResult {
  return {
    ok: false,
    error: {
      code: 'content_script_unavailable',
      message: 'Unable to reach the page content script.'
    }
  }
}

function isContentResponse (value: unknown): value is ContentResponse {
  if (!isRecord(value) || typeof value.ok !== 'boolean') {
    return false
  }

  if (value.ok) {
    return Object.hasOwn(value, 'data')
  }

  return (
    isRecord(value.error) &&
    isPageContentErrorCode(value.error.code) &&
    typeof value.error.message === 'string'
  )
}

function isPageContentErrorCode (
  value: unknown
): value is PageContentErrorCode | ActionResultErrorCode {
  return (
    value === 'no_active_tab' ||
    value === 'unsupported_page' ||
    value === 'regular_page_permission_required' ||
    value === 'content_script_unavailable' ||
    value === 'extraction_failed' ||
    value === 'invalid_index' ||
    value === 'unsupported_request' ||
    value === 'unsupported_action' ||
    value === 'invalid_action_target' ||
    value === 'target_not_found' ||
    value === 'target_disabled' ||
    value === 'target_readonly' ||
    value === 'unsupported_control' ||
    value === 'invalid_control_value' ||
    value === 'option_not_found' ||
    value === 'target_option_disabled' ||
    value === 'action_failed'
  )
}

function isRecord (value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

class DomWebSocketAdapter implements BrowserBridgeSocket {
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

chrome.action.onClicked.addListener(() => {
  void controller.handleActionClicked()
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
