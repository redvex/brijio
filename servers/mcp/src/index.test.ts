import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const currentPageResourceUri = 'browser://page/current'

void describe('BrowserBridge MCP stdio server', () => {
  void it('uses the official MCP lifecycle for initialize, resource discovery, and ping', async () => {
    const client = new Client({
      name: 'browserbridge-mcp-test',
      version: '0.0.0'
    })
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['--import', 'tsx', 'src/index.ts'],
      cwd: packageRoot,
      env: {
        BROWSERBRIDGE_WEBSOCKET_URL: 'ws://127.0.0.1:1',
        BROWSERBRIDGE_REQUEST_TIMEOUT_MS: '100'
      },
      stderr: 'pipe'
    })

    try {
      await client.connect(transport, { timeout: 1000 })

      assert.deepEqual(client.getServerVersion(), {
        name: 'browserbridge-mcp',
        version: '0.0.0'
      })

      const resources = await client.listResources(undefined, { timeout: 1000 })
      assert.deepEqual(
        resources.resources.map((resource) => ({
          uri: resource.uri,
          name: resource.name,
          mimeType: resource.mimeType
        })),
        [
          {
            uri: currentPageResourceUri,
            name: 'current-page-context',
            mimeType: 'application/json'
          }
        ]
      )

      const currentPage = await client.readResource(
        {
          uri: currentPageResourceUri
        },
        { timeout: 1000 }
      )

      assert.equal(currentPage.contents.length, 1)
      const content = currentPage.contents[0]
      assert.ok('text' in content)
      assert.deepEqual(JSON.parse(content.text), {
        ok: false,
        error: {
          code: 'connection_failed',
          message:
            'Unable to connect to BrowserBridge WebSocket at ws://127.0.0.1:1.'
        }
      })

      await assert.doesNotReject(async () => {
        await client.ping({ timeout: 1000 })
      })
    } finally {
      await client.close()
    }
  })
})
