import { defineConfig } from 'tsup'
import { copyFileSync, mkdirSync } from 'node:fs'

export default defineConfig({
  entry: {
    'bin/brijio': 'bin/brijio.mjs'
  },
  format: ['esm'],
  target: 'node20',
  splitting: false,
  // Bundle workspace deps and internal server modules into the single output
  noExternal: [
    '@brijio/shared',
    '@brijio/websocket',
    '../src/daemon.ts',
    '../src/http-server.ts',
    '../src/page-context.ts',
    '../src/protocol.ts',
    '../src/browser-list-tool.ts'
  ],
  // Keep npm deps and tsx runtime external
  external: [
    '@modelcontextprotocol/sdk',
    'ws',
    'zod',
    'tsx'
  ],
  clean: true,
  dts: false,
  minify: false,
  esmOptions: {
    shimMissingCJS: true
  },
  // Copy package.json to dist/ so readFileSync('../package.json') resolves
  async onSuccess () {
    mkdirSync('dist/bin', { recursive: true })
    copyFileSync('package.json', 'dist/package.json')
  }
})