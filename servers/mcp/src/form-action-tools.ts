import {
  fillCurrentPageEditable,
  selectCurrentPageOptions,
  setCurrentPageChecked,
  submitCurrentPageForm,
  type BrijioPageActionsConfig
} from './page-actions.js'
import {
  type EditableTarget,
  type FillInputActionResultData,
  type FillInputTarget,
  type SelectOptionsActionResultData,
  type SetCheckedActionResultData,
  type SubmitFormActionResultData
} from './protocol.js'
import { type BrijioToolResult } from './page-reading-tool.js'

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
  BrijioToolResult<SetCheckedActionResultData>

export type SelectOptionsResult =
  BrijioToolResult<SelectOptionsActionResultData>

export type SubmitFormResult =
  BrijioToolResult<SubmitFormActionResultData>

export type FillEditableResult =
  BrijioToolResult<FillInputActionResultData>

export async function setChecked (
  config: BrijioPageActionsConfig,
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
  config: BrijioPageActionsConfig,
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
  config: BrijioPageActionsConfig,
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
  config: BrijioPageActionsConfig,
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
): BrijioToolResult<{
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
): BrijioToolResult<{
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
): BrijioToolResult<string | undefined> {
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
): BrijioToolResult<never> {
  return {
    ok: false,
    error: {
      code: 'invalid_tool_input',
      message
    }
  }
}
