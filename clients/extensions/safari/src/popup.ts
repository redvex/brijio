// Safari popup message helpers.
//
// Per ADR 0031, message creators and response parsers are shared via
// @brijio/shared. This file only contains Safari-specific helpers:
// the BrowserApi interface and the callback-based sendMessage wrapper.

import type { BrowserApi } from './popup-entry.js'

import {
  createGetSettingsMessage,
  createSaveSettingsMessage,
  createConnectMessage,
  createDisconnectMessage,
  createGetStatusMessage,
  parseSettingsResponse,
  parseStatusResponse,
  parseErrorResponse
} from '@brijio/shared'

export {
  createGetSettingsMessage,
  createSaveSettingsMessage,
  createConnectMessage,
  createDisconnectMessage,
  createGetStatusMessage,
  parseSettingsResponse,
  parseStatusResponse,
  parseErrorResponse
}

/**
 * Send a message to the background script and return a Promise with the response.
 *
 * Safari's browser.runtime.sendMessage() uses a callback pattern in MV2,
 * not a promise-based API. This wrapper promisifies it for async/await usage.
 */
export async function sendMessage (browser: BrowserApi, message: unknown): Promise<unknown> {
  return await new Promise((resolve) => {
    browser.runtime.sendMessage(message, undefined, (response: unknown) => {
      resolve(response)
    })
  })
}
