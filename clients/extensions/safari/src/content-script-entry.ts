// Safari content script entry point.
//
// Per ADR 0019, this is a thin file that registers a
// browser.runtime.onMessage listener and delegates to the shared
// handleContentRequest function from @brijio/shared.
// It is analogous to Chrome's content-script-entry.ts but uses the
// browser.* namespace (WebExtension API) instead of chrome.*.
//
// Per ADR 0042, a module-scoped sentinel prevents duplicate listener
// registration when scripting.executeScript re-injects this script
// into the same page.

import {
  handleContentRequest,
  registerPageNavigationListener,
  type ContentRequest,
  type ContentResponse
} from '@brijio/shared'

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

// Guard against duplicate injection: if this script is injected again
// (e.g. by scripting.executeScript), skip re-registering listeners.
// The window property is set on first injection and persists across
// re-injections because the page context is the same.
if ((globalThis as Record<string, unknown>).__brijioContentLoaded !== true) {
  ;(globalThis as Record<string, unknown>).__brijioContentLoaded = true

  // Per ADR 0041, register a pageshow listener so content-handler
  // increments pageContextVersion on back/forward navigation.
  registerPageNavigationListener()

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
}
