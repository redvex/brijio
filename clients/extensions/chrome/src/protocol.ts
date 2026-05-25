export interface WebSocketEnvelope {
  type: 'message'
  id?: string
  payload: unknown
}

export const defaultPageContentMaxPayloadBytes = 131072

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
}

export interface WriteTextActionTarget {
  formId: string
  controlId: string
}

export interface PerformClickAction {
  type: 'click'
  target: ClickActionTarget
}

export interface PerformWriteTextAction {
  type: 'write_text'
  target: WriteTextActionTarget
  text: string
}

export interface PerformActionRequest {
  type: 'perform_action'
  action: PerformClickAction | PerformWriteTextAction
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
  | 'action_failed'

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

export interface ActionResultData {
  action: 'click'
  target: ClickActionTarget
}

export interface WriteTextActionResultData {
  action: 'write_text'
  target: WriteTextActionTarget
  textLength: number
}

export interface ActionResultResponse {
  type: 'action_result'
  ok: true
  data: ActionResultData | WriteTextActionResultData
}

export interface ActionResultErrorResponse {
  type: 'action_result'
  ok: false
  error: {
    code: ActionResultErrorCode
    message: string
  }
}

export type ExtensionResponse =
  | PageContextResponse
  | PageContextErrorResponse
  | PageContentResponse
  | PageContentErrorResponse
  | ActionResultResponse
  | ActionResultErrorResponse

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

  return false
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
  data: ActionResultData | WriteTextActionResultData
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

  return (
    typeof value.target.formId === 'string' &&
    value.target.formId.trim() !== '' &&
    typeof value.target.controlId === 'string' &&
    value.target.controlId.trim() !== '' &&
    typeof value.text === 'string'
  )
}

function isRecord (value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
