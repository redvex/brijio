import { randomBytes } from 'node:crypto'

export function generatePairingToken () {
  return randomBytes(32).toString('base64url')
}

export function generateAuthToken () {
  return randomBytes(32).toString('base64url')
}