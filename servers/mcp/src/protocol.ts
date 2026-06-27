export interface WebSocketEnvelope {
  type: 'message'
  id?: string
  target?: {
    browserInstanceId?: string
  }
  payload: unknown
}

export interface BrowserPresence {
  browserInstanceId: string
  label: string
  browserName: string
  profileName: string
  connectedAt: string
  lastSeenAt: string
  capabilities: string[]
}

export interface PageHeading {
  id: string
  level: number
  text: string
}

export interface PageLandmark {
  id: string
  role: string
  name: string
}

export interface PageLink {
  id: string
  text: string
  href: string
}

export interface PageImage {
  id: string
  alt: string
  src: string
}

export type PageFormControlValueState = 'empty' | 'filled' | 'unknown'
export type PageFormControlFilledBy = 'brijio' | 'user_or_page'
export type PageFormControlValidityReason =
  | 'value_missing'
  | 'type_mismatch'
  | 'pattern_mismatch'
  | 'too_short'
  | 'too_long'
  | 'range_underflow'
  | 'range_overflow'
  | 'step_mismatch'
  | 'bad_input'
  | 'custom_error'
  | 'unknown'

export interface PageFormControlValidity {
  valid: boolean
  reason?: PageFormControlValidityReason
}

export interface PageFormControlOption {
  label: string
  value: string
  selected: boolean
}

export interface PageFormControl {
  id: string
  label: string
  type: string
  required: boolean
  requiredSource?: 'html' | 'aria'
  disabled: boolean
  readonly?: boolean
  sensitive: boolean
  valueState: PageFormControlValueState
  filledBy?: PageFormControlFilledBy
  checked?: boolean
  multiple?: boolean
  options?: PageFormControlOption[]
  validity?: PageFormControlValidity
}

export interface PageForm {
  id: string
  label: string
  controls: PageFormControl[]
}

export interface PageAction {
  id: string
  role: string
  name: string
  enabled: boolean
}

export interface PageContext {
  pageContextId?: number
  visibleContextId?: string
  url: string
  title: string
  timestamp: string
  selectedText: string | null
  preview: {
    content: string
    truncated: boolean
    maxBytes: number
  }
  structure: {
    headings: PageHeading[]
    landmarks: PageLandmark[]
    links: PageLink[]
    images: PageImage[]
    forms: PageForm[]
    actions: PageAction[]
  }
  content: {
    available: boolean
    requestType: 'get_page_content'
    firstIndex: 1
    defaultMaxPayloadBytes: number
  }
}

export interface PageContent {
  url: string
  title: string
  timestamp: string
  index: number
  content: string
  truncated: boolean
  maxPayloadBytes: number
}

export interface ClickElementTarget {
  kind: 'link' | 'action'
  id: string
  expectedText?: string
  expectedHref?: string
  expectedRole?: string
}

export interface ClickObserved {
  /** Whether a navigation appears to have started (URL changed) */
  navigationStarted?: boolean
  /** If a disclosure/summary was clicked, its new open state */
  detailsOpen?: boolean
}

export interface ClickElementActionResultData {
  action: 'click'
  target: ClickElementTarget
  /** What was detectable about the page after the click */
  observed?: ClickObserved
}

export interface FillInputTarget {
  formId: string
  controlId: string
  expectedLabel?: string
}

export interface EditableTarget {
  kind: 'editable'
  id: string
  expectedText?: string
}

export type WriteTextTarget = FillInputTarget | EditableTarget

export interface FillInputActionResultData {
  action: 'write_text'
  target: WriteTextTarget
  textLength: number
  contextStale?: boolean
  contextStaleReason?: 'visible_controls_changed'
}

export interface SetCheckedActionResultData {
  action: 'set_checked'
  target: FillInputTarget
  checked: boolean
  changed: boolean
  contextStale?: boolean
  contextStaleReason?: 'visible_controls_changed'
}

export interface SelectOptionsActionResultData {
  action: 'select_options'
  target: FillInputTarget
  values: string[]
  contextStale?: boolean
  contextStaleReason?: 'visible_controls_changed'
}

export interface SubmitFormValidationError {
  formId: string
  controlId: string
  label: string
  type: string
  reason: PageFormControlValidityReason
}

export interface SubmitFormTarget {
  formId: string
  expectedLabel?: string
}

export interface FileUploadPayload {
  fileName: string
  mimeType: string
  contentBase64: string
  sizeBytes: number
  lastModified?: number
}

export interface UploadFileActionResultData {
  action: 'upload_file'
  target: FillInputTarget
  fileName: string
  mimeType: string
  sizeBytes: number
  fileCount: number
  contextStale?: boolean
  contextStaleReason?: 'visible_controls_changed'
}

export interface ApprovalRequestOptions {
  actionUUID?: string
  approvalRequest?: boolean
}

export interface SubmitFormActionResultData {
  action: 'submit_form'
  target: SubmitFormTarget
  submitted?: boolean
  validationErrors?: SubmitFormValidationError[]
  contextStale?: boolean
  contextStaleReason?: 'visible_controls_changed'
}

export type BrijioErrorCode =
  | 'auth_required'
  | 'auth_failed'
  | 'invalid_auth_message'
  | 'browser_unavailable'
  | 'ambiguous_browser_target'
  | 'invalid_browser_target'
  | 'connection_failed'
  | 'timeout'
  | 'invalid_response'
  | 'browser_error'
  | 'batch_failed'
  | 'stale_context'
  | 'page_navigated'
  | 'invalid_resource_uri'
  | 'unsupported_scheme'

export interface StaleContextDetail {
  id: string
  kind: string
  expectedText?: string
  foundText?: string
  expectedHref?: string
  foundHref?: string
  expectedRole?: string
  foundRole?: string
  expectedLabel?: string
  foundLabel?: string
  expectedType?: string
  foundType?: string
  formId?: string
  controlId?: string
  previousContextId?: number
  currentContextId?: number
  previousVisibleContextId?: string
  currentVisibleContextId?: string
}

export type BrijioResourceResult<T> =
  | {
    ok: true
    data: T
  }
  | {
    ok: false
    error: {
      code: string
      message: string
      detail?: StaleContextDetail
      browsers?: BrowserPresence[]
    }
  }

export type BrijioPageContextResult = BrijioResourceResult<PageContext>

export type BrijioPageContentResult = BrijioResourceResult<PageContent>

export type BrijioClickElementResult =
  BrijioResourceResult<ClickElementActionResultData>

export type BrijioFillInputResult =
  BrijioResourceResult<FillInputActionResultData>

export type BrijioSetCheckedResult =
  BrijioResourceResult<SetCheckedActionResultData>

export type BrijioSelectOptionsResult =
  BrijioResourceResult<SelectOptionsActionResultData>

export type BrijioSubmitFormResult =
  BrijioResourceResult<SubmitFormActionResultData>

export type BrijioUploadFileResult =
  BrijioResourceResult<UploadFileActionResultData>

export type BrijioBrowserListResult = BrijioResourceResult<{
  browsers: BrowserPresence[]
}>

// --- Download & Fetch result types (ADR 0047) ---

export interface DownloadStatusResultData {
  capability: 'full' | 'not_supported'
  items: Array<{
    id: number | string
    kind: 'download' | 'fetch'
    filename?: string
    url: string
    mime?: string | null
    size?: number | null
    state: string
    error?: string
  }>
}

export type BrijioDownloadStatusResult =
  BrijioResourceResult<DownloadStatusResultData>

export interface DownloadFileResultData {
  downloadId: number | null
  status: 'initiated' | 'initiated_fire_and_forget'
}

export type BrijioDownloadFileResult =
  BrijioResourceResult<DownloadFileResultData>

export interface FetchResourceResultData {
  fetchId: string
  contentType: string | null
  totalBytes: number
  sha256: string
  dataBase64: string
}

export type BrijioFetchResourceResult =
  BrijioResourceResult<FetchResourceResultData>

export type PageContextParseResult =
  | BrijioPageContextResult
  | { ok: false, ignored: true }

export type PageContentParseResult =
  | BrijioPageContentResult
  | { ok: false, ignored: true }

export type ActionResultParseResult =
  | BrijioClickElementResult
  | BrijioFillInputResult
  | BrijioSetCheckedResult
  | BrijioSelectOptionsResult
  | BrijioSubmitFormResult
  | BrijioUploadFileResult
  | { ok: false, ignored: true }

export type BrowserListParseResult =
  | BrijioBrowserListResult
  | { ok: false, ignored: true }

export interface NavigateToUrlResultData {
  url: string
  title: string
  timestamp: string
  redirected: boolean
  navigationMs: number
}

export type BrijioNavigateToUrlResult =
  BrijioResourceResult<NavigateToUrlResultData>

export type NavigateToUrlParseResult =
  | BrijioNavigateToUrlResult
  | { ok: false, ignored: true }

// --- Batch result types (ADR 0044) ---

export interface BatchActionError {
  code: string
  message: string
  detail?: StaleContextDetail
  aborted: boolean
}

export type BatchActionOutcome =
  | {
    ok: true
    data:
    | ClickElementActionResultData
    | FillInputActionResultData
    | SetCheckedActionResultData
    | SelectOptionsActionResultData
    | SubmitFormActionResultData
    | UploadFileActionResultData
  }
  | { ok: false, error: BatchActionError }

export type BatchReadOutcome =
  | { ok: true, data: PageContext }
  | { ok: false, error: BatchActionError }

export type BatchResultEntry = BatchActionOutcome | BatchReadOutcome

export interface BrijioBatchResult {
  ok: boolean
  results: BatchResultEntry[]
  aborted: boolean
}

export type BrijioBatchResultParseResult =
  | { ok: true, data: BrijioBatchResult }
  | { ok: false, data: BrijioBatchResult }
  | {
    ok: false
    error: {
      code: string
      message: string
      detail?: StaleContextDetail
      browsers?: BrowserPresence[]
    }
  }
  | { ok: false, ignored: true }

// --- Download & Fetch parse result types (ADR 0047) ---

export type DownloadStatusParseResult =
  | BrijioDownloadStatusResult
  | { ok: false, ignored: true }

export type DownloadFileParseResult =
  | BrijioDownloadFileResult
  | { ok: false, ignored: true }

export type FetchResourceParseResult =
  | BrijioFetchResourceResult
  | { ok: false, ignored: true }

export function createNavigateToUrlEnvelope (
  requestId: string,
  url: string
): WebSocketEnvelope {
  return {
    type: 'message',
    id: requestId,
    payload: {
      type: 'navigate_to_url',
      url
    }
  }
}

export function createGetPageContextEnvelope (
  requestId: string
): WebSocketEnvelope {
  return {
    type: 'message',
    id: requestId,
    payload: {
      type: 'get_page_context'
    }
  }
}

export function createGetPageContentEnvelope (
  requestId: string,
  index: number
): WebSocketEnvelope {
  return {
    type: 'message',
    id: requestId,
    payload: {
      type: 'get_page_content',
      index
    }
  }
}

export function createClickElementEnvelope (
  requestId: string,
  target: ClickElementTarget,
  pageContextId?: number,
  visibleContextId?: string
): WebSocketEnvelope {
  return {
    type: 'message',
    id: requestId,
    payload: {
      type: 'perform_action',
      ...(pageContextId !== undefined ? { pageContextId } : {}),
      ...(visibleContextId !== undefined ? { visibleContextId } : {}),
      action: {
        type: 'click',
        target
      }
    }
  }
}

export function createFillInputEnvelope (
  requestId: string,
  target: FillInputTarget,
  text: string,
  pageContextId?: number,
  visibleContextId?: string
): WebSocketEnvelope {
  return {
    type: 'message',
    id: requestId,
    payload: {
      type: 'perform_action',
      ...(pageContextId !== undefined ? { pageContextId } : {}),
      ...(visibleContextId !== undefined ? { visibleContextId } : {}),
      action: {
        type: 'write_text',
        target,
        text
      }
    }
  }
}

export function createWriteEditableEnvelope (
  requestId: string,
  target: EditableTarget,
  text: string,
  pageContextId?: number,
  visibleContextId?: string
): WebSocketEnvelope {
  return {
    type: 'message',
    id: requestId,
    payload: {
      type: 'perform_action',
      ...(pageContextId !== undefined ? { pageContextId } : {}),
      ...(visibleContextId !== undefined ? { visibleContextId } : {}),
      action: {
        type: 'write_text',
        target,
        text
      }
    }
  }
}

export function createSetCheckedEnvelope (
  requestId: string,
  target: FillInputTarget,
  checked: boolean,
  pageContextId?: number,
  visibleContextId?: string
): WebSocketEnvelope {
  return {
    type: 'message',
    id: requestId,
    payload: {
      type: 'perform_action',
      ...(pageContextId !== undefined ? { pageContextId } : {}),
      ...(visibleContextId !== undefined ? { visibleContextId } : {}),
      action: {
        type: 'set_checked',
        target,
        checked
      }
    }
  }
}

export function createSelectOptionsEnvelope (
  requestId: string,
  target: FillInputTarget,
  values: string[],
  pageContextId?: number,
  visibleContextId?: string
): WebSocketEnvelope {
  return {
    type: 'message',
    id: requestId,
    payload: {
      type: 'perform_action',
      ...(pageContextId !== undefined ? { pageContextId } : {}),
      ...(visibleContextId !== undefined ? { visibleContextId } : {}),
      action: {
        type: 'select_options',
        target,
        values
      }
    }
  }
}

export function createUploadFileEnvelope (
  requestId: string,
  target: FillInputTarget,
  file: FileUploadPayload,
  pageContextId?: number,
  visibleContextId?: string
): WebSocketEnvelope {
  return {
    type: 'message',
    id: requestId,
    payload: {
      type: 'perform_action',
      ...(pageContextId !== undefined ? { pageContextId } : {}),
      ...(visibleContextId !== undefined ? { visibleContextId } : {}),
      action: {
        type: 'upload_file',
        target,
        file
      }
    }
  }
}

export function createSubmitFormEnvelope (
  requestId: string,
  target: SubmitFormTarget,
  pageContextId?: number,
  visibleContextId?: string,
  approval?: ApprovalRequestOptions
): WebSocketEnvelope {
  return {
    type: 'message',
    id: requestId,
    payload: {
      type: 'perform_action',
      ...(pageContextId !== undefined ? { pageContextId } : {}),
      ...(visibleContextId !== undefined ? { visibleContextId } : {}),
      action: {
        type: 'submit_form',
        target,
        ...(approval?.actionUUID !== undefined
          ? { actionUUID: approval.actionUUID }
          : {}),
        ...(approval?.approvalRequest !== undefined
          ? { approvalRequest: approval.approvalRequest }
          : {})
      }
    }
  }
}

export function createPerformBatchEnvelope (
  requestId: string,
  actions: Array<Record<string, unknown>>,
  options?: {
    pageContextId?: number
    visibleContextId?: string
    continueOnError?: boolean
    readAfterActions?: boolean
  }
): WebSocketEnvelope {
  const payload: Record<string, unknown> = {
    type: 'perform_batch',
    actions,
    ...(options?.pageContextId !== undefined
      ? { pageContextId: options.pageContextId }
      : {}),
    ...(options?.visibleContextId !== undefined
      ? { visibleContextId: options.visibleContextId }
      : {}),
    ...(options?.continueOnError !== undefined
      ? { continueOnError: options.continueOnError }
      : {}),
    ...(options?.readAfterActions !== undefined
      ? { readAfterActions: options.readAfterActions }
      : {})
  }

  return {
    type: 'message',
    id: requestId,
    payload
  }
}

export function createDownloadStatusEnvelope (
  requestId: string,
  ids?: Array<number | string>,
  browserInstanceId?: string
): WebSocketEnvelope {
  const payload: Record<string, unknown> = { type: 'download_status' }
  if (ids !== undefined) {
    payload.ids = ids
  }

  return {
    type: 'message',
    id: requestId,
    ...(browserInstanceId !== undefined
      ? { target: { browserInstanceId } }
      : {}),
    payload
  }
}

export function createDownloadFileEnvelope (
  requestId: string,
  url: string,
  filename?: string,
  conflictAction?: 'uniquify' | 'overwrite',
  browserInstanceId?: string,
  approval?: ApprovalRequestOptions
): WebSocketEnvelope {
  const payload: Record<string, unknown> = { type: 'download_file', url }
  if (filename !== undefined) {
    payload.filename = filename
  }
  if (conflictAction !== undefined) {
    payload.conflictAction = conflictAction
  }
  if (approval?.actionUUID !== undefined) {
    payload.actionUUID = approval.actionUUID
  }
  if (approval?.approvalRequest !== undefined) {
    payload.approvalRequest = approval.approvalRequest
  }

  return {
    type: 'message',
    id: requestId,
    ...(browserInstanceId !== undefined
      ? { target: { browserInstanceId } }
      : {}),
    payload
  }
}

export function createFetchResourceEnvelope (
  requestId: string,
  url: string,
  maxSizeBytes?: number,
  timeout?: number,
  browserInstanceId?: string,
  approval?: ApprovalRequestOptions
): WebSocketEnvelope {
  const payload: Record<string, unknown> = { type: 'fetch_resource', url }
  if (maxSizeBytes !== undefined) {
    payload.maxSizeBytes = maxSizeBytes
  }
  if (timeout !== undefined) {
    payload.timeout = timeout
  }
  if (approval?.actionUUID !== undefined) {
    payload.actionUUID = approval.actionUUID
  }
  if (approval?.approvalRequest !== undefined) {
    payload.approvalRequest = approval.approvalRequest
  }

  return {
    type: 'message',
    id: requestId,
    ...(browserInstanceId !== undefined
      ? { target: { browserInstanceId } }
      : {}),
    payload
  }
}

export function parseBatchResultEnvelope (
  value: unknown,
  requestId: string
): BrijioBatchResultParseResult {
  if (!isRecord(value) || value.type !== 'message') {
    return invalidResponse()
  }

  if (value.id !== requestId) {
    return { ok: false, ignored: true }
  }

  if (!isRecord(value.payload)) {
    return invalidResponse()
  }

  if (value.payload.type !== 'batch_result') {
    return invalidResponse()
  }

  // Batch-level error (no browser, timeout, etc.)
  if (value.payload.ok === false && !Object.hasOwn(value.payload, 'results')) {
    if (
      !isRecord(value.payload.error) ||
      typeof value.payload.error.message !== 'string'
    ) {
      return invalidResponse()
    }

    return {
      ok: false,
      error: {
        code: mapBatchErrorCode(value.payload.error.code),
        message: value.payload.error.message
      }
    }
  }

  // Success or partial-failure response with results array
  if (!Array.isArray(value.payload.results)) {
    return invalidResponse()
  }

  const results: BatchResultEntry[] = []

  for (const entry of value.payload.results) {
    if (!isRecord(entry)) {
      return invalidResponse()
    }

    if (entry.ok === true) {
      // Could be an action result or a page context read result
      if (isRecord(entry.data) && Object.hasOwn(entry.data, 'action')) {
        const actionResult = parseActionResultData(entry.data)
        if (actionResult === null) {
          return invalidResponse()
        }
        results.push({ ok: true, data: actionResult })
      } else if (isPageContext(entry.data)) {
        results.push({ ok: true, data: entry.data })
      } else {
        return invalidResponse()
      }
    } else if (entry.ok === false) {
      if (!isRecord(entry.error) || typeof entry.error.message !== 'string') {
        return invalidResponse()
      }

      const aborted = entry.error.aborted === true
      const detail = isStaleContextDetail(entry.error.detail)
        ? entry.error.detail
        : undefined

      results.push({
        ok: false,
        error: {
          code: mapBatchErrorCode(entry.error.code),
          message: entry.error.message,
          ...(detail !== undefined ? { detail } : {}),
          aborted
        }
      })
    } else {
      return invalidResponse()
    }
  }

  const aborted = value.payload.aborted === true

  if (results.every((entry) => entry.ok)) {
    return {
      ok: true,
      data: { ok: true, results, aborted }
    }
  }

  return {
    ok: false,
    data: { ok: false, results, aborted }
  }
}

function parseActionResultData (
  data: Record<PropertyKey, unknown>
):
  | ClickElementActionResultData
  | FillInputActionResultData
  | SetCheckedActionResultData
  | SelectOptionsActionResultData
  | SubmitFormActionResultData
  | UploadFileActionResultData
  | null {
  if (isClickElementActionResultData(data)) {
    return data
  }
  if (isFillInputActionResultData(data)) {
    return data
  }
  if (isSetCheckedActionResultData(data)) {
    return data
  }
  if (isSelectOptionsActionResultData(data)) {
    return data
  }
  if (isSubmitFormActionResultData(data)) {
    return data
  }
  if (isUploadFileActionResultData(data)) {
    return data
  }
  return null
}

function mapBatchErrorCode (code: unknown): string {
  if (typeof code === 'string') {
    if (code === 'page_navigated') {
      return 'stale_context'
    }
    return code
  }
  return 'browser_error'
}

export function parsePageContextEnvelope (
  value: unknown,
  requestId: string
): PageContextParseResult {
  if (!isRecord(value) || value.type !== 'message') {
    return invalidResponse()
  }

  if (value.id !== requestId) {
    return { ok: false, ignored: true }
  }

  if (!isRecord(value.payload)) {
    return invalidResponse()
  }

  if (value.payload.type !== 'page_context_response') {
    return invalidResponse()
  }

  if (value.payload.ok === true) {
    return parsePageContextSuccessPayload(value.payload)
  }

  if (value.payload.ok === false) {
    return parseErrorPayload(value.payload, invalidPageContextResponse())
  }

  return invalidPageContextResponse()
}

export function parsePageContentEnvelope (
  value: unknown,
  requestId: string
): PageContentParseResult {
  if (!isRecord(value) || value.type !== 'message') {
    return invalidResponse()
  }

  if (value.id !== requestId) {
    return { ok: false, ignored: true }
  }

  if (!isRecord(value.payload)) {
    return invalidResponse()
  }

  if (value.payload.type !== 'page_content_response') {
    return invalidResponse()
  }

  if (value.payload.ok === true) {
    return parsePageContentSuccessPayload(value.payload)
  }

  if (value.payload.ok === false) {
    return parseErrorPayload(value.payload, invalidResponse())
  }

  return invalidResponse()
}

export function parseActionResultEnvelope (
  value: unknown,
  requestId: string
): ActionResultParseResult {
  if (!isRecord(value) || value.type !== 'message') {
    return invalidResponse()
  }

  if (value.id !== requestId) {
    return { ok: false, ignored: true }
  }

  if (!isRecord(value.payload)) {
    return invalidResponse()
  }

  if (value.payload.type !== 'action_result') {
    return invalidResponse()
  }

  if (value.payload.ok === true) {
    return parseActionResultSuccessPayload(value.payload)
  }

  if (value.payload.ok === false) {
    return parseErrorPayload(value.payload, invalidResponse())
  }

  return invalidResponse()
}

export function parseBrowserListEnvelope (
  value: unknown,
  requestId: string
): BrowserListParseResult {
  if (!isRecord(value) || value.type !== 'message') {
    return invalidResponse()
  }

  if (value.id !== requestId) {
    return { ok: false, ignored: true }
  }

  if (!isRecord(value.payload) || value.payload.type !== 'browser_list') {
    return invalidResponse()
  }

  if (value.payload.ok !== true || !isRecord(value.payload.data)) {
    return invalidResponse()
  }

  if (!isArrayOf(value.payload.data.browsers, isBrowserPresence)) {
    return invalidResponse()
  }

  return {
    ok: true,
    data: {
      browsers: value.payload.data.browsers
    }
  }
}

export function parseNavigateToUrlEnvelope (
  value: unknown,
  requestId: string
): NavigateToUrlParseResult {
  if (!isRecord(value) || value.type !== 'message') {
    return invalidResponse()
  }

  if (value.id !== requestId) {
    return { ok: false, ignored: true }
  }

  if (!isRecord(value.payload)) {
    return invalidResponse()
  }

  if (value.payload.type !== 'navigate_to_url_response') {
    return invalidResponse()
  }

  if (value.payload.ok === true) {
    return parseNavigateToUrlSuccessPayload(value.payload)
  }

  if (value.payload.ok === false) {
    return parseErrorPayload(value.payload, invalidResponse())
  }

  return invalidResponse()
}

export function parseDownloadStatusEnvelope (
  value: unknown,
  requestId: string
): DownloadStatusParseResult {
  if (!isRecord(value) || value.type !== 'message') {
    return invalidResponse()
  }

  if (value.id !== requestId) {
    return { ok: false, ignored: true }
  }

  if (!isRecord(value.payload)) {
    return invalidResponse()
  }

  if (value.payload.type !== 'download_status_response') {
    return invalidResponse()
  }

  if (value.payload.ok === true) {
    const capability = value.payload.capability
    if (capability !== 'full' && capability !== 'not_supported') {
      return invalidResponse()
    }

    if (!Array.isArray(value.payload.items)) {
      return invalidResponse()
    }

    const items = value.payload.items
      .map((item: unknown) => {
        if (!isRecord(item)) return null
        return {
          id: (item as Record<string, unknown>).id as number | string,
          kind: (item as Record<string, unknown>).kind as 'download' | 'fetch',
          filename: (item as Record<string, unknown>).filename as
            | string
            | undefined,
          url: (item as Record<string, unknown>).url as string,
          mime: (item as Record<string, unknown>).mime as
            | string
            | null
            | undefined,
          size: (item as Record<string, unknown>).size as
            | number
            | null
            | undefined,
          state: (item as Record<string, unknown>).state as string,
          error: (item as Record<string, unknown>).error as string | undefined
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)

    return {
      ok: true,
      data: {
        capability,
        items
      }
    }
  }

  if (value.payload.ok === false) {
    return parseErrorPayload(value.payload, invalidResponse())
  }

  return invalidResponse()
}

export function parseDownloadFileEnvelope (
  value: unknown,
  requestId: string
): DownloadFileParseResult {
  if (!isRecord(value) || value.type !== 'message') {
    return invalidResponse()
  }

  if (value.id !== requestId) {
    return { ok: false, ignored: true }
  }

  if (!isRecord(value.payload)) {
    return invalidResponse()
  }

  if (value.payload.type !== 'download_file_response') {
    return invalidResponse()
  }

  if (value.payload.ok === true) {
    const downloadId = value.payload.downloadId
    const status = value.payload.status
    if (status !== 'initiated' && status !== 'initiated_fire_and_forget') {
      return invalidResponse()
    }

    return {
      ok: true,
      data: {
        downloadId: downloadId as number | null,
        status
      }
    }
  }

  if (value.payload.ok === false) {
    return parseErrorPayload(value.payload, invalidResponse())
  }

  return invalidResponse()
}

export function parseFetchResourceEnvelope (
  value: unknown,
  requestId: string
): FetchResourceParseResult {
  if (!isRecord(value) || value.type !== 'message') {
    return invalidResponse()
  }

  if (value.id !== requestId) {
    return { ok: false, ignored: true }
  }

  if (!isRecord(value.payload)) {
    return invalidResponse()
  }

  // fetch_resource uses a streaming protocol — the response may arrive as
  // multiple messages (start, chunks, complete) or a single error.
  // For the MCP tool we reassemble everything, so the final message
  // from the extension is either fetch_resource_complete or fetch_resource_error.

  if (value.payload.type === 'fetch_resource_complete') {
    const fetchId = value.payload.fetchId
    const sha256 = value.payload.sha256
    const totalBytes = value.payload.totalBytes

    if (
      typeof fetchId !== 'string' ||
      typeof sha256 !== 'string' ||
      typeof totalBytes !== 'number'
    ) {
      return invalidResponse()
    }

    // The dataBase64 is collected from preceding chunk messages and
    // passed through the websocket-client's response accumulator.
    // For now, we expect it on the payload directly (single-chunk fast path).
    const dataBase64 =
      typeof value.payload.dataBase64 === 'string'
        ? value.payload.dataBase64
        : ''

    return {
      ok: true,
      data: {
        fetchId,
        contentType:
          typeof value.payload.contentType === 'string'
            ? value.payload.contentType
            : null,
        totalBytes,
        sha256,
        dataBase64
      }
    }
  }

  if (value.payload.type === 'fetch_resource_error') {
    const errorCode =
      typeof value.payload.error === 'string' ? value.payload.error : 'unknown'
    const message = value.payload.message

    if (typeof message !== 'string') {
      return invalidResponse()
    }

    return {
      ok: false,
      error: {
        code: 'browser_error' as BrijioErrorCode,
        message: `fetch_resource_error:${errorCode}: ${message}`
      }
    }
  }

  if (value.payload.ok === false) {
    return parseErrorPayload(value.payload, invalidResponse())
  }

  return invalidResponse()
}

export function parseRouterErrorEnvelope (
  value: unknown
): BrijioResourceResult<never> | { ok: false, ignored: true } {
  if (!isRecord(value) || value.type !== 'error') {
    return { ok: false, ignored: true }
  }

  if (!isRecord(value.error) || typeof value.error.message !== 'string') {
    return invalidResponse()
  }

  // Forward any string code — the WS server may emit codes not in the
  // MCP server's BrijioErrorCode union (e.g. invalid_message, invalid_json).
  // The agent benefits from seeing the real error, not a generic replacement.
  const code = typeof value.error.code === 'string' ? value.error.code : 'invalid_response'

  return {
    ok: false,
    error: {
      code,
      message: value.error.message,
      ...(isArrayOf(value.error.browsers, isBrowserPresence)
        ? { browsers: value.error.browsers }
        : {})
    }
  }
}

function parsePageContextSuccessPayload (
  payload: Record<PropertyKey, unknown>
): BrijioPageContextResult {
  if (!isPageContext(payload.data)) {
    return invalidPageContextResponse()
  }

  return {
    ok: true,
    data: payload.data
  }
}

function parsePageContentSuccessPayload (
  payload: Record<PropertyKey, unknown>
): BrijioPageContentResult {
  if (!isPageContent(payload.data)) {
    return invalidResponse()
  }

  return {
    ok: true,
    data: payload.data
  }
}

function parseActionResultSuccessPayload (
  payload: Record<PropertyKey, unknown>
):
  | BrijioClickElementResult
  | BrijioFillInputResult
  | BrijioSetCheckedResult
  | BrijioSelectOptionsResult
  | BrijioSubmitFormResult
  | BrijioUploadFileResult {
  const data = payload.data

  if (isClickElementActionResultData(data)) {
    return {
      ok: true,
      data
    }
  }

  if (isFillInputActionResultData(data)) {
    return {
      ok: true,
      data
    }
  }

  if (isSetCheckedActionResultData(data)) {
    return {
      ok: true,
      data
    }
  }

  if (isSelectOptionsActionResultData(data)) {
    return {
      ok: true,
      data
    }
  }

  if (isSubmitFormActionResultData(data)) {
    return {
      ok: true,
      data
    }
  }

  if (isUploadFileActionResultData(data)) {
    return {
      ok: true,
      data
    }
  }

  return invalidResponse()
}

function parseErrorPayload<T> (
  payload: Record<PropertyKey, unknown>,
  fallback: BrijioResourceResult<T>
): BrijioResourceResult<T> {
  if (!isRecord(payload.error) || typeof payload.error.message !== 'string') {
    return fallback
  }

  const code = payload.error.code
  // Preserve stale_context and page_navigated with their structured detail
  if (code === 'stale_context') {
    const detail = isStaleContextDetail(payload.error.detail)
      ? payload.error.detail
      : undefined
    return {
      ok: false,
      error: {
        code: 'stale_context',
        message: payload.error.message,
        ...(detail !== undefined ? { detail } : {})
      }
    }
  }

  if (code === 'page_navigated') {
    const detail = isStaleContextDetail(payload.error.detail)
      ? payload.error.detail
      : undefined
    return {
      ok: false,
      error: {
        code: 'page_navigated',
        message: payload.error.message,
        ...(detail !== undefined ? { detail } : {})
      }
    }
  }

  // Forward the original error code from the extension (e.g. not_supported,
  // cors_blocked, http_error, size_exceeded). The agent can act on the
  // specific code rather than receiving a generic browser_error.
  const forwardedCode = typeof code === 'string' ? code : 'browser_error'

  return {
    ok: false,
    error: {
      code: forwardedCode,
      message: payload.error.message
    }
  }
}

export function unsupportedSchemeResponse (
  scheme: string
): BrijioResourceResult<never> {
  return {
    ok: false,
    error: {
      code: 'unsupported_scheme',
      message: `URL scheme '${scheme}' is not supported. Only http and https are allowed.`
    }
  }
}

function parseNavigateToUrlSuccessPayload (
  payload: Record<PropertyKey, unknown>
): BrijioNavigateToUrlResult {
  if (!isNavigateToUrlResultData(payload.data)) {
    return invalidResponse()
  }

  return {
    ok: true,
    data: payload.data
  }
}

export function isNavigateToUrlResultData (
  value: unknown
): value is NavigateToUrlResultData {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.url === 'string' &&
    typeof value.title === 'string' &&
    typeof value.timestamp === 'string' &&
    typeof value.redirected === 'boolean' &&
    typeof value.navigationMs === 'number'
  )
}

export function invalidResponse (): BrijioResourceResult<never> {
  return {
    ok: false,
    error: {
      code: 'invalid_response',
      message: 'Received an invalid Brijio response.'
    }
  }
}

export function invalidPageContextResponse (): BrijioPageContextResult {
  return {
    ok: false,
    error: {
      code: 'invalid_response',
      message: 'Received an invalid page context response.'
    }
  }
}

export function invalidResourceUriResponse (): BrijioResourceResult<never> {
  return {
    ok: false,
    error: {
      code: 'invalid_resource_uri',
      message:
        'Page content resource URI must end with a positive 1-based index.'
    }
  }
}

export function timeoutResponse (
  message = 'Timed out waiting for a browser page context response.'
): BrijioResourceResult<never> {
  return {
    ok: false,
    error: {
      code: 'timeout',
      message
    }
  }
}

export function connectionFailedResponse (
  websocketUrl: string
): BrijioResourceResult<never> {
  return {
    ok: false,
    error: {
      code: 'connection_failed',
      message: `Unable to connect to Brijio WebSocket at ${websocketUrl}.`
    }
  }
}

export function authRequiredResponse (): BrijioResourceResult<never> {
  return {
    ok: false,
    error: {
      code: 'auth_required',
      message:
        'BRIJIO_PAIRING_TOKEN or BROWSERBRIDGE_PAIRING_TOKEN must be configured.'
    }
  }
}

export function createAuthEnvelope (token: string): WebSocketEnvelope {
  return {
    type: 'message',
    payload: {
      type: 'auth',
      role: 'mcp',
      token
    }
  }
}

function isPageContext (value: unknown): value is PageContext {
  if (!isRecord(value)) {
    return false
  }

  if (
    typeof value.url !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.timestamp !== 'string' ||
    !(typeof value.selectedText === 'string' || value.selectedText === null)
  ) {
    return false
  }

  if (
    value.pageContextId !== undefined &&
    typeof value.pageContextId !== 'number'
  ) {
    return false
  }

  if (
    value.visibleContextId !== undefined &&
    typeof value.visibleContextId !== 'string'
  ) {
    return false
  }

  if (!isPagePreview(value.preview)) {
    return false
  }

  if (!isRecord(value.structure)) {
    return false
  }

  if (
    !isArrayOf(value.structure.headings, isPageHeading) ||
    !isArrayOf(value.structure.landmarks, isPageLandmark) ||
    !isArrayOf(value.structure.links, isPageLink) ||
    !isArrayOf(value.structure.images, isPageImage) ||
    !isArrayOf(value.structure.forms, isPageForm) ||
    !isArrayOf(value.structure.actions, isPageAction)
  ) {
    return false
  }

  if (!isRecord(value.content)) {
    return false
  }

  return (
    (value.content.available === true || value.content.available === false) &&
    value.content.requestType === 'get_page_content' &&
    value.content.firstIndex === 1 &&
    isPositiveNumber(value.content.defaultMaxPayloadBytes)
  )
}

function isPageContent (value: unknown): value is PageContent {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.url === 'string' &&
    typeof value.title === 'string' &&
    typeof value.timestamp === 'string' &&
    typeof value.index === 'number' &&
    Number.isInteger(value.index) &&
    value.index >= 1 &&
    typeof value.content === 'string' &&
    typeof value.truncated === 'boolean' &&
    isPositiveNumber(value.maxPayloadBytes)
  )
}

function isPagePreview (value: unknown): value is PageContext['preview'] {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.content === 'string' &&
    typeof value.truncated === 'boolean' &&
    isPositiveNumber(value.maxBytes)
  )
}

function isPageHeading (value: unknown): value is PageHeading {
  return (
    hasStringProperties(value, ['id', 'text']) &&
    isRecord(value) &&
    typeof value.level === 'number' &&
    Number.isInteger(value.level) &&
    value.level >= 1
  )
}

function isPageLandmark (value: unknown): value is PageLandmark {
  return hasStringProperties(value, ['id', 'role', 'name'])
}

function isPageLink (value: unknown): value is PageLink {
  return hasStringProperties(value, ['id', 'text', 'href'])
}

function isPageImage (value: unknown): value is PageImage {
  return hasStringProperties(value, ['id', 'alt', 'src'])
}

function isPageFormControl (value: unknown): value is PageFormControl {
  if (!hasStringProperties(value, ['id', 'label', 'type'])) {
    return false
  }

  return (
    isRecord(value) &&
    typeof value.required === 'boolean' &&
    typeof value.disabled === 'boolean' &&
    typeof value.sensitive === 'boolean'
  )
}

function isPageForm (value: unknown): value is PageForm {
  if (!hasStringProperties(value, ['id', 'label']) || !isRecord(value)) {
    return false
  }

  return isArrayOf(value.controls, isPageFormControl)
}

function isPageAction (value: unknown): value is PageAction {
  if (!hasStringProperties(value, ['id', 'role', 'name'])) {
    return false
  }

  return isRecord(value) && typeof value.enabled === 'boolean'
}

function isBrowserPresence (value: unknown): value is BrowserPresence {
  return (
    hasStringProperties(value, [
      'browserInstanceId',
      'label',
      'browserName',
      'profileName',
      'connectedAt',
      'lastSeenAt'
    ]) &&
    isRecord(value) &&
    Array.isArray(value.capabilities) &&
    value.capabilities.every((capability) => typeof capability === 'string')
  )
}

function isStaleContextDetail (value: unknown): value is StaleContextDetail {
  if (!isRecord(value)) {
    return false
  }

  if (typeof value.id !== 'string' || typeof value.kind !== 'string') {
    return false
  }

  // Optional string fields
  const optionalStrings: Array<keyof StaleContextDetail> = [
    'expectedText',
    'foundText',
    'expectedHref',
    'foundHref',
    'expectedRole',
    'foundRole',
    'expectedLabel',
    'foundLabel',
    'expectedType',
    'foundType',
    'formId',
    'controlId',
    'previousVisibleContextId',
    'currentVisibleContextId'
  ]

  for (const key of optionalStrings) {
    if (value[key] !== undefined && typeof value[key] !== 'string') {
      return false
    }
  }

  // Optional number fields
  const optionalNumbers: Array<keyof StaleContextDetail> = [
    'previousContextId',
    'currentContextId'
  ]

  for (const key of optionalNumbers) {
    if (value[key] !== undefined && typeof value[key] !== 'number') {
      return false
    }
  }

  return true
}

function isClickElementActionResultData (
  value: unknown
): value is ClickElementActionResultData {
  if (!isRecord(value)) {
    return false
  }

  return value.action === 'click' && isClickElementTarget(value.target)
}

function isFillInputActionResultData (
  value: unknown
): value is FillInputActionResultData {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.action === 'write_text' &&
    isWriteTextTarget(value.target) &&
    typeof value.textLength === 'number' &&
    Number.isInteger(value.textLength) &&
    value.textLength >= 0
  )
}

function isSetCheckedActionResultData (
  value: unknown
): value is SetCheckedActionResultData {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.action === 'set_checked' &&
    isFillInputTarget(value.target) &&
    typeof value.checked === 'boolean' &&
    typeof value.changed === 'boolean'
  )
}

function isSelectOptionsActionResultData (
  value: unknown
): value is SelectOptionsActionResultData {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.action === 'select_options' &&
    isFillInputTarget(value.target) &&
    isArrayOf(value.values, isString)
  )
}

function isSubmitFormActionResultData (
  value: unknown
): value is SubmitFormActionResultData {
  if (!isRecord(value)) {
    return false
  }

  return value.action === 'submit_form' && isSubmitFormTarget(value.target)
}

function isUploadFileActionResultData (
  value: unknown
): value is UploadFileActionResultData {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.action === 'upload_file' &&
    isFillInputTarget(value.target) &&
    typeof value.fileName === 'string' &&
    typeof value.mimeType === 'string' &&
    Number.isInteger(value.sizeBytes) &&
    Number(value.sizeBytes) >= 0 &&
    Number.isInteger(value.fileCount) &&
    Number(value.fileCount) >= 0
  )
}

function isClickElementTarget (value: unknown): value is ClickElementTarget {
  if (!isRecord(value)) {
    return false
  }

  if (
    (value.kind !== 'link' && value.kind !== 'action') ||
    typeof value.id !== 'string'
  ) {
    return false
  }

  // Validate optional fields — if present, must be strings
  if (
    value.expectedText !== undefined &&
    typeof value.expectedText !== 'string'
  ) {
    return false
  }
  if (
    value.expectedHref !== undefined &&
    typeof value.expectedHref !== 'string'
  ) {
    return false
  }
  if (
    value.expectedRole !== undefined &&
    typeof value.expectedRole !== 'string'
  ) {
    return false
  }

  return true
}

function isFillInputTarget (value: unknown): value is FillInputTarget {
  if (!hasStringProperties(value, ['formId', 'controlId'])) {
    return false
  }

  if (
    isRecord(value) &&
    value.expectedLabel !== undefined &&
    typeof value.expectedLabel !== 'string'
  ) {
    return false
  }

  return true
}

function isEditableTarget (value: unknown): value is EditableTarget {
  if (!isRecord(value)) {
    return false
  }

  if (value.kind !== 'editable' || typeof value.id !== 'string') {
    return false
  }

  if (
    value.expectedText !== undefined &&
    typeof value.expectedText !== 'string'
  ) {
    return false
  }

  return true
}

function isWriteTextTarget (value: unknown): value is WriteTextTarget {
  return isFillInputTarget(value) || isEditableTarget(value)
}

function isSubmitFormTarget (value: unknown): value is SubmitFormTarget {
  if (!hasStringProperties(value, ['formId'])) {
    return false
  }

  if (
    isRecord(value) &&
    value.expectedLabel !== undefined &&
    typeof value.expectedLabel !== 'string'
  ) {
    return false
  }

  return true
}

function hasStringProperties (value: unknown, properties: string[]): boolean {
  if (!isRecord(value)) {
    return false
  }

  return properties.every((property) => typeof value[property] === 'string')
}

function isArrayOf<T> (
  value: unknown,
  predicate: (item: unknown) => item is T
): value is T[] {
  return Array.isArray(value) && value.every(predicate)
}

function isString (value: unknown): value is string {
  return typeof value === 'string'
}

function isPositiveNumber (value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isRecord (value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
