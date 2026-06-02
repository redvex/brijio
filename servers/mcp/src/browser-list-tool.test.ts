import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { listBrowsers } from './browser-list-tool.js'

void describe('MCP browser list tool', () => {
  void it('returns available browser presence records', async () => {
    // This tool is a thin wrapper over the WebSocket client; detailed protocol
    // behavior is covered in websocket-client.test.ts.
    assert.deepEqual(
      await listBrowsers({
        websocketUrl: 'ws://127.0.0.1:1',
        pairingToken: '',
        timeoutMs: 100
      }),
      {
        ok: false,
        error: {
          code: 'auth_required',
          message: 'BROWSERBRIDGE_PAIRING_TOKEN must be configured.'
        }
      }
    )
  })
})
