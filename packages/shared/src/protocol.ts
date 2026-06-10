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

export interface PerformClickAction {
  type: 'click'
  target: ClickActionTarget
}

export interface PerformWriteTextAction {
  type: 'write_text'
  target: WriteTextActionTarget | WriteTextEditableTarget
  text: string
}

export interface PerformSetCheckedAction {
  type: 'set_checked'
  target: FormControlTarget
  checked: boolean
}

export interface PerformSelectOptionsAction {
  type: 'select_options'
  target: FormControlTarget
  values: string[]
}

export interface PerformSubmitFormAction {
  type: 'submit_form'
  target: FormSubmitTarget
}

export interface PerformActionRequest {
  type: 'perform_action'
  pageContextId?: number
  action:
  | PerformClickAction
  | PerformWriteTextAction
  | PerformSetCheckedAction
  | PerformSelectOptionsAction
  | PerformSubmitFormAction
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
  readonly?: boolean
  sensitive: boolean
  checked?: boolean
  multiple?: boolean
  options?: PageFormControlOption[]
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
}

export interface SetCheckedActionResultData {
  action: 'set_checked'
  target: WriteTextActionTarget
  checked: boolean
  changed: boolean
}

export interface SelectOptionsActionResultData {
  action: 'select_options'
  target: WriteTextActionTarget
  values: string[]
}

export interface SubmitFormActionResultData {
  action: 'submit_form'
  target: {
    formId: string
  }
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
}

export interface ActionResultErrorResponse {
  type: 'action_result'
  ok: false
  error: {
    code: ActionResultErrorCode
    message: string
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
  message: string
): WebSocketEnvelope {
  return createEnvelope(id, {
    type: 'action_result',
    ok: false,
    error: {
      code,
      message
    }
  })
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
    value === 'navigate'
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
