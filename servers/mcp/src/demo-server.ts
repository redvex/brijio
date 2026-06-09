/**
 * Static demo file server for `brijio demo`.
 *
 * Serves demo static files over HTTP so users can verify the full
 * WS + MCP + browser-extension stack without Docker.
 * Per ADR-0039: started only for the `demo` subcommand, not `start` or `run`.
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, join, posix, resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createLogger } from '@brijio/shared'

const logger = createLogger('demo')

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8'
}

/**
 * Resolve the demo static files directory.
 *
 * Strategy (per ADR-0039: clients/test-page/ is single source of truth):
 * 1. BRIJIO_DEMO_DIR env var (explicit override)
 * 2. Walk up from this module's directory looking for `clients/test-page/index.html`
 *    (monorepo dev mode: serves directly from the source of truth)
 * 3. Walk up from this module's directory looking for a `demo/` folder
 *    that contains `index.html` (npm bundled mode: dist/demo/)
 * 4. Fallback to <cwd>/clients/test-page/
 */
function resolveDemoDir (): string {
  const envDir = process.env.BRIJIO_DEMO_DIR
  if ((envDir ?? '').trim() !== '') {
    return resolve(envDir as string)
  }

  // Walk up from this file's directory to find clients/test-page/index.html first
  // (monorepo dev mode — single source of truth per ADR-0039)
  try {
    const thisDir = dirname(fileURLToPath(import.meta.url))
    let dir = thisDir
    for (let i = 0; i < 15; i += 1) {
      const candidate = join(dir, 'clients', 'test-page')
      if (existsSync(join(candidate, 'index.html'))) {
        return resolve(candidate)
      }
      const parent = resolve(dir, '..')
      if (parent === dir) break
      dir = parent
    }
  } catch {
    // import.meta.url may not be available in some test contexts
  }

  // Walk up looking for demo/index.html (npm bundled mode)
  try {
    const thisDir = dirname(fileURLToPath(import.meta.url))
    let dir = thisDir
    for (let i = 0; i < 15; i += 1) {
      const candidate = join(dir, 'demo')
      if (existsSync(join(candidate, 'index.html'))) {
        return resolve(candidate)
      }
      const parent = resolve(dir, '..')
      if (parent === dir) break
      dir = parent
    }
  } catch {
    // import.meta.url may not be available in some test contexts
  }

  return resolve(process.cwd(), 'clients', 'test-page')
}

function dirname (path: string): string {
  const idx = path.lastIndexOf('/')
  return idx >= 0 ? path.slice(0, idx) : '.'
}

export interface DemoServerOptions {
  host: string
  port: number
}

export interface DemoServerRuntime {
  server: Server
  url: string
  close: () => Promise<void>
}

/**
 * Start the demo static file server.
 */
export async function startDemoServer (options: DemoServerOptions): Promise<DemoServerRuntime> {
  const demoDir = resolveDemoDir()
  const { host, port } = options

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void handleRequest(req, res, demoDir)
  })

  return await new Promise((resolve, reject) => {
    server.on('error', reject)

    server.listen(port, host, () => {
      server.removeListener('error', reject)

      const displayHost = host === '0.0.0.0' ? '127.0.0.1' : host
      const url = 'http://' + displayHost + ':' + String(port) + '/'

      logger.info('demo_server_started', { url, demoDir })

      resolve({
        server,
        url,
        close: async () => {
          await new Promise<void>((_resolve, _reject) => {
            server.close((err) => {
              if (err != null) {
                _reject(err)
              } else {
                _resolve()
              }
            })
          })
        }
      })
    })
  })
}

/**
 * Get the default demo port from env or fallback.
 */
export function getDemoPortFromEnv (env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.BRIJIO_DEMO_PORT ?? env.BROWSERBRIDGE_DEMO_PORT
  if (raw !== undefined && raw.trim() !== '') {
    const parsed = Number.parseInt(raw, 10)
    if (Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 65535) {
      return parsed
    }
  }
  return 8789
}

async function handleRequest (req: IncomingMessage, res: ServerResponse, demoDir: string): Promise<void> {
  const parsedUrl = new URL(req.url ?? '/', 'http://localhost')
  let pathname = posix.normalize(decodeURIComponent(parsedUrl.pathname))

  // Prevent path traversal
  if (pathname.includes('..')) {
    res.writeHead(403, { 'Content-Type': 'text/plain' })
    res.end('Forbidden')
    return
  }

  // Serve index.html for root or for /results (SPA-style hash routing)
  if (pathname === '/' || pathname === '/results') {
    pathname = '/index.html'
  }

  const filePath = join(demoDir, pathname)
  // Ensure the resolved path is within demoDir (path traversal check)
  const resolvedPath = resolve(filePath)
  if (!resolvedPath.startsWith(resolve(demoDir))) {
    res.writeHead(403, { 'Content-Type': 'text/plain' })
    res.end('Forbidden')
    return
  }

  try {
    const data = await readFile(resolvedPath)
    const ext = extname(resolvedPath).toLowerCase()
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream'

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    })
    res.end(data)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
  }
}
