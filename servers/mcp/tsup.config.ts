import { defineConfig } from 'tsup'
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

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
    '../src/browser-list-tool.ts',
    '../src/demo-server.ts',
    '../src/startup-banner.ts'
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
  // and copy demo/ directory for brijio demo static file serving
  async onSuccess () {
    mkdirSync('dist/bin', { recursive: true })
    copyFileSync('package.json', 'dist/package.json')
    // Copy demo static files for brijio demo command (ADR-0039)
    const demoDest = join('dist', 'demo')
    mkdirSync(demoDest, { recursive: true })
    try {
      const demoSrc = join('demo')
      for (const file of readdirSync(demoSrc)) {
        copyFileSync(join(demoSrc, file), join(demoDest, file))
      }
    } catch {
      // demo/ may not exist during development at server level — non-fatal
    }
  }
})
