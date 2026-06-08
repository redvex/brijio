import {
  defaultPageContentMaxPayloadBytes,
  type BridgeSettings,
  type BrijioSocket,
  type PageContent,
  type PageContext,
  type PageNavigationResult,
  type PageReadResult,
  normalizeBridgeSettings,
  readActiveTabPage as sharedReadActiveTabPage,
  type ActiveTabDeps
} from '@brijio/shared'
import { hasRegularPageAccess, isRegularPageUrl } from './permissions.js'

// --- Browser API types for Safari (browser.* namespace) ---
// Per ADR 0019, Safari uses the browser.* namespace (not chrome.*),
// persistent background scripts (not service workers),
// and text-only badges (no color API).

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
    return normalizeBridgeSettings(values, 'Safari')
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

  private get deps (): ActiveTabDeps {
    return {
      tabs: this.tabs,
      scripting: this.scripting,
      isRegularPageUrl,
      onCatchPermissionCheck: hasRegularPageAccess
    }
  }

  async getPageContext (): Promise<PageReadResult<PageContext>> {
    return await sharedReadActiveTabPage(
      {
        type: 'extract_page_context',
        previewMaxBytes,
        defaultMaxPayloadBytes: defaultPageContentMaxPayloadBytes
      },
      this.deps
    )
  }

  async getPageContent (index: number): Promise<PageReadResult<PageContent>> {
    return await sharedReadActiveTabPage(
      {
        type: 'extract_page_content',
        index,
        maxContentBytes,
        maxPayloadBytes: defaultPageContentMaxPayloadBytes
      },
      this.deps
    )
  }
}

export class SafariPageNavigationAdapter {
  private static readonly NAVIGATION_TIMEOUT_MS = 10000

  constructor (
    private readonly tabs: BrowserApi['tabs']
  ) {}

  async navigateToUrl (url: string): Promise<PageNavigationResult> {
    try {
      const tabs = await this.tabs.query({ active: true, currentWindow: true })

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

      // Safari's browser.tabs.update() may hang or return undefined in some
      // edge-cases (e.g. restricted pages, permission prompts). Wrap the call
      // in a timeout so the MCP client always gets a response.
      const updatedTab = await withTimeout(
        this.tabs.update(tabId, { url }),
        SafariPageNavigationAdapter.NAVIGATION_TIMEOUT_MS,
        `Navigation to ${url} timed out.`
      )

      if (updatedTab === undefined || updatedTab === null) {
        // tabs.update resolved but returned no tab object — still report
        // success because Safari has accepted the navigation request.
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
        error instanceof TimeoutError
          ? error.message
          : `Failed to navigate tab to ${url}.`
      return {
        ok: false,
        error: {
          code: error instanceof TimeoutError ? 'timeout' : 'navigation_failed',
          message
        }
      }
    }
  }
}

class TimeoutError extends Error {
  constructor (message: string) {
    super(message)
    this.name = 'TimeoutError'
  }
}

async function withTimeout<T> (
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(message))
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

export class SafariWebSocketConnection implements BrijioSocket {
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
      this.socket.onopen =
        listener === undefined
          ? null
          : () => {
              listener()
            }
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
      this.socket.onclose =
        listener === undefined
          ? null
          : () => {
              listener()
            }
    }
  }

  get onerror (): (() => void) | undefined {
    return this.errorListener
  }

  set onerror (listener: (() => void) | undefined) {
    this.errorListener = listener
    if (this.socket !== undefined) {
      this.socket.onerror =
        listener === undefined
          ? null
          : () => {
              listener()
            }
    }
  }

  connect (): void {
    this.socket = new WebSocket(this.url)

    if (this.openListener !== undefined) {
      this.socket.onopen = () => {
        (this.openListener as () => void)()
      }
    }
    if (this.messageListener !== undefined) {
      this.socket.onmessage = (event) => {
        if (typeof event.data === 'string') {
          void (this.messageListener as (event: { data: string }) => void)({
            data: event.data
          })
        }
      }
    }
    if (this.closeListener !== undefined) {
      this.socket.onclose = () => {
        (this.closeListener as () => void)()
      }
    }
    if (this.errorListener !== undefined) {
      this.socket.onerror = () => {
        (this.errorListener as () => void)()
      }
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
