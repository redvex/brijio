import type {
  PageContentErrorCode,
  ActionResultErrorCode
} from './protocol.js'
import type { ContentRequest, ContentResponse } from './content-handler.js'
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

/**
 * Send a message to the content script in the active tab.
 *
 * Per ADR 0043, we try sendMessage first without re-injecting the content
 * script. If the content script is already loaded (e.g. via manifest
 * content_scripts on Safari), this avoids the duplicate-listener and
 * pageContextVersion-reset problems caused by scripting.executeScript.
 *
 * If sendMessage returns undefined (no listener), we fall back to
 * executeScript + sendMessage to inject the content script on demand
 * (e.g. for Chrome which uses programmatic injection).
 */
async function sendMessageToContentScript<T> (
  tabId: number,
  message: ContentRequest,
  deps: ActiveTabDeps
): Promise<T | null> {
  // Try sending the message directly first — if the content script is
  // already loaded, this succeeds without side effects.
  let response = await deps.tabs.sendMessage(tabId, message)

  if (isContentResponse(response)) {
    return response as T
  }

  // No listener responded (undefined) or an unexpected response was
  // received. Inject the content script and try again.
  await deps.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  })

  response = await deps.tabs.sendMessage(tabId, message)

  if (isContentResponse(response)) {
    return response as T
  }

  return null
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
    const response = await sendMessageToContentScript<ContentResponse>(activeTab.id, message, deps)

    if (response === null) {
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
    console.log('[brijio] readActiveTabPage caught error:', err)
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
    const response = await sendMessageToContentScript<ContentResponse>(activeTab.id, message, deps)

    if (response === null) {
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
    console.log('[brijio] performActiveTabAction caught error:', err)
    if (
      deps.onCatchPermissionCheck !== undefined &&
      !(await deps.onCatchPermissionCheck())
    ) {
      return actionRegularPagePermissionRequired()
    }

    return actionContentScriptUnavailable()
  }
}
