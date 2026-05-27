// Safari content script entry point.
//
// Per ADR 0019, this is a thin file that registers a
// browser.runtime.onMessage listener and delegates to the shared
// handleContentRequest function from @browserbridge/shared.
// It is analogous to Chrome's content-script-entry.ts but uses the
// browser.* namespace (WebExtension API) instead of chrome.*.

import {
  handleContentRequest,
  type ContentRequest,
  type ContentResponse
} from '@browserbridge/shared'

type SendResponse = (response: ContentResponse) => void

interface BrowserRuntimeApi {
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

declare const browser: BrowserRuntimeApi | undefined

if (typeof browser !== 'undefined') {
  browser.runtime.onMessage.addListener(
    (message: ContentRequest, _sender: unknown, sendResponse: SendResponse): boolean => {
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
    }
  )
}
