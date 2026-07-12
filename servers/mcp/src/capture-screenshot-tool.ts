import {
  type BrijioPageActionsConfig,
  captureScreenshot as captureScreenshotAction
} from './page-actions.js'
import { type BrijioToolResult } from './page-reading-tool.js'

export interface CaptureScreenshotInput {
  browserInstanceId?: unknown
  tabId?: unknown
}

export interface CaptureScreenshotResultData {
  dataBase64: string
  mimeType: 'image/jpeg'
  width: number
  height: number
  tabId: string
  capturedAt: string
}

export type CaptureScreenshotResult =
  BrijioToolResult<CaptureScreenshotResultData>

export async function captureScreenshot (
  config: BrijioPageActionsConfig,
  input: CaptureScreenshotInput
): Promise<CaptureScreenshotResult> {
  const normalizedInput = normalizeInput(input)

  if (!normalizedInput.ok) {
    return normalizedInput
  }

  const result = await captureScreenshotAction(
    config,
    normalizedInput.data.browserInstanceId,
    normalizedInput.data.tabId
  )

  if (!result.ok) {
    return result
  }

  return {
    ok: true,
    data: {
      dataBase64: result.data.dataBase64,
      mimeType: 'image/jpeg',
      width: result.data.width,
      height: result.data.height,
      tabId: result.data.tabId,
      capturedAt: result.data.capturedAt
    }
  }
}

function normalizeInput (input: CaptureScreenshotInput): BrijioToolResult<{
  browserInstanceId?: string
  tabId?: string
}> {
  const browserInstanceId = normalizeBrowserInstanceId(
    input.browserInstanceId
  )

  if (!browserInstanceId.ok) {
    return browserInstanceId
  }

  const tabId = normalizeTabId(input.tabId)

  if (!tabId.ok) {
    return tabId
  }

  return {
    ok: true,
    data: {
      ...(browserInstanceId.data !== undefined
        ? { browserInstanceId: browserInstanceId.data }
        : {}),
      ...(tabId.data !== undefined ? { tabId: tabId.data } : {})
    }
  }
}

function normalizeBrowserInstanceId (
  value: unknown
): BrijioToolResult<string | undefined> {
  if (value === undefined) {
    return { ok: true, data: undefined }
  }

  if (typeof value !== 'string' || value.length === 0) {
    return invalidToolInputResponse(
      'browserInstanceId must be a non-empty string when provided.'
    )
  }

  return { ok: true, data: value }
}

function normalizeTabId (
  value: unknown
): BrijioToolResult<string | undefined> {
  if (value === undefined) {
    return { ok: true, data: undefined }
  }

  if (typeof value !== 'string' || value.length === 0) {
    return invalidToolInputResponse(
      'tabId must be a non-empty string when provided.'
    )
  }

  return { ok: true, data: value }
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
