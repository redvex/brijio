# Chrome Popup Configuration Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Replace Chrome extension click-to-toggle + full-tab setup page with a popup overlay matching Safari's UI pattern, making configuration immediately accessible from the toolbar icon.

**Architecture:** Add `popup.html` as `default_popup` in the Chrome manifest. Create `popup.ts` (message helpers) and `popup-entry.ts` (DOM wiring) following Safari's proven file structure. Switch from optional to required host permissions. Add `getConnectionStatus()` to the shared controller for rich status display. Delete `setup.html`/`setup.ts`.

**Tech Stack:** TypeScript, Chrome Extension Manifest V3, Node.js test runner, linkedom for DOM testing, esbuild for bundling.

**ADR:** [0030-chrome-popup-configuration](docs/architecture/decisions/0030-chrome-popup-configuration.md)

---

### Task 1: Add `ConnectionStatus` type and `getConnectionStatus()` to shared controller

**Objective:** Expose rich connection state from the shared background controller so the popup can display it.

**Files:**
- Modify: `packages/shared/src/background-controller.ts`
- Modify: `packages/shared/src/background-controller.test.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Write failing test**

Add to `packages/shared/src/background-controller.test.ts`:

```typescript
void it('returns disconnected status when not connected', async () => {
  const harness = createHarness()

  const status = harness.controller.getConnectionStatus()

  assert.equal(status.state, 'disconnected')
  assert.equal(status.lastError, undefined)
})

void it('returns connecting status after connect is called', async () => {
  const harness = createHarness({ websocketUrl: 'ws://127.0.0.1:8787' })

  await harness.controller.handleActionClicked()

  const status = harness.controller.getConnectionStatus()

  assert.equal(status.state, 'connecting')
  assert.equal(status.lastError, undefined)
})

void it('returns connected status after socket opens', async () => {
  const harness = createHarness({ websocketUrl: 'ws://127.0.0.1:8787' })

  await harness.controller.handleActionClicked()
  harness.sockets.created[0].open()
  await new Promise((resolve) => setImmediate(resolve))

  const status = harness.controller.getConnectionStatus()

  assert.equal(status.state, 'connected')
  assert.equal(status.lastError, undefined)
})

void it('returns error status with last error message when socket errors', async () => {
  const harness = createHarness({ websocketUrl: 'ws://127.0.0.1:8787' })

  await harness.controller.handleActionClicked()
  harness.sockets.created[0].error()

  const status = harness.controller.getConnectionStatus()

  assert.equal(status.state, 'error')
  assert.equal(status.lastError, 'BrowserBridge connection error')
})
```

**Step 2: Run test to verify failure**

Run: `pnpm --filter @browserbridge/shared test`
Expected: FAIL — `getConnectionStatus is not a function` / Property `state` does not exist

**Step 3: Write minimal implementation**

Add to `packages/shared/src/background-controller.ts`:

```typescript
export interface ConnectionStatus {
  state: 'disconnected' | 'connecting' | 'connected' | 'error'
  lastError?: string
}
```

Add method to `BrowserBridgeBackgroundController`:

```typescript
private connectionState: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected'
private lastErrorMessage: string | undefined

getConnectionStatus (): ConnectionStatus {
  if (this.connectionState === 'error') {
    return { state: 'error', lastError: this.lastErrorMessage }
  }
  return { state: this.connectionState }
}
```

Update `setConnectedState`, `setConnectingState`, `setStoppedState`, `setErrorState` to also set `this.connectionState` and `this.lastErrorMessage`.

**Step 4: Run test to verify pass**

Run: `pnpm --filter @browserbridge/shared test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared/src/background-controller.ts packages/shared/src/background-controller.test.ts
git commit -m "feat: add getConnectionStatus to shared background controller"
```

---

### Task 2: Export `ConnectionStatus` from shared package index

**Objective:** Make `ConnectionStatus` type available to Chrome and Safari extensions.

**Files:**
- Modify: `packages/shared/src/index.ts`

**Step 1: Write the export**

Add to `packages/shared/src/index.ts`:

```typescript
// ConnectionStatus is already exported via background-controller.js re-export
```

The `export * from './background-controller.js'` line already covers it. Verify by running:

Run: `pnpm --filter @browserbridge/shared test`
Expected: PASS (no change needed if already exported)

**Step 2: Commit (if index.ts changed)**

```bash
git add packages/shared/src/index.ts
git commit -m "chore: verify ConnectionStatus export from shared package"
```

---

### Task 3: Create Chrome `popup.ts` message helpers with failing tests

**Objective:** Create message creation and response parsing helpers for the Chrome popup, adapted from Safari's `popup.ts` but using Chrome's promise-based `chrome.runtime.sendMessage`.

**Files:**
- Create: `clients/extensions/chrome/src/popup.ts`
- Create: `clients/extensions/chrome/src/popup.test.ts`

**Step 1: Write failing tests**

Create `clients/extensions/chrome/src/popup.test.ts`:

```typescript
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createGetSettingsMessage,
  createSaveSettingsMessage,
  createConnectMessage,
  createDisconnectMessage,
  createGetStatusMessage,
  parseSettingsResponse,
  parseStatusResponse,
  parseErrorResponse,
  type ChromeRuntime
} from './popup.js'

void describe('createGetSettingsMessage', () => {
  void it('returns a message with type "get_settings"', () => {
    const message = createGetSettingsMessage()
    assert.equal(message.type, 'get_settings')
  })
})

void describe('createSaveSettingsMessage', () => {
  void it('returns a message with type "save_settings" and complete pairing settings', () => {
    const message = createSaveSettingsMessage({
      websocketUrl: 'ws://127.0.0.1:8787',
      pairingToken: 'local-token',
      profileName: 'Default',
      label: 'Chrome Default'
    })
    assert.equal(message.type, 'save_settings')
    assert.equal(message.websocketUrl, 'ws://127.0.0.1:8787')
    assert.equal(message.pairingToken, 'local-token')
    assert.equal(message.profileName, 'Default')
    assert.equal(message.label, 'Chrome Default')
  })
})

void describe('createConnectMessage', () => {
  void it('returns a message with type "connect"', () => {
    const message = createConnectMessage()
    assert.equal(message.type, 'connect')
  })
})

void describe('createDisconnectMessage', () => {
  void it('returns a message with type "disconnect"', () => {
    const message = createDisconnectMessage()
    assert.equal(message.type, 'disconnect')
  })
})

void describe('createGetStatusMessage', () => {
  void it('returns a message with type "get_status"', () => {
    const message = createGetStatusMessage()
    assert.equal(message.type, 'get_status')
  })
})

void describe('parseSettingsResponse', () => {
  void it('returns editable pairing settings when response is successful', () => {
    const response = {
      ok: true,
      data: {
        websocketUrl: 'ws://127.0.0.1:8787',
        pairingToken: 'local-token',
        profileName: 'Default',
        label: 'Chrome Default'
      }
    }
    const settings = parseSettingsResponse(response)
    assert.deepEqual(settings, {
      websocketUrl: 'ws://127.0.0.1:8787',
      pairingToken: 'local-token',
      profileName: 'Default',
      label: 'Chrome Default'
    })
  })

  void it('returns undefined when response ok is false', () => {
    const response = { ok: false, error: { message: 'Error' } }
    const settings = parseSettingsResponse(response)
    assert.equal(settings, undefined)
  })

  void it('returns undefined when data is missing', () => {
    const response = { ok: true }
    const settings = parseSettingsResponse(response)
    assert.equal(settings, undefined)
  })

  void it('returns undefined for null response', () => {
    const settings = parseSettingsResponse(null)
    assert.equal(settings, undefined)
  })
})

void describe('parseStatusResponse', () => {
  void it('returns status object when response is successful', () => {
    const response = { ok: true, data: { state: 'connected' } }
    const status = parseStatusResponse(response)
    assert.equal(status?.state, 'connected')
  })

  void it('returns undefined when response ok is false', () => {
    const response = { ok: false, error: { message: 'Error' } }
    const status = parseStatusResponse(response)
    assert.equal(status, undefined)
  })

  void it('returns undefined when data is missing', () => {
    const response = { ok: true }
    const status = parseStatusResponse(response)
    assert.equal(status, undefined)
  })

  void it('returns undefined for null response', () => {
    const status = parseStatusResponse(null)
    assert.equal(status, undefined)
  })
})

void describe('parseErrorResponse', () => {
  void it('returns the error message from the response', () => {
    const response = { ok: false, error: { message: 'Something went wrong' } }
    const message = parseErrorResponse(response)
    assert.equal(message, 'Something went wrong')
  })

  void it('returns a default message when error message is missing', () => {
    const response = { ok: false, error: {} }
    const message = parseErrorResponse(response)
    assert.equal(message, 'An unknown error occurred.')
  })

  void it('returns a default message for null response', () => {
    const message = parseErrorResponse(null)
    assert.equal(message, 'An unknown error occurred.')
  })
})
```

**Step 2: Run test to verify failure**

Run: `pnpm --filter @browserbridge/chrome-extension test`
Expected: FAIL — Cannot find module `./popup.js`

**Step 3: Write minimal implementation**

Create `clients/extensions/chrome/src/popup.ts`:

```typescript
export interface EditableBridgeSettings {
  websocketUrl?: string
  pairingToken?: string
  profileName?: string
  label?: string
}

export interface RequiredEditableBridgeSettings {
  websocketUrl: string
  pairingToken: string
  profileName: string
  label: string
}

export interface ChromeRuntime {
  sendMessage: (message: unknown) => Promise<unknown>
}

export function createGetSettingsMessage (): { type: 'get_settings' } {
  return { type: 'get_settings' }
}

export function createSaveSettingsMessage (
  settings: RequiredEditableBridgeSettings
): {
  type: 'save_settings'
  websocketUrl: string
  pairingToken: string
  profileName: string
  label: string
} {
  return {
    type: 'save_settings',
    websocketUrl: settings.websocketUrl,
    pairingToken: settings.pairingToken,
    profileName: settings.profileName,
    label: settings.label
  }
}

export function createConnectMessage (): { type: 'connect' } {
  return { type: 'connect' }
}

export function createDisconnectMessage (): { type: 'disconnect' } {
  return { type: 'disconnect' }
}

export function createGetStatusMessage (): { type: 'get_status' } {
  return { type: 'get_status' }
}

export function parseSettingsResponse (response: unknown): EditableBridgeSettings | undefined {
  if (
    typeof response === 'object' && response !== null &&
    'ok' in response && Boolean((response as { ok: boolean }).ok) &&
    'data' in response &&
    typeof (response as { data: unknown }).data === 'object' &&
    (response as { data: unknown }).data !== null
  ) {
    const data = (response as { data: Record<string, unknown> }).data
    const settings: EditableBridgeSettings = {}

    if (typeof data.websocketUrl === 'string') {
      settings.websocketUrl = data.websocketUrl
    }

    if (typeof data.pairingToken === 'string') {
      settings.pairingToken = data.pairingToken
    }

    if (typeof data.profileName === 'string') {
      settings.profileName = data.profileName
    }

    if (typeof data.label === 'string') {
      settings.label = data.label
    }

    if (Object.keys(settings).length > 0) {
      return settings
    }
  }
  return undefined
}

export function parseStatusResponse (response: unknown): { state: string, lastError?: string } | undefined {
  if (
    typeof response === 'object' && response !== null &&
    'ok' in response && Boolean((response as { ok: boolean }).ok) &&
    'data' in response &&
    typeof (response as { data: unknown }).data === 'object' &&
    (response as { data: unknown }).data !== null &&
    typeof (response as { data: { state: unknown } }).data.state === 'string'
  ) {
    const data = (response as { data: { state: string, lastError?: string } }).data
    return { state: data.state, lastError: data.lastError }
  }
  return undefined
}

export function parseErrorResponse (response: unknown): string {
  if (
    typeof response === 'object' && response !== null &&
    'error' in response && typeof ((response as { error: { message: string } }).error?.message) === 'string'
  ) {
    return (response as { error: { message: string } }).error.message
  }
  return 'An unknown error occurred.'
}

export async function sendMessage (chromeRuntime: ChromeRuntime, message: unknown): Promise<unknown> {
  return await chromeRuntime.sendMessage(message)
}
```

**Step 4: Run test to verify pass**

Run: `pnpm --filter @browserbridge/chrome-extension test`
Expected: PASS

**Step 5: Commit**

```bash
git add clients/extensions/chrome/src/popup.ts clients/extensions/chrome/src/popup.test.ts
git commit -m "feat: add Chrome popup message helpers and tests"
```

---

### Task 4: Create Chrome `popup-entry.ts` with failing tests

**Objective:** Wire DOM elements to message helpers — form submit → save, connect/disconnect buttons → send messages, load settings and status on popup open.

**Files:**
- Create: `clients/extensions/chrome/src/popup-entry.ts`
- Create: `clients/extensions/chrome/src/popup-entry.test.ts`

**Step 1: Write failing tests**

Create `clients/extensions/chrome/src/popup-entry.test.ts` using `linkedom` to test DOM wiring. Follow the Safari `popup-entry.ts` structure but with Chrome's promise-based API:

```typescript
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseHTML } from 'linkedom'
import {
  createGetSettingsMessage,
  createSaveSettingsMessage,
  createConnectMessage,
  createDisconnectMessage,
  createGetStatusMessage,
  sendMessage
} from './popup.js'
import type { ChromeRuntime } from './popup.js'

void describe('Chrome popup entry', () => {
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

  void it('sends save_settings on form submit', async () => {
    const { document } = parseHTML(popupHtml())
    const messages: unknown[] = []
    const runtime: ChromeRuntime = {
      async sendMessage (message: unknown): Promise<unknown> {
        messages.push(message)
        return { ok: true }
      }
    }

    await initPopup(document, runtime)

    const form = document.querySelector<HTMLFormElement>('#settings-form')
    form?.dispatchEvent(new Event('submit'))

    assert.equal(messages.length >= 1, true)
  })

  void it('sends connect message when connect button is clicked', async () => {
    const { document } = parseHTML(popupHtml())
    const messages: unknown[] = []
    const runtime: ChromeRuntime = {
      async sendMessage (message: unknown): Promise<unknown> {
        messages.push(message)
        return { ok: true, data: { state: 'connecting' } }
      }
    }

    await initPopup(document, runtime)

    const connectBtn = document.querySelector<HTMLButtonElement>('#connect-button')
    connectBtn?.click()

    const connectMsg = messages.find(m => (m as { type: string }).type === 'connect')
    assert.equal(connectMsg !== undefined, true)
  })

  void it('sends disconnect message when disconnect button is clicked', async () => {
    const { document } = parseHTML(popupHtml())
    const messages: unknown[] = []
    const runtime: ChromeRuntime = {
      async sendMessage (message: unknown): Promise<unknown> {
        messages.push(message)
        return { ok: true }
      }
    }

    await initPopup(document, runtime)

    const disconnectBtn = document.querySelector<HTMLButtonElement>('#disconnect-button')
    disconnectBtn?.click()

    const disconnectMsg = messages.find(m => (m as { type: string }).type === 'disconnect')
    assert.equal(disconnectMsg !== undefined, true)
  })

  void it('shows connection status from status response', async () => {
    const { document } = parseHTML(popupHtml())
    const runtime = createFakeChromeRuntime({
      [JSON.stringify(createGetSettingsMessage())]: { ok: true, data: {} },
      [JSON.stringify(createGetStatusMessage())]: { ok: true, data: { state: 'connected' } }
    })

    await initPopup(document, runtime)

    const status = document.querySelector<HTMLElement>('#status')
    assert.equal(status?.textContent?.includes('Connected'), true)
  })

  void it('shows error status from status response', async () => {
    const { document } = parseHTML(popupHtml())
    const runtime = createFakeChromeRuntime({
      [JSON.stringify(createGetSettingsMessage())]: { ok: true, data: {} },
      [JSON.stringify(createGetStatusMessage())]: { ok: true, data: { state: 'error', lastError: 'Connection refused' } }
    })

    await initPopup(document, runtime)

    const status = document.querySelector<HTMLElement>('#status')
    assert.equal(status?.textContent?.includes('Connection refused'), true)
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
    async sendMessage (message: unknown): Promise<unknown> {
      const key = JSON.stringify(message)
      return responses[key] ?? { ok: true }
    }
  }
}

function createEvent (type: string): Event {
  return new Event(type, { bubbles: true, cancelable: true })
}
```

Note: The actual `popup-entry.ts` implementation uses `chrome.runtime.sendMessage` directly. The test injects a mock runtime. A helper function `initPopup(document, chromeRuntime)` is exported for testing purposes.

**Step 2: Run test to verify failure**

Run: `pnpm --filter @browserbridge/chrome-extension test`
Expected: FAIL — Cannot find module `./popup-entry.js`

**Step 3: Write minimal implementation**

Create `clients/extensions/chrome/src/popup-entry.ts`:

```typescript
import {
  createGetSettingsMessage,
  createSaveSettingsMessage,
  createConnectMessage,
  createDisconnectMessage,
  createGetStatusMessage,
  parseSettingsResponse,
  parseStatusResponse,
  parseErrorResponse,
  sendMessage
} from './popup.js'

export interface ChromeApi {
  runtime: {
    sendMessage: (message: unknown) => Promise<unknown>
  }
}

declare const chrome: ChromeApi

const form = document.querySelector<HTMLFormElement>('#settings-form')
const input = document.querySelector<HTMLInputElement>('#websocket-url')
const tokenInput = document.querySelector<HTMLInputElement>('#pairing-token')
const profileInput = document.querySelector<HTMLInputElement>('#profile-name')
const labelInput = document.querySelector<HTMLInputElement>('#browser-label')
const connectButton = document.querySelector<HTMLButtonElement>('#connect-button')
const disconnectButton = document.querySelector<HTMLButtonElement>('#disconnect-button')
const status = document.querySelector<HTMLElement>('#status')

if (
  form === null ||
  input === null ||
  tokenInput === null ||
  profileInput === null ||
  labelInput === null ||
  connectButton === null ||
  disconnectButton === null ||
  status === null
) {
  throw new Error('BrowserBridge popup is missing required elements.')
}

const settingsForm = form
const websocketUrlInput = input
const pairingTokenInput = tokenInput
const profileNameInput = profileInput
const browserLabelInput = labelInput
const connectBtn = connectButton
const disconnectBtn = disconnectButton
const statusMessage = status

void loadSettings()
void updateConnectionStatus()

settingsForm.addEventListener('submit', (event) => {
  event.preventDefault()
  void saveSettings(readSettingsForm())
})

connectBtn.addEventListener('click', () => {
  void connect()
})

disconnectBtn.addEventListener('click', () => {
  void disconnect()
})

async function loadSettings (): Promise<void> {
  try {
    const response = await sendMessage(chrome, createGetSettingsMessage())
    const settings = parseSettingsResponse(response)
    if (settings?.websocketUrl !== undefined) {
      websocketUrlInput.value = settings.websocketUrl
    }
    if (settings?.pairingToken !== undefined) {
      pairingTokenInput.value = settings.pairingToken
    }
    if (settings?.profileName !== undefined) {
      profileNameInput.value = settings.profileName
    }
    if (settings?.label !== undefined) {
      browserLabelInput.value = settings.label
    }
  } catch {
    statusMessage.textContent = 'Failed to load settings.'
  }
}

async function saveSettings (settings: {
  websocketUrl: string
  pairingToken: string
  profileName: string
  label: string
}): Promise<void> {
  try {
    const response = await sendMessage(chrome, createSaveSettingsMessage(settings))
    if (
      typeof response === 'object' && response !== null &&
      'ok' in response && (response as { ok: boolean }).ok
    ) {
      statusMessage.textContent = 'Settings saved.'
    } else {
      statusMessage.textContent = parseErrorResponse(response)
    }
  } catch {
    statusMessage.textContent = 'Failed to save settings.'
  }
  void updateConnectionStatus()
}

async function connect (): Promise<void> {
  const settings = readSettingsForm()

  if (settings.websocketUrl.trim() === '') {
    statusMessage.textContent = 'Enter a WebSocket URL before connecting.'
    return
  }

  const saveResponse = await sendMessage(chrome, createSaveSettingsMessage(settings))
  if (
    typeof saveResponse !== 'object' ||
    saveResponse === null ||
    !('ok' in saveResponse) ||
    !(saveResponse as { ok: boolean }).ok
  ) {
    statusMessage.textContent = parseErrorResponse(saveResponse)
    return
  }

  try {
    const response = await sendMessage(chrome, createConnectMessage())
    if (
      typeof response === 'object' && response !== null &&
      'ok' in response && (response as { ok: boolean }).ok
    ) {
      statusMessage.textContent = 'Connecting...'
    } else {
      statusMessage.textContent = parseErrorResponse(response)
    }
  } catch {
    statusMessage.textContent = 'Failed to connect.'
  }
  void updateConnectionStatus()
}

function readSettingsForm (): {
  websocketUrl: string
  pairingToken: string
  profileName: string
  label: string
} {
  return {
    websocketUrl: websocketUrlInput.value,
    pairingToken: pairingTokenInput.value,
    profileName: profileNameInput.value,
    label: browserLabelInput.value
  }
}

async function disconnect (): Promise<void> {
  try {
    const response = await sendMessage(chrome, createDisconnectMessage())
    if (
      typeof response === 'object' && response !== null &&
      'ok' in response && (response as { ok: boolean }).ok
    ) {
      statusMessage.textContent = 'Disconnected.'
    } else {
      statusMessage.textContent = parseErrorResponse(response)
    }
  } catch {
    statusMessage.textContent = 'Failed to disconnect.'
  }
  void updateConnectionStatus()
}

async function updateConnectionStatus (): Promise<void> {
  try {
    const response = await sendMessage(chrome, createGetStatusMessage())
    const statusResult = parseStatusResponse(response)
    if (statusResult === undefined) {
      statusMessage.textContent = 'Status: Unknown'
      return
    }

    if (statusResult.state === 'connected') {
      statusMessage.textContent = 'Status: Connected'
    } else if (statusResult.state === 'connecting') {
      statusMessage.textContent = 'Status: Connecting...'
    } else if (statusResult.state === 'error') {
      statusMessage.textContent = statusResult.lastError !== undefined
        ? `Status: Error — ${statusResult.lastError}`
        : 'Status: Error'
    } else {
      statusMessage.textContent = 'Status: Disconnected'
    }
  } catch {
    // Status update is non-critical; leave current text.
  }
}
```

**Step 4: Run test to verify pass**

Run: `pnpm --filter @browserbridge/chrome-extension test`
Expected: PASS

**Step 5: Commit**

```bash
git add clients/extensions/chrome/src/popup-entry.ts clients/extensions/chrome/src/popup-entry.test.ts
git commit -m "feat: add Chrome popup DOM wiring and tests"
```

---

### Task 5: Create Chrome `popup.html`

**Objective:** Create the popup HTML with dark theme matching Safari's popup styling, settings form, Connect/Disconnect buttons, and status area.

**Files:**
- Create: `clients/extensions/chrome/src/popup.html`

**Step 1: Create popup.html**

Create `clients/extensions/chrome/src/popup.html` (adapted from Safari's `popup.html` with Chrome Default label):

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>BrowserBridge</title>
    <style>
      :root {
        --bg: #1a1a2e;
        --surface: #16213e;
        --border: #0f3460;
        --text: #e0e0e0;
        --muted: #9aa0a6;
        --accent: #4ecca3;
        --accent-hover: #3db892;
        --danger: #e74c3c;
        --danger-hover: #c0392b;
      }

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      body {
        background: var(--bg);
        color: var(--text);
        font-family:
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;
        font-size: 14px;
        line-height: 1.5;
        min-width: 320px;
        padding: 16px;
      }

      h1 {
        font-size: 16px;
        font-weight: 600;
        margin-block-end: 12px;
      }

      label {
        display: block;
        font-weight: 600;
        font-size: 13px;
        margin-block-end: 4px;
      }

      input {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 6px;
        color: var(--text);
        font: inherit;
        margin-block-end: 12px;
        padding: 8px 10px;
        width: 100%;
      }

      input:focus {
        border-color: var(--accent);
        outline: none;
      }

      .actions {
        display: flex;
        gap: 8px;
        margin-block-end: 12px;
      }

      button {
        background: var(--accent);
        border: 0;
        border-radius: 6px;
        color: var(--bg);
        cursor: pointer;
        font: inherit;
        font-weight: 600;
        padding: 8px 12px;
      }

      button:hover {
        background: var(--accent-hover);
      }

      button.secondary {
        background: var(--border);
        color: var(--text);
      }

      button.secondary:hover {
        background: var(--muted);
      }

      button.danger {
        background: var(--danger);
        color: #fff;
      }

      button.danger:hover {
        background: var(--danger-hover);
      }

      #status {
        background: var(--surface);
        border-radius: 6px;
        font-size: 13px;
        min-height: 1.5em;
        padding: 8px;
      }
    </style>
  </head>
  <body>
    <h1>BrowserBridge</h1>
    <form id="settings-form">
      <label for="websocket-url">WebSocket URL</label>
      <input
        id="websocket-url"
        name="websocketUrl"
        placeholder="ws://127.0.0.1:8787"
        required
        type="url"
      />
      <label for="pairing-token">Pairing token</label>
      <input
        id="pairing-token"
        name="pairingToken"
        required
        type="password"
      />
      <label for="profile-name">Profile name</label>
      <input
        id="profile-name"
        name="profileName"
        required
        type="text"
        value="Default"
      />
      <label for="browser-label">Browser label</label>
      <input
        id="browser-label"
        name="label"
        required
        type="text"
        value="Chrome Default"
      />
      <div class="actions">
        <button id="save-button" type="submit">Save</button>
        <button class="secondary" id="connect-button" type="button">Connect</button>
        <button class="danger" id="disconnect-button" type="button">Disconnect</button>
      </div>
    </form>
    <div id="status" role="status"></div>
    <script type="module" src="popup-entry.js"></script>
  </body>
</html>
```

**Step 2: Commit**

```bash
git add clients/extensions/chrome/src/popup.html
git commit -m "feat: add Chrome popup HTML with dark theme"
```

---

### Task 6: Simplify Chrome `permissions.ts` — always-true model

**Objective:** Switch permissions to the Safari model where regular page access is always granted (no runtime permission request needed since host_permissions are now required in manifest).

**Files:**
- Modify: `clients/extensions/chrome/src/permissions.ts`
- Modify: `clients/extensions/chrome/src/permissions.test.ts`

**Step 1: Write failing tests**

Update `clients/extensions/chrome/src/permissions.test.ts`:

```typescript
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  hasRegularPageAccess,
  isRegularPageUrl
} from './permissions.js'

void describe('Chrome regular page permissions', () => {
  void it('recognizes regular HTTP and HTTPS page URLs', () => {
    assert.equal(isRegularPageUrl('http://example.com/'), true)
    assert.equal(isRegularPageUrl('https://example.com/docs'), true)
    assert.equal(isRegularPageUrl('chrome://extensions'), false)
    assert.equal(isRegularPageUrl('chrome-extension://abc/setup.html'), false)
    assert.equal(isRegularPageUrl('file:///Users/example/report.html'), false)
  })

  void it('always has regular page access because broad host permission is granted at install time', async () => {
    const granted = await hasRegularPageAccess()

    assert.equal(granted, true)
  })
})
```

**Step 2: Run test to verify failure**

Run: `pnpm --filter @browserbridge/chrome-extension test`
Expected: FAIL — `hasRegularPageAccess` requires a `ChromePermissionsApi` argument

**Step 3: Write minimal implementation**

Update `clients/extensions/chrome/src/permissions.ts`:

```typescript
// Chrome permissions module.
//
// Per ADR 0030, Chrome now grants the broad host permission at
// extension-install time (host_permissions in manifest). There is
// no runtime permission request flow, so hasRegularPageAccess
// always resolves to true.

export function isRegularPageUrl (url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}

export async function hasRegularPageAccess (): Promise<boolean> {
  // Broad host permission is granted at install time — always true.
  return true
}
```

**Step 4: Run test to verify pass**

Run: `pnpm --filter @browserbridge/chrome-extension test`
Expected: PASS

**Step 5: Commit**

```bash
git add clients/extensions/chrome/src/permissions.ts clients/extensions/chrome/src/permissions.test.ts
git commit -m "feat: simplify Chrome permissions to always-true model"
```

---

### Task 7: Update Chrome `background.ts` — remove onClicked, add message handlers

**Objective:** Remove the `chrome.action.onClicked` listener (replaced by popup). Add `get_status`, `connect`, and `disconnect` message handlers. Remove permission-related imports and error paths.

**Files:**
- Modify: `clients/extensions/chrome/src/background.ts`

**Step 1: Update background.ts**

Key changes:
1. Remove `import { hasRegularPageAccess, isRegularPageUrl, type ChromePermissionsApi } from './permissions.js'` — keep `isRegularPageUrl` but remove `hasRegularPageAccess` and `ChromePermissionsApi`
2. Remove `chrome.action.onClicked.addListener(...)` block
3. Remove `chrome.permissions` from `ChromeApi` interface
4. Add `get_status`, `connect`, `disconnect` message handlers to `onMessage` listener
5. Remove permission check calls in `readActiveTabPage` and `performActiveTabAction` (always has access now)
6. Remove `regularPagePermissionRequired` and `actionRegularPagePermissionRequired` helper functions

Add to `chrome.runtime.onMessage.addListener`:

```typescript
if (message.type === 'get_status') {
  const status = controller.getConnectionStatus()
  sendResponse({ ok: true, data: status })
  return undefined
}

if (message.type === 'connect') {
  void controller.requestConnect().then(
    () => {
      sendResponse({ ok: true })
    },
    (error: unknown) => {
      sendResponse({
        ok: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to connect.'
        }
      })
    }
  )
  return true
}

if (message.type === 'disconnect') {
  void controller.requestDisconnect().then(
    () => {
      sendResponse({ ok: true })
    },
    (error: unknown) => {
      sendResponse({
        ok: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to disconnect.'
        }
      })
    }
  )
  return true
}
```

Remove from `readActiveTabPage` and `performActiveTabAction`:
- The `hasRegularPageAccess` check in the catch block
- The `regularPagePermissionRequired()` / `actionRegularPagePermissionRequired()` calls

Replace those catch blocks with just:
```typescript
} catch {
  return contentScriptUnavailable()
}
```

**Step 2: Run existing tests**

Run: `pnpm --filter @browserbridge/chrome-extension test`
Expected: PASS (existing content test still passes)

**Step 3: Commit**

```bash
git add clients/extensions/chrome/src/background.ts
git commit -m "feat: add get_status/connect/disconnect handlers, remove onClicked"
```

---

### Task 8: Update Chrome `manifest.json` — add popup, switch to required host permissions

**Objective:** Add `default_popup` to manifest, move host permissions from optional to required.

**Files:**
- Modify: `clients/extensions/chrome/manifest.json`

**Step 1: Update manifest.json**

```json
{
  "manifest_version": 3,
  "name": "BrowserBridge",
  "version": "0.0.0",
  "minimum_chrome_version": "116",
  "description": "User-controlled bridge between Chrome and AI agents.",
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup.html",
    "default_title": "BrowserBridge"
  },
  "permissions": ["activeTab", "scripting", "storage", "tabs"],
  "host_permissions": ["http://*/*", "https://*/*"]
}
```

**Step 2: Commit**

```bash
git add clients/extensions/chrome/manifest.json
git commit -m "feat: add default_popup and required host_permissions to Chrome manifest"
```

---

### Task 9: Update Chrome build script and tsconfig

**Objective:** Update the build to copy `popup.html` instead of `setup.html`, include new source files in the TypeScript build, and bundle the popup entry.

**Files:**
- Modify: `clients/extensions/chrome/package.json`
- Modify: `clients/extensions/chrome/tsconfig.build.json`

**Step 1: Update package.json build script**

Change `cp src/setup.html dist/setup.html` to `cp src/popup.html dist/popup.html`.

Add esbuild bundle for `popup-entry.ts`:

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.build.json && esbuild src/content-script-entry.ts --bundle --format=iife --platform=browser --target=chrome116 --outfile=dist/content.js && esbuild src/popup-entry.ts --bundle --format=iife --platform=browser --target=chrome116 --outfile=dist/popup-entry.js && cp manifest.json dist/manifest.json && cp src/popup.html dist/popup.html && node scripts/verify-build-output.mjs"
  }
}
```

**Step 2: Update tsconfig.build.json**

Replace `src/setup.ts` with `src/popup-entry.ts`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "noEmit": false
  },
  "include": [
    "src/background.ts",
    "src/content-script-entry.ts",
    "src/popup-entry.ts"
  ]
}
```

**Step 3: Run build**

Run: `pnpm --filter @browserbridge/chrome-extension build`
Expected: PASS — `dist/popup.html` and `dist/popup-entry.js` exist

**Step 4: Commit**

```bash
git add clients/extensions/chrome/package.json clients/extensions/chrome/tsconfig.build.json
git commit -m "build: update Chrome build for popup instead of setup page"
```

---

### Task 10: Delete Chrome `setup.ts` and `setup.html`

**Objective:** Remove the full-tab configuration page that was replaced by the popup.

**Files:**
- Delete: `clients/extensions/chrome/src/setup.ts`
- Delete: `clients/extensions/chrome/src/setup.html`

**Step 1: Delete files**

```bash
rm clients/extensions/chrome/src/setup.ts clients/extensions/chrome/src/setup.html
```

**Step 2: Run build and tests**

Run: `pnpm --filter @browserbridge/chrome-extension build && pnpm --filter @browserbridge/chrome-extension test`
Expected: PASS

**Step 3: Commit**

```bash
git add -u clients/extensions/chrome/src/
git commit -m "chore: remove Chrome setup.ts and setup.html (replaced by popup)"
```

---

### Task 11: Run full test suite and lint

**Objective:** Verify everything works end-to-end.

**Step 1: Run all tests**

```bash
pnpm --filter @browserbridge/shared test
pnpm --filter @browserbridge/chrome-extension test
```

Expected: All tests pass.

**Step 2: Run build**

```bash
pnpm --filter @browserbridge/chrome-extension build
```

Expected: Build succeeds, dist contains `popup.html` and `popup-entry.js`.

**Step 3: Run lint**

```bash
pnpm lint:ts
pnpm lint:md
```

Expected: No new errors.

**Step 4: Commit (if any lint fixes needed)**

```bash
git add -A
git commit -m "chore: lint fixes for Chrome popup feature"
```

---

### Task 12: Update Chrome extension README

**Objective:** Document the popup UI, permission change, and removal of setup page.

**Files:**
- Modify: `clients/extensions/chrome/README.md`

**Step 1: Update README**

Key changes:
- Document popup UI (settings, connect/disconnect, status)
- Document that regular page access is granted at install time (no setup page needed)
- Remove references to `setup.html`
- Update screenshot/description if applicable
- Note that clicking the extension icon now opens a popup instead of toggling connection

**Step 2: Commit**

```bash
git add clients/extensions/chrome/README.md
git commit -m "docs: update Chrome extension README for popup configuration"
```