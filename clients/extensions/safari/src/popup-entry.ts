// Safari popup DOM entry point.
//
// Per ADR 0031, Safari uses shared initPopup from @browserbridge/shared
// for all popup logic. This file only provides Safari-specific BrowserApi
// interface, the promisifying sendMessage wrapper, and the production boot.

import { initPopup } from '@browserbridge/shared'
import type { SendMessageFn } from '@browserbridge/shared'

export interface BrowserRuntime {
  sendMessage: (message: unknown, options?: unknown, callback?: (response: unknown) => void) => void
}

export interface BrowserApi {
  runtime: BrowserRuntime
}

function createSafariSendMessage (browser: BrowserApi): SendMessageFn {
  return async (message: unknown): Promise<unknown> => {
    return await new Promise((resolve) => {
      browser.runtime.sendMessage(message, undefined, (response: unknown) => {
        resolve(response)
      })
    })
  }
}

// Production entry: initialise with real browser globals.
//
// This self-executing block only runs when loaded as a browser <script>.
// In tests, initPopup is called directly with injected dependencies.
declare const browser: BrowserApi

if (typeof (globalThis as { document?: unknown }).document !== 'undefined') {
  void initPopup((globalThis as { document: Document }).document, createSafariSendMessage(browser))
}
