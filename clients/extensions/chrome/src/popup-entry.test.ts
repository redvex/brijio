import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseHTML } from 'linkedom'
import { initPopup } from '@browserbridge/shared'
import {
  createGetSettingsMessage,
  createGetStatusMessage,
  sendMessage
} from './popup.js'
import type { ChromeRuntime } from './popup.js'

void describe('Chrome popup sendMessage wrapper', () => {
  void it('resolves with the response from chrome.runtime.sendMessage', async () => {
    const chromeRuntime: ChromeRuntime = {
      runtime: {
        async sendMessage (message: unknown): Promise<unknown> {
          return { ok: true, data: { websocketUrl: 'ws://test' } }
        }
      }
    }
    const result = await sendMessage(chromeRuntime, createGetSettingsMessage())
    assert.deepEqual(result, { ok: true, data: { websocketUrl: 'ws://test' } })
  })

  void it('passes the message to chrome.runtime.sendMessage', async () => {
    let captured: unknown = null
    const chromeRuntime: ChromeRuntime = {
      runtime: {
        async sendMessage (message: unknown): Promise<unknown> {
          captured = message
          return { ok: true }
        }
      }
    }
    await sendMessage(chromeRuntime, createGetSettingsMessage())
    assert.deepEqual(captured, { type: 'get_settings' })
  })

  void it('resolves with undefined when sendMessage returns undefined', async () => {
    const chromeRuntime: ChromeRuntime = {
      runtime: {
        async sendMessage (_message: unknown): Promise<unknown> {
          return undefined
        }
      }
    }
    const result = await sendMessage(chromeRuntime, createGetSettingsMessage())
    assert.equal(result, undefined)
  })
})

void describe('Chrome popup entry integration', () => {
  async function flushMicrotasks (ticks = 5): Promise<void> {
    for (let i = 0; i < ticks; i++) {
      await new Promise((resolve) => setImmediate(resolve))
    }
  }

  void it('loads settings via chrome.runtime.sendMessage into form fields', async () => {
    const { document } = parseHTML(popupHtml())
    const runtime = createFakeChromeRuntime({
      [JSON.stringify(createGetSettingsMessage())]: {
        ok: true,
        data: { websocketUrl: 'ws://chrome:8787', pairingToken: 'chrome-tok', profileName: 'Default', label: 'Chrome Default' }
      },
      [JSON.stringify(createGetStatusMessage())]: { ok: true, data: { state: 'disconnected' } }
    })

    await initPopup(document, async (message: unknown): Promise<unknown> => {
      return await runtime.runtime.sendMessage(message)
    })

    const urlInput = document.querySelector<HTMLInputElement>('#websocket-url')
    assert.equal(urlInput?.value, 'ws://chrome:8787')
  })

  void it('sends save_settings on form submit via chrome runtime', async () => {
    const { document } = parseHTML(popupHtml())
    const messages: unknown[] = []
    const chromeSendMessage = async (message: unknown): Promise<unknown> => {
      messages.push(message)
      return { ok: true }
    }

    await initPopup(document, chromeSendMessage)

    const urlInput = document.querySelector<HTMLInputElement>('#websocket-url')
    const tokenInput = document.querySelector<HTMLInputElement>('#pairing-token')
    if (urlInput !== null) urlInput.value = 'ws://localhost:8787'
    if (tokenInput !== null) tokenInput.value = 'test-token'

    const form = document.querySelector<HTMLFormElement>('#settings-form')
    const window = document.defaultView
    if (window !== null) {
      form?.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    }
    await flushMicrotasks()

    const saveMsg = messages.find(m => (m as { type: string }).type === 'save_settings')
    assert.ok(saveMsg !== undefined)
  })
})

function popupHtml (): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>Brijio</title></head><body>
<h1>Brijio</h1>
<form id="settings-form" novalidate>
  <input id="websocket-url" name="websocketUrl" type="text" required />
  <input id="pairing-token" name="pairingToken" type="password" required />
  <input id="profile-name" name="profileName" type="text" value="Default" required />
  <input id="browser-label" name="label" type="text" value="Chrome Default" required />
  <button id="save-button" type="submit">Save</button>
  <button id="connect-button" type="button">Connect</button>
  <button id="disconnect-button" type="button">Disconnect</button>
</form>
<div id="status" role="status"><span id="status-spinner" class="hidden"></span><span id="status-text"></span></div>
</body></html>`
}

function createFakeChromeRuntime (responses: Record<string, unknown>): ChromeRuntime {
  return {
    runtime: {
      async sendMessage (message: unknown): Promise<unknown> {
        const key = JSON.stringify(message)
        return responses[key] ?? { ok: true }
      }
    }
  }
}
