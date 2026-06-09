/* eslint-disable @typescript-eslint/no-floating-promises */
/**
 * Tests for doctor module (ADR-0038).
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatDoctorReport, type DoctorCheckResult } from './doctor.js'

describe('formatDoctorReport', () => {
  it('formats passing results', () => {
    const results: DoctorCheckResult[] = [
      { name: 'Config', status: 'pass', message: 'Config file found' },
      { name: 'MCP HTTP port 8788', status: 'pass', message: 'Port 8788 is available' },
      { name: 'Node.js', status: 'pass', message: 'Node.js v22.0.0' }
    ]
    const report = formatDoctorReport(results)
    assert.ok(report.includes('Brijio Doctor'))
    assert.ok(report.includes('✅'))
    assert.ok(report.includes('All checks passed'))
  })

  it('formats failing results', () => {
    const results: DoctorCheckResult[] = [
      { name: 'Config', status: 'pass', message: 'Config file found' },
      { name: 'MCP HTTP port 8788', status: 'fail', message: 'Port 8788 is already in use' }
    ]
    const report = formatDoctorReport(results)
    assert.ok(report.includes('❌'))
    assert.ok(report.includes('issue(s) found'))
  })

  it('formats warnings', () => {
    const results: DoctorCheckResult[] = [
      { name: 'Config', status: 'warn', message: 'No config file', detail: 'Using env vars' }
    ]
    const report = formatDoctorReport(results)
    assert.ok(report.includes('⚠️'))
    assert.ok(report.includes('warning'))
  })

  it('includes detail lines', () => {
    const results: DoctorCheckResult[] = [
      { name: 'Network', status: 'pass', message: '2 paths detected', detail: 'Tailscale: http://100.x.x.x:8788/mcp\nLocalhost: http://localhost:8788/mcp' }
    ]
    const report = formatDoctorReport(results)
    assert.ok(report.includes('Tailscale'))
    assert.ok(report.includes('Localhost'))
  })
})
