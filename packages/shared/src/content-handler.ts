import {
  type ActionResultData,
  type ActionResultErrorCode,
  type ClickActionTarget,
  type FormControlTarget,
  type FormValidationError,
  type EditableActionTarget,
  type FormSubmitTarget,
  type PageContent,
  type PageContentErrorCode,
  type PageContext,
  type SelectOptionsActionResultData,
  type SetCheckedActionResultData,
  type StaleContextDetail,
  type SubmitFormActionResultData,
  type UploadFileActionResultData,
  type FileUploadPayload,
  type WriteTextActionResultData
} from './protocol.js'

import {
  extractPageContent,
  extractPageContext,
  ACTION_SELECTORS,
  computeVisibleContextId,
  computeVisibleFormStructureId
} from './page-context.js'
import { chunkReadableContent } from './page-content.js'

/** Content script version — incremented when ACTION_SELECTORS or response shape changes. */
export const CONTENT_SCRIPT_VERSION = 2

/** Module-scoped page context version; incremented on navigation (pageshow). */
let pageContextVersion = 1

/**
 * Register a pageshow listener to increment pageContextVersion on navigation.
 * Per ADR 0043: stores the listener on globalThis so re-injection can replace
 * the previous one instead of accumulating duplicates.
 */
export function registerPageNavigationListener (): void {
  if (typeof window === 'undefined') {
    return
  }

  const globalRef = globalThis as Record<string, unknown>

  const onPageShow = (): void => {
    pageContextVersion++
  }

  // Remove the previous injection's pageshow listener if it exists
  const previousListener = globalRef.__brijioPageShowListener as
    | (() => void)
    | undefined
  if (previousListener !== undefined) {
    window.removeEventListener('pageshow', previousListener)
  }

  window.addEventListener('pageshow', onPageShow)
  // Store reference so the next injection can remove this one
  globalRef.__brijioPageShowListener = onPageShow
}

/** Get the current pageContextVersion (for testing and embedding in responses). */
export function getPageContextVersion (): number {
  return pageContextVersion
}

/** Reset pageContextVersion (for testing only). */
export function resetPageContextVersion (value = 1): void {
  pageContextVersion = value
}

export type ContentRequest =
  | {
    type: 'extract_page_context'
    previewMaxBytes: number
    defaultMaxPayloadBytes: number
  }
  | {
    type: 'extract_page_content'
    index: number
    maxContentBytes: number
    maxPayloadBytes: number
  }
  | {
    type: 'perform_click'
    target: ClickActionTarget
    pageContextId?: number
    visibleContextId?: string
  }
  | {
    type: 'perform_write_text'
    target: FormControlTarget | EditableActionTarget
    text: string
    pageContextId?: number
    visibleContextId?: string
  }
  | {
    type: 'perform_set_checked'
    target: FormControlTarget
    checked: boolean
    pageContextId?: number
    visibleContextId?: string
  }
  | {
    type: 'perform_select_options'
    target: FormControlTarget
    values: string[]
    pageContextId?: number
    visibleContextId?: string
  }
  | {
    type: 'perform_submit_form'
    target: FormSubmitTarget
    pageContextId?: number
    visibleContextId?: string
  }
  | {
    type: 'perform_upload_file'
    target: FormControlTarget
    file: FileUploadPayload
    pageContextId?: number
    visibleContextId?: string
  }

export type ContentResponse =
  | {
    ok: true
    data:
    | PageContext
    | PageContent
    | ActionResultData
    | WriteTextActionResultData
    | SetCheckedActionResultData
    | SelectOptionsActionResultData
    | SubmitFormActionResultData
    | UploadFileActionResultData
  }
  | {
    ok: false
    error: {
      code: PageContentErrorCode | ActionResultErrorCode
      message: string
      detail?: StaleContextDetail
    }
  }

export interface ContentEnvironment {
  document: Document
  locationHref: string
  title: string
  selectedText: string
  now: () => string
}

export function handleContentRequest (
  request: ContentRequest,
  environment: ContentEnvironment
): ContentResponse {
  try {
    if (request.type === 'extract_page_context') {
      const context = extractPageContext({
        document: environment.document,
        locationHref: environment.locationHref,
        title: environment.title,
        selectedText: environment.selectedText,
        now: environment.now,
        previewMaxBytes: request.previewMaxBytes,
        defaultMaxPayloadBytes: request.defaultMaxPayloadBytes
      })
      return {
        ok: true,
        data: {
          ...context,
          _csVersion: CONTENT_SCRIPT_VERSION,
          pageContextId: pageContextVersion
        }
      }
    }

    // Check pageContextId staleness for all action requests
    if ('pageContextId' in request && request.pageContextId !== undefined) {
      if (request.pageContextId !== pageContextVersion) {
        return {
          ok: false,
          error: {
            code: 'page_navigated',
            message: `The page has navigated since the last read (context ${request.pageContextId} vs current ${pageContextVersion}). Call read_current_page to get fresh context.`,
            detail: {
              id: '',
              kind: 'page',
              previousContextId: request.pageContextId,
              currentContextId: pageContextVersion
            }
          }
        }
      }
    }

    if ('visibleContextId' in request && request.visibleContextId !== undefined) {
      const currentVisibleContextId = computeVisibleContextId(environment.document)

      if (request.visibleContextId !== currentVisibleContextId) {
        return createVisibleContextStaleError(
          request.visibleContextId,
          currentVisibleContextId
        )
      }
    }

    if (request.type === 'perform_click') {
      return performClick(
        request.target,
        environment.document,
        environment.locationHref
      )
    }

    if (request.type === 'perform_write_text') {
      return performWriteText(
        request.target,
        request.text,
        environment.document
      )
    }

    if (request.type === 'perform_set_checked') {
      return performSetChecked(
        request.target,
        request.checked,
        environment.document
      )
    }

    if (request.type === 'perform_select_options') {
      return performSelectOptions(
        request.target,
        request.values,
        environment.document
      )
    }

    if (request.type === 'perform_submit_form') {
      return performSubmitForm(request.target, environment.document)
    }

    if (request.type === 'perform_upload_file') {
      return performUploadFile(request.target, request.file, environment.document)
    }

    const content = extractPageContent(environment.document)
    const chunk = chunkReadableContent(
      content,
      request.index,
      request.maxContentBytes
    )

    return {
      ok: true,
      data: {
        url: environment.locationHref,
        title: environment.title,
        timestamp: environment.now(),
        index: chunk.index,
        content: chunk.content,
        truncated: chunk.truncated,
        maxPayloadBytes: request.maxPayloadBytes
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'invalid_index') {
      return {
        ok: false,
        error: {
          code: 'invalid_index',
          message: 'Page content chunk index must be available and 1-based.'
        }
      }
    }

    return {
      ok: false,
      error: {
        code: 'extraction_failed',
        message: 'Unable to extract page content from the active tab.'
      }
    }
  }
}

function createVisibleContextStaleError (
  previousVisibleContextId: string,
  currentVisibleContextId: string
): ContentResponse {
  return {
    ok: false,
    error: {
      code: 'stale_context',
      message: 'Visible form controls changed since the page was read. Call read_current_page before continuing.',
      detail: {
        id: '',
        kind: 'visible_context',
        previousVisibleContextId,
        currentVisibleContextId,
        reason: 'visible_controls_changed'
      }
    }
  }
}

type FormActionData =
  | WriteTextActionResultData
  | SetCheckedActionResultData
  | SelectOptionsActionResultData
  | SubmitFormActionResultData
  | UploadFileActionResultData

function addVisibleContextStaleness <T extends FormActionData> (
  data: T,
  previousVisibleFormStructureId: string,
  document: Document
): T {
  const currentVisibleFormStructureId = computeVisibleFormStructureId(document)

  if (currentVisibleFormStructureId === previousVisibleFormStructureId) {
    return data
  }

  return {
    ...data,
    contextStale: true,
    contextStaleReason: 'visible_controls_changed',
    currentVisibleContextId: computeVisibleContextId(document)
  }
}

function markBrijioOwned (control: Element): void {
  control.setAttribute('data-brijio-fill-owner', 'brijio')

  const globalControl = control as Element & {
    __brijioOwnerClearListener?: EventListener
  }

  if (globalControl.__brijioOwnerClearListener !== undefined) {
    return
  }

  const clearOwner = (): void => {
    control.removeAttribute('data-brijio-fill-owner')
  }

  control.addEventListener('input', clearOwner)
  control.addEventListener('change', clearOwner)
  globalControl.__brijioOwnerClearListener = clearOwner
}

function getFormValidationErrors (
  form: HTMLFormElement,
  formId: string
): FormValidationError[] {
  return Array.from(form.querySelectorAll('input, textarea, select'))
    .filter(isVisibleFormControl)
    .map((control, index) => ({
      control,
      controlId: `bb-${index + 1}`
    }))
    .map(({ control, controlId }) => {
      const reason = getInvalidReason(control)

      if (reason === null) {
        return null
      }

      return {
        formId,
        controlId,
        label: getFormControlLabel(control),
        reason
      }
    })
    .filter((error): error is FormValidationError => error !== null)
}

function getInvalidReason (
  control: Element
): FormValidationError['reason'] | null {
  if (isEmptyFormControl(control) && isRequiredFormControl(control)) {
    return 'value_missing'
  }

  const validity = (control as HTMLInputElement).validity

  if (validity === undefined || validity.valid) {
    return null
  }

  if (validity.valueMissing) return 'value_missing'
  if (validity.typeMismatch) return 'type_mismatch'
  if (validity.patternMismatch) return 'pattern_mismatch'
  if (validity.tooShort) return 'too_short'
  if (validity.tooLong) return 'too_long'
  if (validity.rangeUnderflow) return 'range_underflow'
  if (validity.rangeOverflow) return 'range_overflow'
  if (validity.stepMismatch) return 'step_mismatch'
  if (validity.badInput) return 'bad_input'
  if (validity.customError) return 'custom_error'
  return 'custom_error'
}

function isRequiredFormControl (control: Element): boolean {
  return control.hasAttribute('required') || control.getAttribute('aria-required') === 'true'
}

function isEmptyFormControl (control: Element): boolean {
  const tagName = control.tagName.toLowerCase()
  const type = getInputType(control)

  if (type === 'checkbox' || type === 'radio') {
    return !(control as HTMLInputElement).checked && !control.hasAttribute('checked')
  }

  if (tagName === 'select') {
    return Array.from((control as HTMLSelectElement).options)
      .filter((option) => option.selected || option.hasAttribute('selected'))
      .filter((option) => option.value !== '')
      .length === 0
  }

  const value = (control as HTMLInputElement | HTMLTextAreaElement).value ??
    control.getAttribute('value') ??
    control.textContent ??
    ''

  return value.trim() === ''
}

function isVisibleFormControl (element: Element): boolean {
  let current: Element | null = element

  while (current !== null) {
    const tagName = current.tagName.toLowerCase()
    const style = current.getAttribute('style')?.toLowerCase() ?? ''

    if (
      ['script', 'style', 'template', 'noscript'].includes(tagName) ||
      current.hasAttribute('hidden') ||
      current.getAttribute('aria-hidden') === 'true' ||
      style.includes('display: none') ||
      style.includes('visibility: hidden') ||
      (tagName === 'input' && current.getAttribute('type') === 'hidden')
    ) {
      return false
    }

    current = current.parentElement
  }

  return true
}

function getFormControlLabel (control: Element): string {
  const ariaLabel = control.getAttribute('aria-label')

  if (ariaLabel !== null && ariaLabel.trim() !== '') {
    return normalizeWhitespace(ariaLabel)
  }

  const wrappingLabel = control.closest('label')

  if (wrappingLabel !== null) {
    return normalizeWhitespace(wrappingLabel.textContent ?? '')
  }

  const id = control.getAttribute('id')

  if (id !== null && control.ownerDocument !== null) {
    const explicitLabel = control.ownerDocument.querySelector(
      `label[for="${id.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"]`
    )

    if (explicitLabel !== null) {
      return normalizeWhitespace(explicitLabel.textContent ?? '')
    }
  }

  return ''
}

function normalizeWhitespace (value: string): string {
  return value.replace(/\s+/gu, ' ').trim()
}

function performWriteText (
  target: FormControlTarget | EditableActionTarget,
  text: string,
  document: Document
): ContentResponse {
  const element = findWriteTextTarget(target, document)

  if (element === null) {
    return {
      ok: false,
      error: {
        code: 'target_not_found',
        message: 'No matching text target was found.'
      }
    }
  }

  if (isEditableTarget(target)) {
    const staleError = validateEditableTarget(target, element)
    if (staleError !== null) {
      return staleError
    }

    try {
      const editable = element as HTMLElement
      editable.focus?.()
      editable.textContent = text
      dispatchElementEvent(editable, 'input')

      return {
        ok: true,
        data: {
          action: 'write_text',
          target,
          textLength: text.length
        }
      }
    } catch {
      return {
        ok: false,
        error: {
          code: 'action_failed',
          message: 'Unable to perform the requested text action.'
        }
      }
    }
  }

  if (element.hasAttribute('disabled')) {
    return {
      ok: false,
      error: {
        code: 'target_disabled',
        message: 'The requested text target is disabled.'
      }
    }
  }

  if (element.hasAttribute('readonly')) {
    return {
      ok: false,
      error: {
        code: 'target_readonly',
        message: 'The requested text target is read-only.'
      }
    }
  }

  if (!isSupportedTextControl(element)) {
    return {
      ok: false,
      error: {
        code: 'unsupported_control',
        message: 'The requested form control does not support text writing.'
      }
    }
  }

  // Validate stale context for form control targets
  if (!isEditableTarget(target)) {
    const staleError = validateFormControlTarget(target, element, document)
    if (staleError !== null) {
      return staleError
    }
  }

  const visibleFormStructureBefore = computeVisibleFormStructureId(document)

  try {
    const control = element as HTMLInputElement | HTMLTextAreaElement
    control.focus?.()
    control.value = text
    if (text !== '' && control.value === '') {
      return {
        ok: false,
        error: {
          code: 'invalid_control_value',
          message: 'The requested value is not valid for this form control.'
        }
      }
    }
    dispatchElementEvent(control, 'input')
    dispatchElementEvent(control, 'change')
    markBrijioOwned(control)

    return {
      ok: true,
      data: addVisibleContextStaleness(
        {
          action: 'write_text',
          target,
          textLength: text.length
        },
        visibleFormStructureBefore,
        document
      )
    }
  } catch {
    return {
      ok: false,
      error: {
        code: 'action_failed',
        message: 'Unable to perform the requested text action.'
      }
    }
  }
}

function performUploadFile (
  target: FormControlTarget,
  file: FileUploadPayload,
  document: Document
): ContentResponse {
  const element = findFormControlTarget(target, document)

  if (element === null) {
    return {
      ok: false,
      error: {
        code: 'target_not_found',
        message: 'No matching file input target was found.'
      }
    }
  }

  const staleError = validateFormControlTarget(target, element, document)
  if (staleError !== null) {
    return staleError
  }

  if (element.hasAttribute('disabled')) {
    return {
      ok: false,
      error: {
        code: 'target_disabled',
        message: 'The requested file target is disabled.'
      }
    }
  }

  if (element.tagName.toLowerCase() !== 'input' || getInputType(element) !== 'file') {
    return {
      ok: false,
      error: {
        code: 'unsupported_control',
        message: 'The requested form control does not support file uploads.'
      }
    }
  }

  const control = element as HTMLInputElement
  const visibleFormStructureBefore = computeVisibleFormStructureId(document)

  try {
    const uploadFile = createBrowserFile(file, document)
    const dataTransfer = createDataTransfer(document)
    dataTransfer.items.add(uploadFile)
    control.files = dataTransfer.files
    control.focus?.()
    dispatchElementEvent(control, 'input')
    dispatchElementEvent(control, 'change')
    markBrijioOwned(control)

    return {
      ok: true,
      data: addVisibleContextStaleness(
        {
          action: 'upload_file',
          target,
          fileName: file.fileName,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          fileCount: control.files?.length ?? 1
        },
        visibleFormStructureBefore,
        document
      )
    }
  } catch {
    return {
      ok: false,
      error: {
        code: 'action_failed',
        message: 'Unable to perform the requested file upload action.'
      }
    }
  }
}

function createBrowserFile (file: FileUploadPayload, document: Document): File {
  const bytes = decodeBase64Bytes(file.contentBase64)
  const view = document.defaultView
  const FileCtor = view?.File ?? globalThis.File
  const blobPart = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(blobPart).set(bytes)
  return new FileCtor([blobPart], file.fileName, {
    type: file.mimeType,
    ...(file.lastModified !== undefined ? { lastModified: file.lastModified } : {})
  })
}

function decodeBase64Bytes (contentBase64: string): Uint8Array {
  if (typeof atob === 'function') {
    return Uint8Array.from(atob(contentBase64), (char) => char.charCodeAt(0))
  }

  const BufferCtor = (globalThis as { Buffer?: { from: (value: string, encoding: string) => Uint8Array } }).Buffer
  if (BufferCtor !== undefined) {
    return Uint8Array.from(BufferCtor.from(contentBase64, 'base64'))
  }

  throw new Error('base64 decoding unavailable')
}

function createDataTransfer (document: Document): DataTransfer {
  const view = document.defaultView
  const DataTransferCtor = view?.DataTransfer ?? globalThis.DataTransfer
  return new DataTransferCtor()
}

function performSetChecked (
  target: FormControlTarget,
  checked: boolean,
  document: Document
): ContentResponse {
  const element = findFormControlTarget(target, document)

  if (element === null) {
    return {
      ok: false,
      error: {
        code: 'target_not_found',
        message: 'No matching checkable target was found.'
      }
    }
  }

  const staleError = validateFormControlTarget(target, element, document)
  if (staleError !== null) {
    return staleError
  }

  if (element.hasAttribute('disabled')) {
    return {
      ok: false,
      error: {
        code: 'target_disabled',
        message: 'The requested checkable target is disabled.'
      }
    }
  }

  if (!isCheckableControl(element)) {
    return {
      ok: false,
      error: {
        code: 'unsupported_control',
        message: 'The requested form control does not support checked state.'
      }
    }
  }

  const control = element as HTMLInputElement
  const type = getInputType(control)

  if (type === 'radio' && !checked) {
    return {
      ok: false,
      error: {
        code: 'unsupported_control',
        message: 'Radio buttons can be selected by choosing another option.'
      }
    }
  }

  const initialChecked = control.checked
  const visibleFormStructureBefore = computeVisibleFormStructureId(document)

  if (initialChecked !== checked) {
    if (type === 'radio' && checked) {
      uncheckRadioGroup(control, document)
    }

    clickCheckableControl(control, checked)
  }

  const changed = initialChecked !== control.checked

  if (control.checked !== checked) {
    return {
      ok: false,
      error: {
        code: 'action_failed',
        message: 'Unable to set the requested checked state.'
      }
    }
  }

  markBrijioOwned(control)

  return {
    ok: true,
    data: addVisibleContextStaleness(
      {
        action: 'set_checked',
        target,
        checked: control.checked,
        changed
      },
      visibleFormStructureBefore,
      document
    )
  }
}

function clickCheckableControl (
  control: HTMLInputElement,
  checked: boolean
): void {
  const label = control.closest('label') as HTMLElement | null

  if (label !== null) {
    label.click()
  }

  if (control.checked === checked) {
    return
  }

  control.click()

  if (control.checked === checked) {
    return
  }

  control.checked = checked
  dispatchElementEvent(control, 'input')
  dispatchElementEvent(control, 'change')
}

function performSelectOptions (
  target: FormControlTarget,
  values: string[],
  document: Document
): ContentResponse {
  const element = findFormControlTarget(target, document)

  if (element === null) {
    return {
      ok: false,
      error: {
        code: 'target_not_found',
        message: 'No matching select target was found.'
      }
    }
  }

  const staleError = validateFormControlTarget(target, element, document)
  if (staleError !== null) {
    return staleError
  }

  if (element.hasAttribute('disabled')) {
    return {
      ok: false,
      error: {
        code: 'target_disabled',
        message: 'The requested select target is disabled.'
      }
    }
  }

  if (element.tagName.toLowerCase() !== 'select') {
    return {
      ok: false,
      error: {
        code: 'unsupported_control',
        message:
          'The requested form control does not support option selection.'
      }
    }
  }

  const select = element as HTMLSelectElement

  const multiple = select.multiple || select.hasAttribute('multiple')

  if (!multiple && values.length !== 1) {
    return {
      ok: false,
      error: {
        code: 'invalid_control_value',
        message: 'Single select controls require exactly one option value.'
      }
    }
  }

  const options = Array.from(select.options)

  for (const value of values) {
    const option = options.find((candidate) => candidate.value === value)

    if (option === undefined) {
      return {
        ok: false,
        error: {
          code: 'option_not_found',
          message: 'The requested option value was not found.'
        }
      }
    }

    if (option.disabled) {
      return {
        ok: false,
        error: {
          code: 'target_option_disabled',
          message: 'The requested option value is disabled.'
        }
      }
    }
  }

  const visibleFormStructureBefore = computeVisibleFormStructureId(document)

  for (const option of options) {
    const selected = values.includes(option.value)
    setOptionSelected(option, selected)
  }

  for (const option of options) {
    const selected = values.includes(option.value)

    if (option.selected !== selected) {
      Object.defineProperty(option, 'selected', {
        configurable: true,
        value: selected,
        writable: true
      })
    }
  }

  dispatchElementEvent(select, 'input')
  dispatchElementEvent(select, 'change')
  markBrijioOwned(select)

  return {
    ok: true,
    data: addVisibleContextStaleness(
      {
        action: 'select_options',
        target,
        values
      },
      visibleFormStructureBefore,
      document
    )
  }
}

function setOptionSelected (option: HTMLOptionElement, selected: boolean): void {
  option.selected = selected

  if (selected) {
    option.setAttribute('selected', '')
  } else {
    option.removeAttribute('selected')
  }

  if (option.selected !== selected) {
    Object.defineProperty(option, 'selected', {
      configurable: true,
      value: selected,
      writable: true
    })
  }
}

function performSubmitForm (
  target: FormSubmitTarget,
  document: Document
): ContentResponse {
  const form = findFormTarget(target.formId, document)

  if (form === null) {
    return {
      ok: false,
      error: {
        code: 'target_not_found',
        message: 'No matching form target was found.'
      }
    }
  }

  const staleError = validateFormSubmitTarget(target, form, document)
  if (staleError !== null) {
    return staleError
  }

  const visibleFormStructureBefore = computeVisibleFormStructureId(document)
  const validationErrors = getFormValidationErrors(form, target.formId)

  if (validationErrors.length > 0) {
    return {
      ok: true,
      data: addVisibleContextStaleness(
        {
          action: 'submit_form',
          target,
          submitted: false,
          validationErrors
        },
        visibleFormStructureBefore,
        document
      )
    }
  }

  if (typeof form.requestSubmit !== 'function') {
    return {
      ok: false,
      error: {
        code: 'action_failed',
        message: 'Unable to submit the requested form with browser validation.'
      }
    }
  }

  try {
    form.requestSubmit()

    return {
      ok: true,
      data: addVisibleContextStaleness(
        {
          action: 'submit_form',
          target,
          submitted: true
        },
        visibleFormStructureBefore,
        document
      )
    }
  } catch {
    return {
      ok: false,
      error: {
        code: 'action_failed',
        message: 'Unable to perform the requested submit action.'
      }
    }
  }
}

function performClick (
  target: ClickActionTarget,
  document: Document,
  locationHref: string
): ContentResponse {
  const element = findClickTarget(target, document)

  if (element === null) {
    return {
      ok: false,
      error: {
        code: 'target_not_found',
        message: 'No matching click target was found.'
      }
    }
  }

  // Stale-context validation: verify the element at position matches expectations
  const staleError = validateClickTarget(target, element, locationHref)
  if (staleError !== null) {
    return staleError
  }

  if (target.kind === 'action' && isActionDisabledForClick(element)) {
    return {
      ok: false,
      error: {
        code: 'target_disabled',
        message: 'The requested click target is disabled.'
      }
    }
  }

  // Capture pre-click state for side-effect detection
  const urlBefore = locationHref
  const detailsBefore = getDetailsOpenState(element)

  try {
    const clickable = element as HTMLElement
    clickable.click()

    // Detect observable side effects
    const observed = detectClickSideEffects(
      element,
      urlBefore,
      document,
      detailsBefore
    )

    return {
      ok: true,
      data: {
        action: 'click',
        target,
        ...(Object.keys(observed).length > 0 ? { observed } : {})
      }
    }
  } catch {
    return {
      ok: false,
      error: {
        code: 'action_failed',
        message: 'Unable to perform the requested click action.'
      }
    }
  }
}

function isActionDisabledForClick (element: Element): boolean {
  return (
    element.hasAttribute('disabled') ||
    element.getAttribute('aria-disabled') === 'true'
  )
}

function getDetailsOpenState (element: Element): boolean | null {
  const details =
    element.tagName.toLowerCase() === 'summary'
      ? element.closest('details')
      : null

  if (details !== null) {
    return details.hasAttribute('open')
  }

  return null
}

function detectClickSideEffects (
  element: Element,
  urlBefore: string,
  document: Document,
  detailsOpenBefore: boolean | null
): Record<string, unknown> {
  const observed: Record<string, unknown> = {}

  // Detect navigation: compare current URL after click.
  // For SPA navigations (pushState/replaceState), window.location.href updates
  // synchronously. For full-page navigations, the content script may not survive
  // to observe the change — the extension's pageshow listener handles that.
  // We check document.URL (DOM) first, then fall back to the window's location
  // if available (browser environment).
  const urlAfter = getWindowLocationHref(document) ?? document.URL ?? ''
  if (urlAfter !== '' && urlAfter !== urlBefore) {
    observed.navigationStarted = true
  }

  // Detect details disclosure toggle
  if (detailsOpenBefore !== null) {
    const details = element.closest('details')
    if (details !== null) {
      observed.detailsOpen = details.hasAttribute('open')
    }
  }

  return observed
}

function getWindowLocationHref (document: Document): string | null {
  try {
    const href = (document.defaultView as { location?: { href?: string } } | null)?.location?.href
    if (typeof href === 'string' && href !== '' && href !== 'about:blank') {
      return href
    }
  } catch {
    // Cross-origin access to window.location may throw; fall back to document.URL
  }

  return null
}

function findWriteTextTarget (
  target: FormControlTarget | EditableActionTarget,
  document: Document
): Element | null {
  if (isEditableTarget(target)) {
    return findEditableTarget(target.id, document)
  }

  return findFormControlTarget(target, document)
}

function findFormControlTarget (
  target: FormControlTarget,
  document: Document
): Element | null {
  const formIndex = parseTargetId(target.formId)
  const controlIndex = parseTargetId(target.controlId)

  if (formIndex === null || controlIndex === null) {
    return null
  }

  const forms = Array.from(document.querySelectorAll('form')).filter(isVisible)
  const form = forms[formIndex - 1]

  if (form === undefined) {
    return null
  }

  const controls = Array.from(
    form.querySelectorAll('input, textarea, select, button')
  ).filter(isVisible)

  return controls[controlIndex - 1] ?? null
}

function findFormTarget (
  formId: string,
  document: Document
): HTMLFormElement | null {
  const formIndex = parseTargetId(formId)

  if (formIndex === null) {
    return null
  }

  const forms = Array.from(document.querySelectorAll('form')).filter(isVisible)

  return (forms[formIndex - 1] as HTMLFormElement | undefined) ?? null
}

function findEditableTarget (id: string, document: Document): Element | null {
  const index = parseTargetId(id)

  if (index === null) {
    return null
  }

  const editables = Array.from(
    document.querySelectorAll(
      '[contenteditable="true"], [contenteditable="plaintext-only"]'
    )
  ).filter(isVisible)

  return editables[index - 1] ?? null
}

function findClickTarget (
  target: ClickActionTarget,
  document: Document
): Element | null {
  const index = parseTargetId(target.id)

  if (index === null) {
    return null
  }

  const selector =
    target.kind === 'link'
      ? 'a[href]'
      : ACTION_SELECTORS
  const elements = Array.from(document.querySelectorAll(selector))
    .filter(isVisible)
    .filter((element) =>
      target.kind === 'link' || !isActionDisabledForClick(element)
    )

  return elements[index - 1] ?? null
}

function validateClickTarget (
  target: ClickActionTarget,
  element: Element,
  locationHref: string
): ContentResponse | null {
  const parts: string[] = []
  const detail: StaleContextDetail = {
    id: target.id,
    kind: target.kind
  }

  // Validate expectedText: case-insensitive substring match
  if (target.expectedText !== undefined && target.expectedText !== '') {
    const foundText = getClickTargetText(element)
    const visibleText = foundText.toLowerCase()
    const expected = target.expectedText.toLowerCase()

    detail.expectedText = target.expectedText
    detail.foundText = foundText

    if (!visibleText.includes(expected)) {
      parts.push(
        `Expected text containing "${target.expectedText}", found "${detail.foundText}".`
      )
    }
  }

  // Validate expectedHref: pathname-only comparison (ignores query/hash)
  if (
    target.kind === 'link' &&
    target.expectedHref !== undefined &&
    target.expectedHref !== ''
  ) {
    const href = element.getAttribute('href') ?? ''
    detail.expectedHref = target.expectedHref
    detail.foundHref = href

    try {
      const resolved = new URL(href, locationHref)
      const expectedPath = target.expectedHref
      if (resolved.pathname !== expectedPath) {
        parts.push(
          `Expected href path "${expectedPath}", found "${resolved.pathname}".`
        )
      }
    } catch {
      // If URL parsing fails, fall back to simple comparison
      if (!href.includes(target.expectedHref)) {
        parts.push(
          `Expected href containing "${target.expectedHref}", found "${href}".`
        )
      }
    }
  }

  // Validate expectedRole: matches role attribute or implicit role
  if (
    target.kind === 'action' &&
    target.expectedRole !== undefined &&
    target.expectedRole !== ''
  ) {
    const role = element.getAttribute('role') ?? getImplicitRole(element)
    detail.expectedRole = target.expectedRole
    detail.foundRole = role

    if (role !== target.expectedRole) {
      parts.push(`Expected role "${target.expectedRole}", found "${role}".`)
    }
  }

  if (parts.length === 0) {
    return null // All validations passed
  }

  const message = `Element at position ${target.id} does not match expected target. ${parts.join(' ')} Call read_current_page and retry with fresh IDs.`

  return {
    ok: false,
    error: {
      code: 'stale_context',
      message,
      detail
    }
  }
}

function getElementVisibleText (element: Element): string {
  // Use innerText for visible text (respects CSS visibility);
  // fall back to textContent for non-HTML elements or environments without innerText
  if ('innerText' in element && typeof element.innerText === 'string') {
    return element.innerText.trim()
  }

  return (element.textContent ?? '').trim()
}

function getClickTargetText (element: Element): string {
  const accessibleName = getElementAccessibleName(element)

  if (accessibleName !== '') {
    return accessibleName
  }

  return getElementVisibleText(element)
}

function getElementAccessibleName (element: Element): string {
  const ariaLabel = element.getAttribute('aria-label')

  if (ariaLabel !== null && ariaLabel.trim() !== '') {
    return normalizeText(ariaLabel)
  }

  const labelledBy = element.getAttribute('aria-labelledby')

  if (labelledBy !== null && labelledBy.trim() !== '') {
    const label = labelledBy
      .split(/\s+/u)
      .map((id) => element.ownerDocument?.getElementById(id))
      .filter((labelElement): labelElement is HTMLElement => labelElement != null)
      .map(getElementVisibleText)
      .filter((text) => text !== '')
      .join(' ')

    if (label !== '') {
      return normalizeText(label)
    }
  }

  if (element.tagName.toLowerCase() === 'input') {
    const value = element.getAttribute('value')

    if (value !== null && value.trim() !== '') {
      return normalizeText(value)
    }
  }

  const alt = element.getAttribute('alt')

  if (alt !== null && alt.trim() !== '') {
    return normalizeText(alt)
  }

  const title = element.getAttribute('title')

  if (title !== null && title.trim() !== '') {
    return normalizeText(title)
  }

  return ''
}

/** Get the visible label for a form control element. */
function getControlLabel (element: Element, document: Document): string {
  // Try explicit <label for="...">
  const id = element.getAttribute('id')
  if (id !== null && id !== '') {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`)
    if (label !== null) {
      return (label.textContent ?? '').trim()
    }
  }

  // Try wrapping <label>
  const wrappingLabel = element.closest('label')
  if (wrappingLabel !== null) {
    return (wrappingLabel.textContent ?? '').trim()
  }

  // Try aria-label
  const ariaLabel = element.getAttribute('aria-label')
  if (ariaLabel !== null && ariaLabel !== '') {
    return ariaLabel.trim()
  }

  // Try title
  const title = element.getAttribute('title')
  if (title !== null && title !== '') {
    return title.trim()
  }

  // Try placeholder
  const placeholder = element.getAttribute('placeholder')
  if (placeholder !== null && placeholder !== '') {
    return placeholder.trim()
  }

  return ''
}

/** Get the visible label for a form element. */
function getFormLabel (form: HTMLFormElement, document: Document): string {
  // Try a heading inside or near the form
  const heading = form.querySelector('h1, h2, h3, h4, h5, h6')
  if (heading !== null) {
    return (heading.textContent ?? '').trim()
  }

  // Try aria-label
  const ariaLabel = form.getAttribute('aria-label')
  if (ariaLabel !== null && ariaLabel !== '') {
    return ariaLabel.trim()
  }

  // Try a preceding heading sibling
  const previousSibling = form.previousElementSibling
  if (previousSibling !== null && /^H[1-6]$/i.test(previousSibling.tagName)) {
    return (previousSibling.textContent ?? '').trim()
  }

  // Try legend inside fieldset
  const legend = form.querySelector('legend')
  if (legend !== null) {
    return (legend.textContent ?? '').trim()
  }

  // Try title attribute
  const title = form.getAttribute('title')
  if (title !== null && title !== '') {
    return title.trim()
  }

  return ''
}

/** Validate form control target against expectedLabel. */
function validateFormControlTarget (
  target: FormControlTarget,
  element: Element,
  document: Document
): ContentResponse | null {
  if (target.expectedLabel === undefined || target.expectedLabel === '') {
    return null
  }

  const foundLabel = getControlLabel(element, document)
  const expected = target.expectedLabel.toLowerCase()
  const found = foundLabel.toLowerCase()

  if (found.includes(expected)) {
    return null
  }

  const inputType = element.tagName.toLowerCase() === 'input'
    ? (element.getAttribute('type') ?? 'text').toLowerCase()
    : element.tagName.toLowerCase()

  return {
    ok: false,
    error: {
      code: 'stale_context',
      message: `Form control ${target.controlId} in form ${target.formId} does not match expected target. Expected label containing "${target.expectedLabel}", found "${foundLabel}". Call read_current_page and retry with fresh IDs.`,
      detail: {
        id: target.controlId,
        kind: 'form_control',
        formId: target.formId,
        controlId: target.controlId,
        expectedLabel: target.expectedLabel,
        foundLabel,
        expectedType: inputType,
        foundType: inputType
      }
    }
  }
}

/** Validate editable target against expectedText. */
function validateEditableTarget (
  target: EditableActionTarget,
  element: Element
): ContentResponse | null {
  if (target.expectedText === undefined || target.expectedText === '') {
    return null
  }

  const foundText = getElementVisibleText(element)
  const expected = target.expectedText.toLowerCase()
  const found = foundText.toLowerCase()

  if (found.includes(expected)) {
    return null
  }

  return {
    ok: false,
    error: {
      code: 'stale_context',
      message: `Editable target ${target.id} does not match expected target. Expected text containing "${target.expectedText}", found "${foundText}". Call read_current_page and retry with fresh IDs.`,
      detail: {
        id: target.id,
        kind: 'editable',
        expectedText: target.expectedText,
        foundText
      }
    }
  }
}

/** Validate form submit target against expectedLabel. */
function validateFormSubmitTarget (
  target: FormSubmitTarget,
  form: HTMLFormElement,
  document: Document
): ContentResponse | null {
  if (target.expectedLabel === undefined || target.expectedLabel === '') {
    return null
  }

  const foundLabel = getFormLabel(form, document)
  const expected = target.expectedLabel.toLowerCase()
  const found = foundLabel.toLowerCase()

  if (found.includes(expected)) {
    return null
  }

  return {
    ok: false,
    error: {
      code: 'stale_context',
      message: `Form ${target.formId} does not match expected target. Expected label containing "${target.expectedLabel}", found "${foundLabel}". Call read_current_page and retry with fresh IDs.`,
      detail: {
        id: target.formId,
        kind: 'form',
        expectedLabel: target.expectedLabel,
        foundLabel
      }
    }
  }
}

function getImplicitRole (element: Element): string {
  const tag = element.tagName.toLowerCase()

  if (tag === 'button') return 'button'
  if (tag === 'summary') return 'button'
  if (tag === 'a' && element.hasAttribute('href')) return 'link'
  if (tag === 'input') {
    const type = (element.getAttribute('type') ?? 'text').toLowerCase()
    if (type === 'button' || type === 'submit' || type === 'reset' || type === 'image') { return 'button' }
    if (type === 'checkbox') return 'checkbox'
    if (type === 'radio') return 'radio'
  }

  return ''
}

function isSupportedTextControl (element: Element): boolean {
  const tagName = element.tagName.toLowerCase()

  if (tagName === 'textarea') {
    return true
  }

  if (tagName !== 'input') {
    return false
  }

  const type = (element.getAttribute('type') ?? 'text').toLowerCase()
  return [
    'text',
    'search',
    'email',
    'url',
    'tel',
    'number',
    'date',
    'time',
    'datetime-local',
    'month',
    'week',
    'color',
    'range'
  ].includes(type)
}

function isCheckableControl (element: Element): boolean {
  if (element.tagName.toLowerCase() !== 'input') {
    return false
  }

  const type = getInputType(element)

  return type === 'checkbox' || type === 'radio'
}

function getInputType (element: Element): string {
  return (element.getAttribute('type') ?? 'text').toLowerCase()
}

function uncheckRadioGroup (
  control: HTMLInputElement,
  document: Document
): void {
  const name = control.getAttribute('name')

  if (name === null || name === '') {
    return
  }

  const radios = Array.from(
    document.querySelectorAll(
      `input[type="radio"][name="${escapeAttributeValue(name)}"]`
    )
  )

  for (const radio of radios) {
    if (radio !== control) {
      (radio as HTMLInputElement).checked = false
    }
  }
}

function dispatchElementEvent (
  control: Element,
  type: 'input' | 'change'
): void {
  const EventConstructor = control.ownerDocument.defaultView?.Event ?? Event
  control.dispatchEvent(new EventConstructor(type, { bubbles: true }))
}

function isEditableTarget (
  target: FormControlTarget | EditableActionTarget
): target is EditableActionTarget {
  return 'kind' in target && target.kind === 'editable'
}

function parseTargetId (id: string): number | null {
  const match = /^bb-(\d+)$/u.exec(id)

  if (match === null) {
    return null
  }

  const index = Number(match[1])

  return Number.isInteger(index) && index >= 1 ? index : null
}

function normalizeText (value: string): string {
  return value.replace(/\s+/gu, ' ').trim()
}

function isVisible (element: Element): boolean {
  return !isSkippedElement(element)
}

function isSkippedElement (element: Element): boolean {
  const tagName = element.tagName.toLowerCase()

  return (
    ['script', 'style', 'template', 'noscript'].includes(tagName) ||
    element.hasAttribute('hidden') ||
    element.getAttribute('aria-hidden') === 'true' ||
    (tagName === 'input' && element.getAttribute('type') === 'hidden')
  )
}

function escapeAttributeValue (value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}
