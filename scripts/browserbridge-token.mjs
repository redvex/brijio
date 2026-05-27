import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

export function generatePairingToken () {
  return randomBytes(32).toString('base64url')
}

function printToken () {
  const token = generatePairingToken()

  console.log(token)
  console.error('')
  console.error('Use this token for local BrowserBridge pairing:')
  console.error('- BROWSERBRIDGE_PAIRING_TOKEN for the WebSocket server')
  console.error('- BROWSERBRIDGE_PAIRING_TOKEN for the MCP server')
  console.error('- Pairing token in the Chrome extension setup page')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  printToken()
}
