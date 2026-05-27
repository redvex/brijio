import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

interface ListenerRegistry<T> {
  listeners: T[]
  addListener: (listener: T) => void
}

function createListenerRegistry<T> (): ListenerRegistry<T> {
  const listeners: T[] = []
  return {
    listeners,
    addListener (listener: T): void {
      listeners.push(listener)
    }
  }
}

void describe('Safari background entry point', () => {
  void it('registers listeners with the Manifest V2 browserAction API', async () => {
    const browser = {
      browserAction: {
        onClicked: createListenerRegistry<() => void | Promise<void>>(),
        async setBadgeText (_details: { text: string }) {},
        async setTitle (_details: { title: string }) {}
      },
      runtime: {
        onMessage: createListenerRegistry<
        (
          message: { type?: unknown, websocketUrl?: unknown },
          sender: unknown,
          sendResponse: (response: unknown) => void
        ) => boolean | undefined
        >()
      },
      storage: {
        local: {
          async get (_keys: string[]) {
            return {}
          },
          async set (_items: Record<string, unknown>) {}
        }
      },
      tabs: {
        async query (_queryInfo: { active: boolean, currentWindow: boolean }) {
          return []
        },
        async sendMessage (_tabId: number, _message: unknown) {
          return undefined
        }
      },
      scripting: {
        async executeScript (_details: { target: { tabId: number }, files: string[] }) {
          return undefined
        }
      }
    }

    ;(globalThis as unknown as { browser: unknown }).browser = browser

    await import(`./background-entry.js?test=${Date.now()}`)

    assert.equal(browser.browserAction.onClicked.listeners.length, 1)
    assert.equal(browser.runtime.onMessage.listeners.length, 1)
  })
})
