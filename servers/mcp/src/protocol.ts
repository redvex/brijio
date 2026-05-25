export interface WebSocketEnvelope {
  type: 'message'
  id?: string
  payload: unknown
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
}

export interface ClickElementActionResultData {
  action: 'click'
  target: ClickElementTarget
}

export interface FillInputTarget {
  formId: string
  controlId: string
}

export interface FillInputActionResultData {
  action: 'write_text'
  target: FillInputTarget
  textLength: number
}

export type BrowserBridgeErrorCode =
  | 'connection_failed'
  | 'timeout'
  | 'invalid_response'
  | 'browser_error'
  | 'invalid_resource_uri'

export type BrowserBridgeResourceResult<T> =
  | {
    ok: true
    data: T
  }
  | {
    ok: false
    error: {
      code: BrowserBridgeErrorCode
      message: string
    }
  }

export type BrowserBridgePageContextResult =
  BrowserBridgeResourceResult<PageContext>

export type BrowserBridgePageContentResult =
  BrowserBridgeResourceResult<PageContent>

export type BrowserBridgeClickElementResult =
  BrowserBridgeResourceResult<ClickElementActionResultData>

export type BrowserBridgeFillInputResult =
  BrowserBridgeResourceResult<FillInputActionResultData>

export type PageContextParseResult =
  | BrowserBridgePageContextResult
  | { ok: false, ignored: true }

export type PageContentParseResult =
  | BrowserBridgePageContentResult
  | { ok: false, ignored: true }

export type ActionResultParseResult =
  | BrowserBridgeClickElementResult
  | BrowserBridgeFillInputResult
  | { ok: false, ignored: true }

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
  target: ClickElementTarget
): WebSocketEnvelope {
  return {
    type: 'message',
    id: requestId,
    payload: {
      type: 'perform_action',
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
  text: string
): WebSocketEnvelope {
  return {
    type: 'message',
    id: requestId,
    payload: {
      type: 'perform_action',
      action: {
        type: 'write_text',
        target,
        text
      }
    }
  }
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

function parsePageContextSuccessPayload (
  payload: Record<PropertyKey, unknown>
): BrowserBridgePageContextResult {
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
): BrowserBridgePageContentResult {
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
): BrowserBridgeClickElementResult | BrowserBridgeFillInputResult {
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

  return invalidResponse()
}

function parseErrorPayload<T> (
  payload: Record<PropertyKey, unknown>,
  fallback: BrowserBridgeResourceResult<T>
): BrowserBridgeResourceResult<T> {
  if (!isRecord(payload.error) || typeof payload.error.message !== 'string') {
    return fallback
  }

  return {
    ok: false,
    error: {
      code: 'browser_error',
      message: payload.error.message
    }
  }
}

export function invalidResponse (): BrowserBridgeResourceResult<never> {
  return {
    ok: false,
    error: {
      code: 'invalid_response',
      message: 'Received an invalid BrowserBridge response.'
    }
  }
}

export function invalidPageContextResponse (): BrowserBridgePageContextResult {
  return {
    ok: false,
    error: {
      code: 'invalid_response',
      message: 'Received an invalid page context response.'
    }
  }
}

export function invalidResourceUriResponse (): BrowserBridgeResourceResult<never> {
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
): BrowserBridgeResourceResult<never> {
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
): BrowserBridgeResourceResult<never> {
  return {
    ok: false,
    error: {
      code: 'connection_failed',
      message: `Unable to connect to BrowserBridge WebSocket at ${websocketUrl}.`
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
    value.content.available === true ||
    value.content.available === false
  ) &&
    value.content.requestType === 'get_page_content' &&
    value.content.firstIndex === 1 &&
    isPositiveNumber(value.content.defaultMaxPayloadBytes)
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

function isPagePreview (
  value: unknown
): value is PageContext['preview'] {
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
  return hasStringProperties(value, ['id', 'text']) &&
    isRecord(value) &&
    typeof value.level === 'number' &&
    Number.isInteger(value.level) &&
    value.level >= 1
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

  return isRecord(value) &&
    typeof value.required === 'boolean' &&
    typeof value.disabled === 'boolean' &&
    typeof value.sensitive === 'boolean'
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

  return value.action === 'write_text' &&
    isFillInputTarget(value.target) &&
    typeof value.textLength === 'number' &&
    Number.isInteger(value.textLength) &&
    value.textLength >= 0
}

function isClickElementTarget (
  value: unknown
): value is ClickElementTarget {
  if (!isRecord(value)) {
    return false
  }

  return (
    (value.kind === 'link' || value.kind === 'action') &&
    typeof value.id === 'string'
  )
}

function isFillInputTarget (
  value: unknown
): value is FillInputTarget {
  return hasStringProperties(value, ['formId', 'controlId'])
}

function hasStringProperties (
  value: unknown,
  properties: string[]
): boolean {
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

function isPositiveNumber (value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isRecord (value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
