export interface Logger {
  readonly service: string
  debug (message: string, context?: Record<string, unknown>): void
  info (message: string, context?: Record<string, unknown>): void
  warn (message: string, context?: Record<string, unknown>): void
  error (message: string, context?: Record<string, unknown>): void
}

export interface LogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  service: string
  [key: string]: unknown
}

export function createLogger (service: string, sink?: (line: string) => void): Logger {
  const write = sink ?? ((line: string) => { process.stderr.write(line) })

  function log (level: LogEntry['level'], message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service,
      ...context
    }
    write(JSON.stringify(entry) + '\n')
  }

  return {
    service,
    debug: (message, context) => { log('debug', message, context) },
    info: (message, context) => { log('info', message, context) },
    warn: (message, context) => { log('warn', message, context) },
    error: (message, context) => { log('error', message, context) }
  }
}