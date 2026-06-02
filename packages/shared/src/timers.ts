import type { TimersAdapter } from './background-controller.js'

export interface TimerScope {
  setInterval: (callback: () => void, intervalMs: number) => number
  clearInterval: (timerId: number) => void
  setTimeout: (callback: () => void, delayMs: number) => number
  clearTimeout: (timerId: number) => void
}

export function createGlobalTimers (
  scope: TimerScope = globalThis as unknown as TimerScope
): TimersAdapter {
  return {
    setInterval (callback, intervalMs) {
      return scope.setInterval(callback, intervalMs)
    },
    clearInterval (timerId) {
      scope.clearInterval(timerId)
    },
    setTimeout (callback, delayMs) {
      return scope.setTimeout(callback, delayMs)
    },
    clearTimeout (timerId) {
      scope.clearTimeout(timerId)
    }
  }
}
