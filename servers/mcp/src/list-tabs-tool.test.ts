import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { listTabs } from './list-tabs-tool.js'

void describe('MCP tab list tool', () => {
  void it('returns an error when pairing token is not configured', async () => {
    // This tool is a thin wrapper over the WebSocket client; detailed protocol
    // behavior is covered in websocket-client.test.ts.
    assert.deepEqual(
      await listTabs({
        websocketUrl: 'ws://127.0.0.1:1',
        pairingToken: '',
        timeoutMs: 100
      }),
      {
        ok: false,
        error: {
          code: 'auth_required',
          message: 'BRIJIO_PAIRING_TOKEN or BROWSERBRIDGE_PAIRING_TOKEN must be configured.'
        }
      }
    )
  })
})
