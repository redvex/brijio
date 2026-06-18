export interface WebSocketEnvelope {
  type: 'message'
  id?: string
  target?: {
    browserInstanceId?: string
  }
  payload: unknown
}

export const defaultPageContentMaxPayloadBytes = 131072

export type BrijioEnvelope = WebSocketEnvelope

export type BrijioRole = 'extension' | 'mcp'

export type BrowserCapability =
  | 'page_context'
  | 'page_content'
  | 'click'
  | 'fill_input'
  | 'fill_editable'
  | 'set_checked'
  | 'select_options'
  | 'submit_form'
  | 'navigate'
  | 'batch'
  | 'upload_file'
  | 'download_status'
  | 'download_file'
  | 'fetch_resource'

export interface BrowserPresence {
  browserInstanceId: string
  label: string
  browserName: string
  profileName: string
  connectedAt?: string
  lastSeenAt?: string
  capabilities: BrowserCapability[]
}

export interface AuthPayload {
  type: 'auth'
  role: BrijioRole
  token: string
}

export interface AuthSuccessPayload {
  type: 'auth_success'
}

export interface BrowserPresenceRequestPayload {
  type: 'browser_presence_request'
}

export interface BrowserPresenceAnnouncePayload extends BrowserPresence {
  type: 'browser_presence_announce'
}

export interface StageFileUploadStartPayload {
  type: 'stage_file_upload_start'
  uploadId: string
  file: {
    name: string
    size: number
    type?: string
    sha256?: string
  }
  chunkSize: number
  totalChunks: number
}

export interface StageFileUploadStartEnvelope {
  type: 'message'
  id?: string
  target: { browserInstanceId?: string }
  payload: StageFileUploadStartPayload
}

export interface StageFileUploadChunkPayload {
  type: 'stage_file_upload_chunk'
  uploadId: string
  index: number
  dataBase64: string
}

export interface StageFileUploadChunkEnvelope {
  type: 'message'
  id?: string
  target: { browserInstanceId?: string }
  payload: StageFileUploadChunkPayload
}

export interface StageFileUploadCompletePayload {
  type: 'stage_file_upload_complete'
  uploadId: string
  sha256?: string
}

export interface StageFileUploadCompleteEnvelope {
  type: 'message'
  id?: string
  target: { browserInstanceId?: string }
  payload: StageFileUploadCompletePayload
}

export interface StageFileUploadStagedPayload {
  type: 'stage_file_upload_staged'
  uploadId: string
}

export interface StageFileUploadAckPayload {
  type: 'stage_file_upload_ack'
  uploadId: string
}

export interface StageFileUploadAckEnvelope {
  type: 'message'
  id?: string
  target?: { browserInstanceId?: string }
  payload: StageFileUploadAckPayload
}

export interface StageFileUploadErrorPayload {
  type: 'stage_file_upload_error'
  uploadId: string
  error: {
    code: 'invalid_file_payload' | 'checksum_mismatch' | 'file_too_large' | 'invalid_file_name' | 'invalid_file_type' | 'upload_expired'
    message: string
  }
}

export interface StageFileUploadErrorEnvelope {
  type: 'message'
  id?: string
  target?: { browserInstanceId?: string }
  payload: StageFileUploadErrorPayload
}

// --- Download & Fetch types (ADR 0047) ---

export type DownloadState = 'in_progress' | 'complete' | 'interrupted'

export interface DownloadInfo {
  id: number
  kind: 'download'
  filename: string
  url: string
  mime: string | null
  size: number | null
  state: DownloadState
  error?: string
  danger?: string
}

export interface FetchResourceInfo {
  id: string
  kind: 'fetch'
  url: string
  contentType: string | null
  bytesReceived: number
  totalBytes: number | null
  state: DownloadState | 'streaming'
  error?: string
}

// Download status request/response
export interface DownloadStatusRequest {
  type: 'download_status'
  ids?: Array<number | string>
  browserInstanceId?: string
}

export interface DownloadStatusResponse {
  type: 'download_status_response'
  ok: true
  capability: 'full' | 'not_supported'
  items: Array<DownloadInfo | FetchResourceInfo>
}

export interface DownloadStatusErrorResponse {
  type: 'download_status_response'
  ok: false
  error: {
    code: string
    message: string
  }
}

// Download file request/response
export interface DownloadFileRequest extends ApprovalMetadata {
  type: 'download_file'
  url: string
  filename?: string
  conflictAction?: 'uniquify' | 'overwrite'
  browserInstanceId?: string
}

export interface DownloadFileResponse {
  type: 'download_file_response'
  ok: true
  downloadId: number | null
  status: 'initiated' | 'initiated_fire_and_forget'
}

export interface DownloadFileErrorResponse {
  type: 'download_file_response'
  ok: false
  error: {
    code: string
    message: string
  }
}

// Fetch resource request/response
export interface FetchResourceRequest extends ApprovalMetadata {
  type: 'fetch_resource'
  url: string
  maxSizeBytes?: number
  timeout?: number
  browserInstanceId?: string
}

export interface FetchResourceStartResponse {
  type: 'fetch_resource_start'
  fetchId: string
  url: string
  contentType: string | null
  totalBytes: number | null
}

export interface FetchResourceChunkResponse {
  type: 'fetch_resource_chunk'
  fetchId: string
  index: number
  dataBase64: string
}

export interface FetchResourceCompleteResponse {
  type: 'fetch_resource_complete'
  fetchId: string
  contentType?: string | null
  sha256: string
  totalBytes: number
  dataBase64?: string
}

export interface FetchResourceErrorResponse {
  type: 'fetch_resource_error'
  fetchId?: string
  error: string
  httpStatus?: number
  message: string
}

export type FetchResourceStreamMessage =
  | FetchResourceStartResponse
  | FetchResourceChunkResponse
  | FetchResourceCompleteResponse
  | FetchResourceErrorResponse

export type BrijioErrorCode =
  | 'invalid_json'
  | 'invalid_message'
  | 'auth_required'
  | 'auth_failed'
  | 'invalid_auth_message'
  | 'browser_unavailable'
  | 'ambiguous_browser_target'
  | 'invalid_browser_target'
  | 'timeout'
  | 'unsupported_action'
  | 'batch_failed'
  | 'invalid_file_payload'
  | 'checksum_mismatch'
  | 'file_too_large'
  | 'invalid_file_name'
  | 'invalid_file_type'
  | 'upload_staging_failed'
  | 'upload_not_staged'
  | 'target_not_file_input'
  | 'upload_expired'
  | 'download_not_found'
  | 'fetch_resource_failed'

export interface BrijioErrorEnvelope {
  type: 'error'
  error: {
    code: BrijioErrorCode
    message: string
    browsers?: BrowserPresence[]
  }
}

export type ParseBrijioEnvelopeResult =
  | { ok: true, message: BrijioEnvelope }
  | { ok: false, error: BrijioErrorEnvelope }

export interface GetPageContextRequest {
  type: 'get_page_context'
}

export interface GetPageContentRequest {
  type: 'get_page_content'
  index?: number
}

export interface ClickActionTarget {
  kind: 'link' | 'action'
  id: string
  expectedText?: string
  expectedHref?: string
  expectedRole?: string
}

export interface FormControlTarget {
  formId: string
  controlId: string
  /** Optional: validate the control's visible label/text matches before acting */
  expectedLabel?: string
}

export interface EditableActionTarget {
  kind: 'editable'
  id: string
  /** Optional: validate the editable element's visible text/aria-label matches */
  expectedText?: string
}

export interface FormSubmitTarget {
  formId: string
  /** Optional: validate the form contains an expected heading or label */
  expectedLabel?: string
}

/** @deprecated Use FormControlTarget instead — WriteTextActionTarget is now FormControlTarget with optional expectedLabel */
export type WriteTextActionTarget = FormControlTarget

/** @deprecated Use EditableActionTarget instead — WriteTextEditableTarget is now EditableActionTarget with optional expectedText */
export type WriteTextEditableTarget = EditableActionTarget

export interface ApprovalMetadata {
  actionUUID?: string
  approvalRequest?: boolean
}

export interface PerformClickAction extends ApprovalMetadata {
  type: 'click'
  target: ClickActionTarget
}

export interface PerformWriteTextAction extends ApprovalMetadata {
  type: 'write_text'
  target: WriteTextActionTarget | WriteTextEditableTarget
  text: string
}

export interface PerformSetCheckedAction extends ApprovalMetadata {
  type: 'set_checked'
  target: FormControlTarget
  checked: boolean
}

export interface PerformSelectOptionsAction extends ApprovalMetadata {
  type: 'select_options'
  target: FormControlTarget
  values: string[]
}

export interface PerformSubmitFormAction extends ApprovalMetadata {
  type: 'submit_form'
  target: FormSubmitTarget
}

export interface FileUploadPayload {
  fileName: string
  mimeType: string
  contentBase64: string
  sizeBytes: number
  lastModified?: number
}

export interface PerformUploadFileAction extends ApprovalMetadata {
  type: 'upload_file'
  target: FormControlTarget
  file: FileUploadPayload
  expectedLabel?: string
}

export interface PerformActionRequest {
  type: 'perform_action'
  pageContextId?: number
  visibleContextId?: string
  action:
  | PerformClickAction
  | PerformWriteTextAction
  | PerformSetCheckedAction
  | PerformSelectOptionsAction
  | PerformSubmitFormAction
  | PerformUploadFileAction
}

// --- Batch request types (ADR 0044) ---

export const BATCH_MAX_ACTIONS = 20

export type BatchAction =
  | PerformClickAction
  | PerformWriteTextAction
  | PerformSetCheckedAction
  | PerformSelectOptionsAction
  | PerformSubmitFormAction
  | PerformUploadFileAction

export interface PerformBatchRequest {
  type: 'perform_batch'
  pageContextId?: number
  visibleContextId?: string
  actions: BatchAction[]
  continueOnError?: boolean
  readAfterActions?: boolean
}

export interface BatchActionError {
  code: ActionResultErrorCode | 'page_navigated' | 'upload_staging_failed' | 'upload_not_staged'
  message: string
  detail?: StaleContextDetail
  aborted: boolean
  actionUUID?: string
}

export type BatchActionOutcome =
  | { ok: true, data: ActionResultData | WriteTextActionResultData | SetCheckedActionResultData | SelectOptionsActionResultData | SubmitFormActionResultData | UploadFileActionResultData }
  | { ok: false, error: BatchActionError }

export type BatchReadOutcome =
  | { ok: true, data: PageContext }
  | { ok: false, error: BatchActionError }

export type BatchResultEntry = BatchActionOutcome | BatchReadOutcome

export interface BatchResultResponse {
  type: 'batch_result'
  ok: boolean
  results: BatchResultEntry[]
  aborted: boolean
}

export interface BatchResultErrorResponse {
  type: 'batch_result'
  ok: false
  error: {
    code: BrijioErrorCode
    message: string
  }
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

export interface PageFormControl {
  id: string
  label: string
  type: string
  required: boolean
  requiredSource?: 'html' | 'aria'
  disabled: boolean
  readonly?: boolean
  sensitive: boolean
  valueState?: 'empty' | 'filled' | 'unknown'
  filledBy?: 'brijio' | 'user_or_page'
  checked?: boolean
  multiple?: boolean
  options?: PageFormControlOption[]
  validity?: PageFormControlValidity
}

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

export interface PageFormControlValidity {
  valid: boolean
  reason?: PageFormControlValidityReason
}

export interface PageFormControlOption {
  value: string
  label: string
  selected: boolean
  disabled: boolean
}

export interface PageForm {
  id: string
  label: string
  controls: PageFormControl[]
}

export interface PageEditable {
  id: string
  label: string
  role: string
  multiline: boolean
}

export interface PageAction {
  id: string
  role: string
  name: string
  enabled: boolean
  /** Element type tag, e.g. 'button', 'summary', 'input' */
  tagName?: string
  /** Accessible description beyond the name, from aria-describedby or title */
  description?: string
  /** Whether the element has aria-hidden="true" or the hidden attribute */
  hidden?: boolean
}

export interface PageContext {
  /** Content script version for diagnostics (identifies ACTION_SELECTORS shape) */
  _csVersion?: number
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
    editables: PageEditable[]
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

export type PageContextErrorCode =
  | 'not_connected'
  | 'no_active_tab'
  | 'unsupported_page'
  | 'regular_page_permission_required'
  | 'content_script_unavailable'
  | 'extraction_failed'
  | 'invalid_index'
  | 'unsupported_request'

export type PageContentErrorCode =
  | 'no_active_tab'
  | 'unsupported_page'
  | 'regular_page_permission_required'
  | 'content_script_unavailable'
  | 'extraction_failed'
  | 'invalid_index'
  | 'unsupported_request'

export type ActionResultErrorCode =
  | 'no_active_tab'
  | 'unsupported_page'
  | 'regular_page_permission_required'
  | 'content_script_unavailable'
  | 'unsupported_action'
  | 'invalid_action_target'
  | 'target_not_found'
  | 'target_disabled'
  | 'target_readonly'
  | 'unsupported_control'
  | 'invalid_control_value'
  | 'option_not_found'
  | 'target_option_disabled'
  | 'action_failed'
  | 'stale_context'
  | 'page_navigated'
  | 'upload_not_staged'
  | 'approval_denied'
  | 'approval_timeout'
  | 'approval_unavailable'
  | 'approval_origin_changed'

export interface PageContextResponse {
  type: 'page_context_response'
  ok: true
  data: PageContext
}

export interface PageContextErrorResponse {
  type: 'page_context_response'
  ok: false
  error: {
    code: PageContextErrorCode
    message: string
  }
}

export interface PageContentResponse {
  type: 'page_content_response'
  ok: true
  data: PageContent
}

export interface PageContentErrorResponse {
  type: 'page_content_response'
  ok: false
  error: {
    code: PageContentErrorCode
    message: string
  }
}

export interface ClickObserved {
  /** Whether a navigation appears to have started (URL changed) */
  navigationStarted?: boolean
  /** If a disclosure/summary was clicked, its new open state */
  detailsOpen?: boolean
}

export interface ActionResultData {
  action: 'click'
  target: ClickActionTarget
  /** What was detectable about the page after the click */
  observed?: ClickObserved
}

export interface WriteTextActionResultData {
  action: 'write_text'
  target: WriteTextActionTarget | WriteTextEditableTarget
  textLength: number
  contextStale?: boolean
  contextStaleReason?: 'visible_controls_changed'
  currentVisibleContextId?: string
}

export interface SetCheckedActionResultData {
  action: 'set_checked'
  target: WriteTextActionTarget
  checked: boolean
  changed: boolean
  contextStale?: boolean
  contextStaleReason?: 'visible_controls_changed'
  currentVisibleContextId?: string
}

export interface SelectOptionsActionResultData {
  action: 'select_options'
  target: WriteTextActionTarget
  values: string[]
  contextStale?: boolean
  contextStaleReason?: 'visible_controls_changed'
  currentVisibleContextId?: string
}

export interface FormValidationError {
  formId: string
  controlId: string
  label: string
  reason: PageFormControlValidityReason
}

export interface UploadFileActionResultData {
  action: 'upload_file'
  target: FormControlTarget
  fileName: string
  mimeType: string
  sizeBytes: number
  fileCount: number
  contextStale?: boolean
  contextStaleReason?: 'visible_controls_changed'
  currentVisibleContextId?: string
}

export interface SubmitFormActionResultData {
  action: 'submit_form'
  target: {
    formId: string
  }
  submitted?: boolean
  validationErrors?: FormValidationError[]
  contextStale?: boolean
  contextStaleReason?: 'visible_controls_changed'
  currentVisibleContextId?: string
}

export interface ActionResultResponse {
  type: 'action_result'
  ok: true
  data:
  | ActionResultData
  | WriteTextActionResultData
  | SetCheckedActionResultData
  | SelectOptionsActionResultData
  | SubmitFormActionResultData
  | UploadFileActionResultData
}

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
  reason?: 'visible_controls_changed'
}

export interface ActionResultErrorResponse {
  type: 'action_result'
  ok: false
  error: {
    code: ActionResultErrorCode
    message: string
    actionUUID?: string
    detail?: StaleContextDetail
  }
}

export interface NavigateToUrlRequest {
  type: 'navigate_to_url'
  url: string
}

export interface NavigateToUrlResult {
  url: string
  title: string
  timestamp: string
  redirected: boolean
  navigationMs: number
}

export interface NavigateToUrlResponse {
  type: 'navigate_to_url_response'
  ok: true
  data: NavigateToUrlResult
}

export interface NavigateToUrlErrorResponse {
  type: 'navigate_to_url_response'
  ok: false
  error: {
    code: NavigateToUrlErrorCode
    message: string
  }
}

export type NavigateToUrlErrorCode =
  | 'no_active_tab'
  | 'unsupported_scheme'
  | 'unsupported_page'
  | 'navigation_failed'
  | 'timeout'
  | 'content_script_unavailable'

export type ExtensionResponse =
  | PageContextResponse
  | PageContextErrorResponse
  | PageContentResponse
  | PageContentErrorResponse
  | ActionResultResponse
  | ActionResultErrorResponse
  | NavigateToUrlResponse
  | NavigateToUrlErrorResponse
  | BatchResultResponse
  | BatchResultErrorResponse
  | DownloadStatusResponse
  | DownloadStatusErrorResponse
  | DownloadFileResponse
  | DownloadFileErrorResponse
  | FetchResourceStreamMessage

export function createAuthEnvelope (input: {
  requestId?: string
  token: string
  role: BrijioRole
}): BrijioEnvelope
export function createAuthEnvelope (token: string): BrijioEnvelope
export function createAuthEnvelope (
  input:
  | string
  | {
    requestId?: string
    token: string
    role: BrijioRole
  }
): BrijioEnvelope {
  if (typeof input === 'string') {
    return {
      type: 'message',
      payload: {
        type: 'auth',
        role: 'extension',
        token: input
      }
    }
  }

  return {
    type: 'message',
    id: input.requestId,
    payload: {
      type: 'auth',
      role: input.role,
      token: input.token
    }
  }
}

export function createAuthSuccessEnvelope (
  requestId: string | undefined
): BrijioEnvelope {
  return {
    type: 'message',
    id: requestId,
    payload: {
      type: 'auth_success'
    }
  }
}

export function createBrowserPresenceRequestEnvelope (
  requestId?: string
): BrijioEnvelope {
  return {
    type: 'message',
    id: requestId,
    payload: {
      type: 'browser_presence_request'
    }
  }
}

export function createBrowserPresenceAnnounceEnvelope (
  input: BrowserPresence & { requestId?: string }
): BrijioEnvelope {
  return {
    type: 'message',
    id: input.requestId,
    payload: {
      type: 'browser_presence_announce',
      browserInstanceId: input.browserInstanceId,
      label: input.label,
      browserName: input.browserName,
      profileName: input.profileName,
      capabilities: input.capabilities
    }
  }
}

export function createErrorEnvelope (
  code: BrijioErrorCode,
  message: string,
  browsers?: BrowserPresence[]
): BrijioErrorEnvelope {
  return {
    type: 'error',
    error: {
      code,
      message,
      ...(browsers === undefined ? {} : { browsers })
    }
  }
}

export function parseBrijioEnvelope (
  rawMessage: string
): ParseBrijioEnvelopeResult {
  let parsed: unknown

  try {
    parsed = JSON.parse(rawMessage)
  } catch {
    return {
      ok: false,
      error: createErrorEnvelope('invalid_json', 'Message must be valid JSON.')
    }
  }

  if (!isEnvelope(parsed)) {
    return {
      ok: false,
      error: createErrorEnvelope(
        'invalid_message',
        'Message must be an object with type "message" and a payload property.'
      )
    }
  }

  return { ok: true, message: parsed }
}

export function isAuthPayload (value: unknown): value is AuthPayload {
  return (
    isRecord(value) &&
    value.type === 'auth' &&
    (value.role === 'extension' || value.role === 'mcp') &&
    typeof value.token === 'string' &&
    value.token.length > 0
  )
}

export function isBrowserPresenceAnnouncePayload (
  value: unknown
): value is BrowserPresenceAnnouncePayload {
  return (
    isRecord(value) &&
    value.type === 'browser_presence_announce' &&
    typeof value.browserInstanceId === 'string' &&
    value.browserInstanceId.length > 0 &&
    typeof value.label === 'string' &&
    value.label.length > 0 &&
    typeof value.browserName === 'string' &&
    value.browserName.length > 0 &&
    typeof value.profileName === 'string' &&
    value.profileName.length > 0 &&
    Array.isArray(value.capabilities) &&
    value.capabilities.every(isBrowserCapability)
  )
}

export function isBrowserPresenceRequestPayload (
  value: unknown
): value is BrowserPresenceRequestPayload {
  return isRecord(value) && value.type === 'browser_presence_request'
}

export function isAuthSuccessEnvelope (
  value: unknown
): value is WebSocketEnvelope & { payload: AuthSuccessPayload } {
  return hasPayloadType(value, 'auth_success')
}

export function isBrowserPresenceRequestEnvelope (
  value: unknown
): value is WebSocketEnvelope & { payload: BrowserPresenceRequestPayload } {
  return hasPayloadType(value, 'browser_presence_request')
}

export function isGetPageContextEnvelope (
  value: unknown
): value is WebSocketEnvelope & { payload: GetPageContextRequest } {
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

  return value.payload.type === 'get_page_context'
}

export function isGetPageContentEnvelope (
  value: unknown
): value is WebSocketEnvelope & { payload: GetPageContentRequest } {
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

  if (value.payload.type !== 'get_page_content') {
    return false
  }

  if (
    Object.hasOwn(value.payload, 'index') &&
    (!Number.isInteger(value.payload.index) || Number(value.payload.index) < 1)
  ) {
    return false
  }

  return true
}

export function isPerformActionEnvelope (
  value: unknown
): value is WebSocketEnvelope & { payload: PerformActionRequest } {
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

  if (value.payload.type !== 'perform_action') {
    return false
  }

  if (!isRecord(value.payload.action)) {
    return false
  }

  if (!hasValidApprovalMetadata(value.payload.action)) {
    return false
  }

  if (value.payload.action.type === 'click') {
    return isClickAction(value.payload.action)
  }

  if (value.payload.action.type === 'write_text') {
    return isWriteTextAction(value.payload.action)
  }

  if (value.payload.action.type === 'set_checked') {
    return isSetCheckedAction(value.payload.action)
  }

  if (value.payload.action.type === 'select_options') {
    return isSelectOptionsAction(value.payload.action)
  }

  if (value.payload.action.type === 'submit_form') {
    return isSubmitFormAction(value.payload.action)
  }

  if (value.payload.action.type === 'upload_file') {
    return isUploadFileAction(value.payload.action)
  }

  return false
}

export function isNavigateToUrlEnvelope (
  value: unknown
): value is WebSocketEnvelope & { payload: NavigateToUrlRequest } {
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

  if (value.payload.type !== 'navigate_to_url') {
    return false
  }

  return typeof value.payload.url === 'string'
}

export function createNavigateToUrlResponse (
  id: string | undefined,
  result: NavigateToUrlResult
): WebSocketEnvelope {
  return createEnvelope(id, {
    type: 'navigate_to_url_response',
    ok: true,
    data: result
  })
}

export function createNavigateToUrlErrorResponse (
  id: string | undefined,
  code: NavigateToUrlErrorCode,
  message: string
): WebSocketEnvelope {
  return createEnvelope(id, {
    type: 'navigate_to_url_response',
    ok: false,
    error: {
      code,
      message
    }
  })
}

export function createPageContextResponse (
  id: string | undefined,
  context: PageContext
): WebSocketEnvelope {
  return createEnvelope(id, {
    type: 'page_context_response',
    ok: true,
    data: context
  })
}

export function createPageContextErrorResponse (
  id: string | undefined,
  code: PageContextErrorCode,
  message: string
): WebSocketEnvelope {
  return createEnvelope(id, {
    type: 'page_context_response',
    ok: false,
    error: {
      code,
      message
    }
  })
}

export function createPageContentResponse (
  id: string | undefined,
  content: PageContent
): WebSocketEnvelope {
  return createEnvelope(id, {
    type: 'page_content_response',
    ok: true,
    data: content
  })
}

export function createPageContentErrorResponse (
  id: string | undefined,
  code: PageContentErrorCode,
  message: string
): WebSocketEnvelope {
  return createEnvelope(id, {
    type: 'page_content_response',
    ok: false,
    error: {
      code,
      message
    }
  })
}

export function createActionResultResponse (
  id: string | undefined,
  data:
  | ActionResultData
  | WriteTextActionResultData
  | SetCheckedActionResultData
  | SelectOptionsActionResultData
  | SubmitFormActionResultData
  | UploadFileActionResultData
): WebSocketEnvelope {
  return createEnvelope(id, {
    type: 'action_result',
    ok: true,
    data
  })
}

export function createActionResultErrorResponse (
  id: string | undefined,
  code: ActionResultErrorCode,
  message: string,
  actionUUID?: string
): WebSocketEnvelope {
  return createEnvelope(id, {
    type: 'action_result',
    ok: false,
    error: {
      code,
      message,
      ...(actionUUID !== undefined ? { actionUUID } : {})
    }
  })
}

export function createPerformBatchEnvelope (
  requestId: string | undefined,
  actions: BatchAction[],
  options?: { pageContextId?: number, visibleContextId?: string, continueOnError?: boolean, readAfterActions?: boolean }
): WebSocketEnvelope {
  const payload: PerformBatchRequest = {
    type: 'perform_batch',
    actions,
    ...(options?.pageContextId !== undefined ? { pageContextId: options.pageContextId } : {}),
    ...(options?.visibleContextId !== undefined ? { visibleContextId: options.visibleContextId } : {}),
    ...(options?.continueOnError !== undefined ? { continueOnError: options.continueOnError } : {}),
    ...(options?.readAfterActions !== undefined ? { readAfterActions: options.readAfterActions } : {})
  }

  if (requestId === undefined) {
    return {
      type: 'message',
      payload
    }
  }

  return {
    type: 'message',
    id: requestId,
    payload
  }
}

export function createBatchResultResponse (
  id: string | undefined,
  results: BatchResultEntry[],
  aborted: boolean = false,
  ok?: boolean
): WebSocketEnvelope {
  const allOk = ok ?? results.every(entry => entry.ok)

  const payload: BatchResultResponse = {
    type: 'batch_result',
    ok: allOk,
    results,
    aborted
  }

  return createEnvelope(id, payload)
}

export function createBatchResultErrorResponse (
  id: string | undefined,
  code: BrijioErrorCode,
  message: string
): WebSocketEnvelope {
  return createEnvelope(id, {
    type: 'batch_result',
    ok: false,
    error: { code, message }
  })
}

export function createDownloadStatusResponse (
  id: string | undefined,
  capability: 'full' | 'not_supported',
  items: Array<DownloadInfo | FetchResourceInfo>
): WebSocketEnvelope {
  return createEnvelope(id, {
    type: 'download_status_response',
    ok: true,
    capability,
    items
  })
}

export function createDownloadStatusErrorResponse (
  id: string | undefined,
  code: string,
  message: string
): WebSocketEnvelope {
  return createEnvelope(id, {
    type: 'download_status_response',
    ok: false,
    error: { code, message }
  })
}

export function createDownloadFileResponse (
  id: string | undefined,
  downloadId: number | null,
  status: 'initiated' | 'initiated_fire_and_forget'
): WebSocketEnvelope {
  return createEnvelope(id, {
    type: 'download_file_response',
    ok: true,
    downloadId,
    status
  })
}

export function createDownloadFileErrorResponse (
  id: string | undefined,
  code: string,
  message: string
): WebSocketEnvelope {
  return createEnvelope(id, {
    type: 'download_file_response',
    ok: false,
    error: { code, message }
  })
}

export function createFetchResourceStartResponse (
  id: string | undefined,
  fetchId: string,
  url: string,
  contentType: string | null,
  totalBytes: number | null
): WebSocketEnvelope {
  return createEnvelope(id, {
    type: 'fetch_resource_start',
    fetchId,
    url,
    contentType,
    totalBytes
  })
}

export function createFetchResourceChunkResponse (
  id: string | undefined,
  fetchId: string,
  index: number,
  dataBase64: string
): WebSocketEnvelope {
  return createEnvelope(id, {
    type: 'fetch_resource_chunk',
    fetchId,
    index,
    dataBase64
  })
}

export function createFetchResourceCompleteResponse (
  id: string | undefined,
  fetchId: string,
  sha256: string,
  totalBytes: number,
  dataBase64?: string,
  contentType?: string | null
): WebSocketEnvelope {
  return createEnvelope(id, {
    type: 'fetch_resource_complete',
    fetchId,
    sha256,
    totalBytes,
    ...(dataBase64 !== undefined ? { dataBase64 } : {}),
    ...(contentType !== undefined ? { contentType } : {})
  })
}

export function createFetchResourceErrorResponse (
  id: string | undefined,
  errorCode: string,
  message: string
): WebSocketEnvelope {
  return createEnvelope(id, {
    type: 'fetch_resource_error',
    error: errorCode,
    message
  })
}

export function createDownloadStatusEnvelope (
  requestId: string | undefined,
  ids?: Array<number | string>,
  browserInstanceId?: string
): WebSocketEnvelope {
  const payload: DownloadStatusRequest = {
    type: 'download_status',
    ...(ids !== undefined ? { ids } : {})
  }

  return {
    type: 'message',
    ...(requestId !== undefined ? { id: requestId } : {}),
    ...(browserInstanceId !== undefined ? { target: { browserInstanceId } } : {}),
    payload
  }
}

export function createDownloadFileEnvelope (
  requestId: string | undefined,
  url: string,
  filename?: string,
  conflictAction?: 'uniquify' | 'overwrite',
  browserInstanceId?: string
): WebSocketEnvelope {
  const payload: DownloadFileRequest = {
    type: 'download_file',
    url,
    ...(filename !== undefined ? { filename } : {}),
    ...(conflictAction !== undefined ? { conflictAction } : {})
  }

  return {
    type: 'message',
    ...(requestId !== undefined ? { id: requestId } : {}),
    ...(browserInstanceId !== undefined ? { target: { browserInstanceId } } : {}),
    payload
  }
}

export function createFetchResourceEnvelope (
  requestId: string | undefined,
  url: string,
  maxSizeBytes?: number,
  timeout?: number,
  browserInstanceId?: string
): WebSocketEnvelope {
  const payload: FetchResourceRequest = {
    type: 'fetch_resource',
    url,
    ...(maxSizeBytes !== undefined ? { maxSizeBytes } : {}),
    ...(timeout !== undefined ? { timeout } : {})
  }

  return {
    type: 'message',
    ...(requestId !== undefined ? { id: requestId } : {}),
    ...(browserInstanceId !== undefined ? { target: { browserInstanceId } } : {}),
    payload
  }
}

export function isDownloadStatusEnvelope (
  value: unknown
): value is WebSocketEnvelope & { payload: DownloadStatusRequest } {
  if (!isRecord(value) || value.type !== 'message') {
    return false
  }

  if (!isRecord(value.payload) || value.payload.type !== 'download_status') {
    return false
  }

  if (Object.hasOwn(value.payload, 'ids') && !Array.isArray(value.payload.ids)) {
    return false
  }

  return true
}

export function isDownloadFileEnvelope (
  value: unknown
): value is WebSocketEnvelope & { payload: DownloadFileRequest } {
  if (!isRecord(value) || value.type !== 'message') {
    return false
  }

  if (!isRecord(value.payload) || value.payload.type !== 'download_file') {
    return false
  }

  return typeof value.payload.url === 'string'
}

export function isFetchResourceEnvelope (
  value: unknown
): value is WebSocketEnvelope & { payload: FetchResourceRequest } {
  if (!isRecord(value) || value.type !== 'message') {
    return false
  }

  if (!isRecord(value.payload) || value.payload.type !== 'fetch_resource') {
    return false
  }

  return typeof value.payload.url === 'string'
}

export function isPerformBatchEnvelope (
  value: unknown
): value is WebSocketEnvelope & { payload: PerformBatchRequest } {
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

  if (value.payload.type !== 'perform_batch') {
    return false
  }

  // pageContextId: if present, must be a number
  if (Object.hasOwn(value.payload, 'pageContextId') && typeof value.payload.pageContextId !== 'number') {
    return false
  }

  if (Object.hasOwn(value.payload, 'visibleContextId') && typeof value.payload.visibleContextId !== 'string') {
    return false
  }

  // actions: required array, 1–20 items, each must be a valid BatchAction
  if (!Array.isArray(value.payload.actions)) {
    return false
  }

  if (value.payload.actions.length < 1 || value.payload.actions.length > BATCH_MAX_ACTIONS) {
    return false
  }

  if (!value.payload.actions.every(isBatchAction)) {
    return false
  }

  // continueOnError: if present, must be boolean
  if (Object.hasOwn(value.payload, 'continueOnError') && typeof value.payload.continueOnError !== 'boolean') {
    return false
  }

  // readAfterActions: if present, must be boolean
  if (Object.hasOwn(value.payload, 'readAfterActions') && typeof value.payload.readAfterActions !== 'boolean') {
    return false
  }

  return true
}

function isBatchAction (value: unknown): value is BatchAction {
  if (!isRecord(value)) {
    return false
  }

  if (!hasValidApprovalMetadata(value)) {
    return false
  }

  if (value.type === 'click') {
    return isClickAction(value)
  }

  if (value.type === 'write_text') {
    return isWriteTextAction(value)
  }

  if (value.type === 'set_checked') {
    return isSetCheckedAction(value)
  }

  if (value.type === 'select_options') {
    return isSelectOptionsAction(value)
  }

  if (value.type === 'submit_form') {
    return isSubmitFormAction(value)
  }

  if (value.type === 'upload_file') {
    return isUploadFileAction(value)
  }

  return false
}

function hasValidApprovalMetadata (value: Record<PropertyKey, unknown>): boolean {
  if (
    Object.hasOwn(value, 'actionUUID') &&
    (typeof value.actionUUID !== 'string' || value.actionUUID.trim() === '')
  ) {
    return false
  }

  if (
    Object.hasOwn(value, 'approvalRequest') &&
    typeof value.approvalRequest !== 'boolean'
  ) {
    return false
  }

  return true
}

function createEnvelope (
  id: string | undefined,
  payload: ExtensionResponse
): WebSocketEnvelope {
  if (id === undefined) {
    return {
      type: 'message',
      payload
    }
  }

  return {
    type: 'message',
    id,
    payload
  }
}

function isClickAction (value: Record<PropertyKey, unknown>): boolean {
  if (!isRecord(value.target)) {
    return false
  }

  return (
    (value.target.kind === 'link' || value.target.kind === 'action') &&
    typeof value.target.id === 'string' &&
    value.target.id.trim() !== ''
  )
}

function isWriteTextAction (value: Record<PropertyKey, unknown>): boolean {
  if (!isRecord(value.target)) {
    return false
  }

  if (value.target.kind === 'editable') {
    return (
      typeof value.target.id === 'string' &&
      value.target.id.trim() !== '' &&
      typeof value.text === 'string'
    )
  }

  return (
    typeof value.target.formId === 'string' &&
    value.target.formId.trim() !== '' &&
    typeof value.target.controlId === 'string' &&
    value.target.controlId.trim() !== '' &&
    typeof value.text === 'string'
  )
}

function isSetCheckedAction (value: Record<PropertyKey, unknown>): boolean {
  return (
    isFormControlTarget(value.target) && typeof value.checked === 'boolean'
  )
}

function isSelectOptionsAction (value: Record<PropertyKey, unknown>): boolean {
  return (
    isFormControlTarget(value.target) &&
    Array.isArray(value.values) &&
    value.values.every((option) => typeof option === 'string')
  )
}

function isUploadFileAction (value: Record<PropertyKey, unknown>): boolean {
  if (!isRecord(value.file)) {
    return false
  }

  return (
    isFormControlTarget(value.target) &&
    typeof value.file.fileName === 'string' && value.file.fileName.trim() !== '' &&
    typeof value.file.mimeType === 'string' &&
    typeof value.file.contentBase64 === 'string' &&
    Number.isInteger(value.file.sizeBytes) && Number(value.file.sizeBytes) >= 0 &&
    (!Object.hasOwn(value.file, 'lastModified') || typeof value.file.lastModified === 'number')
  )
}

function isSubmitFormAction (value: Record<PropertyKey, unknown>): boolean {
  if (!isRecord(value.target)) {
    return false
  }

  return (
    typeof value.target.formId === 'string' && value.target.formId.trim() !== ''
  )
}

function isFormControlTarget (value: unknown): value is WriteTextActionTarget {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.formId === 'string' &&
    value.formId.trim() !== '' &&
    typeof value.controlId === 'string' &&
    value.controlId.trim() !== ''
  )
}

function isEnvelope (value: unknown): value is BrijioEnvelope {
  return (
    isRecord(value) &&
    value.type === 'message' &&
    (!Object.hasOwn(value, 'id') || typeof value.id === 'string') &&
    (!Object.hasOwn(value, 'target') || isTarget(value.target)) &&
    Object.hasOwn(value, 'payload')
  )
}

function isTarget (value: unknown): value is { browserInstanceId?: string } {
  return (
    isRecord(value) &&
    (!Object.hasOwn(value, 'browserInstanceId') ||
      typeof value.browserInstanceId === 'string')
  )
}

function isBrowserCapability (value: unknown): value is BrowserCapability {
  return (
    value === 'page_context' ||
    value === 'page_content' ||
    value === 'click' ||
    value === 'fill_input' ||
    value === 'fill_editable' ||
    value === 'set_checked' ||
    value === 'select_options' ||
    value === 'submit_form' ||
    value === 'navigate' ||
    value === 'batch' ||
    value === 'upload_file' ||
    value === 'download_status' ||
    value === 'download_file' ||
    value === 'fetch_resource'
  )
}

function hasPayloadType (value: unknown, type: string): boolean {
  return (
    isRecord(value) &&
    value.type === 'message' &&
    (!Object.hasOwn(value, 'id') || typeof value.id === 'string') &&
    isRecord(value.payload) &&
    value.payload.type === type
  )
}

function isRecord (value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
