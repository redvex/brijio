import { fileURLToPath } from 'node:url'
import { generatePairingToken } from './token-utils.mjs'

export { generatePairingToken }

function printToken () {
  const token = generatePairingToken()

  console.log(token)
  console.error('')
  console.error('Use this token for local Brijio pairing:')
  console.error('- BRIJIO_PAIRING_TOKEN for new configuration')
  console.error('- BROWSERBRIDGE_PAIRING_TOKEN remains accepted as a legacy alias')
  console.error('- Pairing token in the Chrome extension setup page')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  printToken()
}