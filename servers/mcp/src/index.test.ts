import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

void describe('BrowserBridge MCP stdio server', () => {
  void it('uses the official MCP lifecycle for initialize, tool discovery, and ping', async () => {
    const client = new Client({
      name: 'browserbridge-mcp-test',
      version: '0.0.0'
    })
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['--import', 'tsx', 'src/index.ts'],
      cwd: packageRoot,
      stderr: 'pipe'
    })

    try {
      await client.connect(transport, { timeout: 1000 })

      assert.deepEqual(client.getServerVersion(), {
        name: 'browserbridge-mcp',
        version: '0.0.0'
      })

      const tools = await client.listTools(undefined, { timeout: 1000 })
      assert.deepEqual(
        tools.tools.map((tool) => tool.name),
        ['get_current_page_context']
      )

      await assert.doesNotReject(async () => {
        await client.ping({ timeout: 1000 })
      })
    } finally {
      await client.close()
    }
  })
})
