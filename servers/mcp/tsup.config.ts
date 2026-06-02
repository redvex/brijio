import { defineConfig } from 'tsup'
import { copyFileSync, mkdirSync } from 'node:fs'

export default defineConfig({
  entry: {
    'bin/browserbridge': 'bin/browserbridge.mjs',
    'http-server': 'src/http-server.ts'
  },
  format: ['esm'],
  target: 'node20',
  splitting: false,
  // Bundle workspace deps into the output
  noExternal: [
    '@browserbridge/shared',
    '@browserbridge/websocket'
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
