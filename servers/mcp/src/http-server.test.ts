import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getMcpHttpServerOptionsFromEnv } from './http-server.js'

void describe('MCP HTTP server configuration', () => {
  void it('derives approval timeout from local HTTP timeout and buffer', () => {
    const options = getMcpHttpServerOptionsFromEnv({
      MCP_HTTP_AUTH_TOKEN: 'token',
      BRIJIO_MCP_HTTP_TIMEOUT_MS: '60000',
      BRIJIO_APPROVAL_TIMEOUT_BUFFER_MS: '5000'
    })

    assert.equal(options.httpTimeoutMs, 60000)
    assert.equal(options.approvalTimeoutMs, 55000)
  })
})
