import { chunkReadableContent } from './page-content.js'
import { extractPageContent, extractPageContext } from './page-context.js'
import {
  type PageContent,
  type PageContentErrorCode,
  type PageContext
} from './protocol.js'

export type ContentRequest =
  | {
    type: 'extract_page_context'
    previewMaxBytes: number
    defaultMaxPayloadBytes: number
  }
  | {
    type: 'extract_page_content'
    index: number
    maxContentBytes: number
    maxPayloadBytes: number
  }

export type ContentResponse =
  | {
    ok: true
    data: PageContext | PageContent
  }
  | {
    ok: false
    error: {
      code: PageContentErrorCode
      message: string
    }
  }

export interface ContentEnvironment {
  document: Document
  locationHref: string
  title: string
  selectedText: string
  now: () => string
}

type SendResponse = (response: ContentResponse) => void

interface ChromeRuntimeApi {
  runtime: {
    onMessage: {
      addListener: (
        callback: (
          message: ContentRequest,
          sender: unknown,
          sendResponse: SendResponse
        ) => boolean
      ) => void
    }
  }
}

declare const chrome: ChromeRuntimeApi | undefined

export function handleContentRequest (
  request: ContentRequest,
  environment: ContentEnvironment
): ContentResponse {
  try {
    if (request.type === 'extract_page_context') {
      return {
        ok: true,
        data: extractPageContext({
          document: environment.document,
          locationHref: environment.locationHref,
          title: environment.title,
          selectedText: environment.selectedText,
          now: environment.now,
          previewMaxBytes: request.previewMaxBytes,
          defaultMaxPayloadBytes: request.defaultMaxPayloadBytes
        })
      }
    }

    const content = extractPageContent(environment.document)
    const chunk = chunkReadableContent(
      content,
      request.index,
      request.maxContentBytes
    )

    return {
      ok: true,
      data: {
        url: environment.locationHref,
        title: environment.title,
        timestamp: environment.now(),
        index: chunk.index,
        content: chunk.content,
        truncated: chunk.truncated,
        maxPayloadBytes: request.maxPayloadBytes
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'invalid_index') {
      return {
        ok: false,
        error: {
          code: 'invalid_index',
          message: 'Page content chunk index must be available and 1-based.'
        }
      }
    }

    return {
      ok: false,
      error: {
        code: 'extraction_failed',
        message: 'Unable to extract page content from the active tab.'
      }
    }
  }
}

if (typeof chrome !== 'undefined') {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    sendResponse(
      handleContentRequest(message, {
        document: globalThis.document,
        locationHref: globalThis.location.href,
        title: globalThis.document.title,
        selectedText: globalThis.getSelection?.()?.toString() ?? '',
        now: () => new Date().toISOString()
      })
    )

    return false
  })
}
