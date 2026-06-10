import type { PageContentErrorCode, ActionResultErrorCode } from './protocol.js'
import type { ContentResponse } from './content-handler.js'
import type { PageReadResult, PageActionResult } from './background-controller.js'

export function isRecord (value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isPageContentErrorCode (
  value: unknown
): value is PageContentErrorCode | ActionResultErrorCode {
  return (
    value === 'no_active_tab' ||
    value === 'unsupported_page' ||
    value === 'regular_page_permission_required' ||
    value === 'content_script_unavailable' ||
    value === 'extraction_failed' ||
    value === 'invalid_index' ||
    value === 'unsupported_request' ||
    value === 'unsupported_action' ||
    value === 'invalid_action_target' ||
    value === 'target_not_found' ||
    value === 'target_disabled' ||
    value === 'target_readonly' ||
    value === 'unsupported_control' ||
    value === 'invalid_control_value' ||
    value === 'option_not_found' ||
    value === 'target_option_disabled' ||
    value === 'action_failed' ||
    value === 'stale_context' ||
    value === 'page_navigated'
  )
}

export function isContentResponse (value: unknown): value is ContentResponse {
  if (!isRecord(value) || typeof value.ok !== 'boolean') {
    return false
  }

  if (value.ok) {
    return Object.hasOwn(value, 'data')
  }

  return (
    isRecord(value.error) &&
    isPageContentErrorCode(value.error.code) &&
    typeof value.error.message === 'string'
  )
}

export function contentScriptUnavailable<T> (): PageReadResult<T> {
  return {
    ok: false,
    error: {
      code: 'content_script_unavailable',
      message: 'Unable to reach the page content script.'
    }
  }
}

export function actionContentScriptUnavailable (): PageActionResult {
  return {
    ok: false,
    error: {
      code: 'content_script_unavailable',
      message: 'Unable to reach the page content script.'
    }
  }
}
