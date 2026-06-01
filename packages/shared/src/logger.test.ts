import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createLogger } from './logger.js'

void describe('createLogger', () => {
  void it('creates a logger with a service name', () => {
    const logger = createLogger('test-service')
    assert.equal(logger.service, 'test-service')
  })

  void it('writes info-level JSON log entries', () => {
    const lines: string[] = []
    const logger = createLogger('test', (line) => { lines.push(line) })

    logger.info('hello', { key: 'value' })

    assert.equal(lines.length, 1)
    const entry = JSON.parse(lines[0]) as Record<string, unknown>
    assert.equal(entry.level, 'info')
    assert.equal(entry.message, 'hello')
    assert.equal(entry.service, 'test')
    assert.equal(entry.key, 'value')
    assert.ok(typeof entry.timestamp === 'string')
  })

  void it('writes error-level entries', () => {
    const lines: string[] = []
    const logger = createLogger('test', (line) => { lines.push(line) })

    logger.error('something failed', { code: 'E_AUTH' })

    const entry = JSON.parse(lines[0]) as Record<string, unknown>
    assert.equal(entry.level, 'error')
    assert.equal(entry.message, 'something failed')
    assert.equal(entry.code, 'E_AUTH')
  })

  void it('writes warn-level entries', () => {
    const lines: string[] = []
    const logger = createLogger('test', (line) => { lines.push(line) })

    logger.warn('deprecation notice')

    const entry = JSON.parse(lines[0]) as Record<string, unknown>
    assert.equal(entry.level, 'warn')
    assert.equal(entry.message, 'deprecation notice')
  })

  void it('writes debug-level entries', () => {
    const lines: string[] = []
    const logger = createLogger('debug-svc', (line) => { lines.push(line) })

    logger.debug('trace detail', { requestId: 'abc123' })

    const entry = JSON.parse(lines[0]) as Record<string, unknown>
    assert.equal(entry.level, 'debug')
    assert.equal(entry.service, 'debug-svc')
    assert.equal(entry.requestId, 'abc123')
  })

  void it('serializes without extra context', () => {
    const lines: string[] = []
    const logger = createLogger('minimal', (line) => { lines.push(line) })

    logger.info('startup')

    const entry = JSON.parse(lines[0]) as Record<string, unknown>
    assert.deepEqual(Object.keys(entry).sort(), ['level', 'message', 'service', 'timestamp'])
  })

  void it('writes each log as a single line ending with newline', () => {
    const lines: string[] = []
    const logger = createLogger('test', (line) => { lines.push(line) })

    logger.info('first')
    logger.info('second')

    assert.equal(lines.length, 2)
    assert.ok(lines[0].endsWith('\n'))
    assert.ok(lines[1].endsWith('\n'))
  })

  void it('defaults to process.stderr when no sink is provided', () => {
    const originalWrite = process.stderr.write
    const captured: string[] = []
    process.stderr.write = (chunk: unknown) => {
      if (typeof chunk === 'string') captured.push(chunk)
      return true
    }

    try {
      const logger = createLogger('stderr-test')
      logger.info('writes to stderr')

      assert.equal(captured.length, 1)
      const entry = JSON.parse(captured[0]) as Record<string, unknown>
      assert.equal(entry.service, 'stderr-test')
      assert.equal(entry.message, 'writes to stderr')
    } finally {
      process.stderr.write = originalWrite
    }
  })
})
