import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseHTML } from 'linkedom'
import { initPopup } from './popup-entry.js'
import type { ChromeRuntime } from './popup.js'
import {
  createGetSettingsMessage,
  createGetStatusMessage
} from './popup.js'

void describe('Chrome popup entry', () => {
  async function flushMicrotasks (ticks = 5): Promise<void> {
    for (let i = 0; i < ticks; i++) {
      await new Promise((resolve) => setImmediate(resolve))
    }
  }

  void it('loads settings into form fields on open', async () => {
    const { document } = parseHTML(popupHtml())
    const runtime = createFakeChromeRuntime({
      [JSON.stringify(createGetSettingsMessage())]: {
        ok: true,
        data: { websocketUrl: 'ws://test:8787', pairingToken: 'tok', profileName: 'Default', label: 'Chrome Default' }
      },
      [JSON.stringify(createGetStatusMessage())]: { ok: true, data: { state: 'disconnected' } }
    })

    await initPopup(document, runtime)

    const urlInput = document.querySelector<HTMLInputElement>('#websocket-url')
    assert.equal(urlInput?.value, 'ws://test:8787')
  })

  void it('loads pairing token into form field on open', async () => {
    const { document } = parseHTML(popupHtml())
    const runtime = createFakeChromeRuntime({
      [JSON.stringify(createGetSettingsMessage())]: {
        ok: true,
        data: { websocketUrl: 'ws://test:8787', pairingToken: 'my-secret-token', profileName: 'Default', label: 'Chrome Default' }
      },
      [JSON.stringify(createGetStatusMessage())]: { ok: true, data: { state: 'disconnected' } }
    })

    await initPopup(document, runtime)

    const tokenInput = document.querySelector<HTMLInputElement>('#pairing-token')
    assert.equal(tokenInput?.value, 'my-secret-token')
  })

  void it('sends save_settings on form submit', async () => {
    const { document } = parseHTML(popupHtml())
    const messages: unknown[] = []
    const runtime: ChromeRuntime = {
      runtime: {
        async sendMessage (message: unknown): Promise<unknown> {
          messages.push(message)
          return { ok: true }
        }
      }
    }

    await initPopup(document, runtime)

    const form = document.querySelector<HTMLFormElement>('#settings-form')
    const window = document.defaultView
    if (window !== null) {
      form?.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    }
    await flushMicrotasks()

    const saveMsg = messages.find(m => (m as { type: string }).type === 'save_settings')
    assert.equal(saveMsg !== undefined, true)
  })

  void it('sends connect message when connect button is clicked', async () => {
    const { document } = parseHTML(popupHtml())
    const messages: unknown[] = []
    const runtime: ChromeRuntime = {
      runtime: {
        async sendMessage (message: unknown): Promise<unknown> {
          messages.push(message)
          if ((message as { type: string }).type === 'get_settings') {
            return {
              ok: true,
              data: { websocketUrl: 'ws://127.0.0.1:8787', pairingToken: 'tok', profileName: 'Default', label: 'Chrome Default' }
            }
          }
          if ((message as { type: string }).type === 'save_settings') {
            return { ok: true }
          }
          if ((message as { type: string }).type === 'connect') {
            return { ok: true, data: { state: 'connecting' } }
          }
          if ((message as { type: string }).type === 'get_status') {
            return { ok: true, data: { state: 'connecting' } }
          }
          return { ok: true }
        }
      }
    }

    await initPopup(document, runtime)

    const connectBtn = document.querySelector<HTMLButtonElement>('#connect-button')
    connectBtn?.click()
    await flushMicrotasks()

    const connectMsg = messages.find(m => (m as { type: string }).type === 'connect')
    assert.equal(connectMsg !== undefined, true)
  })

  void it('sends disconnect message when disconnect button is clicked', async () => {
    const { document } = parseHTML(popupHtml())
    const messages: unknown[] = []
    const runtime: ChromeRuntime = {
      runtime: {
        async sendMessage (message: unknown): Promise<unknown> {
          messages.push(message)
          return { ok: true }
        }
      }
    }

    await initPopup(document, runtime)

    const disconnectBtn = document.querySelector<HTMLButtonElement>('#disconnect-button')
    disconnectBtn?.click()
    await flushMicrotasks()

    const disconnectMsg = messages.find(m => (m as { type: string }).type === 'disconnect')
    assert.equal(disconnectMsg !== undefined, true)
  })

  void it('shows connected status from status response', async () => {
    const { document } = parseHTML(popupHtml())
    const runtime = createFakeChromeRuntime({
      [JSON.stringify(createGetSettingsMessage())]: { ok: true, data: {} },
      [JSON.stringify(createGetStatusMessage())]: { ok: true, data: { state: 'connected' } }
    })

    await initPopup(document, runtime)

    const status = document.querySelector<HTMLElement>('#status')
    assert.equal(status?.textContent, 'Status: Connected')
  })

  void it('shows connecting status from status response', async () => {
    const { document } = parseHTML(popupHtml())
    const runtime = createFakeChromeRuntime({
      [JSON.stringify(createGetSettingsMessage())]: { ok: true, data: {} },
      [JSON.stringify(createGetStatusMessage())]: { ok: true, data: { state: 'connecting' } }
    })

    await initPopup(document, runtime)

    const status = document.querySelector<HTMLElement>('#status')
    assert.equal(status?.textContent, 'Status: Connecting...')
  })

  void it('shows error status with lastError from status response', async () => {
    const { document } = parseHTML(popupHtml())
    const runtime = createFakeChromeRuntime({
      [JSON.stringify(createGetSettingsMessage())]: { ok: true, data: {} },
      [JSON.stringify(createGetStatusMessage())]: { ok: true, data: { state: 'error', lastError: 'Connection refused' } }
    })

    await initPopup(document, runtime)

    const status = document.querySelector<HTMLElement>('#status')
    assert.equal(status?.textContent, 'Status: Error — Connection refused')
  })

  void it('shows generic error status when state is error without lastError', async () => {
    const { document } = parseHTML(popupHtml())
    const runtime = createFakeChromeRuntime({
      [JSON.stringify(createGetSettingsMessage())]: { ok: true, data: {} },
      [JSON.stringify(createGetStatusMessage())]: { ok: true, data: { state: 'error' } }
    })

    await initPopup(document, runtime)

    const status = document.querySelector<HTMLElement>('#status')
    assert.equal(status?.textContent, 'Status: Error')
  })

  void it('shows disconnected status from status response', async () => {
    const { document } = parseHTML(popupHtml())
    const runtime = createFakeChromeRuntime({
      [JSON.stringify(createGetSettingsMessage())]: { ok: true, data: {} },
      [JSON.stringify(createGetStatusMessage())]: { ok: true, data: { state: 'disconnected' } }
    })

    await initPopup(document, runtime)

    const status = document.querySelector<HTMLElement>('#status')
    assert.equal(status?.textContent, 'Status: Disconnected')
  })
})

function popupHtml (): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>BrowserBridge</title></head><body>
<h1>BrowserBridge</h1>
<form id="settings-form">
  <input id="websocket-url" name="websocketUrl" type="url" required />
  <input id="pairing-token" name="pairingToken" type="password" required />
  <input id="profile-name" name="profileName" type="text" value="Default" required />
  <input id="browser-label" name="label" type="text" value="Chrome Default" required />
  <button id="save-button" type="submit">Save</button>
  <button id="connect-button" type="button">Connect</button>
  <button id="disconnect-button" type="button">Disconnect</button>
</form>
<div id="status" role="status"></div>
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
