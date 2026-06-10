import type {
  PageContentErrorCode,
  ActionResultErrorCode
} from './protocol.js'
import type { ContentRequest } from './content-handler.js'
import type {
  ContentBatchRequest,
  BatchResult
} from './batch-handler.js'
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
  query: (queryInfo: {
    active: boolean
    currentWindow: boolean
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
  deps: ActiveTabDeps
): Promise<PageReadResult<T>> {
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

  try {
    // Per ADR 0043: call executeScript first to ensure the latest content
    // script is loaded. The content-script-entry.ts listener replacement
    // mechanism (globalThis.__brijioOnMessageListener) prevents duplicate
    // listeners when re-injecting.
    await deps.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ['content.js']
    })

    const response = await deps.tabs.sendMessage(activeTab.id, message)

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
}

// --- Shared performActiveTabAction ---

export async function performActiveTabAction (
  message: ContentRequest,
  deps: ActiveTabDeps
): Promise<PageActionResult> {
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

  try {
    // Per ADR 0043: call executeScript first to ensure the latest content
    // script is loaded. The content-script-entry.ts listener replacement
    // mechanism (globalThis.__brijioOnMessageListener) prevents duplicate
    // listeners when re-injecting.
    await deps.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ['content.js']
    })

    const response = await deps.tabs.sendMessage(activeTab.id, message)

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

export async function performActiveTabBatch (
  message: ContentBatchRequest,
  deps: ActiveTabDeps
): Promise<BatchResult> {
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

  try {
    await deps.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ['content.js']
    })

    const response = await deps.tabs.sendMessage(activeTab.id, message)

    if (isBatchResult(response)) {
      return response
    }

    // Content script returned an unexpected response type
    return {
      ...BATCH_DEFAULT_RESULT,
      results: message.actions.map(() => ({
        ok: false,
        error: { code: 'content_script_unavailable', message: 'Content script returned an unexpected response.', aborted: true }
      }))
    }
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

    return {
      ...BATCH_DEFAULT_RESULT,
      results: message.actions.map(() => ({
        ok: false,
        error: { code: 'content_script_unavailable', message: 'Content script is not available on this page.', aborted: true }
      }))
    }
  }
}
