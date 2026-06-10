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
      removeListener: (
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

// Per ADR 0041, register a pageshow listener so content-handler
// increments pageContextVersion on back/forward navigation.
registerPageNavigationListener()

if (typeof chrome !== 'undefined') {
  // Per ADR 0043: When scripting.executeScript re-injects this script,
  // a new module scope is created with a fresh pageContextVersion.
  // We must remove the PREVIOUS injection's listener (stored on globalThis)
  // before adding the new one, so only one listener is active and
  // pageContextVersion matches the current module scope.
  type OnMessageCallback = (
    message: ContentRequest,
    sender: unknown,
    sendResponse: SendResponse
  ) => boolean

  const globalRef = globalThis as Record<string, unknown>

  const onMessage: OnMessageCallback = (
    message: ContentRequest,
    _sender: unknown,
    sendResponse: SendResponse
  ): boolean => {
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

  // Remove the previous injection's listener if it exists
  const previousListener = globalRef.__brijioOnMessageListener as OnMessageCallback | undefined
  if (previousListener !== undefined) {
    chrome.runtime.onMessage.removeListener(previousListener)
  }

  chrome.runtime.onMessage.addListener(onMessage)
  // Store reference so the next injection can remove this one
  globalRef.__brijioOnMessageListener = onMessage
}
