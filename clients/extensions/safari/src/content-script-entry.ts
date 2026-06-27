// Safari content script entry point.
//
// Per ADR 0019, this file registers browser.runtime.onMessage listener and
// delegates page operations to shared handlers from @brijio/shared.
// It is analogous to Chrome's content-script-entry.ts but uses browser.*.

import {
  executeBatch,
  handleContentRequest,
  isContentBatchRequest,
  registerPageNavigationListener,
  type BatchResult,
  type ContentBatchRequest,
  type ContentRequest,
  type ContentResponse
} from '@brijio/shared'

export type BrijioApprovalDecision = 'approve' | 'approve_session' | 'deny'

export interface ShowBrijioApprovalMessage {
  type: 'show_brijio_approval'
  actionUUID: string
  actionType: string
  origin: string
  timeoutMs: number
}

export interface HideBrijioApprovalMessage {
  type: 'hide_brijio_approval'
  actionUUID: string
}

export interface ShowBrijioTabIndicatorMessage {
  type: 'show_brijio_tab_indicator'
}

export interface HideBrijioTabIndicatorMessage {
  type: 'hide_brijio_tab_indicator'
}

type ApprovalResponse =
  | { ok: true, decision: BrijioApprovalDecision }
  | { ok: true }

type SendResponse = (response: ContentResponse | BatchResult | ApprovalResponse | { ok: true }) => void

type IncomingMessage =
  | ContentRequest
  | ContentBatchRequest
  | ShowBrijioApprovalMessage
  | HideBrijioApprovalMessage
  | ShowBrijioTabIndicatorMessage
  | HideBrijioTabIndicatorMessage

interface BrowserRuntimeApi {
  runtime: {
    sendMessage: (message: { type: 'brijio_page_active' }) => Promise<unknown>
    onMessage: {
      addListener: (
        callback: (
          message: IncomingMessage,
          sender: unknown,
          sendResponse: SendResponse
        ) => boolean
      ) => void
      removeListener: (
        callback: (
          message: IncomingMessage,
          sender: unknown,
          sendResponse: SendResponse
        ) => boolean
      ) => void
    }
  }
}

declare const browser: BrowserRuntimeApi | undefined

const approvalBannerId = 'brijio-approval-banner'

export function showBrijioApprovalBanner (
  documentRef: Document,
  message: ShowBrijioApprovalMessage,
  onDecision: (decision: BrijioApprovalDecision) => void
): void {
  hideBrijioApprovalBanner(documentRef, message.actionUUID)

  const banner = documentRef.createElement('section')
  banner.id = approvalBannerId
  banner.dataset.brijioActionUuid = message.actionUUID
  banner.setAttribute('role', 'dialog')
  banner.setAttribute('aria-live', 'polite')
  Object.assign(banner.style, {
    alignItems: 'center',
    background: '#fff8d6',
    border: '1px solid #8a6f00',
    borderRadius: '6px',
    boxSizing: 'border-box',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.18)',
    color: '#1f2933',
    display: 'flex',
    flexWrap: 'wrap',
    font: '13px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    gap: '10px',
    left: '16px',
    maxWidth: 'min(720px, calc(100vw - 32px))',
    padding: '10px 12px',
    position: 'fixed',
    top: '16px',
    width: 'max-content',
    zIndex: '2147483647'
  })

  const text = documentRef.createElement('div')
  text.textContent = `Brijio wants approval to ${formatActionType(message.actionType)} on ${message.origin}.`
  Object.assign(text.style, {
    flex: '1 1 260px',
    minWidth: '220px'
  })
  banner.append(text)

  const actions = documentRef.createElement('div')
  Object.assign(actions.style, {
    display: 'flex',
    flex: '0 0 auto',
    flexWrap: 'wrap',
    gap: '8px'
  })
  actions.append(
    createApprovalButton(documentRef, 'Approve', 'approve', onDecision),
    createApprovalButton(documentRef, 'Approve session', 'approve_session', onDecision),
    createApprovalButton(documentRef, 'Deny', 'deny', onDecision)
  )
  banner.append(actions)

  documentRef.documentElement.append(banner)
}

export function hideBrijioApprovalBanner (
  documentRef: Document,
  actionUUID: string
): void {
  const banner = documentRef.getElementById(approvalBannerId)
  if (banner?.dataset.brijioActionUuid === actionUUID) {
    banner.remove()
  }
}

function formatActionType (actionType: string): string {
  return actionType.replace(/_/g, ' ')
}

function createApprovalButton (
  documentRef: Document,
  label: string,
  decision: BrijioApprovalDecision,
  onDecision: (decision: BrijioApprovalDecision) => void
): HTMLButtonElement {
  const button = documentRef.createElement('button')
  button.type = 'button'
  button.textContent = label
  button.dataset.brijioApprovalDecision = decision
  Object.assign(button.style, {
    background: decision === 'deny' ? '#ffffff' : '#1f8f4d',
    border: '1px solid #8a6f00',
    borderRadius: '4px',
    color: decision === 'deny' ? '#1f2933' : '#ffffff',
    cursor: 'pointer',
    font: 'inherit',
    lineHeight: '1.2',
    minHeight: '34px',
    whiteSpace: 'nowrap',
    padding: '6px 8px'
  })
  button.addEventListener('click', () => {
    button.closest(`#${approvalBannerId}`)?.remove()
    onDecision(decision)
  })
  return button
}

function isShowBrijioApprovalMessage (
  message: IncomingMessage
): message is ShowBrijioApprovalMessage {
  return message.type === 'show_brijio_approval'
}

function isHideBrijioApprovalMessage (
  message: IncomingMessage
): message is HideBrijioApprovalMessage {
  return message.type === 'hide_brijio_approval'
}

// --- Tab indicator banner ---

const tabIndicatorBannerId = 'brijio-tab-indicator'
const tabIndicatorTitlePrefix = '● '
const indicatorInactivityTimeoutMs = 60_000

interface TabIndicatorState {
  originalTitle: string
  observer: MutationObserver
}

const tabIndicatorStateMap = new WeakMap<Document, TabIndicatorState>()
const indicatorTimers = new WeakMap<Document, ReturnType<typeof setTimeout>>()

function setIndicatorExpiry (documentRef: Document): void {
  const existing = indicatorTimers.get(documentRef)
  if (existing !== undefined) {
    clearTimeout(existing)
  }
  const timer = setTimeout(() => {
    hideBrijioTabIndicator(documentRef)
  }, indicatorInactivityTimeoutMs)
  indicatorTimers.set(documentRef, timer)
}

export function showBrijioTabIndicator (documentRef: Document): void {
  hideBrijioTabIndicator(documentRef)

  const originalTitle = documentRef.title

  // Prepend the indicator prefix to the title
  if (!documentRef.title.startsWith(tabIndicatorTitlePrefix)) {
    documentRef.title = tabIndicatorTitlePrefix + documentRef.title
  }

  // Set up MutationObserver to re-apply prefix if the page changes its title
  const observer = new MutationObserver(() => {
    if (!documentRef.title.startsWith(tabIndicatorTitlePrefix)) {
      documentRef.title = tabIndicatorTitlePrefix + documentRef.title
    }
  })

  const titleElement = documentRef.querySelector('title')
  if (titleElement !== null) {
    observer.observe(titleElement, { childList: true, characterData: true, subtree: true })
  } else {
    // If no <title> element, observe the head
    const head = documentRef.querySelector('head')
    if (head !== null) {
      observer.observe(head, { childList: true })
    }
  }

  tabIndicatorStateMap.set(documentRef, { originalTitle, observer })
  setIndicatorExpiry(documentRef)

  // Inject the persistent blue banner
  const banner = documentRef.createElement('div')
  banner.id = tabIndicatorBannerId
  banner.setAttribute('role', 'status')
  banner.setAttribute('aria-live', 'polite')
  banner.textContent = 'Brijio is active on this tab'
  Object.assign(banner.style, {
    alignItems: 'center',
    background: '#1a56db',
    borderRadius: '4px',
    boxSizing: 'border-box',
    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
    color: '#ffffff',
    display: 'flex',
    font: '12px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontWeight: '600',
    gap: '6px',
    left: '16px',
    maxWidth: 'calc(100vw - 32px)',
    padding: '6px 12px',
    position: 'fixed',
    bottom: '16px',
    width: 'max-content',
    zIndex: '2147483647'
  })

  documentRef.documentElement.append(banner)
}

export function hideBrijioTabIndicator (documentRef: Document): void {
  const timer = indicatorTimers.get(documentRef)
  if (timer !== undefined) {
    clearTimeout(timer)
    indicatorTimers.delete(documentRef)
  }
  const state = tabIndicatorStateMap.get(documentRef)
  if (state !== undefined) {
    state.observer.disconnect()
    documentRef.title = state.originalTitle
    tabIndicatorStateMap.delete(documentRef)
  }

  const banner = documentRef.getElementById(tabIndicatorBannerId)
  if (banner !== null) {
    banner.remove()
  }
}

function isShowBrijioTabIndicatorMessage (
  message: IncomingMessage
): message is ShowBrijioTabIndicatorMessage {
  return message.type === 'show_brijio_tab_indicator'
}

function isHideBrijioTabIndicatorMessage (
  message: IncomingMessage
): message is HideBrijioTabIndicatorMessage {
  return message.type === 'hide_brijio_tab_indicator'
}

function notifyPageActive (browserApi: BrowserRuntimeApi): void {
  void browserApi.runtime.sendMessage({ type: 'brijio_page_active' }).catch(() => {})
}

export function registerPageActivityListeners (browserApi: BrowserRuntimeApi): void {
  const globalRef = globalThis as unknown as Record<string, unknown>
  const previousCleanup = globalRef.__brijioPageActivityCleanup as (() => void) | undefined
  previousCleanup?.()

  const notify = (): void => {
    notifyPageActive(browserApi)
  }
  const notifyWhenVisible = (): void => {
    if (!globalThis.document.hidden) {
      notify()
    }
  }

  if (typeof globalThis.addEventListener === 'function') {
    globalThis.addEventListener('pageshow', notify)
    globalThis.addEventListener('focus', notify)
  }
  globalThis.document.addEventListener('visibilitychange', notifyWhenVisible)

  globalRef.__brijioPageActivityCleanup = () => {
    if (typeof globalThis.removeEventListener === 'function') {
      globalThis.removeEventListener('pageshow', notify)
      globalThis.removeEventListener('focus', notify)
    }
    globalThis.document.removeEventListener('visibilitychange', notifyWhenVisible)
  }

  if (!globalThis.document.hidden) {
    notify()
  }
}

if (typeof browser !== 'undefined') {
  registerPageNavigationListener()
  registerPageActivityListeners(browser)

  type OnMessageCallback = (
    message: IncomingMessage,
    sender: unknown,
    sendResponse: SendResponse
  ) => boolean

  const globalRef = globalThis as Record<string, unknown>

  const onMessage: OnMessageCallback = (
    message: IncomingMessage,
    _sender: unknown,
    sendResponse: SendResponse
  ): boolean => {
    if (isShowBrijioApprovalMessage(message)) {
      showBrijioApprovalBanner(globalThis.document, message, decision => {
        sendResponse({ ok: true, decision })
      })
      return true
    }

    if (isHideBrijioApprovalMessage(message)) {
      hideBrijioApprovalBanner(globalThis.document, message.actionUUID)
      sendResponse({ ok: true })
      return false
    }

    if (isShowBrijioTabIndicatorMessage(message)) {
      showBrijioTabIndicator(globalThis.document)
      sendResponse({ ok: true })
      return true
    }

    if (isHideBrijioTabIndicatorMessage(message)) {
      hideBrijioTabIndicator(globalThis.document)
      sendResponse({ ok: true })
      return true
    }

    if (isContentBatchRequest(message)) {
      const result = executeBatch(
        {
          actions: message.actions,
          ...(message.pageContextId !== undefined ? { pageContextId: message.pageContextId } : {}),
          ...(message.visibleContextId !== undefined ? { visibleContextId: message.visibleContextId } : {}),
          ...(message.continueOnError !== undefined ? { continueOnError: message.continueOnError } : {}),
          ...(message.readAfterActions !== undefined ? { readAfterActions: message.readAfterActions } : {})
        },
        {
          document: globalThis.document,
          locationHref: globalThis.location.href,
          title: globalThis.document.title,
          selectedText: globalThis.getSelection?.()?.toString() ?? '',
          now: () => new Date().toISOString()
        }
      )
      sendResponse(result)
      return false
    }

    sendResponse(handleContentRequest(message, {
      document: globalThis.document,
      locationHref: globalThis.location.href,
      title: globalThis.document.title,
      selectedText: globalThis.getSelection?.()?.toString() ?? '',
      now: () => new Date().toISOString()
    }))
    return false
  }

  const previousListener = globalRef.__brijioOnMessageListener as OnMessageCallback | undefined
  if (previousListener !== undefined) {
    browser.runtime.onMessage.removeListener(previousListener)
  }
  browser.runtime.onMessage.addListener(onMessage)
  globalRef.__brijioOnMessageListener = onMessage
}
