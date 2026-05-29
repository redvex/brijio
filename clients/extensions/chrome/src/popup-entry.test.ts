import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseHTML } from 'linkedom'
import { initPopup } from './popup-entry.js'
import type { ChromeRuntime } from './popup.js'
import {
  createGetSettingsMessage,
  createGetStatusMessage
} from './popup.js'

function qs<T extends HTMLElement> (doc: Document, selector: string): T {
  const el = doc.querySelector<T>(selector)
  if (el === null) {
    throw new Error(`Element not found: ${selector}`)
  }
  return el
}

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

    // Fill in required fields before submitting
    qs<HTMLInputElement>(document, '#websocket-url').value = 'ws://localhost:8787'
    qs<HTMLInputElement>(document, '#pairing-token').value = 'test-token'

    const form = document.querySelector<HTMLFormElement>('#settings-form')
    const window = document.defaultView
    if (window !== null) {
      form?.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    }
    await flushMicrotasks()

    const saveMsg = messages.find(m => (m as { type: string }).type === 'save_settings')
    assert.equal(saveMsg !== undefined, true)
  })

  void it('preserves form values after save', async () => {
    const { document } = parseHTML(popupHtml())
    let savedSettings: unknown = null
    const runtime: ChromeRuntime = {
      runtime: {
        async sendMessage (message: unknown): Promise<unknown> {
          const msg = message as { type: string }
          if (msg.type === 'get_settings') {
            return {
              ok: true,
              data: { websocketUrl: 'ws://existing:8787', pairingToken: 'existing-token', profileName: 'MyProfile', label: 'My Browser' }
            }
          }
          if (msg.type === 'save_settings') {
            savedSettings = message
            return { ok: true }
          }
          if (msg.type === 'get_status') {
            return { ok: true, data: { state: 'disconnected' } }
          }
          return { ok: true }
        }
      }
    }

    await initPopup(document, runtime)

    // Modify form values (all required fields must be filled)
    const urlInput = qs<HTMLInputElement>(document, '#websocket-url')
    const tokenInput = qs<HTMLInputElement>(document, '#pairing-token')
    const profileInput = qs<HTMLInputElement>(document, '#profile-name')
    const labelInput = qs<HTMLInputElement>(document, '#browser-label')

    urlInput.value = 'ws://new:9090'
    tokenInput.value = 'new-token'
    profileInput.value = 'NewProfile'
    labelInput.value = 'New Browser'

    // Submit the form
    const form = qs<HTMLFormElement>(document, '#settings-form')
    const window = document.defaultView
    if (window !== null) {
      form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    }
    await flushMicrotasks()

    // Verify form values are preserved (not reset to defaults)
    assert.equal(urlInput.value, 'ws://new:9090', 'websocketUrl should be preserved after save')
    assert.equal(tokenInput.value, 'new-token', 'pairingToken should be preserved after save')
    assert.equal(profileInput.value, 'NewProfile', 'profileName should be preserved after save')
    assert.equal(labelInput.value, 'New Browser', 'label should be preserved after save')

    // Verify the saved settings match the new values
    const saved = savedSettings as { websocketUrl: string, pairingToken: string, profileName: string, label: string }
    assert.equal(saved.websocketUrl, 'ws://new:9090')
    assert.equal(saved.pairingToken, 'new-token')
    assert.equal(saved.profileName, 'NewProfile')
    assert.equal(saved.label, 'New Browser')
  })

  void it('shows saved message after successful save without overwriting with status', async () => {
    const { document } = parseHTML(popupHtml())
    const runtime: ChromeRuntime = {
      runtime: {
        async sendMessage (message: unknown): Promise<unknown> {
          const msg = message as { type: string }
          if (msg.type === 'get_settings') {
            return {
              ok: true,
              data: { websocketUrl: 'ws://test:8787', pairingToken: 'tok', profileName: 'Default', label: 'Chrome Default' }
            }
          }
          if (msg.type === 'save_settings') {
            return { ok: true }
          }
          if (msg.type === 'get_status') {
            return { ok: true, data: { state: 'disconnected' } }
          }
          return { ok: true }
        }
      }
    }

    await initPopup(document, runtime)

    // Fill in required fields
    qs<HTMLInputElement>(document, '#websocket-url').value = 'ws://new:9090'
    qs<HTMLInputElement>(document, '#pairing-token').value = 'new-token'

    const form = qs<HTMLFormElement>(document, '#settings-form')
    const window = document.defaultView
    if (window !== null) {
      form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    }
    await flushMicrotasks()

    const status = document.querySelector<HTMLElement>('#status')
    // Save message should NOT be overwritten by status update
    assert.equal(status?.textContent, 'Settings saved. Disconnected.')
  })

  void it('shows validation error when websocket URL is empty', async () => {
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

    // Clear the required URL field
    const urlInput = qs<HTMLInputElement>(document, '#websocket-url')
    urlInput.value = ''

    const form = qs<HTMLFormElement>(document, '#settings-form')
    const window = document.defaultView
    if (window !== null) {
      form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    }
    await flushMicrotasks()

    const status = document.querySelector<HTMLElement>('#status')
    assert.equal(status?.textContent, 'WebSocket URL is required.')

    // Should NOT have sent a save_settings message
    const saveMsg = messages.find(m => (m as { type: string }).type === 'save_settings')
    assert.equal(saveMsg, undefined)
  })

  void it('shows validation error when pairing token is empty', async () => {
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

    // Fill URL but clear token
    qs<HTMLInputElement>(document, '#websocket-url').value = 'ws://test:8787'
    qs<HTMLInputElement>(document, '#pairing-token').value = ''

    const form = qs<HTMLFormElement>(document, '#settings-form')
    const window = document.defaultView
    if (window !== null) {
      form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    }
    await flushMicrotasks()

    const status = document.querySelector<HTMLElement>('#status')
    assert.equal(status?.textContent, 'Pairing token is required.')
  })

  void it('shows error message from server when save fails', async () => {
    const { document } = parseHTML(popupHtml())
    const runtime: ChromeRuntime = {
      runtime: {
        async sendMessage (message: unknown): Promise<unknown> {
          const msg = message as { type: string }
          if (msg.type === 'get_settings') {
            return { ok: true, data: { websocketUrl: 'ws://test:8787', pairingToken: 'tok', profileName: 'Default', label: 'Chrome Default' } }
          }
          if (msg.type === 'save_settings') {
            return { ok: false, error: { message: 'WebSocket URL is required.' } }
          }
          if (msg.type === 'get_status') {
            return { ok: true, data: { state: 'disconnected' } }
          }
          return { ok: true }
        }
      }
    }

    await initPopup(document, runtime)

    // Fill in required fields
    qs<HTMLInputElement>(document, '#websocket-url').value = 'ws://new:9090'
    qs<HTMLInputElement>(document, '#pairing-token').value = 'new-token'

    const form = qs<HTMLFormElement>(document, '#settings-form')
    const window = document.defaultView
    if (window !== null) {
      form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    }
    await flushMicrotasks()

    // Form values should be preserved even on error
    assert.equal(document.querySelector<HTMLInputElement>('#websocket-url')?.value, 'ws://new:9090', 'form values should be preserved on save error')

    // Status should show the server error message (not overwritten by status update)
    const status = document.querySelector<HTMLElement>('#status')
    assert.equal(status?.textContent, 'WebSocket URL is required.')
  })

  void it('reloads settings from storage when popup reopens after save', async () => {
    // Simulate: popup opens with existing settings → user changes values → saves → popup reopens → should load saved values
    const savedData: Record<string, unknown> = {
      websocketUrl: 'ws://saved:8787',
      pairingToken: 'saved-token',
      profileName: 'SavedProfile',
      label: 'Saved Browser'
    }

    const runtime: ChromeRuntime = {
      runtime: {
        async sendMessage (message: unknown): Promise<unknown> {
          const msg = message as { type: string }
          if (msg.type === 'get_settings') {
            return { ok: true, data: savedData }
          }
          if (msg.type === 'save_settings') {
            // Save the new settings to our fake store
            Object.assign(savedData, {
              websocketUrl: (message as { websocketUrl: string }).websocketUrl,
              pairingToken: (message as { pairingToken: string }).pairingToken,
              profileName: (message as { profileName: string }).profileName,
              label: (message as { label: string }).label
            })
            return { ok: true }
          }
          if (msg.type === 'get_status') {
            return { ok: true, data: { state: 'disconnected' } }
          }
          return { ok: true }
        }
      }
    }

    // First popup: load settings, change values, save
    const { document: doc1 } = parseHTML(popupHtml())
    await initPopup(doc1, runtime)

    // Modify form values (all required fields)
    qs<HTMLInputElement>(doc1, '#websocket-url').value = 'ws://updated:9090'
    qs<HTMLInputElement>(doc1, '#pairing-token').value = 'updated-token'
    qs<HTMLInputElement>(doc1, '#profile-name').value = 'UpdatedProfile'
    qs<HTMLInputElement>(doc1, '#browser-label').value = 'Updated Browser'

    const form1 = qs<HTMLFormElement>(doc1, '#settings-form')
    const window1 = doc1.defaultView
    if (window1 !== null) {
      form1.dispatchEvent(new window1.Event('submit', { bubbles: true, cancelable: true }))
    }
    await flushMicrotasks()

    // Second popup: reopen — should load updated settings
    const { document: doc2 } = parseHTML(popupHtml())
    await initPopup(doc2, runtime)

    const urlInput = doc2.querySelector<HTMLInputElement>('#websocket-url')
    assert.equal(urlInput?.value, 'ws://updated:9090', 'settings should persist across popup reopen')
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
<form id="settings-form" novalidate>
  <input id="websocket-url" name="websocketUrl" type="text" required />
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
