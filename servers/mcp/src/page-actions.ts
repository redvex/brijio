import {
  type BrijioClickElementResult,
  type BrijioFillInputResult,
  type BrijioNavigateToUrlResult,
  type BrijioSelectOptionsResult,
  type BrijioSetCheckedResult,
  type BrijioSubmitFormResult,
  type ClickElementTarget,
  type EditableTarget,
  type FillInputTarget,
  type SubmitFormTarget
} from './protocol.js'
import {
  requestClickElement as defaultRequestClickElement,
  type ClickElementRequestOptions,
  requestFillInput as defaultRequestFillInput,
  type FillInputRequestOptions,
  requestNavigateToUrl as defaultRequestNavigateToUrl,
  type NavigateToUrlRequestOptions,
  requestSelectOptions as defaultRequestSelectOptions,
  type SelectOptionsRequestOptions,
  requestSetChecked as defaultRequestSetChecked,
  type SetCheckedRequestOptions,
  requestSubmitForm as defaultRequestSubmitForm,
  type SubmitFormRequestOptions,
  requestWriteEditable as defaultRequestWriteEditable,
  type WriteEditableRequestOptions
} from './websocket-client.js'

export interface BrijioPageActionsConfig {
  websocketUrl: string
  pairingToken?: string
  timeoutMs: number
  defaultBrowserInstanceId?: string
  requestClickElement?: (
    options: ClickElementRequestOptions
  ) => Promise<BrijioClickElementResult>
  requestFillInput?: (
    options: FillInputRequestOptions
  ) => Promise<BrijioFillInputResult>
  requestWriteEditable?: (
    options: WriteEditableRequestOptions
  ) => Promise<BrijioFillInputResult>
  requestSetChecked?: (
    options: SetCheckedRequestOptions
  ) => Promise<BrijioSetCheckedResult>
  requestSelectOptions?: (
    options: SelectOptionsRequestOptions
  ) => Promise<BrijioSelectOptionsResult>
  requestSubmitForm?: (
    options: SubmitFormRequestOptions
  ) => Promise<BrijioSubmitFormResult>
  requestNavigateToUrl?: (
    options: NavigateToUrlRequestOptions
  ) => Promise<BrijioNavigateToUrlResult>
}

export async function clickCurrentPageElement (
  config: BrijioPageActionsConfig,
  target: ClickElementTarget,
  browserInstanceId?: string,
  pageContextId?: number
): Promise<BrijioClickElementResult> {
  const requestClickElement =
    config.requestClickElement ?? defaultRequestClickElement

  return await requestClickElement({
    websocketUrl: config.websocketUrl,
    pairingToken: config.pairingToken ?? '',
    timeoutMs: config.timeoutMs,
    browserInstanceId: browserInstanceId ?? config.defaultBrowserInstanceId,
    target,
    pageContextId
  })
}

export async function fillCurrentPageInput (
  config: BrijioPageActionsConfig,
  target: FillInputTarget,
  text: string,
  browserInstanceId?: string,
  pageContextId?: number
): Promise<BrijioFillInputResult> {
  const requestFillInput = config.requestFillInput ?? defaultRequestFillInput

  return await requestFillInput({
    websocketUrl: config.websocketUrl,
    pairingToken: config.pairingToken ?? '',
    timeoutMs: config.timeoutMs,
    browserInstanceId: browserInstanceId ?? config.defaultBrowserInstanceId,
    target,
    text,
    pageContextId
  })
}

export async function fillCurrentPageEditable (
  config: BrijioPageActionsConfig,
  target: EditableTarget,
  text: string,
  browserInstanceId?: string,
  pageContextId?: number
): Promise<BrijioFillInputResult> {
  const requestWriteEditable =
    config.requestWriteEditable ?? defaultRequestWriteEditable

  return await requestWriteEditable({
    websocketUrl: config.websocketUrl,
    pairingToken: config.pairingToken ?? '',
    timeoutMs: config.timeoutMs,
    browserInstanceId: browserInstanceId ?? config.defaultBrowserInstanceId,
    target,
    text,
    pageContextId
  })
}

export async function setCurrentPageChecked (
  config: BrijioPageActionsConfig,
  target: FillInputTarget,
  checked: boolean,
  browserInstanceId?: string,
  pageContextId?: number
): Promise<BrijioSetCheckedResult> {
  const requestSetChecked =
    config.requestSetChecked ?? defaultRequestSetChecked

  return await requestSetChecked({
    websocketUrl: config.websocketUrl,
    pairingToken: config.pairingToken ?? '',
    timeoutMs: config.timeoutMs,
    browserInstanceId: browserInstanceId ?? config.defaultBrowserInstanceId,
    target,
    checked,
    pageContextId
  })
}

export async function selectCurrentPageOptions (
  config: BrijioPageActionsConfig,
  target: FillInputTarget,
  values: string[],
  browserInstanceId?: string,
  pageContextId?: number
): Promise<BrijioSelectOptionsResult> {
  const requestSelectOptions =
    config.requestSelectOptions ?? defaultRequestSelectOptions

  return await requestSelectOptions({
    websocketUrl: config.websocketUrl,
    pairingToken: config.pairingToken ?? '',
    timeoutMs: config.timeoutMs,
    browserInstanceId: browserInstanceId ?? config.defaultBrowserInstanceId,
    target,
    values,
    pageContextId
  })
}

export async function submitCurrentPageForm (
  config: BrijioPageActionsConfig,
  target: SubmitFormTarget,
  browserInstanceId?: string,
  pageContextId?: number
): Promise<BrijioSubmitFormResult> {
  const requestSubmitForm =
    config.requestSubmitForm ?? defaultRequestSubmitForm

  return await requestSubmitForm({
    websocketUrl: config.websocketUrl,
    pairingToken: config.pairingToken ?? '',
    timeoutMs: config.timeoutMs,
    browserInstanceId: browserInstanceId ?? config.defaultBrowserInstanceId,
    target,
    pageContextId
  })
}

export async function navigateToCurrentPageUrl (
  config: BrijioPageActionsConfig,
  url: string,
  browserInstanceId?: string
): Promise<BrijioNavigateToUrlResult> {
  const requestNavigateToUrl =
    config.requestNavigateToUrl ?? defaultRequestNavigateToUrl

  return await requestNavigateToUrl({
    websocketUrl: config.websocketUrl,
    pairingToken: config.pairingToken ?? '',
    timeoutMs: config.timeoutMs,
    browserInstanceId: browserInstanceId ?? config.defaultBrowserInstanceId,
    url
  })
}
