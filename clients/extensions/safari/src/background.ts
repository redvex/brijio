import {
  ContentRequest,
  ContentResponse,
  defaultPageContentMaxPayloadBytes,
  type ActionResultErrorCode,
  type BridgeSettings,
  type BrowserBridgeSocket,
  type PageActionResult,
  type PageContent,
  type PageContentErrorCode,
  type PageContext,
  type PageReadResult
} from '@browserbridge/shared'
import { hasRegularPageAccess, isRegularPageUrl } from './permissions.js'

// --- Browser API types for Safari (browser.* namespace) ---
// Per ADR 0019, Safari uses the browser.* namespace (not chrome.*),
// persistent background scripts (not service workers),
// and text-only badges (no color API).

interface RuntimeMessage {
  type?: unknown
  websocketUrl?: unknown
}

type SendResponse = (response: unknown) => void
type MessageListener = (event: { data: string }) => void | Promise<void>

export interface BrowserApi {
  browserAction: {
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
          sendResponse: SendResponse
        ) => boolean | undefined
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
  }
}

const storageKey = 'websocketUrl'
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

// --- Safari-specific adapter classes ---

export class SafariActionBadge {
  constructor (private readonly browserAction: BrowserApi['browserAction']) {}

  async setBadgeText (text: string): Promise<void> {
    await this.browserAction.setBadgeText({ text })
  }

  async setBadgeColor (_color: string): Promise<void> {
    // Safari only supports text badges — no background color API.
    // This is a no-op per ADR 0019.
  }

  async setBadgeTextColor (_color: string): Promise<void> {
    // Safari only supports text badges — no text color API.
    // This is a no-op per ADR 0019.
  }

  async setTitle (title: string): Promise<void> {
    await this.browserAction.setTitle({ title })
  }
}

export class SafariStorageAdapter {
  constructor (private readonly storage: BrowserApi['storage']) {}

  async getBridgeSettings (): Promise<BridgeSettings | undefined> {
    const values = await this.storage.local.get(bridgeSettingsKeys)
    return normalizeBridgeSettings(values)
  }

  async setBridgeSettings (settings: BridgeSettings): Promise<void> {
    await this.storage.local.set({
      websocketUrl: settings.websocketUrl,
      pairingToken: settings.pairingToken,
      browserInstanceId: settings.browserInstanceId,
      browserName: settings.browserName,
      profileName: settings.profileName,
      label: settings.label
    })
  }

  async getWebSocketUrl (): Promise<string | undefined> {
    const values = await this.storage.local.get([storageKey])
    const websocketUrl = values[storageKey]
    return typeof websocketUrl === 'string' ? websocketUrl : undefined
  }

  async setWebSocketUrl (url: string): Promise<void> {
    await this.storage.local.set({ [storageKey]: url })
  }
}

function normalizeBridgeSettings (
  values: Record<string, unknown>
): BridgeSettings | undefined {
  const websocketUrl = stringValue(values.websocketUrl)
  const pairingToken = stringValue(values.pairingToken)
  const browserInstanceId = stringValue(values.browserInstanceId)
  const browserName = stringValue(values.browserName) ?? 'Safari'
  const profileName = stringValue(values.profileName) ?? 'Default'
  const label = stringValue(values.label) ?? `${browserName} ${profileName}`

  if (
    websocketUrl === undefined ||
    pairingToken === undefined ||
    browserInstanceId === undefined
  ) {
    return undefined
  }

  return {
    websocketUrl,
    pairingToken,
    browserInstanceId,
    browserName,
    profileName,
    label
  }
}

function stringValue (value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

export class SafariSetupAdapter {
  // Safari uses a popup for setup rather than a separate setup page.
  // Opening a setup page is a no-op.
  async openSetupPage (): Promise<void> {}
}

export class SafariPageReaderAdapter {
  constructor (
    private readonly tabs: BrowserApi['tabs'],
    private readonly scripting: BrowserApi['scripting']
  ) {}

  async getPageContext (): Promise<PageReadResult<PageContext>> {
    return await readActiveTabPage({
      type: 'extract_page_context',
      previewMaxBytes,
      defaultMaxPayloadBytes: defaultPageContentMaxPayloadBytes
    }, this.tabs, this.scripting)
  }

  async getPageContent (index: number): Promise<PageReadResult<PageContent>> {
    return await readActiveTabPage({
      type: 'extract_page_content',
      index,
      maxContentBytes,
      maxPayloadBytes: defaultPageContentMaxPayloadBytes
    }, this.tabs, this.scripting)
  }
}

export class SafariWebSocketConnection implements BrowserBridgeSocket {
  private openListener: (() => void) | undefined
  private messageListener: MessageListener | undefined
  private closeListener: (() => void) | undefined
  private errorListener: (() => void) | undefined
  private socket: WebSocket | undefined

  constructor (private readonly url: string) {}

  get onopen (): (() => void) | undefined {
    return this.openListener
  }

  set onopen (listener: (() => void) | undefined) {
    this.openListener = listener
    if (this.socket !== undefined) {
      this.socket.onopen = listener === undefined ? null : () => { listener() }
    }
  }

  get onmessage (): MessageListener | undefined {
    return this.messageListener
  }

  set onmessage (listener: MessageListener | undefined) {
    this.messageListener = listener
    if (this.socket !== undefined) {
      this.socket.onmessage =
        listener === undefined
          ? null
          : (event) => {
              if (typeof event.data === 'string') {
                void listener({ data: event.data })
              }
            }
    }
  }

  get onclose (): (() => void) | undefined {
    return this.closeListener
  }

  set onclose (listener: (() => void) | undefined) {
    this.closeListener = listener
    if (this.socket !== undefined) {
      this.socket.onclose = listener === undefined ? null : () => { listener() }
    }
  }

  get onerror (): (() => void) | undefined {
    return this.errorListener
  }

  set onerror (listener: (() => void) | undefined) {
    this.errorListener = listener
    if (this.socket !== undefined) {
      this.socket.onerror = listener === undefined ? null : () => { listener() }
    }
  }

  connect (): void {
    this.socket = new WebSocket(this.url)

    if (this.openListener !== undefined) {
      this.socket.onopen = () => { (this.openListener as () => void)() }
    }
    if (this.messageListener !== undefined) {
      this.socket.onmessage = (event) => {
        if (typeof event.data === 'string') {
          void (this.messageListener as (event: { data: string }) => void)({ data: event.data })
        }
      }
    }
    if (this.closeListener !== undefined) {
      this.socket.onclose = () => { (this.closeListener as () => void)() }
    }
    if (this.errorListener !== undefined) {
      this.socket.onerror = () => { (this.errorListener as () => void)() }
    }
  }

  disconnect (): void {
    this.socket?.close()
    this.socket = undefined
  }

  send (message: string): void {
    this.socket?.send(message)
  }

  close (): void {
    this.disconnect()
  }
}

// --- Helper functions ---

async function readActiveTabPage<T> (
  message: ContentRequest,
  tabs: BrowserApi['tabs'],
  scripting: BrowserApi['scripting']
): Promise<PageReadResult<T>> {
  const [activeTab] = await tabs.query({
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
    await scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ['content.js']
    })

    const response = await tabs.sendMessage(activeTab.id, message)

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
    if (!(await hasRegularPageAccess())) {
      return regularPagePermissionRequired()
    }

    return contentScriptUnavailable()
  }
}

async function performActiveTabAction (
  message: ContentRequest,
  tabs: BrowserApi['tabs'],
  scripting: BrowserApi['scripting']
): Promise<PageActionResult> {
  const [activeTab] = await tabs.query({
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
    await scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ['content.js']
    })

    const response = await tabs.sendMessage(activeTab.id, message)

    if (!isContentResponse(response)) {
      return actionContentScriptUnavailable()
    }

    if (response.ok) {
      return {
        ok: true,
        data: response.data as PageActionResult extends { ok: true, data: infer T } ? T : never
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
    if (!(await hasRegularPageAccess())) {
      return actionRegularPagePermissionRequired()
    }

    return actionContentScriptUnavailable()
  }
}

// Re-export helpers for page reader and action adapter wiring
export { readActiveTabPage, performActiveTabAction }

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
