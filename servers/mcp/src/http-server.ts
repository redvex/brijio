import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from 'node:http'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {
  type BrowserBridgePageContextConfig,
  getPageContextConfigFromEnv
} from './page-context.js'
import { createBrowserBridgeMcpServer } from './mcp-server.js'

export interface BrowserBridgeMcpHttpServerOptions {
  host: string
  port: number
  path: string
  authToken: string
  allowedHosts: string[]
  allowedOrigins: string[]
  allowTailscaleHosts?: boolean
  allowLocalHosts?: boolean
  pageContextConfig?: BrowserBridgePageContextConfig
}

export interface BrowserBridgeMcpHttpRuntime {
  server: Server
  url: string
  close: () => Promise<void>
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
  const host = env.MCP_HTTP_HOST ?? '127.0.0.1'
  const port = parsePort(env.MCP_HTTP_PORT)
  const authToken = env.MCP_HTTP_AUTH_TOKEN ?? ''

  if (authToken.trim() === '') {
    throw new Error('MCP_HTTP_AUTH_TOKEN is required for MCP HTTP transport.')
  }

  const allowTailscaleHosts = parseBoolean(env.MCP_HTTP_ALLOW_TAILSCALE_HOSTS)
  const allowLocalHosts = parseBoolean(env.MCP_HTTP_ALLOW_LOCAL_HOSTS)
  const allowedHostSuffixes = getAllowedHostSuffixes({
    allowTailscaleHosts,
    allowLocalHosts
  })

  return {
    host,
    port,
    path: normalizePath(env.MCP_HTTP_PATH ?? '/mcp'),
    authToken,
    allowedHosts: withHostSuffixAllowances(
      parseList(env.MCP_HTTP_ALLOWED_HOSTS, defaultAllowedHosts(host)),
      allowedHostSuffixes
    ),
    allowedOrigins: withHostSuffixAllowances(
      parseList(env.MCP_HTTP_ALLOWED_ORIGINS, []),
      allowedHostSuffixes
    ),
    allowTailscaleHosts,
    allowLocalHosts,
    pageContextConfig: getPageContextConfigFromEnv(env)
  }
}

export async function startBrowserBridgeMcpHttpServer (
  options: BrowserBridgeMcpHttpServerOptions
): Promise<BrowserBridgeMcpHttpRuntime> {
  const server = createServer((request, response) => {
    void handleMcpHttpRequest(request, response, options)
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
  options: BrowserBridgeMcpHttpServerOptions
): Promise<void> {
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

  const allowedHostSuffixes = getAllowedHostSuffixes({
    allowTailscaleHosts: options.allowTailscaleHosts ?? false,
    allowLocalHosts: options.allowLocalHosts ?? false
  })
  const allowedHosts = withHostSuffixAllowances(
    options.allowedHosts,
    allowedHostSuffixes
  )
  const hostError = validateHost(request, allowedHosts)
  if (hostError !== undefined) {
    writeJsonError(response, 403, hostError)
    return
  }

  const allowedOrigins = withHostSuffixAllowances(
    options.allowedOrigins,
    allowedHostSuffixes
  )
  const originError = validateOrigin(request, allowedOrigins)
  if (originError !== undefined) {
    writeJsonError(response, 403, originError)
    return
  }

  if (!isAuthorized(request, options.authToken)) {
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

  const mcpServer = createBrowserBridgeMcpServer(options.pageContextConfig)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  })

  try {
    await mcpServer.connect(transport)
    await transport.handleRequest(request, response)
  } catch (error) {
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

function parseBoolean (value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true'
}

function getAllowedHostSuffixes (
  options: {
    allowTailscaleHosts: boolean
    allowLocalHosts: boolean
  }
): string[] {
  const suffixes: string[] = []

  if (options.allowTailscaleHosts) {
    suffixes.push('*.ts.net')
  }

  if (options.allowLocalHosts) {
    suffixes.push('*.local')
  }

  return suffixes
}

function withHostSuffixAllowances (
  values: string[],
  allowedHostSuffixes: string[]
): string[] {
  const nextValues = [...values]

  for (const suffix of allowedHostSuffixes) {
    if (!nextValues.includes(suffix)) {
      nextValues.push(suffix)
    }
  }

  return nextValues
}

function defaultAllowedHosts (host: string): string[] {
  if (host === '127.0.0.1' || host === 'localhost') {
    return ['127.0.0.1', 'localhost']
  }

  return [host]
}

function matchesPath (request: IncomingMessage, expectedPath: string): boolean {
  const url = new URL(request.url ?? '/', 'http://browserbridge.local')

  return url.pathname === expectedPath
}

function validateHost (
  request: IncomingMessage,
  allowedHosts: string[]
): HttpErrorBody | undefined {
  if (allowedHosts.length === 0) {
    return undefined
  }

  const host = request.headers.host

  if (host === undefined || !isAllowedHost(host, allowedHosts)) {
    return {
      ok: false,
      error: {
        code: 'forbidden_host',
        message: 'Host is not allowed for BrowserBridge MCP HTTP.'
      }
    }
  }
}

function isAllowedHost (hostHeader: string, allowedHosts: string[]): boolean {
  const hostName = stripPort(hostHeader)

  return allowedHosts.some((allowedHost) => {
    const allowedHostName = stripPort(allowedHost)

    return (
      allowedHost === hostHeader ||
      allowedHostName === hostName ||
      matchesWildcardHost(hostName, allowedHostName)
    )
  })
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

function stripPort (host: string): string {
  return host.split(':')[0].toLowerCase()
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
