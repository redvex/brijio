import {
  BrowserBridgeBackgroundController,
  type BrowserBridgeSocket
} from './background-controller.js'
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
  tabs: {
    create: (properties: { url: string }) => Promise<unknown>
    query: (queryInfo: { active: boolean, currentWindow: boolean }) => Promise<Array<{
      title?: string
      url?: string
    }>>
  }
}

declare const chrome: ChromeApi

const storageKey = 'websocketUrl'

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
  tabs: {
    async getActiveTabContext () {
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })

      if (activeTab?.url === undefined) {
        return undefined
      }

      return {
        url: activeTab.url,
        title: activeTab.title ?? ''
      }
    }
  },
  timers: createGlobalTimers()
})

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
