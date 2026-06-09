import {
  clickCurrentPageElement,
  type BrijioPageActionsConfig
} from './page-actions.js'
import { type ClickElementTarget } from './protocol.js'
import { type BrijioToolResult } from './page-reading-tool.js'

export interface ClickElementInput {
  kind?: unknown
  id?: unknown
  browserInstanceId?: unknown
  expectedText?: unknown
  expectedHref?: unknown
  expectedRole?: unknown
  pageContextId?: unknown
}

export type ClickElementResult = BrijioToolResult<{
  action: 'click'
  target: ClickElementTarget
}>

export async function clickElement (
  config: BrijioPageActionsConfig,
  input: ClickElementInput
): Promise<ClickElementResult> {
  const normalizedInput = normalizeInput(input)

  if (!normalizedInput.ok) {
    return normalizedInput
  }

  return await clickCurrentPageElement(
    config,
    normalizedInput.data.target,
    normalizedInput.data.browserInstanceId,
    normalizedInput.data.pageContextId
  )
}

function normalizeInput (input: ClickElementInput): BrijioToolResult<{
  target: ClickElementTarget
  browserInstanceId?: string
  pageContextId?: number
}> {
  if (input.kind !== 'link' && input.kind !== 'action') {
    return invalidToolInputResponse('kind must be either "link" or "action".')
  }

  if (typeof input.id !== 'string' || input.id.length === 0) {
    return invalidToolInputResponse('id must be a non-empty string.')
  }

  const browserInstanceId = normalizeBrowserInstanceId(input.browserInstanceId)

  if (!browserInstanceId.ok) {
    return browserInstanceId
  }

  // Validate optional expected fields — if provided, must be strings
  if (
    input.expectedText !== undefined &&
    typeof input.expectedText !== 'string'
  ) {
    return invalidToolInputResponse(
      'expectedText must be a string when provided.'
    )
  }

  if (
    input.expectedHref !== undefined &&
    typeof input.expectedHref !== 'string'
  ) {
    return invalidToolInputResponse(
      'expectedHref must be a string when provided.'
    )
  }

  if (
    input.expectedRole !== undefined &&
    typeof input.expectedRole !== 'string'
  ) {
    return invalidToolInputResponse(
      'expectedRole must be a string when provided.'
    )
  }

  const target: ClickElementTarget = {
    kind: input.kind,
    id: input.id,
    ...(input.expectedText !== undefined
      ? { expectedText: input.expectedText }
      : {}),
    ...(input.expectedHref !== undefined
      ? { expectedHref: input.expectedHref }
      : {}),
    ...(input.expectedRole !== undefined
      ? { expectedRole: input.expectedRole }
      : {})
  }

  if (
    input.pageContextId !== undefined &&
    typeof input.pageContextId !== 'number'
  ) {
    return invalidToolInputResponse(
      'pageContextId must be a number when provided.'
    )
  }

  return {
    ok: true,
    data: {
      target,
      ...(browserInstanceId.data !== undefined
        ? { browserInstanceId: browserInstanceId.data }
        : {}),
      ...(input.pageContextId !== undefined
        ? { pageContextId: input.pageContextId }
        : {})
    }
  }
}

function normalizeBrowserInstanceId (
  value: unknown
): BrijioToolResult<string | undefined> {
  if (value === undefined) {
    return {
      ok: true,
      data: undefined
    }
  }

  if (typeof value !== 'string' || value.length === 0) {
    return invalidToolInputResponse(
      'browserInstanceId must be a non-empty string when provided.'
    )
  }

  return {
    ok: true,
    data: value
  }
}

function invalidToolInputResponse (
  message: string
): BrijioToolResult<never> {
  return {
    ok: false,
    error: {
      code: 'invalid_tool_input',
      message
    }
  }
}
