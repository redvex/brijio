import {
  fillCurrentPageInput,
  type BrijioPageActionsConfig
} from './page-actions.js'
import {
  type FillInputActionResultData,
  type FillInputTarget
} from './protocol.js'
import { type BrijioToolResult } from './page-reading-tool.js'

export interface FillInputInput {
  formId?: unknown
  controlId?: unknown
  text?: unknown
  expectedLabel?: unknown
  browserInstanceId?: unknown
  pageContextId?: unknown
}

export type FillInputResult =
  BrijioToolResult<FillInputActionResultData>

export async function fillInput (
  config: BrijioPageActionsConfig,
  input: FillInputInput
): Promise<FillInputResult> {
  const normalizedInput = normalizeInput(input)

  if (!normalizedInput.ok) {
    return normalizedInput
  }

  return await fillCurrentPageInput(
    config,
    normalizedInput.data.target,
    normalizedInput.data.text,
    normalizedInput.data.browserInstanceId,
    normalizedInput.data.pageContextId
  )
}

function normalizeInput (
  input: FillInputInput
): BrijioToolResult<{
    target: FillInputTarget
    text: string
    browserInstanceId?: string
    pageContextId?: number
  }> {
  if (typeof input.formId !== 'string' || input.formId.length === 0) {
    return invalidToolInputResponse('formId must be a non-empty string.')
  }

  if (
    typeof input.controlId !== 'string' ||
    input.controlId.length === 0
  ) {
    return invalidToolInputResponse('controlId must be a non-empty string.')
  }

  if (typeof input.text !== 'string') {
    return invalidToolInputResponse('text must be a string.')
  }

  const browserInstanceId = normalizeBrowserInstanceId(
    input.browserInstanceId
  )

  if (!browserInstanceId.ok) {
    return browserInstanceId
  }

  if (
    input.expectedLabel !== undefined &&
    typeof input.expectedLabel !== 'string'
  ) {
    return invalidToolInputResponse(
      'expectedLabel must be a string when provided.'
    )
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
      target: {
        formId: input.formId,
        controlId: input.controlId,
        ...(input.expectedLabel !== undefined
          ? { expectedLabel: input.expectedLabel }
          : {})
      },
      text: input.text,
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
