/**
 * Batch execution engine for ADR 0044.
 *
 * Executes an array of actions sequentially in the content script,
 * with support for:
 * - Page navigation detection (abort remaining actions)
 * - continueOnError (mark failed, continue vs abort)
 * - readAfterActions (append fresh page context as final entry)
 */

import {
  type BatchAction,
  type BatchActionError,
  type BatchActionOutcome,
  type BatchResultEntry,
  type ActionResultData,
  type WriteTextActionResultData,
  type SetCheckedActionResultData,
  type SelectOptionsActionResultData,
  type SubmitFormActionResultData,
  type PageContext
} from './protocol.js'
import { handleContentRequest, type ContentEnvironment, type ContentRequest } from './content-handler.js'

export interface BatchRequest {
  actions: BatchAction[]
  continueOnError?: boolean
  readAfterActions?: boolean
}

export interface BatchResult {
  ok: boolean
  results: BatchResultEntry[]
}

type ActionData = ActionResultData | WriteTextActionResultData | SetCheckedActionResultData | SelectOptionsActionResultData | SubmitFormActionResultData

/**
 * Convert a BatchAction (from protocol) to a ContentRequest (for content-handler).
 */
export function batchActionToContentRequest (action: BatchAction): ContentRequest {
  switch (action.type) {
    case 'click':
      return { type: 'perform_click', target: action.target }
    case 'write_text':
      return { type: 'perform_write_text', target: action.target, text: action.text }
    case 'set_checked':
      return { type: 'perform_set_checked', target: action.target, checked: action.checked }
    case 'select_options':
      return { type: 'perform_select_options', target: action.target, values: action.values }
    case 'submit_form':
      return { type: 'perform_submit_form', target: { formId: action.target.formId } }
  }
}

/**
 * Execute a batch of actions sequentially.
 *
 * After each action, checks if the page URL has changed (navigation detection).
 * If navigation is detected, remaining actions are aborted with `page_navigated`.
 *
 * When `continueOnError` is false (default), any element-level error aborts remaining actions.
 * When `continueOnError` is true, element-level errors mark the action as failed but execution continues.
 *
 * `page_navigated` ALWAYS aborts remaining actions regardless of `continueOnError`.
 */
export function executeBatch (
  request: BatchRequest,
  environment: ContentEnvironment
): BatchResult {
  const results: BatchResultEntry[] = []
  const continueOnError = request.continueOnError === true
  const urlBeforeBatch = environment.locationHref
  let aborted = false

  for (let i = 0; i < request.actions.length; i++) {
    // If a previous action caused abort (page_navigated or non-continue error), skip
    if (aborted) {
      results.push({
        ok: false,
        error: {
          code: 'page_navigated' as const,
          message: 'Action skipped: a previous action caused a page navigation or abort.',
          aborted: true
        }
      })
      continue
    }

    const action = request.actions[i]
    const contentRequest = batchActionToContentRequest(action)
    const response = handleContentRequest(contentRequest, environment)

    if (response.ok) {
      // Action data for actions is always one of the action result types
      results.push({ ok: true, data: response.data as ActionData })

      // After each action, check for page navigation
      if (environment.locationHref !== urlBeforeBatch) {
        // Page navigated — always abort remaining actions
        aborted = true
      }
    } else {
      // Action failed — determine if we should abort or continue
      const actionError: BatchActionError = {
        code: response.error.code as BatchActionError['code'],
        message: response.error.message,
        aborted: false
      }

      if (response.error.detail !== undefined) {
        actionError.detail = response.error.detail
      }

      results.push({ ok: false, error: actionError })

      // Check for page navigation even after failure
      if (environment.locationHref !== urlBeforeBatch) {
        aborted = true
      } else if (!continueOnError) {
        // Default: abort on any error
        aborted = true
      }
      // When continueOnError is true and no navigation, we continue to next action
    }
  }

  // If readAfterActions is requested, append a fresh page context read
  if (request.readAfterActions) {
    const readResponse = handleContentRequest(
      {
        type: 'extract_page_context',
        previewMaxBytes: 4096,
        defaultMaxPayloadBytes: 131072
      },
      environment
    )

    if (readResponse.ok) {
      // Read result data is always PageContext for extract_page_context
      results.push({ ok: true, data: readResponse.data as PageContext })
    } else {
      results.push({
        ok: false,
        error: {
          code: readResponse.error.code as string as BatchActionError['code'],
          message: readResponse.error.message,
          aborted: false
        }
      })
    }
  }

  const allOk = results.every(entry => entry.ok)

  return {
    ok: allOk,
    results
  }
}