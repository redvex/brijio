import {
  clickCurrentPageElement,
  type BrowserBridgePageActionsConfig
} from './page-actions.js'
import { type ClickElementTarget } from './protocol.js'
import { type BrowserBridgeToolResult } from './page-reading-tool.js'

export interface ClickElementInput {
  kind?: unknown
  id?: unknown
}

export type ClickElementResult =
  BrowserBridgeToolResult<{
    action: 'click'
    target: ClickElementTarget
  }>

export async function clickElement (
  config: BrowserBridgePageActionsConfig,
  input: ClickElementInput
): Promise<ClickElementResult> {
  const normalizedInput = normalizeInput(input)

  if (!normalizedInput.ok) {
    return normalizedInput
  }

  return await clickCurrentPageElement(config, normalizedInput.data)
}

function normalizeInput (
  input: ClickElementInput
): BrowserBridgeToolResult<ClickElementTarget> {
  if (input.kind !== 'link' && input.kind !== 'action') {
    return invalidToolInputResponse('kind must be either "link" or "action".')
  }

  if (typeof input.id !== 'string' || input.id.length === 0) {
    return invalidToolInputResponse('id must be a non-empty string.')
  }

  return {
    ok: true,
    data: {
      kind: input.kind,
      id: input.id
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
