import {
  createActionResultErrorResponse,
  createActionResultResponse,
  createAuthEnvelope,
  createBrowserPresenceAnnounceEnvelope,
  createPageContentErrorResponse,
  createPageContentResponse,
  createPageContextErrorResponse,
  createPageContextResponse,
  isAuthSuccessEnvelope,
  isBrowserPresenceRequestEnvelope,
  isGetPageContentEnvelope,
  isGetPageContextEnvelope,
  isPerformActionEnvelope,
  type ActionResultData,
  type ActionResultErrorCode,
  type ClickActionTarget,
  type SelectOptionsActionResultData,
  type SetCheckedActionResultData,
  type SubmitFormActionResultData,
  type PageContent,
  type PageContentErrorCode,
  type PageContext,
  type WebSocketEnvelope,
  type WriteTextActionResultData,
  type WriteTextEditableTarget,
  type WriteTextActionTarget
} from './protocol.js'

export interface ConnectionStatus {
  state: 'disconnected' | 'connecting' | 'reconnecting' | 'connected' | 'error'
  lastError?: string
  reconnectAttempt?: number
  pendingRequests: number
}

export interface BridgeSettings {
  websocketUrl: string
  pairingToken: string
  browserInstanceId: string
  browserName: string
  profileName: string
  label: string
}

export interface StorageAdapter {
  getBridgeSettings: () => Promise<BridgeSettings | undefined>
  setBridgeSettings: (settings: BridgeSettings) => Promise<void>
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

export interface TimersAdapter {
  setInterval: (callback: () => void, intervalMs: number) => number
  clearInterval: (timerId: number) => void
  setTimeout: (callback: () => void, delayMs: number) => number
  clearTimeout: (timerId: number) => void
}

export type PageReadResult<T> =
  | { ok: true, data: T }
  | {
    ok: false
    error: {
      code: PageContentErrorCode
      message: string
    }
  }

export type PageActionResult =
  | {
    ok: true
    data:
    | ActionResultData
    | WriteTextActionResultData
    | SetCheckedActionResultData
    | SelectOptionsActionResultData
    | SubmitFormActionResultData
  }
  | {
    ok: false
    error: {
      code: ActionResultErrorCode
      message: string
    }
  }

export interface PageReaderAdapter {
  getPageContext: () => Promise<PageReadResult<PageContext>>
  getPageContent: (index: number) => Promise<PageReadResult<PageContent>>
}

export interface PageActionAdapter {
  click: (target: ClickActionTarget) => Promise<PageActionResult>
  writeText: (
    target: WriteTextActionTarget | WriteTextEditableTarget,
    text: string,
  ) => Promise<PageActionResult>
  setChecked: (
    target: WriteTextActionTarget,
    checked: boolean,
  ) => Promise<PageActionResult>
  selectOptions: (
    target: WriteTextActionTarget,
    values: string[],
  ) => Promise<PageActionResult>
  submitForm: (target: { formId: string }) => Promise<PageActionResult>
}

export interface BrijioSocket {
  onopen: (() => void) | undefined
  onmessage: ((event: { data: string }) => void | Promise<void>) | undefined
  onclose: ((event: { code: number, reason: string }) => void) | undefined
  onerror: (() => void) | undefined
  send: (message: string) => void
  close: () => void
}

export interface BrijioBackgroundControllerOptions {
  action: ActionAdapter
  createWebSocket: (url: string) => BrijioSocket
  pageActions: PageActionAdapter
  pageReader: PageReaderAdapter
  setup: SetupAdapter
  storage: StorageAdapter
  timers: TimersAdapter
}

type ConnectionState = 'disconnected' | 'connecting' | 'reconnecting' | 'connected' | 'error'

const INITIAL_RECONNECT_DELAY_MS = 1000
const MAX_RECONNECT_DELAY_MS = 30000
const RECONNECT_BACKOFF_MULTIPLIER = 2

function describeCloseEvent (code: number, reason: string): string {
  if (reason.trim() !== '') {
    return `Connection closed (${code}): ${reason}`
  }
  switch (code) {
    case 1000: return 'Connection closed normally'
    case 1001: return 'Endpoint going away'
    case 1005: return 'Connection closed without status code'
    case 1006: return 'Connection lost (abnormal closure)'
    case 1007: return 'Invalid frame payload data'
    case 1008: return 'Policy violation'
    case 1009: return 'Message too large'
    case 1010: return 'Extension negotiation failed'
    case 1011: return 'Internal server error'
    case 1015: return 'TLS handshake failure'
    default: return `Connection closed (${code})`
  }
}

export class BrijioBackgroundController {
  private keepaliveTimerId: number | undefined
  private reconnectTimerId: number | undefined
  private reconnectAttempt: number = 0
  private socket: BrijioSocket | undefined
  private settings: BridgeSettings | undefined
  private connectionState: ConnectionState = 'disconnected'
  private lastErrorMessage: string | undefined
  private manualDisconnect: boolean = false
  private pendingRequestCount: number = 0

  constructor (
    private readonly options: BrijioBackgroundControllerOptions
  ) {}

  async handleActionClicked (): Promise<void> {
    if (this.socket !== undefined) {
      await this.disconnect()
      return
    }

    const settings = await this.options.storage.getBridgeSettings()

    if (!isUsableSettings(settings)) {
      await this.options.setup.openSetupPage()
      return
    }

    await this.connect(settings)
  }

  async saveBridgeSettings (settings: BridgeSettings): Promise<void> {
    await this.options.storage.setBridgeSettings(settings)
    await this.setStoppedState()
  }

  async getBridgeSettings (): Promise<BridgeSettings | undefined> {
    return await this.options.storage.getBridgeSettings()
  }

  async requestConnect (): Promise<void> {
    this.cancelReconnect()
    const settings = await this.options.storage.getBridgeSettings()
    if (!isUsableSettings(settings)) {
      await this.options.setup.openSetupPage()
      return
    }
    this.manualDisconnect = false
    await this.connect(settings)
  }

  async requestDisconnect (): Promise<void> {
    if (this.socket !== undefined) {
      await this.disconnect()
    }
  }

  isConnected (): boolean {
    return this.socket !== undefined
  }

  getConnectionStatus (): ConnectionStatus {
    const base: ConnectionStatus = {
      state: this.connectionState,
      pendingRequests: this.pendingRequestCount
    }
    if (this.connectionState === 'error' && this.lastErrorMessage !== undefined) {
      base.lastError = this.lastErrorMessage
    }
    if (this.connectionState === 'reconnecting') {
      base.reconnectAttempt = this.reconnectAttempt
    }
    return base
  }

  private async connect (settings: BridgeSettings): Promise<void> {
    this.cancelReconnect()
    const socket = this.options.createWebSocket(settings.websocketUrl)
    this.socket = socket
    this.settings = settings
    this.manualDisconnect = false
    this.reconnectAttempt = 0

    socket.onopen = () => {
      if (this.socket === socket) {
        socket.send(JSON.stringify(createAuthEnvelope(settings.pairingToken)))
        this.startKeepalive(socket)
        void this.setConnectedState()
      }
    }

    socket.onmessage = async (event) => {
      await this.handleSocketMessage(event.data)
    }

    socket.onclose = (event) => {
      if (this.socket !== socket) {
        return
      }
      this.socket = undefined
      this.stopKeepalive()
      if (this.manualDisconnect) {
        void this.setStoppedState()
        return
      }
      const message = describeCloseEvent(event.code, event.reason)
      this.lastErrorMessage = message
      void this.scheduleReconnect()
    }

    socket.onerror = () => {
      if (this.socket !== socket) {
        return
      }
      this.socket = undefined
      this.stopKeepalive()
      if (this.manualDisconnect) {
        void this.setStoppedState()
        return
      }
      const hadConnected = this.connectionState === 'connected' || this.reconnectAttempt > 0
      this.lastErrorMessage = hadConnected
        ? 'Connection lost unexpectedly'
        : 'Failed to connect to WebSocket server'
      void this.scheduleReconnect()
    }

    await this.setConnectingState()
  }

  private async disconnect (): Promise<void> {
    this.manualDisconnect = true
    this.cancelReconnect()
    const socket = this.socket
    this.socket = undefined
    this.settings = undefined

    this.stopKeepalive()
    socket?.close()
    await this.setStoppedState()
  }

  private async scheduleReconnect (): Promise<void> {
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY_MS * Math.pow(RECONNECT_BACKOFF_MULTIPLIER, this.reconnectAttempt),
      MAX_RECONNECT_DELAY_MS
    )
    const jitter = delay * 0.25 * (Math.random() * 2 - 1)
    const actualDelay = Math.max(100, delay + jitter)

    this.reconnectAttempt++
    await this.setReconnectingState()

    this.reconnectTimerId = this.options.timers.setTimeout(() => {
      this.reconnectTimerId = undefined
      if (this.manualDisconnect) {
        return
      }
      const settings = this.settings
      if (settings === undefined) {
        void this.setErrorState('No saved settings for reconnect')
        return
      }
      void this.connect(settings)
    }, actualDelay)
  }

  private cancelReconnect (): void {
    if (this.reconnectTimerId !== undefined) {
      this.options.timers.clearTimeout(this.reconnectTimerId)
      this.reconnectTimerId = undefined
    }
    this.reconnectAttempt = 0
  }

  private async handleSocketMessage (data: string): Promise<void> {
    let message: unknown

    try {
      message = JSON.parse(data)
    } catch {
      return
    }

    if (isAuthSuccessEnvelope(message)) {
      this.announcePresence()
      return
    }

    if (isBrowserPresenceRequestEnvelope(message)) {
      this.announcePresence()
      return
    }

    if (isGetPageContextEnvelope(message)) {
      this.pendingRequestCount++
      try {
        await this.handlePageContextRequest(message.id)
      } finally {
        this.pendingRequestCount--
      }
      return
    }

    if (isGetPageContentEnvelope(message)) {
      this.pendingRequestCount++
      try {
        await this.handlePageContentRequest(
          message.id,
          message.payload.index ?? 1
        )
      } finally {
        this.pendingRequestCount--
      }
      return
    }

    if (isPerformActionEnvelope(message)) {
      this.pendingRequestCount++
      try {
        await this.handlePerformActionRequest(message.id, message.payload.action)
      } finally {
        this.pendingRequestCount--
      }
      return
    }

    if (isPerformActionRequestEnvelope(message)) {
      this.pendingRequestCount++
      try {
        await this.handleInvalidPerformActionRequest(
          message.id,
          message.payload.action
        )
      } finally {
        this.pendingRequestCount--
      }
    }
  }

  private async handlePageContextRequest (
    requestId: string | undefined
  ): Promise<void> {
    const result = await this.options.pageReader.getPageContext()

    if (!result.ok) {
      this.socket?.send(
        JSON.stringify(
          createPageContextErrorResponse(
            requestId,
            result.error.code,
            result.error.message
          )
        )
      )
      return
    }

    this.socket?.send(
      JSON.stringify(createPageContextResponse(requestId, result.data))
    )
  }

  private async handlePageContentRequest (
    requestId: string | undefined,
    index: number
  ): Promise<void> {
    const result = await this.options.pageReader.getPageContent(index)

    if (!result.ok) {
      this.socket?.send(
        JSON.stringify(
          createPageContentErrorResponse(
            requestId,
            result.error.code,
            result.error.message
          )
        )
      )
      return
    }

    this.socket?.send(
      JSON.stringify(createPageContentResponse(requestId, result.data))
    )
  }

  private async handlePerformActionRequest (
    requestId: string | undefined,
    action:
    | {
      type: 'click'
      target: ClickActionTarget
    }
    | {
      type: 'write_text'
      target: WriteTextActionTarget | WriteTextEditableTarget
      text: string
    }
    | {
      type: 'set_checked'
      target: WriteTextActionTarget
      checked: boolean
    }
    | {
      type: 'select_options'
      target: WriteTextActionTarget
      values: string[]
    }
    | {
      type: 'submit_form'
      target: {
        formId: string
      }
    }
  ): Promise<void> {
    const result = await this.performPageAction(action)

    if (!result.ok) {
      this.socket?.send(
        JSON.stringify(
          createActionResultErrorResponse(
            requestId,
            result.error.code,
            result.error.message
          )
        )
      )
      return
    }

    this.socket?.send(
      JSON.stringify(createActionResultResponse(requestId, result.data))
    )
  }

  private async performPageAction (
    action:
    | {
      type: 'click'
      target: ClickActionTarget
    }
    | {
      type: 'write_text'
      target: WriteTextActionTarget | WriteTextEditableTarget
      text: string
    }
    | {
      type: 'set_checked'
      target: WriteTextActionTarget
      checked: boolean
    }
    | {
      type: 'select_options'
      target: WriteTextActionTarget
      values: string[]
    }
    | {
      type: 'submit_form'
      target: {
        formId: string
      }
    }
  ): Promise<PageActionResult> {
    if (action.type === 'click') {
      return await this.options.pageActions.click(action.target)
    }

    if (action.type === 'write_text') {
      return await this.options.pageActions.writeText(
        action.target,
        action.text
      )
    }

    if (action.type === 'set_checked') {
      return await this.options.pageActions.setChecked(
        action.target,
        action.checked
      )
    }

    if (action.type === 'select_options') {
      return await this.options.pageActions.selectOptions(
        action.target,
        action.values
      )
    }

    return await this.options.pageActions.submitForm(action.target)
  }

  private async handleInvalidPerformActionRequest (
    requestId: string | undefined,
    action: unknown
  ): Promise<void> {
    const error =
      isRecord(action) && action.type === 'click'
        ? {
            code: 'invalid_action_target' as const,
            message: 'Click targets must identify a link or action by ID.'
          }
        : isRecord(action) && action.type === 'write_text'
          ? {
              code: 'invalid_action_target' as const,
              message: 'Text targets must identify a form control by ID.'
            }
          : isRecord(action) && action.type === 'set_checked'
            ? {
                code: 'invalid_action_target' as const,
                message: 'Checked targets must identify a form control by ID.'
              }
            : isRecord(action) && action.type === 'select_options'
              ? {
                  code: 'invalid_action_target' as const,
                  message: 'Select targets must identify a form control by ID.'
                }
              : isRecord(action) && action.type === 'submit_form'
                ? {
                    code: 'invalid_action_target' as const,
                    message: 'Submit targets must identify a form by ID.'
                  }
                : {
                    code: 'unsupported_action' as const,
                    message:
                      'Only click, write_text, set_checked, select_options, and submit_form actions are supported.'
                  }

    this.socket?.send(
      JSON.stringify(
        createActionResultErrorResponse(requestId, error.code, error.message)
      )
    )
  }

  private async setConnectedState (): Promise<void> {
    this.connectionState = 'connected'
    this.lastErrorMessage = undefined
    this.reconnectAttempt = 0
    await this.options.action.setBadgeText('ON')
    await this.options.action.setBadgeColor('#1f8f4d')
    await this.options.action.setBadgeTextColor('#ffffff')
    await this.options.action.setTitle('Brijio connected')
  }

  private async setConnectingState (): Promise<void> {
    this.connectionState = 'connecting'
    this.lastErrorMessage = undefined
    await this.options.action.setBadgeText('...')
    await this.options.action.setBadgeColor('#f59e0b')
    await this.options.action.setBadgeTextColor('#ffffff')
    await this.options.action.setTitle('Brijio connecting')
  }

  private async setReconnectingState (): Promise<void> {
    this.connectionState = 'reconnecting'
    await this.options.action.setBadgeText('RCY')
    await this.options.action.setBadgeColor('#f59e0b')
    await this.options.action.setBadgeTextColor('#ffffff')
    await this.options.action.setTitle(`Brijio reconnecting (attempt ${this.reconnectAttempt})`)
  }

  private async setStoppedState (): Promise<void> {
    this.connectionState = 'disconnected'
    this.lastErrorMessage = undefined
    this.reconnectAttempt = 0
    await this.options.action.setBadgeText('OFF')
    await this.options.action.setBadgeColor('#666666')
    await this.options.action.setBadgeTextColor('#ffffff')
    await this.options.action.setTitle('Brijio stopped')
  }

  private async setErrorState (message: string = 'Brijio connection error'): Promise<void> {
    this.connectionState = 'error'
    this.lastErrorMessage = message
    await this.options.action.setBadgeText('ERR')
    await this.options.action.setBadgeColor('#b42318')
    await this.options.action.setBadgeTextColor('#ffffff')
    await this.options.action.setTitle(`Brijio error: ${message}`)
  }

  private startKeepalive (socket: BrijioSocket): void {
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

  private announcePresence (): void {
    if (this.socket === undefined || this.settings === undefined) {
      return
    }

    this.socket.send(
      JSON.stringify(
        createBrowserPresenceAnnounceEnvelope({
          browserInstanceId: this.settings.browserInstanceId,
          label: this.settings.label,
          browserName: this.settings.browserName,
          profileName: this.settings.profileName,
          capabilities: [
            'page_context',
            'page_content',
            'click',
            'fill_input',
            'fill_editable',
            'set_checked',
            'select_options',
            'submit_form',
            'navigate'
          ]
        })
      )
    )
  }
}

function isUsableSettings (
  settings: BridgeSettings | undefined
): settings is BridgeSettings {
  return (
    settings !== undefined &&
    settings.websocketUrl.trim() !== '' &&
    settings.pairingToken.trim() !== '' &&
    settings.browserInstanceId.trim() !== '' &&
    settings.browserName.trim() !== '' &&
    settings.profileName.trim() !== '' &&
    settings.label.trim() !== ''
  )
}

function isPerformActionRequestEnvelope (
  value: unknown
): value is WebSocketEnvelope & {
  payload: { type: 'perform_action', action: unknown }
} {
  if (!isRecord(value)) {
    return false
  }

  if (value.type !== 'message') {
    return false
  }

  if (Object.hasOwn(value, 'id') && typeof value.id !== 'string') {
    return false
  }

  if (!isRecord(value.payload)) {
    return false
  }

  return value.payload.type === 'perform_action'
}

function isRecord (value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
