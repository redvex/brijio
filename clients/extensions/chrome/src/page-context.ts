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
  type PageHeading,
  type PageImage,
  type PageLandmark,
  type PageLink
} from '@browserbridge/shared'

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

      return {
        id: createId(index + 1),
        label: getControlLabel(control),
        type,
        required: control.hasAttribute('required'),
        disabled: control.hasAttribute('disabled'),
        readonly: control.hasAttribute('readonly') || undefined,
        sensitive: isSensitiveType(type),
        checked: getCheckedState(control),
        multiple: getMultipleState(control),
        options: getSelectOptions(control)
      }
    })
}

function extractActions (document: Document): PageAction[] {
  return Array.from(
    document.querySelectorAll(
      'button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"]'
    )
  )
    .filter(isVisible)
    .map((element, index) => ({
      id: createId(index + 1),
      role: element.getAttribute('role') ?? 'button',
      name: getAccessibleName(element),
      enabled: !element.hasAttribute('disabled')
    }))
    .filter((action) => action.name !== '')
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
      label: getAccessibleName(element),
      role: element.getAttribute('role') ?? 'textbox',
      multiline: true
    }))
    .filter((editable) => editable.label !== '')
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
