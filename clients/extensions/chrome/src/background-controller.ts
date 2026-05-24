import {
  createPageContextErrorResponse,
  createPageContextResponse,
  isGetPageContextEnvelope,
  type PageContext
} from './protocol.js'

export interface StorageAdapter {
  getWebSocketUrl: () => Promise<string | undefined>
  setWebSocketUrl: (url: string) => Promise<void>
}

export interface SetupAdapter {
  openSetupPage: () => Promise<void>
}

export interface ActionAdapter {
  setBadgeText: (text: string) => Promise<void>
  setBadgeColor: (color: string) => Promise<void>
  setBadgeTextColor: (color: string) => Promise<void>
  setTitle: (title: string) => Promise<void>
}

export interface TabsAdapter {
  getActiveTabContext: () => Promise<PageContext | undefined>
}

export interface TimersAdapter {
  setInterval: (callback: () => void, intervalMs: number) => number
  clearInterval: (timerId: number) => void
}

export interface BrowserBridgeSocket {
  onopen: (() => void) | undefined
  onmessage: ((event: { data: string }) => void | Promise<void>) | undefined
  onclose: (() => void) | undefined
  onerror: (() => void) | undefined
  send: (message: string) => void
  close: () => void
}

export interface BrowserBridgeBackgroundControllerOptions {
  action: ActionAdapter
  createWebSocket: (url: string) => BrowserBridgeSocket
  setup: SetupAdapter
  storage: StorageAdapter
  tabs: TabsAdapter
  timers: TimersAdapter
}

export class BrowserBridgeBackgroundController {
  private keepaliveTimerId: number | undefined
  private socket: BrowserBridgeSocket | undefined

  constructor (
    private readonly options: BrowserBridgeBackgroundControllerOptions
  ) {}

  async handleActionClicked (): Promise<void> {
    if (this.socket !== undefined) {
      await this.disconnect()
      return
    }

    const websocketUrl = await this.options.storage.getWebSocketUrl()

    if (websocketUrl === undefined || websocketUrl.trim() === '') {
      await this.options.setup.openSetupPage()
      return
    }

    await this.connect(websocketUrl)
  }

  async saveWebSocketUrl (url: string): Promise<void> {
    await this.options.storage.setWebSocketUrl(url)
    await this.setStoppedState()
  }

  async getWebSocketUrl (): Promise<string | undefined> {
    return await this.options.storage.getWebSocketUrl()
  }

  private async connect (url: string): Promise<void> {
    const socket = this.options.createWebSocket(url)
    this.socket = socket

    socket.onopen = () => {
      if (this.socket === socket) {
        this.startKeepalive(socket)
        void this.setConnectedState()
      }
    }

    socket.onmessage = async (event) => {
      await this.handleSocketMessage(event.data)
    }

    socket.onclose = () => {
      if (this.socket === socket) {
        this.socket = undefined
        this.stopKeepalive()
        void this.setStoppedState()
      }
    }

    socket.onerror = () => {
      if (this.socket === socket) {
        this.socket = undefined
        this.stopKeepalive()
        void this.setErrorState()
      }
    }

    await this.setConnectingState()
  }

  private async disconnect (): Promise<void> {
    const socket = this.socket
    this.socket = undefined

    this.stopKeepalive()
    socket?.close()
    await this.setStoppedState()
  }

  private async handleSocketMessage (data: string): Promise<void> {
    let message: unknown

    try {
      message = JSON.parse(data)
    } catch {
      return
    }

    if (!isGetPageContextEnvelope(message)) {
      return
    }

    const context = await this.options.tabs.getActiveTabContext()

    if (context === undefined) {
      this.socket?.send(
        JSON.stringify(
          createPageContextErrorResponse(
            message.id,
            'no_active_tab',
            'No active tab with a URL is available.'
          )
        )
      )
      return
    }

    this.socket?.send(JSON.stringify(createPageContextResponse(message.id, context)))
  }

  private async setConnectedState (): Promise<void> {
    await this.options.action.setBadgeText('ON')
    await this.options.action.setBadgeColor('#1f8f4d')
    await this.options.action.setBadgeTextColor('#ffffff')
    await this.options.action.setTitle('BrowserBridge connected')
  }

  private async setConnectingState (): Promise<void> {
    await this.options.action.setBadgeText('...')
    await this.options.action.setBadgeColor('#f59e0b')
    await this.options.action.setBadgeTextColor('#ffffff')
    await this.options.action.setTitle('BrowserBridge connecting')
  }

  private async setStoppedState (): Promise<void> {
    await this.options.action.setBadgeText('OFF')
    await this.options.action.setBadgeColor('#666666')
    await this.options.action.setBadgeTextColor('#ffffff')
    await this.options.action.setTitle('BrowserBridge stopped')
  }

  private async setErrorState (): Promise<void> {
    await this.options.action.setBadgeText('ERR')
    await this.options.action.setBadgeColor('#b42318')
    await this.options.action.setBadgeTextColor('#ffffff')
    await this.options.action.setTitle('BrowserBridge connection error')
  }

  private startKeepalive (socket: BrowserBridgeSocket): void {
    this.stopKeepalive()
    this.keepaliveTimerId = this.options.timers.setInterval(() => {
      socket.send(
        JSON.stringify({
          type: 'message',
          payload: {
            type: 'extension_keepalive'
          }
        })
      )
    }, 20000)
  }

  private stopKeepalive (): void {
    if (this.keepaliveTimerId === undefined) {
      return
    }

    this.options.timers.clearInterval(this.keepaliveTimerId)
    this.keepaliveTimerId = undefined
  }
}
