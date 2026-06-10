import {
  handleContentRequest,
  registerPageNavigationListener,
  type ContentRequest,
  type ContentResponse
} from '@brijio/shared'

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

// Guard against duplicate injection: if this script is injected again
// (e.g. by scripting.executeScript), skip re-registering listeners.
// The window property is set on first injection and persists across
// re-injections because the page context is the same.
if ((globalThis as Record<string, unknown>).__brijioContentLoaded !== true) {
  ;(globalThis as Record<string, unknown>).__brijioContentLoaded = true

  // Per ADR 0041, register a pageshow listener so content-handler
  // increments pageContextVersion on back/forward navigation.
  registerPageNavigationListener()

  if (typeof chrome !== 'undefined') {
    chrome.runtime.onMessage.addListener(
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
}
