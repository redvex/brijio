import {
  type BrijioPageActionsConfig,
  fetchResource as fetchResourceAction
} from './page-actions.js'
import { type BrijioToolResult } from './page-reading-tool.js'

export interface FetchResourceInput {
  url?: unknown
  maxSizeBytes?: unknown
  fetchTimeout?: unknown
  browserInstanceId?: unknown
}

export interface FetchResourceResultData {
  fetchId: string
  contentType: string | null
  totalBytes: number
  sha256: string
  dataBase64: string
}

export type FetchResourceResult =
  BrijioToolResult<FetchResourceResultData>

export async function fetchResource (
  config: BrijioPageActionsConfig,
  input: FetchResourceInput
): Promise<FetchResourceResult> {
  const normalizedInput = normalizeInput(input)

  if (!normalizedInput.ok) {
    return normalizedInput
  }

  return await fetchResourceAction(
    config,
    normalizedInput.data.url,
    normalizedInput.data.maxSizeBytes,
    normalizedInput.data.fetchTimeout,
    normalizedInput.data.browserInstanceId
  )
}

function normalizeInput (input: FetchResourceInput): BrijioToolResult<{
  url: string
  maxSizeBytes?: number
  fetchTimeout?: number
  browserInstanceId?: string
}> {
  if (typeof input.url !== 'string' || input.url.length === 0) {
    return invalidToolInputResponse('url must be a non-empty string.')
  }

  const maxSizeBytes = typeof input.maxSizeBytes === 'number' && input.maxSizeBytes > 0
    ? input.maxSizeBytes
    : undefined

  const fetchTimeout = typeof input.fetchTimeout === 'number' && input.fetchTimeout > 0
    ? input.fetchTimeout
    : undefined

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
      ...(maxSizeBytes !== undefined ? { maxSizeBytes } : {}),
      ...(fetchTimeout !== undefined ? { fetchTimeout } : {}),
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
