import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from 'node:http'
import { readFileSync } from 'node:fs'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {
  type BrowserBridgePageContextConfig,
  getPageContextConfigFromEnv
} from './page-context.js'
import { createBrowserBridgeMcpServer } from './mcp-server.js'
import { createLogger } from '@browserbridge/shared'

const version: string = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
).version
const logger = createLogger('mcp')

export interface BrowserBridgeMcpHttpServerOptions {
  host: string
  port: number
  path: string
  authToken: string
  allowedOrigins: string[]
  pageContextConfig?: BrowserBridgePageContextConfig
}

export interface BrowserBridgeMcpHttpRuntime {
  server: Server
  url: string
  close: () => Promise<void>
}

export interface McpHealthStatus {
  status: 'ok'
  version: string
  uptimeSeconds: number
  websocket: {
    url: string
    status: 'reachable' | 'unknown'
  }
}

interface HttpErrorBody {
  ok: false
  error: {
    code: string
    message: string
  }
}

export function getMcpHttpServerOptionsFromEnv (
  env: NodeJS.ProcessEnv = process.env
): BrowserBridgeMcpHttpServerOptions {
  const host = env.MCP_HTTP_HOST ?? '0.0.0.0'
  const port = parsePort(env.MCP_HTTP_PORT)
  const authToken = env.MCP_HTTP_AUTH_TOKEN ?? ''

  if (authToken.trim() === '') {
    throw new Error('MCP_HTTP_AUTH_TOKEN is required for MCP HTTP transport.')
  }

  return {
    host,
    port,
    path: normalizePath(env.MCP_HTTP_PATH ?? '/mcp'),
    authToken,
    allowedOrigins: parseList(env.MCP_HTTP_ALLOWED_ORIGINS, []),
    pageContextConfig: getPageContextConfigFromEnv(env)
  }
}

export async function startBrowserBridgeMcpHttpServer (
  options: BrowserBridgeMcpHttpServerOptions
): Promise<BrowserBridgeMcpHttpRuntime> {
  const startTime = Date.now()
  const wsUrl = options.pageContextConfig?.websocketUrl ?? ''

  const server = createServer((request, response) => {
    void handleMcpHttpRequest(request, response, options, startTime, wsUrl)
  })

  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
    server.listen(options.port, options.host)
  })

  const address = server.address()

  if (address === null || typeof address === 'string') {
    throw new Error('BrowserBridge MCP HTTP server is not listening on TCP.')
  }

  return {
    server,
    url: `http://${options.host}:${address.port}${options.path}`,
    close: async () => {
      await closeServer(server)
    }
  }
}

async function handleMcpHttpRequest (
  request: IncomingMessage,
  response: ServerResponse,
  options: BrowserBridgeMcpHttpServerOptions,
  startTime: number,
  wsUrl: string
): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://browserbridge.local')

  if (url.pathname === '/health' && request.method === 'GET') {
    const health: McpHealthStatus = {
      status: 'ok',
      version,
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      websocket: {
        url: wsUrl,
        status: 'unknown'
      }
    }
    logger.debug('health_check', { uptimeSeconds: health.uptimeSeconds })
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify(health))
    return
  }

  if (!matchesPath(request, options.path)) {
    writeJsonError(response, 404, {
      ok: false,
      error: {
        code: 'not_found',
        message: 'BrowserBridge MCP HTTP endpoint was not found.'
      }
    })
    return
  }

  if (request.method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }

  const originError = validateOrigin(request, options.allowedOrigins)
  if (originError !== undefined) {
    writeJsonError(response, 403, originError)
    return
  }

  if (!isAuthorized(request, options.authToken)) {
    logger.warn('auth_unauthorized', { path: url.pathname })
    writeJsonError(response, 401, {
      ok: false,
      error: {
        code: 'unauthorized',
        message: 'Missing or invalid MCP HTTP bearer token.'
      }
    })
    return
  }

  if (!isMcpMethod(request.method)) {
    writeJsonError(response, 405, {
      ok: false,
      error: {
        code: 'method_not_allowed',
        message: 'BrowserBridge MCP HTTP only supports GET, POST, and DELETE.'
      }
    })
    return
  }

  const mcpServer = await createBrowserBridgeMcpServer(options.pageContextConfig)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  })

  logger.info('mcp_request', { method: request.method, path: url.pathname })

  try {
    await mcpServer.connect(transport)
    await transport.handleRequest(request, response)
  } catch (error) {
    logger.error('mcp_request_error', { message: error instanceof Error ? error.message : String(error) })
    if (!response.headersSent) {
      writeJsonError(response, 500, {
        ok: false,
        error: {
          code: 'mcp_http_error',
          message:
            error instanceof Error
              ? error.message
              : 'Unexpected MCP HTTP transport error.'
        }
      })
    } else {
      response.end()
    }
  } finally {
    await mcpServer.close()
  }
}

function parsePort (value: string | undefined): number {
  if (value === undefined) {
    return 8788
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 65535) {
    return 8788
  }

  return parsed
}

function normalizePath (value: string): string {
  const trimmed = value.trim()

  if (trimmed === '') {
    return '/mcp'
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function parseList (value: string | undefined, fallback: string[]): string[] {
  if (value === undefined) {
    return fallback
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '')
}

function matchesPath (request: IncomingMessage, expectedPath: string): boolean {
  const url = new URL(request.url ?? '/', 'http://browserbridge.local')

  return url.pathname === expectedPath
}

function validateOrigin (
  request: IncomingMessage,
  allowedOrigins: string[]
): HttpErrorBody | undefined {
  const origin = request.headers.origin

  if (origin === undefined) {
    return undefined
  }

  if (isAllowedOrigin(origin, allowedOrigins)) {
    return undefined
  }

  return {
    ok: false,
    error: {
      code: 'forbidden_origin',
      message: 'Origin is not allowed for BrowserBridge MCP HTTP.'
    }
  }
}

function isAllowedOrigin (origin: string, allowedOrigins: string[]): boolean {
  return allowedOrigins.some((allowedOrigin) => {
    if (allowedOrigin === origin) {
      return true
    }

    if (!allowedOrigin.startsWith('*.')) {
      return false
    }

    try {
      return matchesWildcardHost(new URL(origin).hostname, allowedOrigin)
    } catch {
      return false
    }
  })
}

function matchesWildcardHost (hostName: string, allowedHost: string): boolean {
  if (!allowedHost.startsWith('*.')) {
    return false
  }

  const suffix = allowedHost.slice(1).toLowerCase()

  return hostName.toLowerCase().endsWith(suffix)
}

function isAuthorized (
  request: IncomingMessage,
  authToken: string
): boolean {
  return request.headers.authorization === `Bearer ${authToken}`
}

function isMcpMethod (method: string | undefined): boolean {
  return method === 'GET' || method === 'POST' || method === 'DELETE'
}

function writeJsonError (
  response: ServerResponse,
  statusCode: number,
  body: HttpErrorBody
): void {
  response.writeHead(statusCode, {
    'content-type': 'application/json'
  })
  response.end(JSON.stringify(body))
}

async function closeServer (server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error != null && !String(error.message).includes('not running')) {
        reject(error)
        return
      }

      resolve()
    })
  })
}
