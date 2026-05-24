import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createGlobalTimers } from './timers.js'

void describe('Chrome extension timer adapter', () => {
  void it('uses a worker-compatible global timer scope', () => {
    let scheduledIntervalMs = 0
    let clearedTimerId = 0
    const timers = createGlobalTimers({
      setInterval (_callback, intervalMs) {
        scheduledIntervalMs = intervalMs
        return 42
      },
      clearInterval (timerId) {
        clearedTimerId = timerId
      }
    })

    const timerId = timers.setInterval(() => {}, 20000)
    timers.clearInterval(timerId)

    assert.equal(timerId, 42)
    assert.equal(scheduledIntervalMs, 20000)
    assert.equal(clearedTimerId, 42)
  })
})
