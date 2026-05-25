import {
  fillCurrentPageInput,
  type BrowserBridgePageActionsConfig
} from './page-actions.js'
import {
  type FillInputActionResultData,
  type FillInputTarget
} from './protocol.js'
import { type BrowserBridgeToolResult } from './page-reading-tool.js'

export interface FillInputInput {
  formId?: unknown
  controlId?: unknown
  text?: unknown
  browserInstanceId?: unknown
}

export type FillInputResult =
  BrowserBridgeToolResult<FillInputActionResultData>

export async function fillInput (
  config: BrowserBridgePageActionsConfig,
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
    normalizedInput.data.browserInstanceId
  )
}

function normalizeInput (
  input: FillInputInput
): BrowserBridgeToolResult<{
    target: FillInputTarget
    text: string
    browserInstanceId?: string
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

  return {
    ok: true,
    data: {
      target: {
        formId: input.formId,
        controlId: input.controlId
      },
      text: input.text,
      ...(browserInstanceId.data !== undefined
        ? { browserInstanceId: browserInstanceId.data }
        : {})
    }
  }
}

function normalizeBrowserInstanceId (
  value: unknown
): BrowserBridgeToolResult<string | undefined> {
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
): BrowserBridgeToolResult<never> {
  return {
    ok: false,
    error: {
      code: 'invalid_tool_input',
      message
    }
  }
}
