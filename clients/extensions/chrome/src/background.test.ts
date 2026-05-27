import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { describe, it } from 'node:test'

interface RuntimeMessage {
  type?: unknown
  websocketUrl?: unknown
  pairingToken?: unknown
  browserInstanceId?: unknown
  browserName?: unknown
  profileName?: unknown
  label?: unknown
}

interface RuntimeResponse {
  ok?: unknown
  data?: unknown
  error?: {
    message?: unknown
  }
}

type RuntimeListener = (
  message: RuntimeMessage,
  sender: unknown,
  sendResponse: (response: RuntimeResponse) => void,
) => boolean | undefined

void describe('Chrome background settings messages', () => {
  void it('saves and reloads pairing identity settings', async () => {
    const chrome = await loadBackground()

    const saveResponse = await chrome.sendRuntimeMessage({
      type: 'save_settings',
      websocketUrl: 'ws://127.0.0.1:8787',
      pairingToken: 'local-token',
      profileName: 'Work',
      label: 'Chrome Work'
    })

    assert.equal(saveResponse.ok, true)
    assert.equal(chrome.storageValues.websocketUrl, 'ws://127.0.0.1:8787')
    assert.equal(chrome.storageValues.pairingToken, 'local-token')
    assert.equal(chrome.storageValues.profileName, 'Work')
    assert.equal(chrome.storageValues.label, 'Chrome Work')
    assert.equal(chrome.storageValues.browserName, 'Chrome')
    assert.match(String(chrome.storageValues.browserInstanceId), /^chrome-/)

    const loadResponse = await chrome.sendRuntimeMessage({
      type: 'get_settings'
    })

    assert.deepEqual(loadResponse, {
      ok: true,
      data: {
        websocketUrl: 'ws://127.0.0.1:8787',
        pairingToken: 'local-token',
        browserInstanceId: chrome.storageValues.browserInstanceId,
        browserName: 'Chrome',
        profileName: 'Work',
        label: 'Chrome Work'
      }
    })
  })

  void it('keeps the generated browser instance id stable across saves', async () => {
    const chrome = await loadBackground()

    await chrome.sendRuntimeMessage({
      type: 'save_settings',
      websocketUrl: 'ws://127.0.0.1:8787',
      pairingToken: 'first-token',
      profileName: 'Default',
      label: 'Chrome Default'
    })

    const browserInstanceId = chrome.storageValues.browserInstanceId

    await chrome.sendRuntimeMessage({
      type: 'save_settings',
      websocketUrl: 'ws://127.0.0.1:8787',
      pairingToken: 'second-token',
      profileName: 'Personal',
      label: 'Chrome Personal'
    })

    assert.deepEqual(chrome.storageValues, {
      websocketUrl: 'ws://127.0.0.1:8787',
      pairingToken: 'second-token',
      browserInstanceId,
      browserName: 'Chrome',
      profileName: 'Personal',
      label: 'Chrome Personal'
    })
  })

  void it('loads saved setup values even when runtime identity is incomplete', async () => {
    const chrome = await loadBackground({
      websocketUrl: 'ws://127.0.0.1:8787',
      pairingToken: 'saved-token',
      profileName: 'Saved Profile',
      label: 'Saved Label'
    })

    const loadResponse = await chrome.sendRuntimeMessage({
      type: 'get_settings'
    })

    assert.deepEqual(loadResponse, {
      ok: true,
      data: {
        websocketUrl: 'ws://127.0.0.1:8787',
        pairingToken: 'saved-token',
        browserName: 'Chrome',
        profileName: 'Saved Profile',
        label: 'Saved Label'
      }
    })
  })
})

async function loadBackground (
  storageValues: Record<string, unknown> = {}
): Promise<FakeChromeApi> {
  const chrome = new FakeChromeApi(storageValues)
  globalThis.chrome = chrome

  const backgroundUrl = pathToFileURL(
    new URL('background.ts', import.meta.url).pathname
  )
  backgroundUrl.search = `?test=${crypto.randomUUID()}`
  await import(backgroundUrl.href)

  assert.equal(chrome.runtimeListeners.length, 1)

  return chrome
}

class FakeChromeApi {
  readonly runtimeListeners: RuntimeListener[] = []
  readonly storageValues: Record<string, unknown>

  constructor (storageValues: Record<string, unknown> = {}) {
    this.storageValues = { ...storageValues }
  }

  readonly action = {
    onClicked: {
      addListener: (_callback: () => void | Promise<void>) => {}
    },
    setBadgeText: async (_details: { text: string }) => {},
    setBadgeBackgroundColor: async (_details: { color: string }) => {},
    setBadgeTextColor: async (_details: { color: string }) => {},
    setTitle: async (_details: { title: string }) => {}
  }

  readonly runtime = {
    getURL: (path: string) => `chrome-extension://test/${path}`,
    onMessage: {
      addListener: (callback: RuntimeListener) => {
        this.runtimeListeners.push(callback)
      }
    }
  }

  readonly permissions = {
    contains: async (_permissions: { origins: string[] }) => false,
    request: async (_permissions: { origins: string[] }) => false
  }

  readonly storage = {
    local: {
      get: async (keys: string[]) => {
        return Object.fromEntries(
          keys.map((key) => [key, this.storageValues[key]])
        )
      },
      set: async (items: Record<string, unknown>) => {
        Object.assign(this.storageValues, items)
      }
    }
  }

  readonly scripting = {
    executeScript: async (_details: {
      target: { tabId: number }
      files: string[]
    }) => []
  }

  readonly tabs = {
    create: async (_properties: { url: string }) => ({}),
    query: async (_queryInfo: { active: boolean, currentWindow: boolean }) => [],
    sendMessage: async (_tabId: number, _message: unknown) => ({})
  }

  async sendRuntimeMessage (
    message: RuntimeMessage
  ): Promise<RuntimeResponse> {
    return await new Promise((resolve) => {
      const handled = this.runtimeListeners[0]?.(message, {}, resolve)

      if (handled !== true) {
        resolve({
          ok: false,
          error: {
            message: 'Message was not handled asynchronously.'
          }
        })
      }
    })
  }
}

declare global {
  // eslint-disable-next-line no-var
  var chrome: FakeChromeApi
}
