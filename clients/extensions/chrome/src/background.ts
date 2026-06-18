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
  type FileUploadPayload,
  type FormSubmitTarget,
  type ContentBatchRequest,
  type BatchResult,
  type DownloadAdapter,
  stringValue,
  requireString,
  createBrowserInstanceId,
  normalizeBridgeSettings,
  readActiveTabPage as sharedReadActiveTabPage,
  performActiveTabAction as sharedPerformActiveTabAction,
  performActiveTabBatch as sharedPerformActiveTabBatch,
  type ApprovalAdapter,
  type ApprovalDecision,
  type ApprovalRequest,
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
  downloads?: {
    search: (query: { id?: number }) => Promise<Array<{
      id: number
      filename: string
      url: string
      mime?: string
      fileSize?: number
      totalBytes?: number
      state: 'in_progress' | 'complete' | 'interrupted'
      error?: string
      danger?: string
    }>>
    download: (options: {
      url: string
      filename?: string
      conflictAction: 'uniquify' | 'overwrite'
      saveAs: boolean
    }) => Promise<number>
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

export function createChromeApprovalAdapter (chromeApi: ChromeApi): ApprovalAdapter {
  return {
    async getActiveOrigin () {
      const tab = await getActiveApprovalTab(chromeApi)
      if (tab?.url === undefined || !isRegularPageUrl(tab.url)) {
        return undefined
      }

      return new URL(tab.url).origin
    },
    async requestApproval (request: ApprovalRequest) {
      const tab = await requireActiveApprovalTab(chromeApi)
      await chromeApi.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      })

      const response = await chromeApi.tabs.sendMessage(tab.id, {
        type: 'show_brijio_approval',
        actionUUID: request.actionUUID,
        actionType: request.actionType,
        origin: request.origin,
        timeoutMs: request.timeoutMs
      })

      return parseApprovalDecision(response)
    },
    async hideApproval (actionUUID: string) {
      const tab = await getActiveApprovalTab(chromeApi)
      if (tab?.id === undefined) {
        return
      }

      await chromeApi.tabs.sendMessage(tab.id, {
        type: 'hide_brijio_approval',
        actionUUID
      })
    }
  }
}

async function getActiveApprovalTab (
  chromeApi: ChromeApi
): Promise<{ id?: number, url?: string } | undefined> {
  const tabs = await chromeApi.tabs.query({ active: true, currentWindow: true })
  return tabs[0]
}

async function requireActiveApprovalTab (
  chromeApi: ChromeApi
): Promise<{ id: number, url?: string }> {
  const tab = await getActiveApprovalTab(chromeApi)
  if (tab?.id === undefined) {
    throw new Error('No active tab is available for approval.')
  }

  return { id: tab.id, url: tab.url }
}

function parseApprovalDecision (response: unknown): ApprovalDecision {
  if (
    typeof response === 'object' &&
    response !== null &&
    'decision' in response
  ) {
    const decision = (response as { decision?: unknown }).decision
    if (
      decision === 'approve' ||
      decision === 'approve_session' ||
      decision === 'deny'
    ) {
      return decision
    }
  }

  return 'deny'
}

const downloadAdapter: DownloadAdapter = {
  async downloadStatus (ids?: Array<number | string>) {
    try {
      if (chrome.downloads?.search === undefined) {
        return { ok: true, data: { capability: 'not_supported' as const, items: [] } }
      }

      const searchIds = ids
        ?.map(id => typeof id === 'number' ? id : Number.parseInt(id, 10))
        .filter(id => !Number.isNaN(id)) ?? []

      if (ids !== undefined && searchIds.length === 0) {
        return { ok: true, data: { capability: 'full' as const, items: [] } }
      }

      const query = searchIds.length === 1 ? { id: searchIds[0] } : {}
      const items = await chrome.downloads.search(query)

      return {
        ok: true,
        data: {
          capability: 'full' as const,
          items: items
            .filter(item => searchIds.length === 0 || searchIds.includes(item.id))
            .map(item => ({
              id: item.id,
              kind: 'download' as const,
              filename: item.filename,
              url: item.url,
              mime: item.mime ?? null,
              size: item.fileSize ?? item.totalBytes ?? null,
              state: item.state,
              ...(item.error !== undefined ? { error: item.error } : {}),
              ...(item.danger !== undefined ? { danger: item.danger } : {})
            }))
        }
      }
    } catch (error: unknown) {
      return {
        ok: false,
        error: {
          code: 'browser_error',
          message: error instanceof Error ? error.message : 'Download status query failed.'
        }
      }
    }
  },

  async downloadFile (url: string, filename?: string, conflictAction?: 'uniquify' | 'overwrite') {
    try {
      if (chrome.downloads?.download === undefined) {
        return { ok: false, error: { code: 'not_supported', message: 'chrome.downloads API not available.' } }
      }

      const downloadId = await chrome.downloads.download({
        url,
        ...(filename !== undefined ? { filename } : {}),
        conflictAction: conflictAction ?? 'uniquify',
        saveAs: false
      })

      return { ok: true, data: { downloadId, status: 'initiated' as const } }
    } catch (error: unknown) {
      return {
        ok: false,
        error: {
          code: 'browser_error',
          message: error instanceof Error ? error.message : 'Download failed.'
        }
      }
    }
  },

  async fetchResource (url: string, maxSizeBytes?: number, timeout?: number) {
    const controller = new AbortController()
    const timeoutId = timeout !== undefined
      ? setTimeout(() => { controller.abort() }, timeout)
      : undefined

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        credentials: 'include'
      })

      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
      }

      if (!response.ok) {
        return { ok: false, error: { code: 'http_error', message: `HTTP ${response.status}: ${response.statusText}` } }
      }

      const contentType = response.headers.get('content-type')
      const contentLength = response.headers.get('content-length')
      const declaredBytes = contentLength !== null ? Number.parseInt(contentLength, 10) : null
      const totalBytes = declaredBytes !== null && !Number.isNaN(declaredBytes) ? declaredBytes : null

      if (maxSizeBytes !== undefined && totalBytes !== null && totalBytes > maxSizeBytes) {
        return { ok: false, error: { code: 'size_exceeded', message: `Resource exceeds maxSizeBytes (${totalBytes} > ${maxSizeBytes})` } }
      }

      const arrayBuffer = await response.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)

      if (maxSizeBytes !== undefined && bytes.length > maxSizeBytes) {
        return { ok: false, error: { code: 'size_exceeded', message: `Resource exceeds maxSizeBytes (${bytes.length} > ${maxSizeBytes})` } }
      }

      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      const dataBase64 = btoa(binary)

      const hashBuffer = await crypto.subtle.digest('SHA-256', bytes)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const sha256 = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('')

      return {
        ok: true,
        data: {
          fetchId: crypto.randomUUID(),
          contentType,
          totalBytes: bytes.length,
          dataBase64,
          sha256
        }
      }
    } catch (error: unknown) {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        return { ok: false, error: { code: 'timeout', message: 'Fetch timed out.' } }
      }

      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        return { ok: false, error: { code: 'cors_blocked', message: 'CORS blocked the request.' } }
      }

      return {
        ok: false,
        error: {
          code: 'network_error',
          message: error instanceof Error ? error.message : 'Fetch failed.'
        }
      }
    }
  }
}

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
  approval: {
    async getActiveOrigin () {
      return await createChromeApprovalAdapter(chrome).getActiveOrigin()
    },
    async requestApproval (request) {
      return await createChromeApprovalAdapter(chrome).requestApproval(request)
    },
    async hideApproval (actionUUID) {
      await createChromeApprovalAdapter(chrome).hideApproval(actionUUID)
    }
  },
  createWebSocket (url) {
    return new DomWebSocketAdapter(new WebSocket(url))
  },
  download: downloadAdapter,
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
    },
    async uploadFile (target, file, pageContextId) {
      return await performActiveTabUploadFile(target, file, pageContextId)
    }
  },
  pageBatch: {
    async performBatch (message: ContentBatchRequest): Promise<BatchResult> {
      return await sharedPerformActiveTabBatch(message, chromeDeps)
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

async function performActiveTabUploadFile (
  target: WriteTextActionTarget,
  file: FileUploadPayload,
  pageContextId?: number
): Promise<PageActionResult> {
  return await sharedPerformActiveTabAction(
    {
      type: 'perform_upload_file',
      target,
      file,
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
  const NAVIGATION_TIMEOUT_MS = 10000

  try {
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

    // Chrome's chrome.tabs.update() usually resolves quickly with the tab
    // object, but in edge-cases (restricted pages, permission prompts) it may
    // hang. Wrap in a timeout so the MCP client always gets a response.
    const updatedTab = await withTabTimeout(
      chrome.tabs.update(tabId, { url }),
      NAVIGATION_TIMEOUT_MS,
      `Navigation to ${url} timed out.`
    )

    if (updatedTab === undefined || updatedTab === null) {
      // tabs.update resolved but returned no tab object — still report
      // success because Chrome has accepted the navigation request.
      return {
        ok: true,
        data: {
          url,
          title: '',
          timestamp: new Date(startTime).toISOString(),
          redirected: false,
          navigationMs: Date.now() - startTime
        }
      }
    }

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
  } catch (error: unknown) {
    const message =
      error instanceof TabTimeoutError
        ? error.message
        : `Failed to navigate tab to ${url}.`
    return {
      ok: false,
      error: {
        code: error instanceof TabTimeoutError ? 'timeout' : 'navigation_failed',
        message
      }
    }
  }
}

class TabTimeoutError extends Error {
  constructor (message: string) {
    super(message)
    this.name = 'TabTimeoutError'
  }
}

async function withTabTimeout<T> (
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TabTimeoutError(message))
    }, timeoutMs)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (reason) => {
        clearTimeout(timer)
        reject(reason)
      }
    )
  })
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
