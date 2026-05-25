import {
  clickCurrentPageElement,
  type BrowserBridgePageActionsConfig
} from './page-actions.js'
import { type ClickElementTarget } from './protocol.js'
import { type BrowserBridgeToolResult } from './page-reading-tool.js'

export interface ClickElementInput {
  kind?: unknown
  id?: unknown
  browserInstanceId?: unknown
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

  return await clickCurrentPageElement(
    config,
    normalizedInput.data.target,
    normalizedInput.data.browserInstanceId
  )
}

function normalizeInput (
  input: ClickElementInput
): BrowserBridgeToolResult<{
    target: ClickElementTarget
    browserInstanceId?: string
  }> {
  if (input.kind !== 'link' && input.kind !== 'action') {
    return invalidToolInputResponse('kind must be either "link" or "action".')
  }

  if (typeof input.id !== 'string' || input.id.length === 0) {
    return invalidToolInputResponse('id must be a non-empty string.')
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
        kind: input.kind,
        id: input.id
      },
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
