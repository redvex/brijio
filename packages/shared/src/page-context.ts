import {
  chunkReadableContent,
  renderMarkdownImage,
  renderMarkdownLink,
  renderMarkdownTable
} from './page-content.js'
import {
  defaultPageContentMaxPayloadBytes,
  type PageAction,
  type PageEditable,
  type PageContext,
  type PageForm,
  type PageFormControl,
  type PageFormControlOption,
  type PageFormControlValidityReason,
  type PageHeading,
  type PageImage,
  type PageLandmark,
  type PageLink
} from './protocol.js'

export interface ExtractPageContextOptions {
  document: Document
  locationHref: string
  title: string
  selectedText: string | null
  now: () => string
  previewMaxBytes: number
  defaultMaxPayloadBytes?: number
}

export function extractPageContext (
  options: ExtractPageContextOptions
): PageContext {
  const readableContent = extractPageContent(options.document)
  const selectedText = normalizeText(options.selectedText ?? '')
  const preview = chunkReadableContent(
    readableContent,
    1,
    options.previewMaxBytes
  )

  return {
    url: options.locationHref,
    title: options.title,
    timestamp: options.now(),
    selectedText: selectedText === '' ? null : selectedText,
    visibleContextId: computeVisibleContextId(options.document),
    preview: {
      content: preview.content,
      truncated: preview.truncated,
      maxBytes: options.previewMaxBytes
    },
    structure: {
      headings: extractHeadings(options.document),
      landmarks: extractLandmarks(options.document),
      links: extractLinks(options.document),
      images: extractImages(options.document),
      forms: extractForms(options.document),
      editables: extractEditables(options.document),
      actions: extractActions(options.document)
    },
    content: {
      available: true,
      requestType: 'get_page_content',
      firstIndex: 1,
      defaultMaxPayloadBytes:
        options.defaultMaxPayloadBytes ?? defaultPageContentMaxPayloadBytes
    }
  }
}

export function extractPageContent (document: Document): string {
  const blocks: string[] = []
  const root = getReadableRoot(document)

  if (root === null) {
    return ''
  }

  visitReadableNode(root, blocks)
  return blocks.filter((block) => block.trim() !== '').join('\n\n')
}

function extractHeadings (document: Document): PageHeading[] {
  return Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    .filter(isVisible)
    .map((heading, index) => ({
      id: createId(index + 1),
      level: Number(heading.tagName.slice(1)),
      text: normalizeText(heading.textContent ?? '')
    }))
    .filter((heading) => heading.text !== '')
}

function extractLandmarks (document: Document): PageLandmark[] {
  const selector = [
    'main',
    'nav',
    'aside',
    'header',
    'footer',
    'section',
    '[role="main"]',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    '[role="complementary"]',
    '[role="region"]'
  ].join(',')

  return Array.from(document.querySelectorAll(selector))
    .filter(isVisible)
    .map((element, index) => ({
      id: createId(index + 1),
      role: getLandmarkRole(element),
      name: getLandmarkName(element)
    }))
}

function extractLinks (document: Document): PageLink[] {
  return Array.from(document.querySelectorAll('a[href]'))
    .filter(isVisible)
    .map((element, index) => ({
      id: createId(index + 1),
      text: getAccessibleName(element),
      href: element.getAttribute('href') ?? ''
    }))
    .filter((link) => link.text !== '' || link.href !== '')
}

function extractImages (document: Document): PageImage[] {
  return Array.from(document.querySelectorAll('img'))
    .filter(isVisible)
    .map((element, index) => ({
      id: createId(index + 1),
      alt: element.getAttribute('alt') ?? '',
      src: element.getAttribute('src') ?? ''
    }))
    .filter((image) => image.alt !== '' || image.src !== '')
}

function extractForms (document: Document): PageForm[] {
  return Array.from(document.querySelectorAll('form'))
    .filter(isVisible)
    .map((form, index) => ({
      id: createId(index + 1),
      label: getAccessibleName(form),
      controls: extractFormControls(form)
    }))
}

function extractFormControls (form: Element): PageFormControl[] {
  return Array.from(form.querySelectorAll('input, textarea, select, button'))
    .filter(isVisible)
    .map((control, index) => {
      const type = getControlType(control)
      const requiredSource = getRequiredSource(control)
      const valueState = getValueState(control)
      const filledBy = getFilledBy(control, valueState)

      return {
        id: createId(index + 1),
        label: getControlLabel(control),
        type,
        required: requiredSource !== undefined,
        requiredSource,
        disabled: control.hasAttribute('disabled'),
        readonly: control.hasAttribute('readonly') || undefined,
        sensitive: isSensitiveType(type),
        valueState,
        filledBy,
        checked: getCheckedState(control),
        multiple: getMultipleState(control),
        options: getSelectOptions(control),
        validity: getControlValidity(control)
      }
    })
}

export function computeVisibleContextId (document: Document): string {
  const signature = extractForms(document).map((form) => ({
    label: form.label,
    controls: form.controls.map((control) => ({
      label: control.label,
      type: control.type,
      required: control.required,
      requiredSource: control.requiredSource,
      disabled: control.disabled,
      readonly: control.readonly === true,
      sensitive: control.sensitive,
      valueState: control.valueState,
      filledBy: control.filledBy,
      checked: control.checked,
      multiple: control.multiple,
      options: control.options?.map((option) => ({
        selected: option.selected,
        disabled: option.disabled
      })),
      validityReason: control.validity?.reason
    }))
  }))

  return `ctx_${hashString(JSON.stringify(signature))}`
}

export function computeVisibleFormStructureId (document: Document): string {
  const signature = extractForms(document).map((form) => ({
    label: form.label,
    controls: form.controls.map((control) => ({
      label: control.label,
      type: control.type,
      required: control.required,
      requiredSource: control.requiredSource,
      disabled: control.disabled,
      readonly: control.readonly === true,
      sensitive: control.sensitive,
      multiple: control.multiple,
      optionCount: control.options?.length
    }))
  }))

  return `vfs_${hashString(JSON.stringify(signature))}`
}

export const ACTION_SELECTORS = [
  // Native interactive elements
  'button',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]',
  'input[type="image"]',
  'summary',

  // ARIA role-based interactive elements
  '[role="button"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="treeitem"]',
  '[role="option"]',
  '[role="link"]'
].join(',')

function extractActions (document: Document): PageAction[] {
  return Array.from(
    document.querySelectorAll(ACTION_SELECTORS)
  )
    .filter(isVisible)
    .filter((element) => !isActionDisabled(element))
    .filter((element) => !isActionHidden(element))
    .map((element, index) => ({
      id: createId(index + 1),
      role: getActionRole(element),
      name: getAccessibleName(element),
      enabled: true,
      tagName: element.tagName.toLowerCase(),
      description: getActionDescription(element)
    }))
    .filter((action) => action.name !== '')
}

function isActionDisabled (element: Element): boolean {
  return (
    element.hasAttribute('disabled') ||
    element.getAttribute('aria-disabled') === 'true'
  )
}

function isActionHidden (element: Element): boolean {
  return (
    element.getAttribute('aria-hidden') === 'true' ||
    element.hasAttribute('hidden')
  )
}

function getActionRole (element: Element): string {
  const explicitRole = element.getAttribute('role')
  if (explicitRole !== null && explicitRole !== '') {
    return explicitRole
  }

  const tag = element.tagName.toLowerCase()
  if (tag === 'button') return 'button'
  if (tag === 'summary') return 'button'
  if (tag === 'input') {
    const type = (element.getAttribute('type') ?? 'text').toLowerCase()
    if (type === 'button' || type === 'submit' || type === 'reset' || type === 'image') {
      return 'button'
    }
  }

  return ''
}

function getActionDescription (element: Element): string | undefined {
  // Try aria-describedby
  const describedBy = element.getAttribute('aria-describedby')
  if (describedBy !== null && describedBy.trim() !== '') {
    const ids = describedBy.trim().split(/\s+/u)
    const descriptions = ids
      .map((id) => element.ownerDocument?.getElementById(id))
      .filter(
        (el): el is HTMLElement => el != null
      )
      .map((el) => normalizeText(el.textContent ?? ''))
      .filter((text) => text !== '')
      .join(' ')

    if (descriptions !== '') {
      return descriptions
    }
  }

  // Try title (but not if it's already the accessible name source)
  const title = element.getAttribute('title')
  if (title !== null && title.trim() !== '') {
    const name = getAccessibleName(element)
    if (normalizeText(title) !== name) {
      return normalizeText(title)
    }
  }

  return undefined
}

function extractEditables (document: Document): PageEditable[] {
  return Array.from(
    document.querySelectorAll(
      '[contenteditable="true"], [contenteditable="plaintext-only"]'
    )
  )
    .filter(isVisible)
    .map((element, index) => ({
      id: createId(index + 1),
      label: getEditableLabel(element),
      role: element.getAttribute('role') ?? 'textbox',
      multiline: true
    }))
    .filter((editable) => editable.label !== '')
}

function getEditableLabel (element: Element): string {
  const explicitLabel = getControlLabel(element)

  if (explicitLabel !== '') {
    return explicitLabel
  }

  return getAccessibleName(element)
}

function visitReadableNode (node: Node, blocks: string[]): void {
  if (isElement(node)) {
    if (isSkippedElement(node)) {
      return
    }

    const tagName = node.tagName.toLowerCase()

    if (tagName.match(/^h[1-6]$/u) !== null) {
      const level = Number(tagName.slice(1))
      const text = normalizeText(node.textContent ?? '')
      if (text !== '') {
        blocks.push(`${'#'.repeat(level)} ${text}`)
      }
      return
    }

    if (tagName === 'a') {
      const text = getAccessibleName(node)
      const href = node.getAttribute('href') ?? ''
      if (text !== '' && href !== '') {
        blocks.push(renderMarkdownLink(text, href))
      }
      return
    }

    if (tagName === 'img') {
      const alt = node.getAttribute('alt') ?? ''
      const src = node.getAttribute('src') ?? ''
      if (alt !== '' || src !== '') {
        blocks.push(renderMarkdownImage(alt, src))
      }
      return
    }

    if (tagName === 'table') {
      const table = extractMarkdownTable(node)
      if (table !== '') {
        blocks.push(table)
      }
      return
    }

    if (['p', 'li', 'button', 'label'].includes(tagName)) {
      const text = getReadableElementText(node)
      if (text !== '') {
        blocks.push(text)
      }
      return
    }

    if (['input', 'textarea', 'select'].includes(tagName)) {
      return
    }
  }

  for (const child of Array.from(node.childNodes)) {
    visitReadableNode(child, blocks)
  }
}

function extractMarkdownTable (table: Element): string {
  const rows = Array.from(table.querySelectorAll('tr'))
    .filter(isVisible)
    .map((row) =>
      Array.from(row.querySelectorAll('th, td'))
        .filter(isVisible)
        .map((cell) => normalizeText(cell.textContent ?? ''))
    )
    .filter((row) => row.length > 0)

  if (rows.length === 0) {
    return ''
  }

  const firstHeaderRow = table.querySelector('tr th') !== null
  const headers = firstHeaderRow
    ? rows[0]
    : rows[0].map((_, index) => `Column ${index + 1}`)
  const bodyRows = firstHeaderRow ? rows.slice(1) : rows

  return renderMarkdownTable({
    headers,
    rows: bodyRows
  })
}

function getReadableElementText (element: Element): string {
  const textParts: string[] = []
  collectReadableText(element, textParts)
  return normalizeText(textParts.join(' '))
}

function collectReadableText (node: Node, textParts: string[]): void {
  if (isElement(node)) {
    if (isSkippedElement(node)) {
      return
    }

    const tagName = node.tagName.toLowerCase()

    if (['input', 'textarea', 'select'].includes(tagName)) {
      return
    }
  }

  if (node.nodeType === 3) {
    textParts.push(node.textContent ?? '')
    return
  }

  for (const child of Array.from(node.childNodes)) {
    collectReadableText(child, textParts)
  }
}

function getLandmarkRole (element: Element): string {
  const explicitRole = element.getAttribute('role')

  if (explicitRole !== null && explicitRole !== '') {
    return explicitRole
  }

  const tagName = element.tagName.toLowerCase()

  if (tagName === 'nav') return 'navigation'
  if (tagName === 'header') return 'banner'
  if (tagName === 'footer') return 'contentinfo'
  if (tagName === 'aside') return 'complementary'
  if (tagName === 'main') return 'main'

  return 'region'
}

function getLandmarkName (element: Element): string {
  const labelledName = getExplicitAccessibleName(element)

  if (labelledName !== '') {
    return labelledName
  }

  const heading = Array.from(
    element.querySelectorAll('h1, h2, h3, h4, h5, h6')
  ).find(isVisible)

  if (heading !== undefined) {
    return getReadableElementText(heading)
  }

  return ''
}

function getControlType (control: Element): string {
  const tagName = control.tagName.toLowerCase()

  if (tagName === 'input') {
    return (control.getAttribute('type') ?? 'text').toLowerCase()
  }

  return tagName
}

function getCheckedState (control: Element): boolean | undefined {
  const type = getControlType(control)

  if (type !== 'checkbox' && type !== 'radio') {
    return undefined
  }

  return (
    (control as HTMLInputElement).checked ||
    control.hasAttribute('checked')
  )
}

function getMultipleState (control: Element): boolean | undefined {
  if (control.tagName.toLowerCase() !== 'select') {
    return undefined
  }

  return (
    (control as HTMLSelectElement).multiple ||
    control.hasAttribute('multiple')
  )
}

function getRequiredSource (control: Element): 'html' | 'aria' | undefined {
  if (control.hasAttribute('required')) {
    return 'html'
  }

  if (control.getAttribute('aria-required') === 'true') {
    return 'aria'
  }

  return undefined
}

function getValueState (control: Element): 'empty' | 'filled' | 'unknown' {
  const tagName = control.tagName.toLowerCase()
  const type = getControlType(control)

  if (type === 'checkbox' || type === 'radio') {
    return getCheckedState(control) === true ? 'filled' : 'empty'
  }

  if (tagName === 'select') {
    const selectedOptions = Array.from((control as HTMLSelectElement).options)
      .filter((option) => option.selected || option.hasAttribute('selected'))
      .filter((option) => option.value !== '')

    return selectedOptions.length > 0 ? 'filled' : 'empty'
  }

  if (tagName === 'button') {
    return 'unknown'
  }

  const value = (control as HTMLInputElement | HTMLTextAreaElement).value ??
    control.getAttribute('value') ??
    control.textContent ??
    ''

  return normalizeText(value) === '' ? 'empty' : 'filled'
}

function getFilledBy (
  control: Element,
  valueState: 'empty' | 'filled' | 'unknown'
): 'brijio' | 'user_or_page' | undefined {
  if (valueState !== 'filled') {
    return undefined
  }

  return control.getAttribute('data-brijio-fill-owner') === 'brijio'
    ? 'brijio'
    : 'user_or_page'
}

function getControlValidity (control: Element): PageFormControl['validity'] {
  if (getValueState(control) === 'empty' && getRequiredSource(control) !== undefined) {
    return {
      valid: false,
      reason: 'value_missing'
    }
  }

  const input = control as HTMLInputElement
  const validity = input.validity

  if (validity !== undefined && !validity.valid) {
    return {
      valid: false,
      reason: getValidityReason(validity)
    }
  }

  return { valid: true }
}

function getValidityReason (
  validity: ValidityState
): PageFormControlValidityReason {
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

function hashString (value: string): string {
  let hash = 0x811c9dc5

  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

function getSelectOptions (
  control: Element
): PageFormControlOption[] | undefined {
  if (control.tagName.toLowerCase() !== 'select') {
    return undefined
  }

  return Array.from((control as HTMLSelectElement).options).map((option) => ({
    value: option.value,
    label: normalizeText(option.textContent ?? ''),
    selected: option.selected || option.hasAttribute('selected'),
    disabled: option.disabled || option.hasAttribute('disabled')
  }))
}

function getControlLabel (control: Element): string {
  const ariaLabel = control.getAttribute('aria-label')

  if (ariaLabel !== null && ariaLabel.trim() !== '') {
    return normalizeText(ariaLabel)
  }

  const wrappingLabel = control.closest('label')

  if (wrappingLabel !== null) {
    return getReadableElementText(wrappingLabel)
  }

  const id = control.getAttribute('id')

  if (id !== null && control.ownerDocument !== null) {
    const explicitLabel = control.ownerDocument.querySelector(
      `label[for="${escapeAttributeValue(id)}"]`
    )

    if (explicitLabel !== null) {
      return getReadableElementText(explicitLabel)
    }
  }

  return ''
}

function getAccessibleName (element: Element): string {
  const labelledName = getExplicitAccessibleName(element)

  if (labelledName !== '') {
    return labelledName
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

  return getReadableElementText(element)
}

function getExplicitAccessibleName (element: Element): string {
  const ariaLabel = element.getAttribute('aria-label')

  if (ariaLabel !== null && ariaLabel.trim() !== '') {
    return normalizeText(ariaLabel)
  }

  const ariaLabelledBy = element.getAttribute('aria-labelledby')

  if (ariaLabelledBy !== null && ariaLabelledBy.trim() !== '') {
    const label = ariaLabelledBy
      .split(/\s+/u)
      .map((id) => element.ownerDocument?.getElementById(id))
      .filter(
        (labelElement): labelElement is HTMLElement => labelElement != null
      )
      .map(getReadableElementText)
      .filter((text) => text !== '')
      .join(' ')

    if (label !== '') {
      return normalizeText(label)
    }
  }

  const title = element.getAttribute('title')

  if (title !== null && title.trim() !== '') {
    return normalizeText(title)
  }

  return ''
}

function isVisible (element: Element): boolean {
  let current: Element | null = element

  while (current !== null) {
    if (isSkippedElement(current)) {
      return false
    }

    current = current.parentElement
  }

  return true
}

function isSkippedElement (element: Element): boolean {
  const tagName = element.tagName.toLowerCase()
  const style = element.getAttribute('style')?.toLowerCase() ?? ''

  return (
    ['script', 'style', 'template', 'noscript'].includes(tagName) ||
    element.hasAttribute('hidden') ||
    element.getAttribute('aria-hidden') === 'true' ||
    style.includes('display: none') ||
    style.includes('visibility: hidden') ||
    (tagName === 'input' && element.getAttribute('type') === 'hidden')
  )
}

function isSensitiveType (type: string): boolean {
  return ['email', 'password', 'tel', 'number', 'search'].includes(type)
}

function createId (index: number): string {
  return `bb-${index}`
}

function normalizeText (value: string): string {
  return value.replace(/\s+/gu, ' ').trim()
}

function escapeAttributeValue (value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

function isElement (node: Node): node is Element {
  return node.nodeType === 1
}

function getReadableRoot (document: Document): Element | null {
  if (document.body !== null && document.body.childNodes.length > 0) {
    return document.body
  }

  return document.documentElement
}
