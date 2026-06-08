// Chrome popup DOM entry point.
//
// Per ADR 0031, Chrome uses shared initPopup from @brijio/shared
// for all popup logic. This file only provides the Chrome-specific
// ChromeRuntime interface, the sendMessage wrapper, and the production boot.

import { initPopup } from '@brijio/shared'
import type { SendMessageFn } from '@brijio/shared'
import type { ChromeRuntime } from './popup.js'

function createChromeSendMessage (chromeRuntime: ChromeRuntime): SendMessageFn {
  return async (message: unknown): Promise<unknown> => {
    return await chromeRuntime.runtime.sendMessage(message)
  }
}

// Production entry: initialise with real Chrome globals.
//
// This self-executing block only runs when loaded as a browser <script>.
// In tests, initPopup is called directly with injected dependencies.
declare const chrome: ChromeRuntime

if (typeof (globalThis as { document?: unknown }).document !== 'undefined') {
  void initPopup((globalThis as { document: Document }).document, createChromeSendMessage(chrome))
}
