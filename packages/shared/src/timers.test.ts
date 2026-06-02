import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createGlobalTimers } from './timers.js'

void describe('Chrome extension timer adapter', () => {
  void it('uses a worker-compatible global timer scope', () => {
    let scheduledIntervalMs = 0
    let scheduledTimeoutMs = 0
    let clearedTimerId = 0
    let clearedTimeoutId = 0
    const timers = createGlobalTimers({
      setInterval (_callback, intervalMs) {
        scheduledIntervalMs = intervalMs
        return 42
      },
      clearInterval (timerId) {
        clearedTimerId = timerId
      },
      setTimeout (_callback, delayMs) {
        scheduledTimeoutMs = delayMs
        return 43
      },
      clearTimeout (timerId) {
        clearedTimeoutId = timerId
      }
    })

    const timerId = timers.setInterval(() => {}, 20000)
    timers.clearInterval(timerId)
    const timeoutId = timers.setTimeout(() => {}, 1000)
    timers.clearTimeout(timeoutId)

    assert.equal(timerId, 42)
    assert.equal(timeoutId, 43)
    assert.equal(scheduledIntervalMs, 20000)
    assert.equal(scheduledTimeoutMs, 1000)
    assert.equal(clearedTimerId, 42)
    assert.equal(clearedTimeoutId, 43)
  })
})
