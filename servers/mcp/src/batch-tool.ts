import { performBatch, type BrijioPageActionsConfig } from './page-actions.js'
import { type BrijioBatchResult } from './protocol.js'
import { type BrijioToolResult } from './page-reading-tool.js'
import { stageUploadFilePayload } from './form-action-tools.js'

const VALID_ACTION_TYPES = ['click', 'write_text', 'set_checked', 'select_options', 'submit_form', 'upload_file'] as const
const MAX_BATCH_ACTIONS = 20

export interface PerformBatchInput {
  actions?: unknown
  continueOnError?: unknown
  readAfterActions?: unknown
  pageContextId?: unknown
  visibleContextId?: unknown
  browserInstanceId?: unknown
}

export type PerformBatchToolResult = BrijioToolResult<BrijioBatchResult>

export async function performBatchTool (
  config: BrijioPageActionsConfig,
  input: PerformBatchInput
): Promise<PerformBatchToolResult> {
  if (!Array.isArray(input.actions)) {
    return invalidToolInputResponse('actions must be an array.')
  }

  if (input.actions.length < 1) {
    return invalidToolInputResponse('actions must contain at least one action.')
  }

  if (input.actions.length > MAX_BATCH_ACTIONS) {
    return invalidToolInputResponse(`actions must contain at most ${MAX_BATCH_ACTIONS} actions, got ${input.actions.length}.`)
  }

  const actions: Array<Record<string, unknown>> = []

  for (let i = 0; i < input.actions.length; i++) {
    const action = input.actions[i]
    if (typeof action !== 'object' || action === null || Array.isArray(action)) {
      return invalidToolInputResponse(`actions[${i}] must be an object.`)
    }

    const record = action as Record<string, unknown>
    if (typeof record.type !== 'string' || !VALID_ACTION_TYPES.includes(record.type as typeof VALID_ACTION_TYPES[number])) {
      return invalidToolInputResponse(
        `actions[${i}].type must be one of: ${VALID_ACTION_TYPES.join(', ')}. Got: ${String(record.type)}`
      )
    }

    if (record.type === 'upload_file') {
      const fileResult = stageUploadFilePayload({
        dataBase64: record.dataBase64,
        fileName: record.fileName,
        mimeType: record.mimeType
      })
      if (!fileResult.ok) {
        return invalidToolInputResponse(`actions[${i}]: ${fileResult.error.message}`)
      }

      const { dataBase64: _dataBase64, fileName: _fileName, mimeType: _mimeType, ...stagedAction } = record
      actions.push({
        ...stagedAction,
        file: fileResult.data
      })
    } else {
      actions.push(record)
    }
  }

  const browserInstanceId = normalizeBrowserInstanceId(input.browserInstanceId)
  if (!browserInstanceId.ok) {
    return browserInstanceId
  }

  if (input.continueOnError !== undefined && typeof input.continueOnError !== 'boolean') {
    return invalidToolInputResponse('continueOnError must be a boolean when provided.')
  }

  if (input.readAfterActions !== undefined && typeof input.readAfterActions !== 'boolean') {
    return invalidToolInputResponse('readAfterActions must be a boolean when provided.')
  }

  if (input.pageContextId !== undefined && typeof input.pageContextId !== 'number') {
    return invalidToolInputResponse('pageContextId must be a number when provided.')
  }

  if (input.visibleContextId !== undefined && typeof input.visibleContextId !== 'string') {
    return invalidToolInputResponse('visibleContextId must be a string when provided.')
  }

  const result = await performBatch(config, actions, {
    browserInstanceId: browserInstanceId.data,
    continueOnError: input.continueOnError,
    readAfterActions: input.readAfterActions,
    pageContextId: input.pageContextId,
    visibleContextId: input.visibleContextId
  })

  // BrijioResourceResult<BrijioBatchResult> maps directly to BrijioToolResult<BrijioBatchResult>
  return result
}

function normalizeBrowserInstanceId (
  value: unknown
): BrijioToolResult<string | undefined> {
  if (value === undefined) {
    return { ok: true, data: undefined }
  }

  if (typeof value !== 'string' || value.length === 0) {
    return invalidToolInputResponse(
      'browserInstanceId must be a non-empty string when provided.'
    )
  }

  return { ok: true, data: value }
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
