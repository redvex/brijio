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
  browserInstanceId?: unknown
}

export interface SelectOptionsInput {
  formId?: unknown
  controlId?: unknown
  values?: unknown
  browserInstanceId?: unknown
}

export interface SubmitFormInput {
  formId?: unknown
  browserInstanceId?: unknown
}

export interface FillEditableInput {
  id?: unknown
  text?: unknown
  browserInstanceId?: unknown
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

  return await setCurrentPageChecked(
    config,
    targetResult.data.target,
    input.checked,
    targetResult.data.browserInstanceId
  )
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
    targetResult.data.target,
    input.values,
    targetResult.data.browserInstanceId
  )
}

export async function submitForm (
  config: BrowserBridgePageActionsConfig,
  input: SubmitFormInput
): Promise<SubmitFormResult> {
  if (typeof input.formId !== 'string' || input.formId.length === 0) {
    return invalidToolInputResponse('formId must be a non-empty string.')
  }

  const browserInstanceId = normalizeBrowserInstanceId(
    input.browserInstanceId
  )

  if (!browserInstanceId.ok) {
    return browserInstanceId
  }

  return await submitCurrentPageForm(
    config,
    input.formId,
    browserInstanceId.data
  )
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

  return await fillCurrentPageEditable(
    config,
    targetResult.data.target,
    input.text,
    targetResult.data.browserInstanceId
  )
}

function normalizeFormControlTarget (
  input: SetCheckedInput | SelectOptionsInput
): BrowserBridgeToolResult<{
    target: FillInputTarget
    browserInstanceId?: string
  }> {
  if (typeof input.formId !== 'string' || input.formId.length === 0) {
    return invalidToolInputResponse('formId must be a non-empty string.')
  }

  if (
    typeof input.controlId !== 'string' ||
    input.controlId.length === 0
  ) {
    return invalidToolInputResponse('controlId must be a non-empty string.')
  }

  const browserInstanceId = normalizeBrowserInstanceId(
    input.browserInstanceId
  )

  if (!browserInstanceId.ok) {
    return browserInstanceId
  }

  return {
    ok: true,
    data: {
      target: {
        formId: input.formId,
        controlId: input.controlId
      },
      ...(browserInstanceId.data !== undefined
        ? { browserInstanceId: browserInstanceId.data }
        : {})
    }
  }
}

function normalizeEditableTarget (
  input: FillEditableInput
): BrowserBridgeToolResult<{
    target: EditableTarget
    browserInstanceId?: string
  }> {
  if (typeof input.id !== 'string' || input.id.length === 0) {
    return invalidToolInputResponse('id must be a non-empty string.')
  }

  const browserInstanceId = normalizeBrowserInstanceId(
    input.browserInstanceId
  )

  if (!browserInstanceId.ok) {
    return browserInstanceId
  }

  return {
    ok: true,
    data: {
      target: {
        kind: 'editable',
        id: input.id
      },
      ...(browserInstanceId.data !== undefined
        ? { browserInstanceId: browserInstanceId.data }
        : {})
    }
  }
}

function normalizeBrowserInstanceId (
  value: unknown
): BrowserBridgeToolResult<string | undefined> {
  if (value === undefined) {
    return {
      ok: true,
      data: undefined
    }
  }

  if (typeof value !== 'string' || value.length === 0) {
    return invalidToolInputResponse(
      'browserInstanceId must be a non-empty string when provided.'
    )
  }

  return {
    ok: true,
    data: value
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
