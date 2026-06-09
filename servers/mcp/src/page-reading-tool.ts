import {
  getCurrentPageContent,
  getCurrentPageContext,
  type BrijioPageContextConfig
} from './page-context.js'
import {
  type BrijioErrorCode,
  type PageContent,
  type PageContext,
  type StaleContextDetail
} from './protocol.js'

const defaultMaxContentChunks = 1
const defaultStartContentIndex = 1
const maxAllowedContentChunks = 10

export type BrijioToolErrorCode =
  | BrijioErrorCode
  | 'invalid_tool_input'

export type BrijioToolResult<T> =
  | {
    ok: true
    data: T
  }
  | {
    ok: false
    error: {
      code: BrijioToolErrorCode
      message: string
      detail?: StaleContextDetail
    }
  }

export interface ReadCurrentPageInput {
  includeContent?: boolean
  maxContentChunks?: number
  startContentIndex?: number
  browserInstanceId?: unknown
}

export interface ReadCurrentPageData {
  context: PageContext
  content: PageContent[]
  contentTruncated: boolean
  nextContentIndex: number | null
}

export type ReadCurrentPageResult =
  BrijioToolResult<ReadCurrentPageData>

interface NormalizedReadCurrentPageInput {
  includeContent: boolean
  maxContentChunks: number
  startContentIndex: number
  browserInstanceId?: string
}

export async function readCurrentPage (
  config: BrijioPageContextConfig,
  input: ReadCurrentPageInput
): Promise<ReadCurrentPageResult> {
  const normalizedInput = normalizeInput(input)

  if (!normalizedInput.ok) {
    return normalizedInput
  }

  const contextResult = await getCurrentPageContext(
    config,
    normalizedInput.data.browserInstanceId
  )

  if (!contextResult.ok) {
    return contextResult
  }

  if (
    !normalizedInput.data.includeContent ||
    normalizedInput.data.maxContentChunks === 0 ||
    !contextResult.data.content.available
  ) {
    return {
      ok: true,
      data: {
        context: contextResult.data,
        content: [],
        contentTruncated: false,
        nextContentIndex: null
      }
    }
  }

  return await readContentChunks(
    config,
    contextResult.data,
    normalizedInput.data.maxContentChunks,
    normalizedInput.data.startContentIndex,
    normalizedInput.data.browserInstanceId
  )
}

function normalizeInput (
  input: ReadCurrentPageInput
): BrijioToolResult<NormalizedReadCurrentPageInput> {
  const includeContent = input.includeContent ?? true
  const maxContentChunks = input.maxContentChunks ?? defaultMaxContentChunks
  const startContentIndex = input.startContentIndex ?? defaultStartContentIndex
  const browserInstanceId = normalizeBrowserInstanceId(input.browserInstanceId)

  if (typeof includeContent !== 'boolean') {
    return invalidToolInputResponse('includeContent must be a boolean.')
  }

  if (
    !Number.isInteger(maxContentChunks) ||
    maxContentChunks < 0 ||
    maxContentChunks > maxAllowedContentChunks
  ) {
    return invalidToolInputResponse(
      `maxContentChunks must be an integer from 0 through ${maxAllowedContentChunks}.`
    )
  }

  if (
    !Number.isInteger(startContentIndex) ||
    startContentIndex < 1
  ) {
    return invalidToolInputResponse(
      'startContentIndex must be a positive integer.'
    )
  }

  if (!browserInstanceId.ok) {
    return browserInstanceId
  }

  return {
    ok: true,
    data: {
      includeContent,
      maxContentChunks,
      startContentIndex,
      ...(browserInstanceId.data !== undefined
        ? { browserInstanceId: browserInstanceId.data }
        : {})
    }
  }
}

async function readContentChunks (
  config: BrijioPageContextConfig,
  context: PageContext,
  maxContentChunks: number,
  startContentIndex: number,
  browserInstanceId?: string
): Promise<ReadCurrentPageResult> {
  const content: PageContent[] = []
  let nextIndex = startContentIndex

  for (let count = 0; count < maxContentChunks; count += 1) {
    const contentResult = await getCurrentPageContent(
      config,
      nextIndex,
      browserInstanceId
    )

    if (!contentResult.ok) {
      return contentResult
    }

    content.push(contentResult.data)

    if (!contentResult.data.truncated) {
      return {
        ok: true,
        data: {
          context,
          content,
          contentTruncated: false,
          nextContentIndex: null
        }
      }
    }

    nextIndex += 1
  }

  const lastContent = content[content.length - 1]
  const contentTruncated = lastContent?.truncated ?? false

  return {
    ok: true,
    data: {
      context,
      content,
      contentTruncated,
      nextContentIndex: contentTruncated ? nextIndex : null
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
