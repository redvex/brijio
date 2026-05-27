import { createHash } from 'node:crypto'

export {
  createAuthSuccessEnvelope,
  createBrowserPresenceRequestEnvelope,
  createErrorEnvelope,
  isAuthPayload,
  isBrowserPresenceAnnouncePayload,
  parseBrowserBridgeEnvelope,
  type BrowserBridgeEnvelope,
  type BrowserPresence,
  type BrowserPresenceAnnouncePayload,
  type BrowserBridgeRole
} from '@browserbridge/shared'

export function createScopeKey (token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
