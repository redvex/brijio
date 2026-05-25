import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  fillEditable,
  selectOptions,
  setChecked,
  submitForm
} from './form-action-tools.js'
import { type BrowserBridgePageActionsConfig } from './page-actions.js'

void describe('MCP form action tools', () => {
  void it('returns invalid tool input for non-boolean checked values', async () => {
    const result = await setChecked(
      createConfig(),
      {
        formId: 'form-1',
        controlId: 'control-1',
        checked: 'true'
      }
    )

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'invalid_tool_input',
        message: 'checked must be a boolean.'
      }
    })
  })

  void it('sets a checkbox or radio target checked state', async () => {
    const requestedInputs: unknown[] = []

    const result = await setChecked(
      {
        ...createConfig(),
        requestSetChecked: async (options) => {
          requestedInputs.push({
            target: options.target,
            checked: options.checked
          })
          return {
            ok: true,
            data: {
              action: 'set_checked',
              target: options.target,
              checked: options.checked,
              changed: true
            }
          }
        }
      },
      {
        formId: 'form-1',
        controlId: 'control-1',
        checked: true
      }
    )

    assert.deepEqual(requestedInputs, [
      {
        target: {
          formId: 'form-1',
          controlId: 'control-1'
        },
        checked: true
      }
    ])
    assert.deepEqual(result, {
      ok: true,
      data: {
        action: 'set_checked',
        target: {
          formId: 'form-1',
          controlId: 'control-1'
        },
        checked: true,
        changed: true
      }
    })
  })

  void it('returns invalid tool input for non-array select option values', async () => {
    const result = await selectOptions(
      createConfig(),
      {
        formId: 'form-1',
        controlId: 'control-1',
        values: 'alpha'
      }
    )

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'invalid_tool_input',
        message: 'values must be an array of strings.'
      }
    })
  })

  void it('selects form control option values', async () => {
    const requestedInputs: unknown[] = []

    const result = await selectOptions(
      {
        ...createConfig(),
        requestSelectOptions: async (options) => {
          requestedInputs.push({
            target: options.target,
            values: options.values
          })
          return {
            ok: true,
            data: {
              action: 'select_options',
              target: options.target,
              values: options.values
            }
          }
        }
      },
      {
        formId: 'form-1',
        controlId: 'control-1',
        values: ['alpha', 'gamma']
      }
    )

    assert.deepEqual(requestedInputs, [
      {
        target: {
          formId: 'form-1',
          controlId: 'control-1'
        },
        values: ['alpha', 'gamma']
      }
    ])
    assert.deepEqual(result, {
      ok: true,
      data: {
        action: 'select_options',
        target: {
          formId: 'form-1',
          controlId: 'control-1'
        },
        values: ['alpha', 'gamma']
      }
    })
  })

  void it('submits a visible form by short-lived form ID', async () => {
    const requestedInputs: unknown[] = []

    const result = await submitForm(
      {
        ...createConfig(),
        requestSubmitForm: async (options) => {
          requestedInputs.push({
            target: options.target
          })
          return {
            ok: true,
            data: {
              action: 'submit_form',
              target: options.target
            }
          }
        }
      },
      {
        formId: 'form-1'
      }
    )

    assert.deepEqual(requestedInputs, [
      {
        target: {
          formId: 'form-1'
        }
      }
    ])
    assert.deepEqual(result, {
      ok: true,
      data: {
        action: 'submit_form',
        target: {
          formId: 'form-1'
        }
      }
    })
  })

  void it('returns invalid tool input for empty editable IDs', async () => {
    const result = await fillEditable(
      createConfig(),
      {
        id: '',
        text: 'hello'
      }
    )

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'invalid_tool_input',
        message: 'id must be a non-empty string.'
      }
    })
  })

  void it('fills a visible contenteditable text target', async () => {
    const requestedInputs: unknown[] = []

    const result = await fillEditable(
      {
        ...createConfig(),
        requestWriteEditable: async (options) => {
          requestedInputs.push({
            target: options.target,
            text: options.text
          })
          return {
            ok: true,
            data: {
              action: 'write_text',
              target: options.target,
              textLength: options.text.length
            }
          }
        }
      },
      {
        id: 'bb-1',
        text: 'hello'
      }
    )

    assert.deepEqual(requestedInputs, [
      {
        target: {
          kind: 'editable',
          id: 'bb-1'
        },
        text: 'hello'
      }
    ])
    assert.deepEqual(result, {
      ok: true,
      data: {
        action: 'write_text',
        target: {
          kind: 'editable',
          id: 'bb-1'
        },
        textLength: 5
      }
    })
  })

  void it('returns WebSocket and browser errors without rewriting them', async () => {
    const result = await submitForm(
      {
        ...createConfig(),
        requestSubmitForm: async () => ({
          ok: false,
          error: {
            code: 'browser_error',
            message: 'No matching form was found.'
          }
        })
      },
      {
        formId: 'form-9'
      }
    )

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: 'browser_error',
        message: 'No matching form was found.'
      }
    })
  })
})

function createConfig (): BrowserBridgePageActionsConfig {
  return {
    websocketUrl: 'ws://127.0.0.1:8787',
    timeoutMs: 5000,
    requestSetChecked: async () => {
      throw new Error('set checked should not be requested')
    },
    requestSelectOptions: async () => {
      throw new Error('select options should not be requested')
    },
    requestSubmitForm: async () => {
      throw new Error('submit form should not be requested')
    },
    requestWriteEditable: async () => {
      throw new Error('write editable should not be requested')
    }
  }
}
