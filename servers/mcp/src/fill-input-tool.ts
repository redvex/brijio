import {
  fillCurrentPageInput,
  type BrowserBridgePageActionsConfig
} from './page-actions.js'
import { type FillInputTarget } from './protocol.js'
import { type BrowserBridgeToolResult } from './page-reading-tool.js'

export interface FillInputInput {
  formId?: unknown
  controlId?: unknown
  text?: unknown
}

export type FillInputResult =
  BrowserBridgeToolResult<{
    action: 'write_text'
    target: FillInputTarget
    textLength: number
  }>

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
    normalizedInput.data.text
  )
}

function normalizeInput (
  input: FillInputInput
): BrowserBridgeToolResult<{ target: FillInputTarget, text: string }> {
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

  return {
    ok: true,
    data: {
      target: {
        formId: input.formId,
        controlId: input.controlId
      },
      text: input.text
    }
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
