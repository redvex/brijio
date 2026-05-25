import {
  fillCurrentPageEditable,
  selectCurrentPageOptions,
  setCurrentPageChecked,
  submitCurrentPageForm,
  type BrowserBridgePageActionsConfig
} from './page-actions.js'
import {
  type EditableTarget,
  type FillInputActionResultData,
  type FillInputTarget,
  type SelectOptionsActionResultData,
  type SetCheckedActionResultData,
  type SubmitFormActionResultData
} from './protocol.js'
import { type BrowserBridgeToolResult } from './page-reading-tool.js'

export interface SetCheckedInput {
  formId?: unknown
  controlId?: unknown
  checked?: unknown
}

export interface SelectOptionsInput {
  formId?: unknown
  controlId?: unknown
  values?: unknown
}

export interface SubmitFormInput {
  formId?: unknown
}

export interface FillEditableInput {
  id?: unknown
  text?: unknown
}

export type SetCheckedResult =
  BrowserBridgeToolResult<SetCheckedActionResultData>

export type SelectOptionsResult =
  BrowserBridgeToolResult<SelectOptionsActionResultData>

export type SubmitFormResult =
  BrowserBridgeToolResult<SubmitFormActionResultData>

export type FillEditableResult =
  BrowserBridgeToolResult<FillInputActionResultData>

export async function setChecked (
  config: BrowserBridgePageActionsConfig,
  input: SetCheckedInput
): Promise<SetCheckedResult> {
  const targetResult = normalizeFormControlTarget(input)

  if (!targetResult.ok) {
    return targetResult
  }

  if (typeof input.checked !== 'boolean') {
    return invalidToolInputResponse('checked must be a boolean.')
  }

  return await setCurrentPageChecked(config, targetResult.data, input.checked)
}

export async function selectOptions (
  config: BrowserBridgePageActionsConfig,
  input: SelectOptionsInput
): Promise<SelectOptionsResult> {
  const targetResult = normalizeFormControlTarget(input)

  if (!targetResult.ok) {
    return targetResult
  }

  if (
    !Array.isArray(input.values) ||
    !input.values.every((value) => typeof value === 'string')
  ) {
    return invalidToolInputResponse('values must be an array of strings.')
  }

  return await selectCurrentPageOptions(
    config,
    targetResult.data,
    input.values
  )
}

export async function submitForm (
  config: BrowserBridgePageActionsConfig,
  input: SubmitFormInput
): Promise<SubmitFormResult> {
  if (typeof input.formId !== 'string' || input.formId.length === 0) {
    return invalidToolInputResponse('formId must be a non-empty string.')
  }

  return await submitCurrentPageForm(config, input.formId)
}

export async function fillEditable (
  config: BrowserBridgePageActionsConfig,
  input: FillEditableInput
): Promise<FillEditableResult> {
  const targetResult = normalizeEditableTarget(input)

  if (!targetResult.ok) {
    return targetResult
  }

  if (typeof input.text !== 'string') {
    return invalidToolInputResponse('text must be a string.')
  }

  return await fillCurrentPageEditable(config, targetResult.data, input.text)
}

function normalizeFormControlTarget (
  input: SetCheckedInput | SelectOptionsInput
): BrowserBridgeToolResult<FillInputTarget> {
  if (typeof input.formId !== 'string' || input.formId.length === 0) {
    return invalidToolInputResponse('formId must be a non-empty string.')
  }

  if (
    typeof input.controlId !== 'string' ||
    input.controlId.length === 0
  ) {
    return invalidToolInputResponse('controlId must be a non-empty string.')
  }

  return {
    ok: true,
    data: {
      formId: input.formId,
      controlId: input.controlId
    }
  }
}

function normalizeEditableTarget (
  input: FillEditableInput
): BrowserBridgeToolResult<EditableTarget> {
  if (typeof input.id !== 'string' || input.id.length === 0) {
    return invalidToolInputResponse('id must be a non-empty string.')
  }

  return {
    ok: true,
    data: {
      kind: 'editable',
      id: input.id
    }
  }
}

function invalidToolInputResponse (
  message: string
): BrowserBridgeToolResult<never> {
  return {
    ok: false,
    error: {
      code: 'invalid_tool_input',
      message
    }
  }
}
