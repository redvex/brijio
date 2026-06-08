// Chrome popup message helpers.
//
// Per ADR 0031, message creators and response parsers are shared via
// @brijio/shared. This file only contains Chrome-specific helpers:
// the ChromeRuntime interface and the Promise-based sendMessage wrapper.

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

export interface ChromeRuntime {
  runtime: {
    sendMessage: (message: unknown) => Promise<unknown>
  }
}

/**
 * Send a message to the background script and return a Promise with the response.
 *
 * Chrome's chrome.runtime.sendMessage() returns a Promise natively in MV3.
 */
export async function sendMessage (chromeRuntime: ChromeRuntime, message: unknown): Promise<unknown> {
  return await chromeRuntime.runtime.sendMessage(message)
}
