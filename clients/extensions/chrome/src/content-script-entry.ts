import { handleContentRequest, type ContentRequest, type ContentResponse } from '@browserbridge/shared'

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
