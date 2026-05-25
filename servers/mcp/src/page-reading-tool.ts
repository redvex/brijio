import {
  getCurrentPageContent,
  getCurrentPageContext,
  type BrowserBridgePageContextConfig
} from './page-context.js'
import {
  type BrowserBridgeErrorCode,
  type PageContent,
  type PageContext
} from './protocol.js'

const defaultMaxContentChunks = 1
const maxAllowedContentChunks = 5

export type BrowserBridgeToolErrorCode =
  | BrowserBridgeErrorCode
  | 'invalid_tool_input'

export type BrowserBridgeToolResult<T> =
  | {
    ok: true
    data: T
  }
  | {
    ok: false
    error: {
      code: BrowserBridgeToolErrorCode
      message: string
    }
  }

export interface ReadCurrentPageInput {
  includeContent?: boolean
  maxContentChunks?: number
}

export interface ReadCurrentPageData {
  context: PageContext
  content: PageContent[]
  contentTruncated: boolean
  nextContentIndex: number | null
}

export type ReadCurrentPageResult =
  BrowserBridgeToolResult<ReadCurrentPageData>

export async function readCurrentPage (
  config: BrowserBridgePageContextConfig,
  input: ReadCurrentPageInput
): Promise<ReadCurrentPageResult> {
  const normalizedInput = normalizeInput(input)

  if (!normalizedInput.ok) {
    return normalizedInput
  }

  const contextResult = await getCurrentPageContext(config)

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
    normalizedInput.data.maxContentChunks
  )
}

function normalizeInput (
  input: ReadCurrentPageInput
): BrowserBridgeToolResult<Required<ReadCurrentPageInput>> {
  const includeContent = input.includeContent ?? true
  const maxContentChunks = input.maxContentChunks ?? defaultMaxContentChunks

  if (typeof includeContent !== 'boolean') {
    return invalidToolInputResponse('includeContent must be a boolean.')
  }

  if (
    !Number.isInteger(maxContentChunks) ||
    maxContentChunks < 0 ||
    maxContentChunks > maxAllowedContentChunks
  ) {
    return invalidToolInputResponse(
      'maxContentChunks must be an integer from 0 through 5.'
    )
  }

  return {
    ok: true,
    data: {
      includeContent,
      maxContentChunks
    }
  }
}

async function readContentChunks (
  config: BrowserBridgePageContextConfig,
  context: PageContext,
  maxContentChunks: number
): Promise<ReadCurrentPageResult> {
  const content: PageContent[] = []
  let nextIndex = context.content.firstIndex

  for (let count = 0; count < maxContentChunks; count += 1) {
    const contentResult = await getCurrentPageContent(config, nextIndex)

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
