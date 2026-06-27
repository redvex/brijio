import type {
  PageContentErrorCode,
  ActionResultErrorCode,
  ActionResultData,
  WriteTextActionResultData,
  SetCheckedActionResultData,
  SelectOptionsActionResultData,
  SubmitFormActionResultData,
  PageContext
} from './protocol.js'
import type { ContentRequest } from './content-handler.js'
import type {
  ContentBatchRequest,
  BatchResult
} from './batch-handler.js'
import { batchActionToContentRequest } from './batch-handler.js'
import type {
  PageReadResult,
  PageActionResult
} from './background-controller.js'
import {
  isContentResponse,
  contentScriptUnavailable,
  actionContentScriptUnavailable
} from './content-helpers.js'

// --- Browser API adapter interfaces ---

export interface TabHandle {
  id?: number
  url?: string
}

export interface TabsApi {
  query: (queryInfo?: {
    active?: boolean
    currentWindow?: boolean
  }) => Promise<TabHandle[]>
  sendMessage: (tabId: number, message: unknown) => Promise<unknown>
}

export interface ScriptingApi {
  executeScript: (details: {
    target: { tabId: number }
    files: string[]
  }) => Promise<unknown>
}

export type PermissionCheck = () => Promise<boolean>

export interface ActiveTabDeps {
  tabs: TabsApi
  scripting: ScriptingApi
  isRegularPageUrl: (url: string) => boolean
  onCatchPermissionCheck?: PermissionCheck
  contentScriptMessageTimeoutMs?: number
}

const DEFAULT_CONTENT_SCRIPT_MESSAGE_TIMEOUT_MS = 4000

class ContentScriptMessageTimeoutError extends Error {
  constructor () {
    super('Content script message timed out.')
    this.name = 'ContentScriptMessageTimeoutError'
  }
}

async function sendMessageWithTimeout (
  deps: ActiveTabDeps,
  tabId: number,
  message: unknown
): Promise<unknown> {
  const timeoutMs = deps.contentScriptMessageTimeoutMs ?? DEFAULT_CONTENT_SCRIPT_MESSAGE_TIMEOUT_MS

  return await new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ContentScriptMessageTimeoutError())
    }, timeoutMs)

    deps.tabs.sendMessage(tabId, message).then(
      (response) => {
        clearTimeout(timer)
        resolve(response)
      },
      (reason) => {
        clearTimeout(timer)
        reject(reason)
      }
    )
  })
}

// --- Error factories ---

export function regularPagePermissionRequired<T> (): PageReadResult<T> {
  return {
    ok: false,
    error: {
      code: 'regular_page_permission_required' as PageContentErrorCode,
      message:
        'Regular page access is not enabled. Open Brijio setup and enable regular page access.'
    }
  }
}

export function actionRegularPagePermissionRequired (): PageActionResult {
  return {
    ok: false,
    error: {
      code: 'regular_page_permission_required' as ActionResultErrorCode,
      message:
        'Regular page access is not enabled. Open Brijio setup and enable regular page access.'
    }
  }
}

// --- Shared readActiveTabPage ---

export async function readActiveTabPage<T> (
  message: ContentRequest,
  deps: ActiveTabDeps,
  tabId?: number
): Promise<PageReadResult<T>> {
  let resolvedTabId: number

  if (tabId !== undefined) {
    resolvedTabId = tabId
  } else {
    const [activeTab] = await deps.tabs.query({
      active: true,
      currentWindow: true
    })

    if (activeTab?.id === undefined || activeTab.url === undefined) {
      return {
        ok: false,
        error: {
          code: 'no_active_tab',
          message: 'No active tab with a URL is available.'
        }
      }
    }

    if (!deps.isRegularPageUrl(activeTab.url)) {
      return {
        ok: false,
        error: {
          code: 'unsupported_page',
          message:
            'Brijio can read page content only from HTTP and HTTPS tabs.'
        }
      }
    }

    resolvedTabId = activeTab.id
  }

  try {
    // Per ADR 0043: call executeScript first to ensure the latest content
    // script is loaded. The content-script-entry.ts listener replacement
    // mechanism (globalThis.__brijioOnMessageListener) prevents duplicate
    // listeners when re-injecting.
    await deps.scripting.executeScript({
      target: { tabId: resolvedTabId },
      files: ['content.js']
    })

    await deps.tabs.sendMessage(resolvedTabId, { type: 'show_brijio_tab_indicator' }).catch(
      () => {}
    )

    const response = await deps.tabs.sendMessage(resolvedTabId, message)

    if (!isContentResponse(response)) {
      return contentScriptUnavailable<T>()
    }

    if (response.ok) {
      return {
        ok: true,
        data: response.data as T
      }
    }

    return {
      ok: false,
      error: {
        code: response.error.code as PageContentErrorCode,
        message: response.error.message
      }
    }
  } catch (err) {
    if (
      deps.onCatchPermissionCheck !== undefined &&
      !(await deps.onCatchPermissionCheck())
    ) {
      return regularPagePermissionRequired<T>()
    }

    return contentScriptUnavailable<T>()
}

// --- Shared performActiveTabAction ---

export async function performActiveTabAction (
  message: ContentRequest,
  deps: ActiveTabDeps,
  tabId?: number
): Promise<PageActionResult> {
  let resolvedTabId: number

  if (tabId !== undefined) {
    resolvedTabId = tabId
  } else {
    const [activeTab] = await deps.tabs.query({
      active: true,
      currentWindow: true
    })

    if (activeTab?.id === undefined || activeTab.url === undefined) {
      return {
        ok: false,
        error: {
          code: 'no_active_tab',
          message: 'No active tab with a URL is available.'
        }
      }
    }

    if (!deps.isRegularPageUrl(activeTab.url)) {
      return {
        ok: false,
        error: {
          code: 'unsupported_page',
          message:
            'Brijio can perform actions only on HTTP and HTTPS tabs.'
        }
      }
    }

    resolvedTabId = activeTab.id
  }

  try {
    // Per ADR 0043: call executeScript first to ensure the latest content
    // script is loaded. The content-script-entry.ts listener replacement
    // mechanism (globalThis.__brijioOnMessageListener) prevents duplicate
    // listeners when re-injecting.
    await deps.scripting.executeScript({
      target: { tabId: resolvedTabId },
      files: ['content.js']
    })

    await deps.tabs.sendMessage(resolvedTabId, { type: 'show_brijio_tab_indicator' }).catch(
      () => {}
    )

    const response = await deps.tabs.sendMessage(resolvedTabId, message)

    if (!isContentResponse(response)) {
      return actionContentScriptUnavailable()
    }

    if (response.ok) {
      return {
        ok: true,
        data: response.data as PageActionResult extends {
          ok: true
          data: infer T
        }
          ? T
          : never
      }
    }

    return {
      ok: false,
      error: {
        code: response.error.code as ActionResultErrorCode,
        message: response.error.message
      }
    }
  } catch (err) {
    if (
      deps.onCatchPermissionCheck !== undefined &&
      !(await deps.onCatchPermissionCheck())
    ) {
      return actionRegularPagePermissionRequired()
    }

    return actionContentScriptUnavailable()
}

// --- Shared performActiveTabBatch ---

const BATCH_DEFAULT_RESULT: BatchResult = {
  ok: false,
  results: [],
  aborted: false
}

function isBatchResult (value: unknown): value is BatchResult {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return typeof obj.ok === 'boolean' && Array.isArray(obj.results)
}

type BatchActionSuccessData =
  | ActionResultData
  | WriteTextActionResultData
  | SetCheckedActionResultData
  | SelectOptionsActionResultData
  | SubmitFormActionResultData

function batchUnavailableResult (
  message: ContentBatchRequest,
  errorMessage: string
): BatchResult {
  return {
    ...BATCH_DEFAULT_RESULT,
    results: message.actions.map(() => ({
      ok: false,
      error: {
        code: 'content_script_unavailable',
        message: errorMessage,
        aborted: true
      }
    }))
  }
}

async function performActiveTabBatchViaSingleActions (
  message: ContentBatchRequest,
  deps: ActiveTabDeps,
  tabId: number
): Promise<BatchResult> {
  const results: BatchResult['results'] = []
  const continueOnError = message.continueOnError === true
  let aborted = false

  for (const action of message.actions) {
    if (aborted) {
      results.push({
        ok: false,
        error: {
          code: 'page_navigated',
          message: 'Action skipped: a previous action caused a page navigation or abort.',
          aborted: true
        }
      })
      continue
    }

    try {
      const contentRequest: ContentRequest = batchActionToContentRequest(
        action,
        message.pageContextId
      )
      const response = await sendMessageWithTimeout(deps, tabId, contentRequest)

      if (!isContentResponse(response)) {
        results.push({
          ok: false,
          error: {
            code: 'content_script_unavailable',
            message: 'Content script returned an unexpected response.',
            aborted: true
          }
        })
        aborted = true
        continue
      }

      if (response.ok) {
        const entry: {
          ok: true
          data: BatchActionSuccessData
        } = {
          ok: true,
          data: response.data as BatchActionSuccessData
        }
        results.push(entry)
        continue
      }

      const errorCode = response.error.code as ActionResultErrorCode

      results.push({
        ok: false,
        error: {
          code: errorCode,
          message: response.error.message,
          ...(response.error.detail !== undefined
            ? { detail: response.error.detail }
            : {}),
          aborted: false
        }
      })

      if (String(response.error.code) === 'page_navigated' || !continueOnError) {
        aborted = true
      }
    } catch {
      results.push({
        ok: false,
        error: {
          code: 'content_script_unavailable',
          message: 'Content script is not available on this page.',
          aborted: true
        }
      })
      aborted = true
    }
  }

  if (message.readAfterActions === true) {
    try {
      const response = await sendMessageWithTimeout(deps, tabId, {
        type: 'extract_page_context',
        previewMaxBytes: 4096,
        defaultMaxPayloadBytes: 131072
      })
      const contentResponse = isContentResponse(response) ? response : undefined

      if (contentResponse === undefined) {
        results.push({
          ok: false,
          error: {
            code: 'content_script_unavailable',
            message: 'Content script returned an unexpected response.',
            aborted: false
          }
        })
      } else if (contentResponse.ok) {
        const entry: {
          ok: true
          data: PageContext
        } = {
          ok: true,
          data: contentResponse.data as PageContext
        }
        results.push(entry)
      } else {
        results.push({
          ok: false,
          error: {
            code: contentResponse.error.code as ActionResultErrorCode,
            message: contentResponse.error.message,
            ...(contentResponse.error.detail !== undefined
              ? { detail: contentResponse.error.detail }
              : {}),
            aborted: false
          }
        })
      }
    } catch {
      results.push({
        ok: false,
        error: {
          code: 'content_script_unavailable',
          message: 'Content script is not available on this page.',
          aborted: false
        }
      })
    }
  }

  return {
    ok: results.every(entry => entry.ok),
    results,
    aborted
  }
}

export async function performActiveTabBatch (
  message: ContentBatchRequest,
  deps: ActiveTabDeps,
  tabId?: number
): Promise<BatchResult> {
  let resolvedTabId: number

  if (tabId !== undefined) {
    resolvedTabId = tabId
  } else {
    const [activeTab] = await deps.tabs.query({
      active: true,
      currentWindow: true
    })

    if (activeTab?.id === undefined || activeTab.url === undefined) {
      return {
        ...BATCH_DEFAULT_RESULT,
        results: message.actions.map(() => ({
          ok: false,
          error: { code: 'no_active_tab', message: 'No active tab with a URL is available.', aborted: true }
        }))
      }
    }

    if (!deps.isRegularPageUrl(activeTab.url)) {
      return {
        ...BATCH_DEFAULT_RESULT,
        results: message.actions.map(() => ({
          ok: false,
          error: { code: 'unsupported_page', message: 'Brijio can perform actions only on HTTP and HTTPS tabs.', aborted: true }
        }))
      }
    }

    resolvedTabId = activeTab.id
  }

  try {
    await deps.scripting.executeScript({
      target: { tabId: resolvedTabId },
      files: ['content.js']
    })

    await deps.tabs.sendMessage(resolvedTabId, { type: 'show_brijio_tab_indicator' }).catch(
      () => {}
    )

    const response = await sendMessageWithTimeout(deps, resolvedTabId, message)

    if (isBatchResult(response)) {
      return response
    }

    // Content script returned an unexpected response type. Fall back to the
    // already-supported single-action path so older Chrome content scripts can
    // still execute the batch semantics instead of failing the whole request.
    return await performActiveTabBatchViaSingleActions(
      message,
      deps,
      resolvedTabId
    )
  } catch {
    if (
      deps.onCatchPermissionCheck !== undefined &&
      !(await deps.onCatchPermissionCheck())
    ) {
      return {
        ...BATCH_DEFAULT_RESULT,
        results: message.actions.map(() => ({
          ok: false,
          error: { code: 'regular_page_permission_required', message: 'Permission required to access this page.', aborted: true }
        }))
      }
    }

    const fallbackResult = await performActiveTabBatchViaSingleActions(
      message,
      deps,
      resolvedTabId
    )

    if (fallbackResult.results.some(entry => entry.ok)) {
      return fallbackResult
    }

    return batchUnavailableResult(
      message,
      'Content script is not available on this page.'
    )
}
