import {
  type BrijioBatchResult,
  type BrijioClickElementResult,
  type BrijioFillInputResult,
  type BrijioNavigateToUrlResult,
  type BrijioResourceResult,
  type BrijioSelectOptionsResult,
  type BrijioSetCheckedResult,
  type BrijioSubmitFormResult,
  type BrijioUploadFileResult,
  type BrijioDownloadStatusResult,
  type BrijioDownloadFileResult,
  type BrijioFetchResourceResult,
  type ClickElementTarget,
  type EditableTarget,
  type FileUploadPayload,
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
  requestPerformBatch as defaultRequestPerformBatch,
  type PerformBatchRequestOptions,
  requestSelectOptions as defaultRequestSelectOptions,
  type SelectOptionsRequestOptions,
  requestSetChecked as defaultRequestSetChecked,
  type SetCheckedRequestOptions,
  requestSubmitForm as defaultRequestSubmitForm,
  type SubmitFormRequestOptions,
  requestUploadFile as defaultRequestUploadFile,
  type UploadFileRequestOptions,
  type WriteEditableRequestOptions,
  requestWriteEditable as defaultRequestWriteEditable,
  type DownloadStatusRequestOptions,
  type DownloadFileRequestOptions,
  type FetchResourceRequestOptions,
  requestDownloadStatus as defaultRequestDownloadStatus,
  requestDownloadFile as defaultRequestDownloadFile,
  requestFetchResource as defaultRequestFetchResource
} from './websocket-client.js'

export interface BrijioPageActionsConfig {
  websocketUrl: string
  pairingToken?: string
  timeoutMs: number
  approvalTimeoutMs?: number
  defaultBrowserInstanceId?: string
  defaultTabId?: string
  requestClickElement?: (
    options: ClickElementRequestOptions,
  ) => Promise<BrijioClickElementResult>
  requestFillInput?: (
    options: FillInputRequestOptions,
  ) => Promise<BrijioFillInputResult>
  requestWriteEditable?: (
    options: WriteEditableRequestOptions,
  ) => Promise<BrijioFillInputResult>
  requestSetChecked?: (
    options: SetCheckedRequestOptions,
  ) => Promise<BrijioSetCheckedResult>
  requestSelectOptions?: (
    options: SelectOptionsRequestOptions,
  ) => Promise<BrijioSelectOptionsResult>
  requestSubmitForm?: (
    options: SubmitFormRequestOptions,
  ) => Promise<BrijioSubmitFormResult>
  requestUploadFile?: (
    options: UploadFileRequestOptions,
  ) => Promise<BrijioUploadFileResult>
  requestNavigateToUrl?: (
    options: NavigateToUrlRequestOptions,
  ) => Promise<BrijioNavigateToUrlResult>
  requestPerformBatch?: (
    options: PerformBatchRequestOptions,
  ) => Promise<BrijioResourceResult<BrijioBatchResult>>
  requestDownloadStatus?: (
    options: DownloadStatusRequestOptions,
  ) => Promise<BrijioDownloadStatusResult>
  requestDownloadFile?: (
    options: DownloadFileRequestOptions,
  ) => Promise<BrijioDownloadFileResult>
  requestFetchResource?: (
    options: FetchResourceRequestOptions,
  ) => Promise<BrijioFetchResourceResult>
}

export async function clickCurrentPageElement (
  config: BrijioPageActionsConfig,
  target: ClickElementTarget,
  browserInstanceId?: string,
  tabId?: string,
  pageContextId?: number,
  visibleContextId?: string
): Promise<BrijioClickElementResult> {
  const requestClickElement =
    config.requestClickElement ?? defaultRequestClickElement

  return await requestClickElement({
    websocketUrl: config.websocketUrl,
    pairingToken: config.pairingToken ?? '',
    timeoutMs: config.timeoutMs,
    approvalTimeoutMs: config.approvalTimeoutMs,
    browserInstanceId: browserInstanceId ?? config.defaultBrowserInstanceId,
    tabId: tabId ?? config.defaultTabId,
    target,
    pageContextId,
    visibleContextId
  })
}

export async function fillCurrentPageInput (
  config: BrijioPageActionsConfig,
  target: FillInputTarget,
  text: string,
  browserInstanceId?: string,
  tabId?: string,
  pageContextId?: number,
  visibleContextId?: string
): Promise<BrijioFillInputResult> {
  const requestFillInput = config.requestFillInput ?? defaultRequestFillInput

  return await requestFillInput({
    websocketUrl: config.websocketUrl,
    pairingToken: config.pairingToken ?? '',
    timeoutMs: config.timeoutMs,
    approvalTimeoutMs: config.approvalTimeoutMs,
    browserInstanceId: browserInstanceId ?? config.defaultBrowserInstanceId,
    tabId: tabId ?? config.defaultTabId,
    target,
    text,
    pageContextId,
    visibleContextId
  })
}

export async function fillCurrentPageEditable (
  config: BrijioPageActionsConfig,
  target: EditableTarget,
  text: string,
  browserInstanceId?: string,
  tabId?: string,
  pageContextId?: number,
  visibleContextId?: string
): Promise<BrijioFillInputResult> {
  const requestWriteEditable =
    config.requestWriteEditable ?? defaultRequestWriteEditable

  return await requestWriteEditable({
    websocketUrl: config.websocketUrl,
    pairingToken: config.pairingToken ?? '',
    timeoutMs: config.timeoutMs,
    approvalTimeoutMs: config.approvalTimeoutMs,
    browserInstanceId: browserInstanceId ?? config.defaultBrowserInstanceId,
    tabId: tabId ?? config.defaultTabId,
    target,
    text,
    pageContextId,
    visibleContextId
  })
}

export async function setCurrentPageChecked (
  config: BrijioPageActionsConfig,
  target: FillInputTarget,
  checked: boolean,
  browserInstanceId?: string,
  tabId?: string,
  pageContextId?: number,
  visibleContextId?: string
): Promise<BrijioSetCheckedResult> {
  const requestSetChecked =
    config.requestSetChecked ?? defaultRequestSetChecked

  return await requestSetChecked({
    websocketUrl: config.websocketUrl,
    pairingToken: config.pairingToken ?? '',
    timeoutMs: config.timeoutMs,
    approvalTimeoutMs: config.approvalTimeoutMs,
    browserInstanceId: browserInstanceId ?? config.defaultBrowserInstanceId,
    tabId: tabId ?? config.defaultTabId,
    target,
    checked,
    pageContextId,
    visibleContextId
  })
}

export async function selectCurrentPageOptions (
  config: BrijioPageActionsConfig,
  target: FillInputTarget,
  values: string[],
  browserInstanceId?: string,
  tabId?: string,
  pageContextId?: number,
  visibleContextId?: string
): Promise<BrijioSelectOptionsResult> {
  const requestSelectOptions =
    config.requestSelectOptions ?? defaultRequestSelectOptions

  return await requestSelectOptions({
    websocketUrl: config.websocketUrl,
    pairingToken: config.pairingToken ?? '',
    timeoutMs: config.timeoutMs,
    approvalTimeoutMs: config.approvalTimeoutMs,
    browserInstanceId: browserInstanceId ?? config.defaultBrowserInstanceId,
    tabId: tabId ?? config.defaultTabId,
    target,
    values,
    pageContextId,
    visibleContextId
  })
}

export async function submitCurrentPageForm (
  config: BrijioPageActionsConfig,
  target: SubmitFormTarget,
  browserInstanceId?: string,
  tabId?: string,
  pageContextId?: number,
  visibleContextId?: string
): Promise<BrijioSubmitFormResult> {
  const requestSubmitForm =
    config.requestSubmitForm ?? defaultRequestSubmitForm

  return await requestSubmitForm({
    websocketUrl: config.websocketUrl,
    pairingToken: config.pairingToken ?? '',
    timeoutMs: config.timeoutMs,
    approvalTimeoutMs: config.approvalTimeoutMs,
    browserInstanceId: browserInstanceId ?? config.defaultBrowserInstanceId,
    tabId: tabId ?? config.defaultTabId,
    target,
    pageContextId,
    visibleContextId
  })
}

export async function uploadCurrentPageFile (
  config: BrijioPageActionsConfig,
  target: FillInputTarget,
  file: FileUploadPayload,
  browserInstanceId?: string,
  tabId?: string,
  pageContextId?: number,
  visibleContextId?: string
): Promise<BrijioUploadFileResult> {
  const requestUploadFile =
    config.requestUploadFile ?? defaultRequestUploadFile

  return await requestUploadFile({
    websocketUrl: config.websocketUrl,
    pairingToken: config.pairingToken ?? '',
    timeoutMs: config.timeoutMs,
    approvalTimeoutMs: config.approvalTimeoutMs,
    browserInstanceId: browserInstanceId ?? config.defaultBrowserInstanceId,
    tabId: tabId ?? config.defaultTabId,
    target,
    file,
    pageContextId,
    visibleContextId
  })
}

export async function navigateToCurrentPageUrl (
  config: BrijioPageActionsConfig,
  url: string,
  browserInstanceId?: string,
  tabId?: string
): Promise<BrijioNavigateToUrlResult> {
  const requestNavigateToUrl =
    config.requestNavigateToUrl ?? defaultRequestNavigateToUrl

  return await requestNavigateToUrl({
    websocketUrl: config.websocketUrl,
    pairingToken: config.pairingToken ?? '',
    timeoutMs: config.timeoutMs,
    approvalTimeoutMs: config.approvalTimeoutMs,
    browserInstanceId: browserInstanceId ?? config.defaultBrowserInstanceId,
    tabId: tabId ?? config.defaultTabId,
    url
  })
}

export async function performBatch (
  config: BrijioPageActionsConfig,
  actions: Array<Record<string, unknown>>,
  options?: {
    browserInstanceId?: string
    tabId?: string
    continueOnError?: boolean
    readAfterActions?: boolean
    pageContextId?: number
    visibleContextId?: string
  }
): Promise<BrijioResourceResult<BrijioBatchResult>> {
  const requestPerformBatch =
    config.requestPerformBatch ?? defaultRequestPerformBatch

  return await requestPerformBatch({
    websocketUrl: config.websocketUrl,
    pairingToken: config.pairingToken ?? '',
    timeoutMs: config.timeoutMs,
    approvalTimeoutMs: config.approvalTimeoutMs,
    browserInstanceId:
      options?.browserInstanceId ?? config.defaultBrowserInstanceId,
    tabId: options?.tabId ?? config.defaultTabId,
    actions,
    continueOnError: options?.continueOnError,
    readAfterActions: options?.readAfterActions,
    pageContextId: options?.pageContextId,
    visibleContextId: options?.visibleContextId
  })
}

export async function getDownloadStatus (
  config: BrijioPageActionsConfig,
  ids?: Array<number | string>,
  browserInstanceId?: string,
  tabId?: string
): Promise<BrijioDownloadStatusResult> {
  const requestDownloadStatus =
    config.requestDownloadStatus ?? defaultRequestDownloadStatus

  return await requestDownloadStatus({
    websocketUrl: config.websocketUrl,
    pairingToken: config.pairingToken ?? '',
    timeoutMs: config.timeoutMs,
    approvalTimeoutMs: config.approvalTimeoutMs,
    browserInstanceId: browserInstanceId ?? config.defaultBrowserInstanceId,
    tabId: tabId ?? config.defaultTabId,
    ids
  })
}

export async function downloadFile (
  config: BrijioPageActionsConfig,
  url: string,
  filename?: string,
  conflictAction?: 'uniquify' | 'overwrite',
  browserInstanceId?: string,
  tabId?: string
): Promise<BrijioDownloadFileResult> {
  const requestDownloadFile =
    config.requestDownloadFile ?? defaultRequestDownloadFile

  return await requestDownloadFile({
    websocketUrl: config.websocketUrl,
    pairingToken: config.pairingToken ?? '',
    timeoutMs: config.timeoutMs,
    approvalTimeoutMs: config.approvalTimeoutMs,
    browserInstanceId: browserInstanceId ?? config.defaultBrowserInstanceId,
    tabId: tabId ?? config.defaultTabId,
    url,
    filename,
    conflictAction
  })
}

export async function fetchResource (
  config: BrijioPageActionsConfig,
  url: string,
  maxSizeBytes?: number,
  fetchTimeout?: number,
  browserInstanceId?: string,
  tabId?: string
): Promise<BrijioFetchResourceResult> {
  const requestFetchResource =
    config.requestFetchResource ?? defaultRequestFetchResource

  return await requestFetchResource({
    websocketUrl: config.websocketUrl,
    pairingToken: config.pairingToken ?? '',
    timeoutMs: config.timeoutMs,
    approvalTimeoutMs: config.approvalTimeoutMs,
    browserInstanceId: browserInstanceId ?? config.defaultBrowserInstanceId,
    tabId: tabId ?? config.defaultTabId,
    url,
    maxSizeBytes,
    fetchTimeout
  })
}
