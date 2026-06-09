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
  type SubmitFormActionResultData,
  type SubmitFormTarget
} from './protocol.js'
import { type BrijioToolResult } from './page-reading-tool.js'

export interface SetCheckedInput {
  formId?: unknown
  controlId?: unknown
  checked?: unknown
  expectedLabel?: unknown
  browserInstanceId?: unknown
  pageContextId?: unknown
}

export interface SelectOptionsInput {
  formId?: unknown
  controlId?: unknown
  values?: unknown
  expectedLabel?: unknown
  browserInstanceId?: unknown
  pageContextId?: unknown
}

export interface SubmitFormInput {
  formId?: unknown
  expectedLabel?: unknown
  browserInstanceId?: unknown
  pageContextId?: unknown
}

export interface FillEditableInput {
  id?: unknown
  text?: unknown
  expectedText?: unknown
  browserInstanceId?: unknown
  pageContextId?: unknown
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
    targetResult.data.browserInstanceId,
    targetResult.data.pageContextId
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
    targetResult.data.browserInstanceId,
    targetResult.data.pageContextId
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

  if (
    input.expectedLabel !== undefined &&
    typeof input.expectedLabel !== 'string'
  ) {
    return invalidToolInputResponse(
      'expectedLabel must be a string when provided.'
    )
  }

  if (
    input.pageContextId !== undefined &&
    typeof input.pageContextId !== 'number'
  ) {
    return invalidToolInputResponse(
      'pageContextId must be a number when provided.'
    )
  }

  const target: SubmitFormTarget = {
    formId: input.formId,
    ...(input.expectedLabel !== undefined
      ? { expectedLabel: input.expectedLabel }
      : {})
  }

  return await submitCurrentPageForm(
    config,
    target,
    browserInstanceId.data,
    input.pageContextId !== undefined ? input.pageContextId : undefined
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
    targetResult.data.browserInstanceId,
    targetResult.data.pageContextId
  )
}

function normalizeFormControlTarget (
  input: SetCheckedInput | SelectOptionsInput
): BrijioToolResult<{
    target: FillInputTarget
    browserInstanceId?: string
    pageContextId?: number
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

  if (
    input.expectedLabel !== undefined &&
    typeof input.expectedLabel !== 'string'
  ) {
    return invalidToolInputResponse(
      'expectedLabel must be a string when provided.'
    )
  }

  if (
    input.pageContextId !== undefined &&
    typeof input.pageContextId !== 'number'
  ) {
    return invalidToolInputResponse(
      'pageContextId must be a number when provided.'
    )
  }

  return {
    ok: true,
    data: {
      target: {
        formId: input.formId,
        controlId: input.controlId,
        ...(input.expectedLabel !== undefined
          ? { expectedLabel: input.expectedLabel }
          : {})
      },
      ...(browserInstanceId.data !== undefined
        ? { browserInstanceId: browserInstanceId.data }
        : {}),
      ...(input.pageContextId !== undefined
        ? { pageContextId: input.pageContextId }
        : {})
    }
  }
}

function normalizeEditableTarget (
  input: FillEditableInput
): BrijioToolResult<{
    target: EditableTarget
    browserInstanceId?: string
    pageContextId?: number
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

  if (
    input.expectedText !== undefined &&
    typeof input.expectedText !== 'string'
  ) {
    return invalidToolInputResponse(
      'expectedText must be a string when provided.'
    )
  }

  if (
    input.pageContextId !== undefined &&
    typeof input.pageContextId !== 'number'
  ) {
    return invalidToolInputResponse(
      'pageContextId must be a number when provided.'
    )
  }

  return {
    ok: true,
    data: {
      target: {
        kind: 'editable',
        id: input.id,
        ...(input.expectedText !== undefined
          ? { expectedText: input.expectedText }
          : {})
      },
      ...(browserInstanceId.data !== undefined
        ? { browserInstanceId: browserInstanceId.data }
        : {}),
      ...(input.pageContextId !== undefined
        ? { pageContextId: input.pageContextId }
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
