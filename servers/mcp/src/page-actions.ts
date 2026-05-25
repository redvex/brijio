import {
  type BrowserBridgeClickElementResult,
  type BrowserBridgeFillInputResult,
  type BrowserBridgeSelectOptionsResult,
  type BrowserBridgeSetCheckedResult,
  type BrowserBridgeSubmitFormResult,
  type ClickElementTarget,
  type EditableTarget,
  type FillInputTarget
} from './protocol.js'
import {
  requestClickElement as defaultRequestClickElement,
  type ClickElementRequestOptions,
  requestFillInput as defaultRequestFillInput,
  type FillInputRequestOptions,
  requestSelectOptions as defaultRequestSelectOptions,
  type SelectOptionsRequestOptions,
  requestSetChecked as defaultRequestSetChecked,
  type SetCheckedRequestOptions,
  requestSubmitForm as defaultRequestSubmitForm,
  type SubmitFormRequestOptions,
  requestWriteEditable as defaultRequestWriteEditable,
  type WriteEditableRequestOptions
} from './websocket-client.js'

export interface BrowserBridgePageActionsConfig {
  websocketUrl: string
  timeoutMs: number
  requestClickElement?: (
    options: ClickElementRequestOptions
  ) => Promise<BrowserBridgeClickElementResult>
  requestFillInput?: (
    options: FillInputRequestOptions
  ) => Promise<BrowserBridgeFillInputResult>
  requestWriteEditable?: (
    options: WriteEditableRequestOptions
  ) => Promise<BrowserBridgeFillInputResult>
  requestSetChecked?: (
    options: SetCheckedRequestOptions
  ) => Promise<BrowserBridgeSetCheckedResult>
  requestSelectOptions?: (
    options: SelectOptionsRequestOptions
  ) => Promise<BrowserBridgeSelectOptionsResult>
  requestSubmitForm?: (
    options: SubmitFormRequestOptions
  ) => Promise<BrowserBridgeSubmitFormResult>
}

export async function clickCurrentPageElement (
  config: BrowserBridgePageActionsConfig,
  target: ClickElementTarget
): Promise<BrowserBridgeClickElementResult> {
  const requestClickElement =
    config.requestClickElement ?? defaultRequestClickElement

  return await requestClickElement({
    websocketUrl: config.websocketUrl,
    timeoutMs: config.timeoutMs,
    target
  })
}

export async function fillCurrentPageInput (
  config: BrowserBridgePageActionsConfig,
  target: FillInputTarget,
  text: string
): Promise<BrowserBridgeFillInputResult> {
  const requestFillInput = config.requestFillInput ?? defaultRequestFillInput

  return await requestFillInput({
    websocketUrl: config.websocketUrl,
    timeoutMs: config.timeoutMs,
    target,
    text
  })
}

export async function fillCurrentPageEditable (
  config: BrowserBridgePageActionsConfig,
  target: EditableTarget,
  text: string
): Promise<BrowserBridgeFillInputResult> {
  const requestWriteEditable =
    config.requestWriteEditable ?? defaultRequestWriteEditable

  return await requestWriteEditable({
    websocketUrl: config.websocketUrl,
    timeoutMs: config.timeoutMs,
    target,
    text
  })
}

export async function setCurrentPageChecked (
  config: BrowserBridgePageActionsConfig,
  target: FillInputTarget,
  checked: boolean
): Promise<BrowserBridgeSetCheckedResult> {
  const requestSetChecked =
    config.requestSetChecked ?? defaultRequestSetChecked

  return await requestSetChecked({
    websocketUrl: config.websocketUrl,
    timeoutMs: config.timeoutMs,
    target,
    checked
  })
}

export async function selectCurrentPageOptions (
  config: BrowserBridgePageActionsConfig,
  target: FillInputTarget,
  values: string[]
): Promise<BrowserBridgeSelectOptionsResult> {
  const requestSelectOptions =
    config.requestSelectOptions ?? defaultRequestSelectOptions

  return await requestSelectOptions({
    websocketUrl: config.websocketUrl,
    timeoutMs: config.timeoutMs,
    target,
    values
  })
}

export async function submitCurrentPageForm (
  config: BrowserBridgePageActionsConfig,
  formId: string
): Promise<BrowserBridgeSubmitFormResult> {
  const requestSubmitForm =
    config.requestSubmitForm ?? defaultRequestSubmitForm

  return await requestSubmitForm({
    websocketUrl: config.websocketUrl,
    timeoutMs: config.timeoutMs,
    target: {
      formId
    }
  })
}
