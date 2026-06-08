import { createHash } from 'node:crypto'

export {
  createAuthSuccessEnvelope,
  createBrowserPresenceRequestEnvelope,
  createErrorEnvelope,
  isAuthPayload,
  isBrowserPresenceAnnouncePayload,
  parseBrijioEnvelope,
  type BrijioEnvelope,
  type BrowserPresence,
  type BrowserPresenceAnnouncePayload,
  type BrijioRole
} from '@brijio/shared'

export function createScopeKey (token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
