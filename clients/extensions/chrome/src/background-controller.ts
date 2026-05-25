import {
  createActionResultErrorResponse,
  createActionResultResponse,
  createPageContentErrorResponse,
  createPageContentResponse,
  createPageContextErrorResponse,
  createPageContextResponse,
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

export interface TimersAdapter {
  setInterval: (callback: () => void, intervalMs: number) => number
  clearInterval: (timerId: number) => void
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
  pageActions: PageActionAdapter
  pageReader: PageReaderAdapter
  setup: SetupAdapter
  storage: StorageAdapter
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

    if (isGetPageContextEnvelope(message)) {
      await this.handlePageContextRequest(message.id)
      return
    }

    if (isGetPageContentEnvelope(message)) {
      await this.handlePageContentRequest(
        message.id,
        message.payload.index ?? 1
      )
      return
    }

    if (isPerformActionEnvelope(message)) {
      await this.handlePerformActionRequest(message.id, message.payload.action)
      return
    }

    if (isPerformActionRequestEnvelope(message)) {
      await this.handleInvalidPerformActionRequest(
        message.id,
        message.payload.action
      )
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
