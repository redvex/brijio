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

export interface PageFormControl {
  id: string
  label: string
  type: string
  required: boolean
  disabled: boolean
  sensitive: boolean
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
}

export interface SetCheckedActionResultData {
  action: 'set_checked'
  target: FillInputTarget
  checked: boolean
  changed: boolean
}

export interface SelectOptionsActionResultData {
  action: 'select_options'
  target: FillInputTarget
  values: string[]
}

export interface SubmitFormTarget {
  formId: string
  expectedLabel?: string
}

export interface SubmitFormActionResultData {
  action: 'submit_form'
  target: SubmitFormTarget
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
}

export type BrijioResourceResult<T> =
  | {
    ok: true
    data: T
  }
  | {
    ok: false
    error: {
      code: BrijioErrorCode
      message: string
      detail?: StaleContextDetail
      browsers?: BrowserPresence[]
    }
  }

export type BrijioPageContextResult =
  BrijioResourceResult<PageContext>

export type BrijioPageContentResult =
  BrijioResourceResult<PageContent>

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

export type BrijioBrowserListResult = BrijioResourceResult<{
  browsers: BrowserPresence[]
}>

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
  | { ok: true, data: ClickElementActionResultData | FillInputActionResultData | SetCheckedActionResultData | SelectOptionsActionResultData | SubmitFormActionResultData }
  | { ok: false, error: BatchActionError }

export type BatchReadOutcome =
  | { ok: true, data: PageContext }
  | { ok: false, error: BatchActionError }

export type BatchResultEntry = BatchActionOutcome | BatchReadOutcome

export interface BrijioBatchResult {
  ok: boolean
  results: BatchResultEntry[]
}

export type BrijioBatchResultParseResult =
  | { ok: true, data: BrijioBatchResult }
  | { ok: false, data: BrijioBatchResult }
  | { ok: false, error: { code: BrijioErrorCode, message: string, detail?: StaleContextDetail, browsers?: BrowserPresence[] } }
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
  pageContextId?: number
): WebSocketEnvelope {
  return {
    type: 'message',
    id: requestId,
    payload: {
      type: 'perform_action',
      ...(pageContextId !== undefined ? { pageContextId } : {}),
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
  pageContextId?: number
): WebSocketEnvelope {
  return {
    type: 'message',
    id: requestId,
    payload: {
      type: 'perform_action',
      ...(pageContextId !== undefined ? { pageContextId } : {}),
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
  pageContextId?: number
): WebSocketEnvelope {
  return {
    type: 'message',
    id: requestId,
    payload: {
      type: 'perform_action',
      ...(pageContextId !== undefined ? { pageContextId } : {}),
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
  pageContextId?: number
): WebSocketEnvelope {
  return {
    type: 'message',
    id: requestId,
    payload: {
      type: 'perform_action',
      ...(pageContextId !== undefined ? { pageContextId } : {}),
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
  pageContextId?: number
): WebSocketEnvelope {
  return {
    type: 'message',
    id: requestId,
    payload: {
      type: 'perform_action',
      ...(pageContextId !== undefined ? { pageContextId } : {}),
      action: {
        type: 'select_options',
        target,
        values
      }
    }
  }
}

export function createSubmitFormEnvelope (
  requestId: string,
  target: SubmitFormTarget,
  pageContextId?: number
): WebSocketEnvelope {
  return {
    type: 'message',
    id: requestId,
    payload: {
      type: 'perform_action',
      ...(pageContextId !== undefined ? { pageContextId } : {}),
      action: {
        type: 'submit_form',
        target
      }
    }
  }
}

export function createPerformBatchEnvelope (
  requestId: string,
  actions: Array<Record<string, unknown>>,
  options?: { pageContextId?: number, continueOnError?: boolean, readAfterActions?: boolean }
): WebSocketEnvelope {
  const payload: Record<string, unknown> = {
    type: 'perform_batch',
    actions,
    ...(options?.pageContextId !== undefined ? { pageContextId: options.pageContextId } : {}),
    ...(options?.continueOnError !== undefined ? { continueOnError: options.continueOnError } : {}),
    ...(options?.readAfterActions !== undefined ? { readAfterActions: options.readAfterActions } : {})
  }

  return {
    type: 'message',
    id: requestId,
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
    if (!isRecord(value.payload.error) || typeof value.payload.error.message !== 'string') {
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
        results.push({ ok: true, data: entry.data as PageContext })
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

  if (results.every(entry => entry.ok)) {
    return {
      ok: true,
      data: { ok: true, results }
    }
  }

  return {
    ok: false,
    data: { ok: false, results }
  }
}

function parseActionResultData (
  data: Record<PropertyKey, unknown>
): ClickElementActionResultData | FillInputActionResultData | SetCheckedActionResultData | SelectOptionsActionResultData | SubmitFormActionResultData | null {
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
  return null
}

function mapBatchErrorCode (code: unknown): BrijioErrorCode {
  if (typeof code === 'string') {
    if (code === 'page_navigated') {
      return 'stale_context'
    }
    if (isBrijioErrorCode(code)) {
      return code
    }
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

export function parseRouterErrorEnvelope (
  value: unknown
): BrijioResourceResult<never> | { ok: false, ignored: true } {
  if (!isRecord(value) || value.type !== 'error') {
    return { ok: false, ignored: true }
  }

  if (!isRecord(value.error) || typeof value.error.message !== 'string') {
    return invalidResponse()
  }

  if (!isBrijioErrorCode(value.error.code)) {
    return invalidResponse()
  }

  return {
    ok: false,
    error: {
      code: value.error.code,
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
  | BrijioSubmitFormResult {
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
  // Pass through stale_context with its detail; wrap unknown codes as browser_error
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

  return {
    ok: false,
    error: {
      code: 'browser_error',
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
      message: 'BRIJIO_PAIRING_TOKEN or BROWSERBRIDGE_PAIRING_TOKEN must be configured.'
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

function isBrijioErrorCode (
  value: unknown
): value is BrijioErrorCode {
  return (
    value === 'auth_required' ||
    value === 'auth_failed' ||
    value === 'invalid_auth_message' ||
    value === 'browser_unavailable' ||
    value === 'ambiguous_browser_target' ||
    value === 'invalid_browser_target' ||
    value === 'connection_failed' ||
    value === 'timeout' ||
    value === 'invalid_response' ||
    value === 'browser_error' ||
    value === 'stale_context' ||
    value === 'page_navigated' ||
    value === 'invalid_resource_uri' ||
    value === 'unsupported_scheme'
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
    'controlId'
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
