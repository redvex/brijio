import {
  createActionResultErrorResponse,
  createActionResultResponse,
  createAuthEnvelope,
  createBrowserPresenceAnnounceEnvelope,
  createBatchResultResponse,
  createBatchResultErrorResponse,
  createDownloadFileErrorResponse,
  createDownloadFileResponse,
  createDownloadStatusErrorResponse,
  createDownloadStatusResponse,
  createFetchResourceCompleteResponse,
  createFetchResourceErrorResponse,
  createNavigateToUrlErrorResponse,
  createNavigateToUrlResponse,
  createPageContentErrorResponse,
  createPageContentResponse,
  createPageContextErrorResponse,
  createPageContextResponse,
  createTabListResponse,
  isAuthSuccessEnvelope,
  isBrowserPresenceRequestEnvelope,
  isDownloadFileEnvelope,
  isDownloadStatusEnvelope,
  isFetchResourceEnvelope,
  isGetPageContentEnvelope,
  isGetPageContextEnvelope,
  isListTabsEnvelope,
  isNavigateToUrlEnvelope,
  isPerformActionEnvelope,
  isPerformBatchEnvelope,
  type ActionResultData,
  type ActionResultErrorCode,
  type ClickActionTarget,
  type NavigateToUrlErrorCode,
  type NavigateToUrlResult,
  type SelectOptionsActionResultData,
  type SetCheckedActionResultData,
  type SubmitFormActionResultData,
  type UploadFileActionResultData,
  type FileUploadPayload,
  type PageContent,
  type PageContentErrorCode,
  type PageContext,
  type TabInfo,
  type WebSocketEnvelope,
  type WriteTextActionResultData,
  type WriteTextEditableTarget,
  type WriteTextActionTarget,
  type BatchAction,
  type BatchActionError,
  type BatchResultEntry,
  type DownloadInfo,
  type FetchResourceInfo
} from './protocol.js'

import { type ContentBatchRequest, type BatchResult } from './batch-handler.js'

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
    | UploadFileActionResultData
  }
  | {
    ok: false
    error: {
      code: ActionResultErrorCode
      message: string
    }
  }

export interface PageReaderAdapter {
  getPageContext: (tabId?: number) => Promise<PageReadResult<PageContext>>
  getPageContent: (index: number, tabId?: number) => Promise<PageReadResult<PageContent>>
}

export interface PageActionAdapter {
  click: (
    target: ClickActionTarget,
    pageContextId?: number,
    visibleContextId?: string,
    tabId?: number,
  ) => Promise<PageActionResult>
  writeText: (
    target: WriteTextActionTarget | WriteTextEditableTarget,
    text: string,
    pageContextId?: number,
    visibleContextId?: string,
    tabId?: number,
  ) => Promise<PageActionResult>
  setChecked: (
    target: WriteTextActionTarget,
    checked: boolean,
    pageContextId?: number,
    visibleContextId?: string,
    tabId?: number,
  ) => Promise<PageActionResult>
  selectOptions: (
    target: WriteTextActionTarget,
    values: string[],
    pageContextId?: number,
    visibleContextId?: string,
    tabId?: number,
  ) => Promise<PageActionResult>
  submitForm: (
    target: { formId: string, expectedLabel?: string },
    pageContextId?: number,
    visibleContextId?: string,
    tabId?: number,
  ) => Promise<PageActionResult>
  uploadFile: (
    target: WriteTextActionTarget,
    file: FileUploadPayload,
    pageContextId?: number,
    visibleContextId?: string,
    tabId?: number,
  ) => Promise<PageActionResult>
}

export interface PageBatchAdapter {
  performBatch: (message: ContentBatchRequest, tabId?: number) => Promise<BatchResult>
}

export type PageNavigationResult =
  | { ok: true, data: NavigateToUrlResult }
  | {
    ok: false
    error: {
      code: NavigateToUrlErrorCode
      message: string
    }
  }

export interface PageNavigationAdapter {
  navigateToUrl: (url: string, tabId?: number) => Promise<PageNavigationResult>
}

export type DownloadStatusResult =
  | {
    ok: true
    data: {
      capability: 'full' | 'not_supported'
      items: Array<DownloadInfo | FetchResourceInfo>
    }
  }
  | { ok: false, error: { code: string, message: string } }

export type DownloadFileResult =
  | {
    ok: true
    data: {
      downloadId: number | null
      status: 'initiated' | 'initiated_fire_and_forget'
    }
  }
  | { ok: false, error: { code: string, message: string } }

export type FetchResourceResult =
  | {
    ok: true
    data: {
      fetchId: string
      contentType: string | null
      totalBytes: number | null
      dataBase64: string
      sha256: string
    }
  }
  | { ok: false, error: { code: string, message: string } }

export interface DownloadAdapter {
  downloadStatus: (
    ids?: Array<number | string>,
  ) => Promise<DownloadStatusResult>
  downloadFile: (
    url: string,
    filename?: string,
    conflictAction?: 'uniquify' | 'overwrite',
  ) => Promise<DownloadFileResult>
  fetchResource: (
    url: string,
    maxSizeBytes?: number,
    timeout?: number,
  ) => Promise<FetchResourceResult>
}

export type ApprovalActionType =
  | 'submit_form'
  | 'fetch_resource'
  | 'download_file'

export type ApprovalDecision = 'approve' | 'approve_session' | 'deny'

export interface ApprovalRequest {
  actionUUID: string
  actionType: ApprovalActionType
  origin: string
  timeoutMs: number
}

export interface ApprovalAdapter {
  getActiveOrigin: () => Promise<string | undefined>
  requestApproval: (request: ApprovalRequest) => Promise<ApprovalDecision>
  hideApproval: (actionUUID: string) => Promise<void>
}

export interface TabListerAdapter {
  listTabs: () => Promise<
  | { ok: true, data: { tabs: TabInfo[] } }
  | { ok: false, error: { code: string, message: string } }
  >
}

type ApprovalCheckResult =
  | { ok: true }
  | {
    ok: false
    error: {
      code: ActionResultErrorCode
      message: string
      actionUUID?: string
    }
  }

type ApprovalCheckError = Extract<ApprovalCheckResult, { ok: false }>['error']

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
  approval?: ApprovalAdapter
  approvalTimeoutMs?: number
  createWebSocket: (url: string) => BrijioSocket
  download?: DownloadAdapter
  pageActions: PageActionAdapter
  pageBatch: PageBatchAdapter
  pageNavigation: PageNavigationAdapter
  pageReader: PageReaderAdapter
  setup: SetupAdapter
  storage: StorageAdapter
  tabLister?: TabListerAdapter
  timers: TimersAdapter
}

type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'reconnecting'
  | 'connected'
  | 'error'

const INITIAL_RECONNECT_DELAY_MS = 1000
const MAX_RECONNECT_DELAY_MS = 30000
const RECONNECT_BACKOFF_MULTIPLIER = 2

function describeCloseEvent (code: number, reason: string): string {
  if (reason.trim() !== '') {
    return `Connection closed (${code}): ${reason}`
  }
  switch (code) {
    case 1000:
      return 'Connection closed normally'
    case 1001:
      return 'Endpoint going away'
    case 1005:
      return 'Connection closed without status code'
    case 1006:
      return 'Connection lost (abnormal closure)'
    case 1007:
      return 'Invalid frame payload data'
    case 1008:
      return 'Policy violation'
    case 1009:
      return 'Message too large'
    case 1010:
      return 'Extension negotiation failed'
    case 1011:
      return 'Internal server error'
    case 1015:
      return 'TLS handshake failure'
    default:
      return `Connection closed (${code})`
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
  private readonly approvalSessionGrants = new Set<string>()

  constructor (private readonly options: BrijioBackgroundControllerOptions) {}

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
    if (
      this.connectionState === 'error' &&
      this.lastErrorMessage !== undefined
    ) {
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
      const hadConnected =
        this.connectionState === 'connected' || this.reconnectAttempt > 0
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
    this.approvalSessionGrants.clear()

    this.stopKeepalive()
    socket?.close()
    await this.setStoppedState()
  }

  private async scheduleReconnect (): Promise<void> {
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY_MS *
        Math.pow(RECONNECT_BACKOFF_MULTIPLIER, this.reconnectAttempt),
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

    const tabId = extractTabId(message)

    if (isAuthSuccessEnvelope(message)) {
      this.announcePresence()
      return
    }

    if (isBrowserPresenceRequestEnvelope(message)) {
      this.announcePresence()
      return
    }

    if (isListTabsEnvelope(message)) {
      this.pendingRequestCount++
      try {
        await this.handleListTabsRequest(message.id)
      } finally {
        this.pendingRequestCount--
      }
      return
    }

    if (isGetPageContextEnvelope(message)) {
      this.pendingRequestCount++
      try {
        await this.handlePageContextRequest(message.id, tabId)
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
          message.payload.index ?? 1,
          tabId
        )
      } finally {
        this.pendingRequestCount--
      }
      return
    }

    if (isPerformActionEnvelope(message)) {
      this.pendingRequestCount++
      try {
        await this.handlePerformActionRequest(
          message.id,
          message.payload.action,
          message.payload.pageContextId,
          message.payload.visibleContextId,
          tabId
        )
      } finally {
        this.pendingRequestCount--
      }
      return
    }

    if (isNavigateToUrlEnvelope(message)) {
      this.pendingRequestCount++
      try {
        await this.handleNavigateToUrlRequest(message.id, message.payload.url, tabId)
      } finally {
        this.pendingRequestCount--
      }
      return
    }

    if (isPerformBatchEnvelope(message)) {
      this.pendingRequestCount++
      try {
        await this.handlePerformBatchRequest(message.id, message.payload, tabId)
      } finally {
        this.pendingRequestCount--
      }
      return
    }

    if (isDownloadStatusEnvelope(message)) {
      this.pendingRequestCount++
      try {
        await this.handleDownloadStatusRequest(message.id, message.payload.ids)
      } finally {
        this.pendingRequestCount--
      }
      return
    }

    if (isDownloadFileEnvelope(message)) {
      this.pendingRequestCount++
      try {
        await this.handleDownloadFileRequest(
          message.id,
          message.payload.url,
          message.payload.filename,
          message.payload.conflictAction,
          message.payload.actionUUID,
          message.payload.approvalRequest
        )
      } finally {
        this.pendingRequestCount--
      }
      return
    }

    if (isFetchResourceEnvelope(message)) {
      this.pendingRequestCount++
      try {
        await this.handleFetchResourceRequest(
          message.id,
          message.payload.url,
          message.payload.maxSizeBytes,
          message.payload.timeout,
          message.payload.actionUUID,
          message.payload.approvalRequest
        )
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
    requestId: string | undefined,
    tabId?: number
  ): Promise<void> {
    const result = await this.options.pageReader.getPageContext(tabId)

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

  private async handleListTabsRequest (
    requestId: string | undefined
  ): Promise<void> {
    if (this.options.tabLister === undefined) {
      this.socket?.send(
        JSON.stringify({
          type: 'message',
          id: requestId,
          payload: {
            type: 'tab_list_response',
            ok: false,
            error: {
              code: 'not_supported',
              message: 'Tab listing is not supported by this browser.'
            }
          }
        })
      )
      return
    }

    const result = await this.options.tabLister.listTabs()

    if (!result.ok) {
      this.socket?.send(
        JSON.stringify({
          type: 'message',
          id: requestId,
          payload: {
            type: 'tab_list_response',
            ok: false,
            error: result.error
          }
        })
      )
      return
    }

    this.socket?.send(
      JSON.stringify(createTabListResponse(requestId, result.data.tabs))
    )
  }

  private async handlePageContentRequest (
    requestId: string | undefined,
    index: number,
    tabId?: number
  ): Promise<void> {
    const result = await this.options.pageReader.getPageContent(index, tabId)

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
    action: BatchAction,
    pageContextId?: number,
    visibleContextId?: string,
    tabId?: number
  ): Promise<void> {
    const approval = await this.ensureApprovedAction(action)
    if (!approval.ok) {
      this.socket?.send(
        JSON.stringify(
          createActionResultErrorResponse(
            requestId,
            approval.error.code,
            approval.error.message,
            approval.error.actionUUID
          )
        )
      )
      return
    }

    const result = await this.performPageAction(
      action,
      pageContextId,
      visibleContextId,
      tabId
    )

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

  private async handlePerformBatchRequest (
    requestId: string | undefined,
    payload: {
      actions: BatchAction[]
      continueOnError?: boolean
      readAfterActions?: boolean
      pageContextId?: number
      visibleContextId?: string
    },
    tabId?: number
  ): Promise<void> {
    const batchMessage: ContentBatchRequest = {
      type: 'perform_batch',
      actions: payload.actions,
      ...(payload.pageContextId !== undefined
        ? { pageContextId: payload.pageContextId }
        : {}),
      ...(payload.visibleContextId !== undefined
        ? { visibleContextId: payload.visibleContextId }
        : {}),
      ...(payload.continueOnError !== undefined
        ? { continueOnError: payload.continueOnError }
        : {}),
      ...(payload.readAfterActions !== undefined
        ? { readAfterActions: payload.readAfterActions }
        : {})
    }

    if (hasApprovalGatedAction(payload.actions)) {
      const result = await this.performApprovalAwareBatch(batchMessage, tabId)
      this.socket?.send(
        JSON.stringify(
          createBatchResultResponse(
            requestId,
            result.results,
            result.aborted,
            result.ok
          )
        )
      )
      return
    }

    let result: BatchResult
    try {
      result = await this.options.pageBatch.performBatch(batchMessage, tabId)
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unexpected batch error.'
      this.socket?.send(
        JSON.stringify(
          createBatchResultErrorResponse(requestId, 'batch_failed', message)
        )
      )
      return
    }

    this.socket?.send(
      JSON.stringify(
        createBatchResultResponse(
          requestId,
          result.results,
          result.aborted,
          result.ok
        )
      )
    )
  }

  private async handleNavigateToUrlRequest (
    requestId: string | undefined,
    url: string,
    tabId?: number
  ): Promise<void> {
    let result: PageNavigationResult
    try {
      result = await this.options.pageNavigation.navigateToUrl(url, tabId)
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unexpected navigation error.'
      this.socket?.send(
        JSON.stringify(
          createNavigateToUrlErrorResponse(
            requestId,
            'navigation_failed',
            message
          )
        )
      )
      return
    }

    if (!result.ok) {
      this.socket?.send(
        JSON.stringify(
          createNavigateToUrlErrorResponse(
            requestId,
            result.error.code,
            result.error.message
          )
        )
      )
      return
    }

    this.socket?.send(
      JSON.stringify(createNavigateToUrlResponse(requestId, result.data))
    )
  }

  private async handleDownloadStatusRequest (
    requestId: string | undefined,
    ids?: Array<number | string>
  ): Promise<void> {
    if (this.options.download === undefined) {
      this.socket?.send(
        JSON.stringify(
          createDownloadStatusErrorResponse(
            requestId,
            'not_supported',
            'Download status is not supported by this browser.'
          )
        )
      )
      return
    }

    const result = await this.options.download.downloadStatus(ids)
    if (!result.ok) {
      this.socket?.send(
        JSON.stringify(
          createDownloadStatusErrorResponse(
            requestId,
            result.error.code,
            result.error.message
          )
        )
      )
      return
    }

    this.socket?.send(
      JSON.stringify(
        createDownloadStatusResponse(
          requestId,
          result.data.capability,
          result.data.items
        )
      )
    )
  }

  private async handleDownloadFileRequest (
    requestId: string | undefined,
    url: string,
    filename?: string,
    conflictAction?: 'uniquify' | 'overwrite',
    actionUUID?: string,
    approvalRequest?: boolean
  ): Promise<void> {
    if (this.options.download === undefined) {
      this.socket?.send(
        JSON.stringify(
          createDownloadFileErrorResponse(
            requestId,
            'not_supported',
            'File download is not supported by this browser.'
          )
        )
      )
      return
    }

    const approval = await this.ensureApprovedAction({
      type: 'download_file',
      actionUUID,
      approvalRequest
    })
    if (!approval.ok) {
      this.socket?.send(
        JSON.stringify(
          createDownloadFileErrorResponse(
            requestId,
            approval.error.code,
            approval.error.message
          )
        )
      )
      return
    }

    const result = await this.options.download.downloadFile(
      url,
      filename,
      conflictAction
    )
    if (!result.ok) {
      this.socket?.send(
        JSON.stringify(
          createDownloadFileErrorResponse(
            requestId,
            result.error.code,
            result.error.message
          )
        )
      )
      return
    }

    this.socket?.send(
      JSON.stringify(
        createDownloadFileResponse(
          requestId,
          result.data.downloadId,
          result.data.status
        )
      )
    )
  }

  private async handleFetchResourceRequest (
    requestId: string | undefined,
    url: string,
    maxSizeBytes?: number,
    timeout?: number,
    actionUUID?: string,
    approvalRequest?: boolean
  ): Promise<void> {
    if (this.options.download === undefined) {
      this.socket?.send(
        JSON.stringify(
          createFetchResourceErrorResponse(
            requestId,
            'not_supported',
            'Fetch resource is not supported by this browser.'
          )
        )
      )
      return
    }

    const approval = await this.ensureApprovedAction({
      type: 'fetch_resource',
      actionUUID,
      approvalRequest
    })
    if (!approval.ok) {
      this.socket?.send(
        JSON.stringify(
          createFetchResourceErrorResponse(
            requestId,
            approval.error.code,
            approval.error.message
          )
        )
      )
      return
    }

    const result = await this.options.download.fetchResource(
      url,
      maxSizeBytes,
      timeout
    )
    if (!result.ok) {
      this.socket?.send(
        JSON.stringify(
          createFetchResourceErrorResponse(
            requestId,
            result.error.code,
            result.error.message
          )
        )
      )
      return
    }

    // Single-message fast path; start/chunk streaming can be added later.
    this.socket?.send(
      JSON.stringify(
        createFetchResourceCompleteResponse(
          requestId,
          result.data.fetchId,
          result.data.sha256,
          result.data.totalBytes ?? 0,
          result.data.dataBase64,
          result.data.contentType
        )
      )
    )
  }

  private async performApprovalAwareBatch (
    request: ContentBatchRequest,
    tabId?: number
  ): Promise<BatchResult> {
    const results: BatchResultEntry[] = []
    let aborted = false
    const continueOnError = request.continueOnError === true

    for (let index = 0; index < request.actions.length; index++) {
      if (aborted) {
        results.push(createSkippedBatchEntry())
        continue
      }

      const action = request.actions[index]
      const approval = await this.ensureApprovedAction(action)
      if (!approval.ok) {
        const isTimeout = approval.error.code === 'approval_timeout'
        results.push({
          ok: false,
          error: createBatchErrorFromApproval(approval.error, isTimeout)
        })

        if (isTimeout) {
          aborted = true
          for (let remaining = index + 1; remaining < request.actions.length; remaining++) {
            results.push(createSkippedAfterApprovalTimeoutEntry(request.actions[remaining]))
          }
          break
        }

        continue
      }

      const result = await this.performPageAction(
        action,
        request.pageContextId,
        request.visibleContextId,
        tabId
      )

      if (result.ok) {
        results.push({ ok: true, data: result.data })
        continue
      }

      results.push({
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          aborted: false
        }
      })

      if (!continueOnError) {
        aborted = true
      }
    }

    if (request.readAfterActions === true) {
      const readResult = await this.options.pageReader.getPageContext(tabId)
      if (readResult.ok) {
        results.push({ ok: true, data: readResult.data })
      } else {
        results.push({
          ok: false,
          error: {
            code: readResult.error.code as BatchActionError['code'],
            message: readResult.error.message,
            aborted: false
          }
        })
      }
    }

    return {
      ok: results.every((entry) => entry.ok),
      results,
      aborted
    }
  }

  private async ensureApprovedAction (
    action: { type: string, actionUUID?: string, approvalRequest?: boolean }
  ): Promise<ApprovalCheckResult> {
    const actionType = getApprovalActionType(action.type)
    if (actionType === undefined || action.approvalRequest !== true) {
      return { ok: true }
    }

    const actionUUID = action.actionUUID
    if (actionUUID === undefined || actionUUID.trim() === '') {
      return {
        ok: false,
        error: {
          code: 'approval_unavailable',
          message: 'Approval request is missing an actionUUID.'
        }
      }
    }

    const approval = this.options.approval
    if (approval === undefined) {
      return {
        ok: false,
        error: {
          code: 'approval_unavailable',
          message: 'Action approval is not available.',
          actionUUID
        }
      }
    }

    const origin = await approval.getActiveOrigin()
    if (origin === undefined || origin.trim() === '') {
      return {
        ok: false,
        error: {
          code: 'approval_unavailable',
          message: 'Active tab origin is not available for approval.',
          actionUUID
        }
      }
    }

    const grantKey = createApprovalGrantKey(origin, actionType)
    if (this.approvalSessionGrants.has(grantKey)) {
      return { ok: true }
    }

    const timeoutMs = this.options.approvalTimeoutMs ?? 55000
    const decision = await this.waitForApprovalDecision({
      actionUUID,
      actionType,
      origin,
      timeoutMs
    })
    if (decision === 'timeout') {
      return {
        ok: false,
        error: {
          code: 'approval_timeout',
          message: 'Timed out waiting for user approval.',
          actionUUID
        }
      }
    }

    if (decision === 'deny') {
      return {
        ok: false,
        error: {
          code: 'approval_denied',
          message: `User denied approval for ${actionType}.`,
          actionUUID
        }
      }
    }

    const activeOrigin = await approval.getActiveOrigin()
    if (activeOrigin !== origin) {
      return {
        ok: false,
        error: {
          code: 'approval_origin_changed',
          message: 'Active tab origin changed before approved action could run.',
          actionUUID
        }
      }
    }

    if (decision === 'approve_session') {
      this.approvalSessionGrants.add(grantKey)
    }

    return { ok: true }
  }

  private async waitForApprovalDecision (
    request: ApprovalRequest
  ): Promise<ApprovalDecision | 'timeout'> {
    const approval = this.options.approval
    if (approval === undefined) {
      return 'timeout'
    }

    let timeoutId: number | undefined
    const timeout = new Promise<'timeout'>((resolve) => {
      timeoutId = this.options.timers.setTimeout(() => {
        void approval.hideApproval(request.actionUUID)
        resolve('timeout')
      }, request.timeoutMs)
    })

    const decision = approval.requestApproval(request)
    const result = await Promise.race([decision, timeout])

    if (timeoutId !== undefined) {
      this.options.timers.clearTimeout(timeoutId)
    }

    return result
  }

  private async performPageAction (
    action: BatchAction,
    pageContextId?: number,
    visibleContextId?: string,
    tabId?: number
  ): Promise<PageActionResult> {
    if (action.type === 'click') {
      return await this.options.pageActions.click(
        action.target,
        pageContextId,
        visibleContextId,
        tabId
      )
    }

    if (action.type === 'write_text') {
      return await this.options.pageActions.writeText(
        action.target,
        action.text,
        pageContextId,
        visibleContextId,
        tabId
      )
    }

    if (action.type === 'set_checked') {
      return await this.options.pageActions.setChecked(
        action.target,
        action.checked,
        pageContextId,
        visibleContextId,
        tabId
      )
    }

    if (action.type === 'select_options') {
      return await this.options.pageActions.selectOptions(
        action.target,
        action.values,
        pageContextId,
        visibleContextId,
        tabId
      )
    }

    if (action.type === 'upload_file') {
      return await this.options.pageActions.uploadFile(
        action.target,
        action.file,
        pageContextId,
        visibleContextId,
        tabId
      )
    }

    return await this.options.pageActions.submitForm(
      action.target,
      pageContextId,
      visibleContextId,
      tabId
    )
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
                : isRecord(action) && action.type === 'upload_file'
                  ? {
                      code: 'invalid_action_target' as const,
                      message:
                        'Upload targets must identify a file input by ID.'
                    }
                  : {
                      code: 'unsupported_action' as const,
                      message:
                        'Only click, write_text, set_checked, select_options, submit_form, and upload_file actions are supported.'
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
    await this.options.action.setTitle(
      `Brijio reconnecting (attempt ${this.reconnectAttempt})`
    )
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

  private async setErrorState (
    message: string = 'Brijio connection error'
  ): Promise<void> {
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
            'navigate',
            ...(this.options.download !== undefined
              ? ([
                  'download_status',
                  'download_file',
                  'fetch_resource'
                ] as const)
              : [])
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

function getApprovalActionType (type: string): ApprovalActionType | undefined {
  if (
    type === 'submit_form' ||
    type === 'fetch_resource' ||
    type === 'download_file'
  ) {
    return type
  }

  return undefined
}

function hasApprovalGatedAction (actions: BatchAction[]): boolean {
  return actions.some(
    (action) =>
      action.approvalRequest === true &&
      getApprovalActionType(action.type) !== undefined
  )
}

function createApprovalGrantKey (
  origin: string,
  actionType: ApprovalActionType
): string {
  return `${origin}\u0000${actionType}`
}

function createBatchErrorFromApproval (
  error: ApprovalCheckError,
  aborted: boolean
): BatchActionError {
  return {
    code: error.code,
    message: error.message,
    aborted,
    ...(error.actionUUID !== undefined ? { actionUUID: error.actionUUID } : {})
  }
}

function createSkippedAfterApprovalTimeoutEntry (
  action: BatchAction
): BatchResultEntry {
  return {
    ok: false,
    error: {
      code: 'approval_timeout',
      message: 'Skipped because approval timed out before this action.',
      aborted: true,
      ...(action.actionUUID !== undefined ? { actionUUID: action.actionUUID } : {})
    }
  }
}

function createSkippedBatchEntry (): BatchResultEntry {
  return {
    ok: false,
    error: {
      code: 'page_navigated',
      message: 'Action skipped: previous action caused page navigation or abort.',
      aborted: true
    }
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

/**
 * Extract tabId from the envelope's `target` field and parse to a number.
 * The MCP server puts `tabId` as a string in `message.target.tabId`.
 * Returns `undefined` when no tabId is present (falls back to active tab).
 */
function extractTabId (message: unknown): number | undefined {
  if (!isRecord(message)) return undefined
  const target = message.target
  if (!isRecord(target)) return undefined
  if (typeof target.tabId !== 'string' || target.tabId.length === 0) return undefined
  const numericId = Number.parseInt(target.tabId, 10)
  return Number.isSafeInteger(numericId) ? numericId : undefined
}
