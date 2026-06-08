import {
  navigateToCurrentPageUrl,
  type BrijioPageActionsConfig
} from './page-actions.js'
import {
  unsupportedSchemeResponse
} from './protocol.js'
import { type BrijioToolResult } from './page-reading-tool.js'

export interface NavigateToUrlInput {
  url?: unknown
  browserInstanceId?: unknown
}

export interface NavigateToUrlResultData {
  url: string
  title: string
  timestamp: string
  redirected: boolean
  navigationMs: number
}

export type NavigateToUrlResult =
  BrijioToolResult<NavigateToUrlResultData>

export async function navigateToUrl (
  config: BrijioPageActionsConfig,
  input: NavigateToUrlInput
): Promise<NavigateToUrlResult> {
  const normalizedInput = normalizeInput(input)

  if (!normalizedInput.ok) {
    return normalizedInput
  }

  return await navigateToCurrentPageUrl(
    config,
    normalizedInput.data.url,
    normalizedInput.data.browserInstanceId
  )
}

function normalizeInput (input: NavigateToUrlInput): BrijioToolResult<{
  url: string
  browserInstanceId?: string
}> {
  if (typeof input.url !== 'string' || input.url.length === 0) {
    return invalidToolInputResponse('url must be a non-empty string.')
  }

  const parsed = parseUrl(input.url)
  if (parsed !== null && parsed.scheme !== 'http' && parsed.scheme !== 'https') {
    return unsupportedSchemeResponse(parsed.scheme)
  }
  if (parsed === null) {
    return invalidToolInputResponse('url must be a valid URL.')
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
      url: input.url,
      ...(browserInstanceId.data !== undefined
        ? { browserInstanceId: browserInstanceId.data }
        : {})
    }
  }
}

function parseUrl (url: string): { scheme: string } | null {
  const colonIndex = url.indexOf(':')
  if (colonIndex <= 0) {
    return null
  }

  const scheme = url.slice(0, colonIndex).toLowerCase()
  // Valid schemes contain only letters, digits, +, -, .
  if (!/^[a-z][a-z0-9+\-.]*$/.test(scheme)) {
    return null
  }

  return { scheme }
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