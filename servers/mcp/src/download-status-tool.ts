import {
  type BrijioPageActionsConfig,
  getDownloadStatus
} from './page-actions.js'
import { type BrijioToolResult } from './page-reading-tool.js'

export interface DownloadStatusInput {
  ids?: unknown
  browserInstanceId?: unknown
  tabId?: unknown
}

export interface DownloadStatusResultData {
  capability: 'full' | 'not_supported'
  items: Array<{
    id: number | string
    kind: 'download' | 'fetch'
    filename?: string
    url: string
    mime?: string | null
    size?: number | null
    state: string
    error?: string
  }>
}

export type DownloadStatusResult =
  BrijioToolResult<DownloadStatusResultData>

export async function downloadStatus (
  config: BrijioPageActionsConfig,
  input: DownloadStatusInput
): Promise<DownloadStatusResult> {
  const normalizedIds = normalizeIds(input.ids)
  if (!normalizedIds.ok) {
    return normalizedIds
  }

  const normalizedBrowserInstanceId = normalizeBrowserInstanceId(
    input.browserInstanceId
  )
  if (!normalizedBrowserInstanceId.ok) {
    return normalizedBrowserInstanceId
  }

  return await getDownloadStatus(
    config,
    normalizedIds.data,
    normalizedBrowserInstanceId.data
  )
}

function normalizeIds (
  value: unknown
): BrijioToolResult<Array<number | string> | undefined> {
  if (value === undefined) {
    return { ok: true, data: undefined }
  }

  if (!Array.isArray(value)) {
    return invalidToolInputResponse('ids must be an array of numbers or strings.')
  }

  for (const item of value) {
    if (typeof item !== 'number' && typeof item !== 'string') {
      return invalidToolInputResponse('Each id must be a number or string.')
    }
  }

  return { ok: true, data: value as Array<number | string> }
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
