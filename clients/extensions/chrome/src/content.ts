import { chunkReadableContent } from './page-content.js'
import { extractPageContent, extractPageContext } from './page-context.js'
import {
  type ActionResultData,
  type ActionResultErrorCode,
  type ClickActionTarget,
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
  | {
    type: 'perform_click'
    target: ClickActionTarget
  }

export type ContentResponse =
  | {
    ok: true
    data: PageContext | PageContent | ActionResultData
  }
  | {
    ok: false
    error: {
      code: PageContentErrorCode | ActionResultErrorCode
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

    if (request.type === 'perform_click') {
      return performClick(request.target, environment.document)
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

function performClick (
  target: ClickActionTarget,
  document: Document
): ContentResponse {
  const element = findClickTarget(target, document)

  if (element === null) {
    return {
      ok: false,
      error: {
        code: 'target_not_found',
        message: 'No matching click target was found.'
      }
    }
  }

  if (target.kind === 'action' && element.hasAttribute('disabled')) {
    return {
      ok: false,
      error: {
        code: 'target_disabled',
        message: 'The requested click target is disabled.'
      }
    }
  }

  try {
    const clickable = element as HTMLElement
    clickable.click()

    return {
      ok: true,
      data: {
        action: 'click',
        target
      }
    }
  } catch {
    return {
      ok: false,
      error: {
        code: 'action_failed',
        message: 'Unable to perform the requested click action.'
      }
    }
  }
}

function findClickTarget (
  target: ClickActionTarget,
  document: Document
): Element | null {
  const index = parseTargetId(target.id)

  if (index === null) {
    return null
  }

  const selector =
    target.kind === 'link'
      ? 'a[href]'
      : 'button, [role="button"], input[type="button"], input[type="submit"]'
  const elements = Array.from(document.querySelectorAll(selector)).filter(
    isVisible
  )

  return elements[index - 1] ?? null
}

function parseTargetId (id: string): number | null {
  const match = /^bb-(\d+)$/u.exec(id)

  if (match === null) {
    return null
  }

  const index = Number(match[1])

  return Number.isInteger(index) && index >= 1 ? index : null
}

function isVisible (element: Element): boolean {
  return !isSkippedElement(element)
}

function isSkippedElement (element: Element): boolean {
  const tagName = element.tagName.toLowerCase()

  return (
    ['script', 'style', 'template', 'noscript'].includes(tagName) ||
    element.hasAttribute('hidden') ||
    element.getAttribute('aria-hidden') === 'true' ||
    (tagName === 'input' && element.getAttribute('type') === 'hidden')
  )
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
