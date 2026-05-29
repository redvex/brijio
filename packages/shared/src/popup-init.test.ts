import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseHTML } from 'linkedom'
import {
  isOkResponse,
  validateForm,
  queryPopupElements,
  initPopup,
  type BridgeSettingsForm,
  type SendMessageFn
} from './popup-init.js'
import {
  createGetSettingsMessage,
  createGetStatusMessage
} from './popup-messages.js'

function qs<T extends HTMLElement> (doc: Document, selector: string): T {
  const el = doc.querySelector<T>(selector)
  if (el === null) {
    throw new Error(`Element not found: ${selector}`)
  }
  return el
}

function popupHtml (): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>BrowserBridge</title></head><body>
<h1>BrowserBridge</h1>
<form id="settings-form" novalidate>
  <input id="websocket-url" name="websocketUrl" type="text" required />
  <input id="pairing-token" name="pairingToken" type="password" required />
  <input id="profile-name" name="profileName" type="text" value="Default" required />
  <input id="browser-label" name="label" type="text" value="Default" required />
  <button id="save-button" type="submit">Save</button>
  <button id="connect-button" type="button">Connect</button>
  <button id="disconnect-button" type="button">Disconnect</button>
</form>
<div id="status" role="status"></div>
</body></html>`
}

function createFakeSendMessage (responses: Record<string, unknown>): SendMessageFn {
  return async (message: unknown): Promise<unknown> => {
    const key = JSON.stringify(message)
    return responses[key] ?? { ok: true }
  }
}

async function flushMicrotasks (ticks = 5): Promise<void> {
  for (let i = 0; i < ticks; i++) {
    await new Promise((resolve) => setImmediate(resolve))
  }
}

// --- isOkResponse tests ---

void describe('isOkResponse', () => {
  void it('returns true for response with ok: true', () => {
    assert.equal(isOkResponse({ ok: true }), true)
  })

  void it('returns false for response with ok: false', () => {
    assert.equal(isOkResponse({ ok: false }), false)
  })

  void it('returns false for null response', () => {
    assert.equal(isOkResponse(null), false)
  })

  void it('returns false for undefined response', () => {
    assert.equal(isOkResponse(undefined), false)
  })

  void it('returns false for string response', () => {
    assert.equal(isOkResponse('ok'), false)
  })

  void it('returns false for object without ok property', () => {
    assert.equal(isOkResponse({ error: 'bad' }), false)
  })

  void it('returns false for ok being a truthy non-boolean', () => {
    assert.equal(isOkResponse({ ok: 'yes' }), false)
  })
})

// --- validateForm tests ---

void describe('validateForm', () => {
  void it('returns undefined for valid settings', () => {
    const settings: BridgeSettingsForm = {
      websocketUrl: 'ws://localhost:8787',
      pairingToken: 'my-token',
      profileName: 'Default',
      label: 'My Browser'
    }
    assert.equal(validateForm(settings), undefined)
  })

  void it('returns error for empty websocketUrl', () => {
    const settings: BridgeSettingsForm = {
      websocketUrl: '',
      pairingToken: 'my-token',
      profileName: 'Default',
      label: 'My Browser'
    }
    assert.equal(validateForm(settings), 'WebSocket URL is required.')
  })

  void it('returns error for whitespace-only websocketUrl', () => {
    const settings: BridgeSettingsForm = {
      websocketUrl: '   ',
      pairingToken: 'my-token',
      profileName: 'Default',
      label: 'My Browser'
    }
    assert.equal(validateForm(settings), 'WebSocket URL is required.')
  })

  void it('returns error for empty pairingToken', () => {
    const settings: BridgeSettingsForm = {
      websocketUrl: 'ws://localhost:8787',
      pairingToken: '',
      profileName: 'Default',
      label: 'My Browser'
    }
    assert.equal(validateForm(settings), 'Pairing token is required.')
  })

  void it('returns error for empty profileName', () => {
    const settings: BridgeSettingsForm = {
      websocketUrl: 'ws://localhost:8787',
      pairingToken: 'my-token',
      profileName: '',
      label: 'My Browser'
    }
    assert.equal(validateForm(settings), 'Profile name is required.')
  })

  void it('returns error for empty label', () => {
    const settings: BridgeSettingsForm = {
      websocketUrl: 'ws://localhost:8787',
      pairingToken: 'my-token',
      profileName: 'Default',
      label: ''
    }
    assert.equal(validateForm(settings), 'Browser label is required.')
  })
})

// --- queryPopupElements tests ---

void describe('queryPopupElements', () => {
  void it('returns all elements when HTML is correct', () => {
    const { document } = parseHTML(popupHtml())
    const elements = queryPopupElements(document)
    assert.ok(elements !== undefined)
    assert.ok(elements.settingsForm !== null)
    assert.ok(elements.websocketUrlInput !== null)
    assert.ok(elements.pairingTokenInput !== null)
    assert.ok(elements.profileNameInput !== null)
    assert.ok(elements.browserLabelInput !== null)
    assert.ok(elements.connectBtn !== null)
    assert.ok(elements.disconnectBtn !== null)
    assert.ok(elements.statusMessage !== null)
    assert.equal(elements.settingsForm.id, 'settings-form')
    assert.equal(elements.websocketUrlInput.id, 'websocket-url')
    assert.equal(elements.connectBtn.id, 'connect-button')
  })

  void it('throws when settings form is missing', () => {
    const { document } = parseHTML('<html><body></body></html>')
    assert.throws(() => queryPopupElements(document), /missing required elements/i)
  })

  void it('throws when websocket-url input is missing', () => {
    const { document } = parseHTML(
      '<html><body><form id="settings-form"></form><div id="status"></div></body></html>'
    )
    assert.throws(() => queryPopupElements(document), /missing required elements/i)
  })
})

// --- initPopup integration tests ---

void describe('initPopup', () => {
  void it('loads settings into form fields on open', async () => {
    const { document } = parseHTML(popupHtml())
    const sendMessage = createFakeSendMessage({
      [JSON.stringify(createGetSettingsMessage())]: {
        ok: true,
        data: { websocketUrl: 'ws://test:8787', pairingToken: 'tok', profileName: 'Default', label: 'My Browser' }
      },
      [JSON.stringify(createGetStatusMessage())]: { ok: true, data: { state: 'disconnected' } }
    })

    await initPopup(document, sendMessage)

    assert.equal(document.querySelector<HTMLInputElement>('#websocket-url')?.value, 'ws://test:8787')
  })

  void it('loads pairing token into form field on open', async () => {
    const { document } = parseHTML(popupHtml())
    const sendMessage = createFakeSendMessage({
      [JSON.stringify(createGetSettingsMessage())]: {
        ok: true,
        data: { websocketUrl: 'ws://test:8787', pairingToken: 'my-secret-token', profileName: 'Default', label: 'My Browser' }
      },
      [JSON.stringify(createGetStatusMessage())]: { ok: true, data: { state: 'disconnected' } }
    })

    await initPopup(document, sendMessage)

    assert.equal(document.querySelector<HTMLInputElement>('#pairing-token')?.value, 'my-secret-token')
  })

  void it('shows disconnected status on load', async () => {
    const { document } = parseHTML(popupHtml())
    const sendMessage = createFakeSendMessage({
      [JSON.stringify(createGetSettingsMessage())]: { ok: true, data: {} },
      [JSON.stringify(createGetStatusMessage())]: { ok: true, data: { state: 'disconnected' } }
    })

    await initPopup(document, sendMessage)

    assert.equal(document.querySelector<HTMLElement>('#status')?.textContent, 'Status: Disconnected')
  })

  void it('shows connected status on load', async () => {
    const { document } = parseHTML(popupHtml())
    const sendMessage = createFakeSendMessage({
      [JSON.stringify(createGetSettingsMessage())]: { ok: true, data: {} },
      [JSON.stringify(createGetStatusMessage())]: { ok: true, data: { state: 'connected' } }
    })

    await initPopup(document, sendMessage)

    assert.equal(document.querySelector<HTMLElement>('#status')?.textContent, 'Status: Connected')
  })

  void it('shows connecting status on load', async () => {
    const { document } = parseHTML(popupHtml())
    const sendMessage = createFakeSendMessage({
      [JSON.stringify(createGetSettingsMessage())]: { ok: true, data: {} },
      [JSON.stringify(createGetStatusMessage())]: { ok: true, data: { state: 'connecting' } }
    })

    await initPopup(document, sendMessage)

    assert.equal(document.querySelector<HTMLElement>('#status')?.textContent, 'Status: Connecting...')
  })

  void it('shows error status with lastError on load', async () => {
    const { document } = parseHTML(popupHtml())
    const sendMessage = createFakeSendMessage({
      [JSON.stringify(createGetSettingsMessage())]: { ok: true, data: {} },
      [JSON.stringify(createGetStatusMessage())]: { ok: true, data: { state: 'error', lastError: 'Connection refused' } }
    })

    await initPopup(document, sendMessage)

    assert.equal(document.querySelector<HTMLElement>('#status')?.textContent, 'Status: Error — Connection refused')
  })

  void it('shows generic error status when state is error without lastError', async () => {
    const { document } = parseHTML(popupHtml())
    const sendMessage = createFakeSendMessage({
      [JSON.stringify(createGetSettingsMessage())]: { ok: true, data: {} },
      [JSON.stringify(createGetStatusMessage())]: { ok: true, data: { state: 'error' } }
    })

    await initPopup(document, sendMessage)

    assert.equal(document.querySelector<HTMLElement>('#status')?.textContent, 'Status: Error')
  })

  void it('sends save_settings on form submit', async () => {
    const { document } = parseHTML(popupHtml())
    const messages: unknown[] = []
    const sendMessage: SendMessageFn = async (message: unknown): Promise<unknown> => {
      messages.push(message)
      return { ok: true }
    }

    await initPopup(document, sendMessage)

    qs<HTMLInputElement>(document, '#websocket-url').value = 'ws://localhost:8787'
    qs<HTMLInputElement>(document, '#pairing-token').value = 'test-token'

    const form = qs<HTMLFormElement>(document, '#settings-form')
    const window = document.defaultView
    if (window !== null) {
      form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    }
    await flushMicrotasks()

    const saveMsg = messages.find(m => (m as { type: string }).type === 'save_settings')
    assert.ok(saveMsg !== undefined)
  })

  void it('preserves form values after save', async () => {
    const { document } = parseHTML(popupHtml())
    let savedSettings: unknown = null
    const sendMessage: SendMessageFn = async (message: unknown): Promise<unknown> => {
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

    await initPopup(document, sendMessage)

    const urlInput = qs<HTMLInputElement>(document, '#websocket-url')
    const tokenInput = qs<HTMLInputElement>(document, '#pairing-token')
    const profileInput = qs<HTMLInputElement>(document, '#profile-name')
    const labelInput = qs<HTMLInputElement>(document, '#browser-label')

    urlInput.value = 'ws://new:9090'
    tokenInput.value = 'new-token'
    profileInput.value = 'NewProfile'
    labelInput.value = 'New Browser'

    const form = qs<HTMLFormElement>(document, '#settings-form')
    const window = document.defaultView
    if (window !== null) {
      form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    }
    await flushMicrotasks()

    assert.equal(urlInput.value, 'ws://new:9090')
    assert.equal(tokenInput.value, 'new-token')
    assert.equal(profileInput.value, 'NewProfile')
    assert.equal(labelInput.value, 'New Browser')

    const saved = savedSettings as { websocketUrl: string, pairingToken: string, profileName: string, label: string }
    assert.equal(saved.websocketUrl, 'ws://new:9090')
    assert.equal(saved.pairingToken, 'new-token')
    assert.equal(saved.profileName, 'NewProfile')
    assert.equal(saved.label, 'New Browser')
  })

  void it('shows saved message after successful save without overwriting with status', async () => {
    const { document } = parseHTML(popupHtml())
    const sendMessage: SendMessageFn = async (message: unknown): Promise<unknown> => {
      const msg = message as { type: string }
      if (msg.type === 'get_settings') {
        return { ok: true, data: { websocketUrl: 'ws://test:8787', pairingToken: 'tok', profileName: 'Default', label: 'My Browser' } }
      }
      if (msg.type === 'save_settings') {
        return { ok: true }
      }
      if (msg.type === 'get_status') {
        return { ok: true, data: { state: 'disconnected' } }
      }
      return { ok: true }
    }

    await initPopup(document, sendMessage)

    qs<HTMLInputElement>(document, '#websocket-url').value = 'ws://new:9090'
    qs<HTMLInputElement>(document, '#pairing-token').value = 'new-token'

    const form = qs<HTMLFormElement>(document, '#settings-form')
    const window = document.defaultView
    if (window !== null) {
      form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    }
    await flushMicrotasks()

    const status = document.querySelector<HTMLElement>('#status')
    assert.equal(status?.textContent, 'Settings saved. Disconnected.')
  })

  void it('shows validation error when websocket URL is empty', async () => {
    const { document } = parseHTML(popupHtml())
    const messages: unknown[] = []
    const sendMessage: SendMessageFn = async (message: unknown): Promise<unknown> => {
      messages.push(message)
      return { ok: true }
    }

    await initPopup(document, sendMessage)

    qs<HTMLInputElement>(document, '#websocket-url').value = ''

    const form = qs<HTMLFormElement>(document, '#settings-form')
    const window = document.defaultView
    if (window !== null) {
      form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    }
    await flushMicrotasks()

    const status = document.querySelector<HTMLElement>('#status')
    assert.equal(status?.textContent, 'WebSocket URL is required.')

    const saveMsg = messages.find(m => (m as { type: string }).type === 'save_settings')
    assert.equal(saveMsg, undefined)
  })

  void it('shows validation error when pairing token is empty', async () => {
    const { document } = parseHTML(popupHtml())
    const messages: unknown[] = []
    const sendMessage: SendMessageFn = async (message: unknown): Promise<unknown> => {
      messages.push(message)
      return { ok: true }
    }

    await initPopup(document, sendMessage)

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
    const sendMessage: SendMessageFn = async (message: unknown): Promise<unknown> => {
      const msg = message as { type: string }
      if (msg.type === 'get_settings') {
        return { ok: true, data: { websocketUrl: 'ws://test:8787', pairingToken: 'tok', profileName: 'Default', label: 'My Browser' } }
      }
      if (msg.type === 'save_settings') {
        return { ok: false, error: { message: 'WebSocket URL is required.' } }
      }
      if (msg.type === 'get_status') {
        return { ok: true, data: { state: 'disconnected' } }
      }
      return { ok: true }
    }

    await initPopup(document, sendMessage)

    qs<HTMLInputElement>(document, '#websocket-url').value = 'ws://new:9090'
    qs<HTMLInputElement>(document, '#pairing-token').value = 'new-token'

    const form = qs<HTMLFormElement>(document, '#settings-form')
    const window = document.defaultView
    if (window !== null) {
      form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    }
    await flushMicrotasks()

    assert.equal(document.querySelector<HTMLInputElement>('#websocket-url')?.value, 'ws://new:9090')
    const status = document.querySelector<HTMLElement>('#status')
    assert.equal(status?.textContent, 'WebSocket URL is required.')
  })

  void it('sends connect message when connect button is clicked', async () => {
    const { document } = parseHTML(popupHtml())
    const messages: unknown[] = []
    const sendMessage: SendMessageFn = async (message: unknown): Promise<unknown> => {
      messages.push(message)
      const msg = message as { type: string }
      if (msg.type === 'get_settings') {
        return { ok: true, data: { websocketUrl: 'ws://127.0.0.1:8787', pairingToken: 'tok', profileName: 'Default', label: 'Default' } }
      }
      if (msg.type === 'save_settings') {
        return { ok: true }
      }
      if (msg.type === 'connect') {
        return { ok: true, data: { state: 'connecting' } }
      }
      if (msg.type === 'get_status') {
        return { ok: true, data: { state: 'connecting' } }
      }
      return { ok: true }
    }

    await initPopup(document, sendMessage)

    const connectBtn = qs<HTMLButtonElement>(document, '#connect-button')
    connectBtn.click()
    await flushMicrotasks()

    const connectMsg = messages.find(m => (m as { type: string }).type === 'connect')
    assert.ok(connectMsg !== undefined)
  })

  void it('sends disconnect message when disconnect button is clicked', async () => {
    const { document } = parseHTML(popupHtml())
    const messages: unknown[] = []
    const sendMessage: SendMessageFn = async (message: unknown): Promise<unknown> => {
      messages.push(message)
      return { ok: true }
    }

    await initPopup(document, sendMessage)

    const disconnectBtn = qs<HTMLButtonElement>(document, '#disconnect-button')
    disconnectBtn.click()
    await flushMicrotasks()

    const disconnectMsg = messages.find(m => (m as { type: string }).type === 'disconnect')
    assert.ok(disconnectMsg !== undefined)
  })

  void it('shows Connecting... when connect succeeds', async () => {
    const { document } = parseHTML(popupHtml())
    const sendMessage: SendMessageFn = async (message: unknown): Promise<unknown> => {
      const msg = message as { type: string }
      if (msg.type === 'get_settings') {
        return { ok: true, data: { websocketUrl: 'ws://test:8787', pairingToken: 'tok', profileName: 'Default', label: 'My Browser' } }
      }
      if (msg.type === 'get_status') {
        return { ok: true, data: { state: 'disconnected' } }
      }
      if (msg.type === 'save_settings') {
        return { ok: true }
      }
      if (msg.type === 'connect') {
        return { ok: true }
      }
      return { ok: true }
    }

    await initPopup(document, sendMessage)

    const connectBtn = qs<HTMLButtonElement>(document, '#connect-button')
    connectBtn.click()
    await flushMicrotasks()

    const status = document.querySelector<HTMLElement>('#status')
    assert.equal(status?.textContent, 'Connecting...')
  })

  void it('shows Disconnected. when disconnect succeeds', async () => {
    const { document } = parseHTML(popupHtml())
    const sendMessage: SendMessageFn = async (message: unknown): Promise<unknown> => {
      const msg = message as { type: string }
      if (msg.type === 'get_settings') {
        return { ok: true, data: {} }
      }
      if (msg.type === 'get_status') {
        return { ok: true, data: { state: 'connected' } }
      }
      if (msg.type === 'disconnect') {
        return { ok: true }
      }
      return { ok: true }
    }

    await initPopup(document, sendMessage)

    const disconnectBtn = qs<HTMLButtonElement>(document, '#disconnect-button')
    disconnectBtn.click()
    await flushMicrotasks()

    const status = document.querySelector<HTMLElement>('#status')
    assert.equal(status?.textContent, 'Disconnected.')
  })

  void it('disconnect does not overwrite status with updateConnectionStatus', async () => {
    // This is the bug fix: disconnect should set "Disconnected." and NOT
    // call updateConnectionStatus which would overwrite it with "Status: Disconnected"
    const { document } = parseHTML(popupHtml())
    const sendMessage: SendMessageFn = async (message: unknown): Promise<unknown> => {
      const msg = message as { type: string }
      if (msg.type === 'get_settings') {
        return { ok: true, data: {} }
      }
      if (msg.type === 'get_status') {
        return { ok: true, data: { state: 'disconnected' } }
      }
      if (msg.type === 'disconnect') {
        return { ok: true }
      }
      return { ok: true }
    }

    await initPopup(document, sendMessage)

    const disconnectBtn = qs<HTMLButtonElement>(document, '#disconnect-button')
    disconnectBtn.click()
    await flushMicrotasks()

    const status = document.querySelector<HTMLElement>('#status')
    // Must be "Disconnected." not "Status: Disconnected"
    assert.equal(status?.textContent, 'Disconnected.')
  })

  void it('connect does not call updateConnectionStatus after', async () => {
    const { document } = parseHTML(popupHtml())
    let getStatusCallCount = 0
    const sendMessage: SendMessageFn = async (message: unknown): Promise<unknown> => {
      const msg = message as { type: string }
      if (msg.type === 'get_settings') {
        return { ok: true, data: { websocketUrl: 'ws://test:8787', pairingToken: 'tok', profileName: 'Default', label: 'Default' } }
      }
      if (msg.type === 'get_status') {
        getStatusCallCount++
        return { ok: true, data: { state: 'disconnected' } }
      }
      if (msg.type === 'save_settings') {
        return { ok: true }
      }
      if (msg.type === 'connect') {
        return { ok: true }
      }
      return { ok: true }
    }

    await initPopup(document, sendMessage)
    // Only one get_status call from initial load
    const initialStatusCalls = getStatusCallCount

    const connectBtn = qs<HTMLButtonElement>(document, '#connect-button')
    connectBtn.click()
    await flushMicrotasks()

    // Connect should NOT call updateConnectionStatus (no extra get_status call)
    assert.equal(getStatusCallCount, initialStatusCalls)
  })

  void it('shows Enter a WebSocket URL before connecting when connect clicked with empty URL', async () => {
    const { document } = parseHTML(popupHtml())
    const sendMessage: SendMessageFn = async (message: unknown): Promise<unknown> => {
      const msg = message as { type: string }
      if (msg.type === 'get_settings') {
        return { ok: true, data: {} }
      }
      if (msg.type === 'get_status') {
        return { ok: true, data: { state: 'disconnected' } }
      }
      return { ok: true }
    }

    await initPopup(document, sendMessage)

    const urlInput = qs<HTMLInputElement>(document, '#websocket-url')
    urlInput.value = ''

    const connectBtn = qs<HTMLButtonElement>(document, '#connect-button')
    connectBtn.click()
    await flushMicrotasks()

    const status = document.querySelector<HTMLElement>('#status')
    assert.equal(status?.textContent, 'Enter a WebSocket URL before connecting.')
  })

  void it('shows Failed to load settings when get_settings throws', async () => {
    const { document } = parseHTML(popupHtml())
    const sendMessage: SendMessageFn = async (_message: unknown): Promise<unknown> => {
      throw new Error('Network error')
    }

    await initPopup(document, sendMessage)

    const status = document.querySelector<HTMLElement>('#status')
    assert.equal(status?.textContent, 'Failed to load settings.')
  })

  void it('shows Failed to save settings when save throws', async () => {
    const { document } = parseHTML(popupHtml())
    const sendMessage: SendMessageFn = async (message: unknown): Promise<unknown> => {
      const msg = message as { type: string }
      if (msg.type === 'get_settings') {
        return { ok: true, data: { websocketUrl: 'ws://test:8787', pairingToken: 'tok', profileName: 'Default', label: 'Default' } }
      }
      if (msg.type === 'get_status') {
        return { ok: true, data: { state: 'disconnected' } }
      }
      if (msg.type === 'save_settings') {
        throw new Error('Network error')
      }
      return { ok: true }
    }

    await initPopup(document, sendMessage)

    qs<HTMLInputElement>(document, '#websocket-url').value = 'ws://new'
    qs<HTMLInputElement>(document, '#pairing-token').value = 'new'

    const form = qs<HTMLFormElement>(document, '#settings-form')
    const window = document.defaultView
    if (window !== null) {
      form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    }
    await flushMicrotasks()

    const status = document.querySelector<HTMLElement>('#status')
    assert.equal(status?.textContent, 'Failed to save settings.')
  })

  void it('shows Failed to connect when connect throws', async () => {
    const { document } = parseHTML(popupHtml())
    const sendMessage: SendMessageFn = async (message: unknown): Promise<unknown> => {
      const msg = message as { type: string }
      if (msg.type === 'get_settings') {
        return { ok: true, data: { websocketUrl: 'ws://test:8787', pairingToken: 'tok', profileName: 'Default', label: 'Default' } }
      }
      if (msg.type === 'get_status') {
        return { ok: true, data: { state: 'disconnected' } }
      }
      if (msg.type === 'save_settings') {
        return { ok: true }
      }
      if (msg.type === 'connect') {
        throw new Error('Network error')
      }
      return { ok: true }
    }

    await initPopup(document, sendMessage)

    const connectBtn = qs<HTMLButtonElement>(document, '#connect-button')
    connectBtn.click()
    await flushMicrotasks()

    const status = document.querySelector<HTMLElement>('#status')
    assert.equal(status?.textContent, 'Failed to connect.')
  })

  void it('shows Failed to disconnect when disconnect throws', async () => {
    const { document } = parseHTML(popupHtml())
    const sendMessage: SendMessageFn = async (message: unknown): Promise<unknown> => {
      const msg = message as { type: string }
      if (msg.type === 'get_settings') {
        return { ok: true, data: {} }
      }
      if (msg.type === 'get_status') {
        return { ok: true, data: { state: 'connected' } }
      }
      if (msg.type === 'disconnect') {
        throw new Error('Network error')
      }
      return { ok: true }
    }

    await initPopup(document, sendMessage)

    const disconnectBtn = qs<HTMLButtonElement>(document, '#disconnect-button')
    disconnectBtn.click()
    await flushMicrotasks()

    const status = document.querySelector<HTMLElement>('#status')
    assert.equal(status?.textContent, 'Failed to disconnect.')
  })

  void it('shows server error on failed connect', async () => {
    const { document } = parseHTML(popupHtml())
    const sendMessage: SendMessageFn = async (message: unknown): Promise<unknown> => {
      const msg = message as { type: string }
      if (msg.type === 'get_settings') {
        return { ok: true, data: { websocketUrl: 'ws://test:8787', pairingToken: 'tok', profileName: 'Default', label: 'Default' } }
      }
      if (msg.type === 'get_status') {
        return { ok: true, data: { state: 'disconnected' } }
      }
      if (msg.type === 'save_settings') {
        return { ok: true }
      }
      if (msg.type === 'connect') {
        return { ok: false, error: { message: 'Connection failed' } }
      }
      return { ok: true }
    }

    await initPopup(document, sendMessage)

    const connectBtn = qs<HTMLButtonElement>(document, '#connect-button')
    connectBtn.click()
    await flushMicrotasks()

    const status = document.querySelector<HTMLElement>('#status')
    assert.equal(status?.textContent, 'Connection failed')
  })

  void it('shows server error on failed disconnect', async () => {
    const { document } = parseHTML(popupHtml())
    const sendMessage: SendMessageFn = async (message: unknown): Promise<unknown> => {
      const msg = message as { type: string }
      if (msg.type === 'get_settings') {
        return { ok: true, data: {} }
      }
      if (msg.type === 'get_status') {
        return { ok: true, data: { state: 'connected' } }
      }
      if (msg.type === 'disconnect') {
        return { ok: false, error: { message: 'Not connected' } }
      }
      return { ok: true }
    }

    await initPopup(document, sendMessage)

    const disconnectBtn = qs<HTMLButtonElement>(document, '#disconnect-button')
    disconnectBtn.click()
    await flushMicrotasks()

    const status = document.querySelector<HTMLElement>('#status')
    assert.equal(status?.textContent, 'Not connected')
  })

  void it('shows server error on failed save_settings before connect', async () => {
    const { document } = parseHTML(popupHtml())
    let connectCalled = false
    const sendMessage: SendMessageFn = async (message: unknown): Promise<unknown> => {
      const msg = message as { type: string }
      if (msg.type === 'get_settings') {
        return { ok: true, data: { websocketUrl: 'ws://test:8787', pairingToken: 'tok', profileName: 'Default', label: 'Default' } }
      }
      if (msg.type === 'get_status') {
        return { ok: true, data: { state: 'disconnected' } }
      }
      if (msg.type === 'save_settings') {
        return { ok: false, error: { message: 'Invalid settings' } }
      }
      if (msg.type === 'connect') {
        connectCalled = true
        return { ok: true }
      }
      return { ok: true }
    }

    await initPopup(document, sendMessage)

    const connectBtn = qs<HTMLButtonElement>(document, '#connect-button')
    connectBtn.click()
    await flushMicrotasks()

    assert.equal(connectCalled, false)
    const status = document.querySelector<HTMLElement>('#status')
    assert.equal(status?.textContent, 'Invalid settings')
  })

  void it('reloads settings from storage when popup reopens after save', async () => {
    const savedData: Record<string, unknown> = {
      websocketUrl: 'ws://saved:8787',
      pairingToken: 'saved-token',
      profileName: 'SavedProfile',
      label: 'Saved Browser'
    }

    const sendMessage: SendMessageFn = async (message: unknown): Promise<unknown> => {
      const msg = message as { type: string }
      if (msg.type === 'get_settings') {
        return { ok: true, data: savedData }
      }
      if (msg.type === 'save_settings') {
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

    // First popup
    const { document: doc1 } = parseHTML(popupHtml())
    await initPopup(doc1, sendMessage)

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

    // Second popup (reopen)
    const { document: doc2 } = parseHTML(popupHtml())
    await initPopup(doc2, sendMessage)

    const urlInput = doc2.querySelector<HTMLInputElement>('#websocket-url')
    assert.equal(urlInput?.value, 'ws://updated:9090')
  })
})
