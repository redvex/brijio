// Safari content script entry point.
//
// Per ADR 0019, this is a thin file that registers a
// browser.runtime.onMessage listener and delegates to the shared
// handleContentRequest / executeBatch functions from @brijio/shared.
// It is analogous to Chrome's content-script-entry.ts but uses the
// browser.* namespace (WebExtension API) instead of chrome.*.

import {
  handleContentRequest,
  executeBatch,
  isContentBatchRequest,
  registerPageNavigationListener,
  type ContentRequest,
  type ContentResponse,
  type ContentBatchRequest,
  type BatchResult
} from '@brijio/shared'

type SendResponse = (response: ContentResponse | BatchResult) => void

type IncomingMessage = ContentRequest | ContentBatchRequest

interface BrowserRuntimeApi {
  runtime: {
    onMessage: {
      addListener: (
        callback: (
          message: IncomingMessage,
          sender: unknown,
          sendResponse: SendResponse
        ) => boolean
      ) => void
      removeListener: (
        callback: (
          message: IncomingMessage,
          sender: unknown,
          sendResponse: SendResponse
        ) => boolean
      ) => void
    }
  }
}

declare const browser: BrowserRuntimeApi | undefined

if (typeof browser !== 'undefined') {
  // Per ADR 0041, register a pageshow listener so content-handler
  // increments pageContextVersion on back/forward navigation.
  // Per ADR 0043, this also replaces any previous injection's listener.
  registerPageNavigationListener()

  // Per ADR 0043: When scripting.executeScript re-injects this script,
  // a new module scope is created with a fresh pageContextVersion.
  // We must remove the PREVIOUS injection's listener (stored on globalThis)
  // before adding the new one, so only one listener is active and
  // pageContextVersion matches the current module scope.
  type OnMessageCallback = (
    message: IncomingMessage,
    sender: unknown,
    sendResponse: SendResponse
  ) => boolean

  const globalRef = globalThis as Record<string, unknown>

  const onMessage: OnMessageCallback = (
    message: IncomingMessage,
    _sender: unknown,
    sendResponse: SendResponse
  ): boolean => {
    if (isContentBatchRequest(message)) {
      const result = executeBatch({
        actions: message.actions,
        ...(message.pageContextId !== undefined ? { pageContextId: message.pageContextId } : {}),
        ...(message.continueOnError !== undefined ? { continueOnError: message.continueOnError } : {}),
        ...(message.readAfterActions !== undefined ? { readAfterActions: message.readAfterActions } : {})
      }, {
        document: globalThis.document,
        locationHref: globalThis.location.href,
        title: globalThis.document.title,
        selectedText: globalThis.getSelection?.()?.toString() ?? '',
        now: () => new Date().toISOString()
      })

      sendResponse(result)
      return false
    }

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
    browser.runtime.onMessage.removeListener(previousListener)
  }

  browser.runtime.onMessage.addListener(onMessage)
  // Store reference so the next injection can remove this one
  globalRef.__brijioOnMessageListener = onMessage
}
