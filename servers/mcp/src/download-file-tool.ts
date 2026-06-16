import {
  type BrijioPageActionsConfig,
  downloadFile as downloadFileAction
} from './page-actions.js'
import { type BrijioToolResult } from './page-reading-tool.js'

export interface DownloadFileInput {
  url?: unknown
  filename?: unknown
  conflictAction?: unknown
  browserInstanceId?: unknown
}

export interface DownloadFileResultData {
  downloadId: number | null
  status: 'initiated' | 'initiated_fire_and_forget'
}

export type DownloadFileResult =
  BrijioToolResult<DownloadFileResultData>

export async function downloadFile (
  config: BrijioPageActionsConfig,
  input: DownloadFileInput
): Promise<DownloadFileResult> {
  const normalizedInput = normalizeInput(input)

  if (!normalizedInput.ok) {
    return normalizedInput
  }

  return await downloadFileAction(
    config,
    normalizedInput.data.url,
    normalizedInput.data.filename,
    normalizedInput.data.conflictAction,
    normalizedInput.data.browserInstanceId
  )
}

function normalizeInput (input: DownloadFileInput): BrijioToolResult<{
  url: string
  filename?: string
  conflictAction?: 'uniquify' | 'overwrite'
  browserInstanceId?: string
}> {
  if (typeof input.url !== 'string' || input.url.length === 0) {
    return invalidToolInputResponse('url must be a non-empty string.')
  }

  const filename = typeof input.filename === 'string' && input.filename.length > 0
    ? input.filename
    : undefined

  if (input.conflictAction !== undefined &&
      input.conflictAction !== 'uniquify' &&
      input.conflictAction !== 'overwrite') {
    return invalidToolInputResponse('conflictAction must be "uniquify" or "overwrite" when provided.')
  }

  const conflictAction = input.conflictAction

  const browserInstanceId = normalizeBrowserInstanceId(
    input.browserInstanceId
  )
  if (!browserInstanceId.ok) {
    return browserInstanceId
  }

  return {
    ok: true,
    data: {
      url: input.url,
      ...(filename !== undefined ? { filename } : {}),
      ...(conflictAction !== undefined ? { conflictAction } : {}),
      ...(browserInstanceId.data !== undefined
        ? { browserInstanceId: browserInstanceId.data }
        : {})
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
