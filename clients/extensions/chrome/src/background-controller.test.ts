import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  BrowserBridgeBackgroundController,
  type ActionAdapter,
  type BridgeSettings,
  type PageActionAdapter,
  type PageActionResult,
  type BrowserBridgeSocket,
  type PageReadResult,
  type PageReaderAdapter,
  type SetupAdapter,
  type StorageAdapter
} from './background-controller.js'
import type {
  ActionResultErrorCode,
  ClickActionTarget,
  PageContent,
  PageContentErrorCode,
  PageContext,
  SelectOptionsActionResultData,
  SetCheckedActionResultData,
  SubmitFormActionResultData,
  WriteTextEditableTarget,
  WriteTextActionTarget
} from './protocol.js'

void describe('BrowserBridge background controller', () => {
  void it('opens setup when action is clicked without a stored WebSocket URL', async () => {
    const harness = createHarness()

    await harness.controller.handleActionClicked()

    assert.equal(harness.setup.opened, true)
    assert.equal(harness.sockets.created.length, 0)
  })

  void it('opens setup when required bridge settings are missing', async () => {
    const harness = createHarness({
      bridgeSettings: {
        ...createBridgeSettings(),
        pairingToken: ''
      }
    })

    await harness.controller.handleActionClicked()

    assert.equal(harness.setup.opened, true)
    assert.equal(harness.sockets.created.length, 0)
  })

  void it('connects when action is clicked with a stored WebSocket URL', async () => {
    const harness = createHarness({ websocketUrl: 'ws://127.0.0.1:8787' })

    await harness.controller.handleActionClicked()

    assert.equal(harness.sockets.created.length, 1)
    assert.equal(harness.sockets.created[0].url, 'ws://127.0.0.1:8787')
    assert.equal(harness.action.badgeText, '...')
    assert.equal(harness.action.title, 'BrowserBridge connecting')
  })

  void it('authenticates when the socket opens', async () => {
    const harness = createHarness({
      bridgeSettings: createBridgeSettings()
    })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()

    assert.deepEqual(JSON.parse(harness.sockets.created[0].sent[0]), {
      type: 'message',
      payload: {
        type: 'auth',
        role: 'extension',
        token: 'local-token'
      }
    })
  })

  void it('announces presence after auth success', async () => {
    const harness = createHarness({
      bridgeSettings: createBridgeSettings()
    })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    await harness.sockets.created[0].receive(
      JSON.stringify({
        type: 'message',
        payload: {
          type: 'auth_success'
        }
      })
    )

    assert.deepEqual(parseLastSent(harness), {
      type: 'message',
      payload: createPresencePayload()
    })
  })

  void it('announces presence when the server requests presence', async () => {
    const harness = createHarness({
      bridgeSettings: createBridgeSettings()
    })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    await harness.sockets.created[0].receive(
      JSON.stringify({
        type: 'message',
        id: 'presence-1',
        payload: {
          type: 'browser_presence_request'
        }
      })
    )

    assert.deepEqual(parseLastSent(harness), {
      type: 'message',
      payload: createPresencePayload()
    })
  })

  void it('saves token profile label and stable instance id', async () => {
    const harness = createHarness()
    const settings = createBridgeSettings({
      browserInstanceId: 'chrome-work-test',
      profileName: 'Work',
      label: 'Chrome Work'
    })

    await harness.controller.saveBridgeSettings(settings)

    assert.deepEqual(await harness.controller.getBridgeSettings(), settings)
    assert.equal(harness.action.badgeText, 'OFF')
    assert.equal(harness.action.title, 'BrowserBridge stopped')
  })

  void it('sets connected state when the socket opens', async () => {
    const harness = createHarness({ websocketUrl: 'ws://127.0.0.1:8787' })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    await new Promise((resolve) => setImmediate(resolve))

    assert.equal(harness.action.badgeText, 'ON')
    assert.equal(harness.action.title, 'BrowserBridge connected')
  })

  void it('disconnects when action is clicked while connected', async () => {
    const harness = createHarness({ websocketUrl: 'ws://127.0.0.1:8787' })

    await harness.controller.handleActionClicked()
    await harness.controller.handleActionClicked()

    assert.equal(harness.sockets.created[0].closed, true)
    assert.equal(harness.action.badgeText, 'OFF')
    assert.equal(harness.action.title, 'BrowserBridge stopped')
  })

  void it('responds to get_page_context with rich active tab context', async () => {
    const harness = createHarness({
      websocketUrl: 'ws://127.0.0.1:8787',
      pageContext: createPageContext()
    })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    await harness.sockets.created[0].receive(
      JSON.stringify({
        type: 'message',
        id: 'context-1',
        payload: {
          type: 'get_page_context'
        }
      })
    )

    assert.deepEqual(parseLastSent(harness), {
      type: 'message',
      id: 'context-1',
      payload: {
        type: 'page_context_response',
        ok: true,
        data: createPageContext()
      }
    })
  })

  void it('returns no_active_tab when no active tab with a URL exists', async () => {
    const harness = createHarness({
      websocketUrl: 'ws://127.0.0.1:8787',
      pageReaderError: {
        code: 'no_active_tab',
        message: 'No active tab with a URL is available.'
      }
    })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    await harness.sockets.created[0].receive(
      JSON.stringify({
        type: 'message',
        id: 'request-2',
        payload: {
          type: 'get_page_context'
        }
      })
    )

    assert.deepEqual(parseLastSent(harness), {
      type: 'message',
      id: 'request-2',
      payload: {
        type: 'page_context_response',
        ok: false,
        error: {
          code: 'no_active_tab',
          message: 'No active tab with a URL is available.'
        }
      }
    })
  })

  void it('responds to get_page_content with the requested chunk', async () => {
    const harness = createHarness({
      websocketUrl: 'ws://127.0.0.1:8787',
      pageContent: {
        url: 'https://example.com/',
        title: 'Example Domain',
        timestamp: '2026-05-25T10:01:00.000Z',
        index: 2,
        content: 'Second chunk',
        truncated: false,
        maxPayloadBytes: 131072
      }
    })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    await harness.sockets.created[0].receive(
      JSON.stringify({
        type: 'message',
        id: 'content-1',
        payload: {
          type: 'get_page_content',
          index: 2
        }
      })
    )

    assert.deepEqual(parseLastSent(harness), {
      type: 'message',
      id: 'content-1',
      payload: {
        type: 'page_content_response',
        ok: true,
        data: {
          url: 'https://example.com/',
          title: 'Example Domain',
          timestamp: '2026-05-25T10:01:00.000Z',
          index: 2,
          content: 'Second chunk',
          truncated: false,
          maxPayloadBytes: 131072
        }
      }
    })
  })

  void it('returns content_script_unavailable when active tab extraction fails', async () => {
    const harness = createHarness({
      websocketUrl: 'ws://127.0.0.1:8787',
      pageReaderError: {
        code: 'content_script_unavailable',
        message: 'Unable to reach the page content script.'
      }
    })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    await harness.sockets.created[0].receive(
      JSON.stringify({
        type: 'message',
        id: 'content-2',
        payload: {
          type: 'get_page_content',
          index: 1
        }
      })
    )

    assert.deepEqual(parseLastSent(harness), {
      type: 'message',
      id: 'content-2',
      payload: {
        type: 'page_content_response',
        ok: false,
        error: {
          code: 'content_script_unavailable',
          message: 'Unable to reach the page content script.'
        }
      }
    })
  })

  void it('returns regular_page_permission_required when a regular page needs host permission', async () => {
    const harness = createHarness({
      websocketUrl: 'ws://127.0.0.1:8787',
      pageReaderError: {
        code: 'regular_page_permission_required',
        message:
          'Regular page access is not enabled. Open BrowserBridge setup and enable regular page access.'
      }
    })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    await harness.sockets.created[0].receive(
      JSON.stringify({
        type: 'message',
        id: 'content-3',
        payload: {
          type: 'get_page_content',
          index: 1
        }
      })
    )

    assert.deepEqual(parseLastSent(harness), {
      type: 'message',
      id: 'content-3',
      payload: {
        type: 'page_content_response',
        ok: false,
        error: {
          code: 'regular_page_permission_required',
          message:
            'Regular page access is not enabled. Open BrowserBridge setup and enable regular page access.'
        }
      }
    })
  })

  void it('responds to perform_action click with an action result', async () => {
    const harness = createHarness({
      websocketUrl: 'ws://127.0.0.1:8787',
      clickTarget: {
        kind: 'link',
        id: 'bb-1'
      }
    })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    await harness.sockets.created[0].receive(
      JSON.stringify({
        type: 'message',
        id: 'action-1',
        payload: {
          type: 'perform_action',
          action: {
            type: 'click',
            target: {
              kind: 'link',
              id: 'bb-1'
            }
          }
        }
      })
    )

    assert.deepEqual(parseLastSent(harness), {
      type: 'message',
      id: 'action-1',
      payload: {
        type: 'action_result',
        ok: true,
        data: {
          action: 'click',
          target: {
            kind: 'link',
            id: 'bb-1'
          }
        }
      }
    })
  })

  void it('responds to perform_action write_text with an action result', async () => {
    const harness = createHarness({
      websocketUrl: 'ws://127.0.0.1:8787',
      writeTextTarget: {
        formId: 'bb-1',
        controlId: 'bb-2'
      }
    })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    await harness.sockets.created[0].receive(
      JSON.stringify({
        type: 'message',
        id: 'action-write-1',
        payload: {
          type: 'perform_action',
          action: {
            type: 'write_text',
            target: {
              formId: 'bb-1',
              controlId: 'bb-2'
            },
            text: 'Ada Lovelace'
          }
        }
      })
    )

    assert.deepEqual(parseLastSent(harness), {
      type: 'message',
      id: 'action-write-1',
      payload: {
        type: 'action_result',
        ok: true,
        data: {
          action: 'write_text',
          target: {
            formId: 'bb-1',
            controlId: 'bb-2'
          },
          textLength: 12
        }
      }
    })
  })

  void it('responds to perform_action set_checked with an action result', async () => {
    const harness = createHarness({
      websocketUrl: 'ws://127.0.0.1:8787',
      setCheckedResult: {
        action: 'set_checked',
        target: {
          formId: 'bb-1',
          controlId: 'bb-3'
        },
        checked: true,
        changed: true
      }
    })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    await harness.sockets.created[0].receive(
      JSON.stringify({
        type: 'message',
        id: 'action-check-1',
        payload: {
          type: 'perform_action',
          action: {
            type: 'set_checked',
            target: {
              formId: 'bb-1',
              controlId: 'bb-3'
            },
            checked: true
          }
        }
      })
    )

    assert.deepEqual(parseLastSent(harness), {
      type: 'message',
      id: 'action-check-1',
      payload: {
        type: 'action_result',
        ok: true,
        data: {
          action: 'set_checked',
          target: {
            formId: 'bb-1',
            controlId: 'bb-3'
          },
          checked: true,
          changed: true
        }
      }
    })
  })

  void it('responds to perform_action select_options with an action result', async () => {
    const harness = createHarness({
      websocketUrl: 'ws://127.0.0.1:8787',
      selectOptionsResult: {
        action: 'select_options',
        target: {
          formId: 'bb-1',
          controlId: 'bb-4'
        },
        values: ['alpha']
      }
    })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    await harness.sockets.created[0].receive(
      JSON.stringify({
        type: 'message',
        id: 'action-select-1',
        payload: {
          type: 'perform_action',
          action: {
            type: 'select_options',
            target: {
              formId: 'bb-1',
              controlId: 'bb-4'
            },
            values: ['alpha']
          }
        }
      })
    )

    assert.deepEqual(parseLastSent(harness), {
      type: 'message',
      id: 'action-select-1',
      payload: {
        type: 'action_result',
        ok: true,
        data: {
          action: 'select_options',
          target: {
            formId: 'bb-1',
            controlId: 'bb-4'
          },
          values: ['alpha']
        }
      }
    })
  })

  void it('responds to perform_action submit_form with an action result', async () => {
    const harness = createHarness({
      websocketUrl: 'ws://127.0.0.1:8787',
      submitFormResult: {
        action: 'submit_form',
        target: {
          formId: 'bb-1'
        }
      }
    })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    await harness.sockets.created[0].receive(
      JSON.stringify({
        type: 'message',
        id: 'action-submit-1',
        payload: {
          type: 'perform_action',
          action: {
            type: 'submit_form',
            target: {
              formId: 'bb-1'
            }
          }
        }
      })
    )

    assert.deepEqual(parseLastSent(harness), {
      type: 'message',
      id: 'action-submit-1',
      payload: {
        type: 'action_result',
        ok: true,
        data: {
          action: 'submit_form',
          target: {
            formId: 'bb-1'
          }
        }
      }
    })
  })

  void it('returns action errors from perform_action click requests', async () => {
    const harness = createHarness({
      websocketUrl: 'ws://127.0.0.1:8787',
      pageActionError: {
        code: 'target_not_found',
        message: 'No matching click target was found.'
      }
    })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    await harness.sockets.created[0].receive(
      JSON.stringify({
        type: 'message',
        id: 'action-2',
        payload: {
          type: 'perform_action',
          action: {
            type: 'click',
            target: {
              kind: 'action',
              id: 'bb-3'
            }
          }
        }
      })
    )

    assert.deepEqual(parseLastSent(harness), {
      type: 'message',
      id: 'action-2',
      payload: {
        type: 'action_result',
        ok: false,
        error: {
          code: 'target_not_found',
          message: 'No matching click target was found.'
        }
      }
    })
  })

  void it('returns unsupported_action for unsupported perform_action requests', async () => {
    const harness = createHarness({ websocketUrl: 'ws://127.0.0.1:8787' })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    await harness.sockets.created[0].receive(
      JSON.stringify({
        type: 'message',
        id: 'action-3',
        payload: {
          type: 'perform_action',
          action: {
            type: 'hover',
            target: {
              kind: 'action',
              id: 'bb-1'
            }
          }
        }
      })
    )

    assert.deepEqual(parseLastSent(harness), {
      type: 'message',
      id: 'action-3',
      payload: {
        type: 'action_result',
        ok: false,
        error: {
          code: 'unsupported_action',
          message:
            'Only click, write_text, set_checked, select_options, and submit_form actions are supported.'
        }
      }
    })
  })

  void it('returns invalid_action_target for invalid click targets', async () => {
    const harness = createHarness({ websocketUrl: 'ws://127.0.0.1:8787' })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    await harness.sockets.created[0].receive(
      JSON.stringify({
        type: 'message',
        id: 'action-4',
        payload: {
          type: 'perform_action',
          action: {
            type: 'click',
            target: {
              kind: 'image',
              id: 'bb-1'
            }
          }
        }
      })
    )

    assert.deepEqual(parseLastSent(harness), {
      type: 'message',
      id: 'action-4',
      payload: {
        type: 'action_result',
        ok: false,
        error: {
          code: 'invalid_action_target',
          message: 'Click targets must identify a link or action by ID.'
        }
      }
    })
  })

  void it('returns invalid_action_target for invalid write_text targets', async () => {
    const harness = createHarness({ websocketUrl: 'ws://127.0.0.1:8787' })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    await harness.sockets.created[0].receive(
      JSON.stringify({
        type: 'message',
        id: 'action-write-2',
        payload: {
          type: 'perform_action',
          action: {
            type: 'write_text',
            target: {
              formId: 'bb-1',
              controlId: ''
            },
            text: 'Ada Lovelace'
          }
        }
      })
    )

    assert.deepEqual(parseLastSent(harness), {
      type: 'message',
      id: 'action-write-2',
      payload: {
        type: 'action_result',
        ok: false,
        error: {
          code: 'invalid_action_target',
          message: 'Text targets must identify a form control by ID.'
        }
      }
    })
  })

  void it('keeps the error state when a socket error is followed by close', async () => {
    const harness = createHarness({ websocketUrl: 'ws://127.0.0.1:8787' })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    harness.sockets.created[0].fail()
    harness.sockets.created[0].close()
    await new Promise((resolve) => setImmediate(resolve))

    assert.equal(harness.action.badgeText, 'ERR')
    assert.equal(harness.action.title, 'BrowserBridge connection error')
  })

  void it('sends extension keepalives while connected', async () => {
    const harness = createHarness({ websocketUrl: 'ws://127.0.0.1:8787' })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    harness.timers.tick()

    assert.deepEqual(parseLastSent(harness), {
      type: 'message',
      payload: {
        type: 'extension_keepalive'
      }
    })
    assert.equal(harness.timers.intervalMs, 20000)
  })

  void it('stops extension keepalives after disconnect', async () => {
    const harness = createHarness({ websocketUrl: 'ws://127.0.0.1:8787' })

    await harness.controller.handleActionClicked()
    harness.sockets.created[0].open()
    await harness.controller.handleActionClicked()
    harness.timers.tick()

    assert.deepEqual(harness.sockets.created[0].sent, [
      JSON.stringify({
        type: 'message',
        payload: {
          type: 'auth',
          role: 'extension',
          token: 'local-token'
        }
      })
    ])
    assert.equal(harness.timers.cleared, true)
  })
})

interface HarnessOptions {
  websocketUrl?: string
  bridgeSettings?: BridgeSettings
  pageContext?: PageContext
  pageContent?: PageContent
  pageReaderError?: {
    code: PageContentErrorCode
    message: string
  }
  clickTarget?: ClickActionTarget
  writeTextTarget?: WriteTextActionTarget
  setCheckedResult?: SetCheckedActionResultData
  selectOptionsResult?: SelectOptionsActionResultData
  submitFormResult?: SubmitFormActionResultData
  pageActionError?: {
    code: ActionResultErrorCode
    message: string
  }
}

interface Harness {
  action: FakeActionAdapter
  controller: BrowserBridgeBackgroundController
  setup: FakeSetupAdapter
  sockets: FakeSocketFactory
  timers: FakeTimersAdapter
}

function createHarness (options: HarnessOptions = {}): Harness {
  const storage = new FakeStorageAdapter(
    options.bridgeSettings ??
    (options.websocketUrl === undefined
      ? undefined
      : createBridgeSettings({ websocketUrl: options.websocketUrl }))
  )
  const setup = new FakeSetupAdapter()
  const action = new FakeActionAdapter()
  const pageReader = new FakePageReaderAdapter(options)
  const pageActions = new FakePageActionAdapter(options)
  const sockets = new FakeSocketFactory()
  const timers = new FakeTimersAdapter()
  const controller = new BrowserBridgeBackgroundController({
    action,
    createWebSocket: sockets.create,
    setup,
    storage,
    pageReader,
    pageActions,
    timers
  })

  return {
    action,
    controller,
    setup,
    sockets,
    timers
  }
}

function parseLastSent (harness: Harness): unknown {
  const message = harness.sockets.created[0].sent.at(-1)

  if (typeof message !== 'string') {
    throw new Error('Expected socket to have sent a message.')
  }

  return JSON.parse(message)
}

class FakePageActionAdapter implements PageActionAdapter {
  constructor (private readonly options: HarnessOptions) {}

  async click (target: ClickActionTarget): Promise<PageActionResult> {
    if (this.options.pageActionError !== undefined) {
      return {
        ok: false,
        error: this.options.pageActionError
      }
    }

    return {
      ok: true,
      data: {
        action: 'click',
        target: this.options.clickTarget ?? target
      }
    }
  }

  async writeText (
    target: WriteTextActionTarget | WriteTextEditableTarget,
    text: string
  ): Promise<PageActionResult> {
    if (this.options.pageActionError !== undefined) {
      return {
        ok: false,
        error: this.options.pageActionError
      }
    }

    return {
      ok: true,
      data: {
        action: 'write_text',
        target: this.options.writeTextTarget ?? target,
        textLength: text.length
      }
    }
  }

  async setChecked (
    target: WriteTextActionTarget,
    checked: boolean
  ): Promise<PageActionResult> {
    if (this.options.pageActionError !== undefined) {
      return {
        ok: false,
        error: this.options.pageActionError
      }
    }

    return {
      ok: true,
      data: this.options.setCheckedResult ?? {
        action: 'set_checked',
        target,
        checked,
        changed: true
      }
    }
  }

  async selectOptions (
    target: WriteTextActionTarget,
    values: string[]
  ): Promise<PageActionResult> {
    if (this.options.pageActionError !== undefined) {
      return {
        ok: false,
        error: this.options.pageActionError
      }
    }

    return {
      ok: true,
      data: this.options.selectOptionsResult ?? {
        action: 'select_options',
        target,
        values
      }
    }
  }

  async submitForm (target: { formId: string }): Promise<PageActionResult> {
    if (this.options.pageActionError !== undefined) {
      return {
        ok: false,
        error: this.options.pageActionError
      }
    }

    return {
      ok: true,
      data: this.options.submitFormResult ?? {
        action: 'submit_form',
        target
      }
    }
  }
}

class FakeStorageAdapter implements StorageAdapter {
  constructor (private bridgeSettings: BridgeSettings | undefined) {}

  async getBridgeSettings (): Promise<BridgeSettings | undefined> {
    return this.bridgeSettings
  }

  async setBridgeSettings (settings: BridgeSettings): Promise<void> {
    this.bridgeSettings = settings
  }
}

function createBridgeSettings (
  overrides: Partial<BridgeSettings> = {}
): BridgeSettings {
  return {
    websocketUrl: 'ws://127.0.0.1:8787',
    pairingToken: 'local-token',
    browserInstanceId: 'chrome-default-test',
    browserName: 'Chrome',
    profileName: 'Default',
    label: 'Chrome Default',
    ...overrides
  }
}

function createPresencePayload (): unknown {
  return {
    type: 'browser_presence_announce',
    browserInstanceId: 'chrome-default-test',
    label: 'Chrome Default',
    browserName: 'Chrome',
    profileName: 'Default',
    capabilities: [
      'page_context',
      'page_content',
      'click',
      'fill_input',
      'fill_editable',
      'set_checked',
      'select_options',
      'submit_form'
    ]
  }
}

class FakeSetupAdapter implements SetupAdapter {
  opened = false

  async openSetupPage (): Promise<void> {
    this.opened = true
  }
}

class FakeActionAdapter implements ActionAdapter {
  badgeText = ''
  title = ''

  async setBadgeText (text: string): Promise<void> {
    this.badgeText = text
  }

  async setBadgeColor (_color: string): Promise<void> {}

  async setBadgeTextColor (_color: string): Promise<void> {}

  async setTitle (title: string): Promise<void> {
    this.title = title
  }
}

class FakePageReaderAdapter implements PageReaderAdapter {
  constructor (private readonly options: HarnessOptions) {}

  async getPageContext (): Promise<PageReadResult<PageContext>> {
    if (this.options.pageReaderError !== undefined) {
      return {
        ok: false,
        error: this.options.pageReaderError
      }
    }

    if (this.options.pageContext === undefined) {
      return {
        ok: false,
        error: {
          code: 'no_active_tab',
          message: 'No active tab with a URL is available.'
        }
      }
    }

    return {
      ok: true,
      data: this.options.pageContext
    }
  }

  async getPageContent (_index: number): Promise<PageReadResult<PageContent>> {
    if (this.options.pageReaderError !== undefined) {
      return {
        ok: false,
        error: this.options.pageReaderError
      }
    }

    if (this.options.pageContent === undefined) {
      return {
        ok: false,
        error: {
          code: 'invalid_index',
          message: 'Page content chunk index must be available and 1-based.'
        }
      }
    }

    return {
      ok: true,
      data: this.options.pageContent
    }
  }
}

function createPageContext (): PageContext {
  return {
    url: 'https://example.com/',
    title: 'Example Domain',
    timestamp: '2026-05-25T10:00:00.000Z',
    selectedText: null,
    preview: {
      content: 'Example preview',
      truncated: false,
      maxBytes: 4096
    },
    structure: {
      headings: [],
      landmarks: [],
      links: [],
      images: [],
      forms: [],
      editables: [],
      actions: []
    },
    content: {
      available: true,
      requestType: 'get_page_content',
      firstIndex: 1,
      defaultMaxPayloadBytes: 131072
    }
  }
}

class FakeSocketFactory {
  readonly created: FakeSocket[] = []

  readonly create = (url: string): BrowserBridgeSocket => {
    const socket = new FakeSocket(url)
    this.created.push(socket)
    return socket
  }
}

class FakeSocket implements BrowserBridgeSocket {
  onopen: (() => void) | undefined
  onmessage: ((event: { data: string }) => void | Promise<void>) | undefined
  onclose: (() => void) | undefined
  onerror: (() => void) | undefined
  readonly sent: string[] = []
  closed = false

  constructor (readonly url: string) {}

  send (message: string): void {
    this.sent.push(message)
  }

  close (): void {
    this.closed = true
    this.onclose?.()
  }

  open (): void {
    this.onopen?.()
  }

  fail (): void {
    this.onerror?.()
  }

  async receive (message: string): Promise<void> {
    await this.onmessage?.({ data: message })
  }
}

class FakeTimersAdapter {
  callback: (() => void) | undefined
  cleared = false
  intervalMs = 0

  setInterval (callback: () => void, intervalMs: number): number {
    this.callback = callback
    this.intervalMs = intervalMs
    return 1
  }

  clearInterval (_timerId: number): void {
    this.callback = undefined
    this.cleared = true
  }

  tick (): void {
    this.callback?.()
  }
}
