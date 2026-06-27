import assert from 'node:assert/strict'
import { type AddressInfo } from 'node:net'
import { afterEach, describe, it } from 'node:test'
import { WebSocketServer, type RawData, type WebSocket } from 'ws'
import {
  requestClickElement,
  requestBrowserList,
  requestFillInput,
  requestNavigateToUrl,
  requestPageContent,
  requestPageContext,
  requestSelectOptions,
  requestSetChecked,
  requestSubmitForm,
  requestWriteEditable
} from './websocket-client.js'

const servers: WebSocketServer[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(closeServer))
})

void describe('Brijio WebSocket client', () => {
  void it('authenticates before sending a page context request', async () => {
    const receivedPayloadTypes: string[] = []
    const server = await startServer((socket) => {
      socket.on('message', (data) => {
        const request = JSON.parse(rawDataToString(data)) as {
          id?: string
          payload: { type: string }
        }
        receivedPayloadTypes.push(request.payload.type)

        if (request.payload.type === 'auth') {
          socket.send(
            JSON.stringify({
              type: 'message',
              id: request.id,
              payload: {
                type: 'auth_success'
              }
            })
          )
          return
        }

        socket.send(
          JSON.stringify({
            type: 'message',
            id: request.id,
            payload: {
              type: 'page_context_response',
              ok: true,
              data: createRichPageContext()
            }
          })
        )
      })
    })

    assert.equal(
      (
        await requestPageContext({
          websocketUrl: server.url,
          pairingToken: 'local-token',
          timeoutMs: 100,
          createRequestId: () => 'request-auth-1'
        })
      ).ok,
      true
    )
    assert.deepEqual(receivedPayloadTypes, ['auth', 'get_page_context'])
  })

  void it('requests page context and returns the matching response', async () => {
    const server = await startServer((socket) => {
      onAuthenticatedMessage(socket, (data) => {
        const request = JSON.parse(rawDataToString(data)) as { id: string }

        socket.send(
          JSON.stringify({
            type: 'message',
            id: request.id,
            payload: {
              type: 'page_context_response',
              ok: true,
              data: createRichPageContext()
            }
          })
        )
      })
    })

    assert.deepEqual(
      await requestPageContext({
        websocketUrl: server.url,
        pairingToken: 'local-token',
        timeoutMs: 100,
        createRequestId: () => 'request-1'
      }),
      {
        ok: true,
        data: createRichPageContext()
      }
    )
  })

  void it('requests page content and returns the matching response', async () => {
    let receivedPayload: unknown
    const server = await startServer((socket) => {
      onAuthenticatedMessage(socket, (data) => {
        const request = JSON.parse(rawDataToString(data)) as {
          id: string
          payload: unknown
        }
        receivedPayload = request.payload

        socket.send(
          JSON.stringify({
            type: 'message',
            id: request.id,
            payload: {
              type: 'page_content_response',
              ok: true,
              data: {
                url: 'https://example.com/',
                title: 'Example',
                timestamp: '2026-05-25T10:00:00.000Z',
                index: 2,
                content: 'Second chunk',
                truncated: false,
                maxPayloadBytes: 131072
              }
            }
          })
        )
      })
    })

    assert.deepEqual(
      await requestPageContent({
        websocketUrl: server.url,
        pairingToken: 'local-token',
        timeoutMs: 100,
        index: 2,
        createRequestId: () => 'request-content-1'
      }),
      {
        ok: true,
        data: {
          url: 'https://example.com/',
          title: 'Example',
          timestamp: '2026-05-25T10:00:00.000Z',
          index: 2,
          content: 'Second chunk',
          truncated: false,
          maxPayloadBytes: 131072
        }
      }
    )
    assert.deepEqual(receivedPayload, {
      type: 'get_page_content',
      index: 2
    })
  })

  void it('requests the browser list', async () => {
    const server = await startServer((socket) => {
      onAuthenticatedMessage(socket, (data) => {
        const request = JSON.parse(rawDataToString(data)) as { id: string }

        socket.send(
          JSON.stringify({
            type: 'message',
            id: request.id,
            payload: {
              type: 'browser_list',
              ok: true,
              data: {
                browsers: [
                  {
                    browserInstanceId: 'chrome-default-test',
                    label: 'Chrome Default',
                    browserName: 'Chrome',
                    profileName: 'Default',
                    connectedAt: '2026-05-25T10:00:00.000Z',
                    lastSeenAt: '2026-05-25T10:00:00.000Z',
                    capabilities: ['page_context']
                  }
                ]
              }
            }
          })
        )
      })
    })

    assert.deepEqual(
      await requestBrowserList({
        websocketUrl: server.url,
        pairingToken: 'local-token',
        timeoutMs: 100,
        createRequestId: () => 'request-browsers-1'
      }),
      {
        ok: true,
        data: {
          browsers: [
            {
              browserInstanceId: 'chrome-default-test',
              label: 'Chrome Default',
              browserName: 'Chrome',
              profileName: 'Default',
              connectedAt: '2026-05-25T10:00:00.000Z',
              lastSeenAt: '2026-05-25T10:00:00.000Z',
              capabilities: ['page_context']
            }
          ]
        }
      }
    )
  })

  void it('adds browserInstanceId targets to page requests', async () => {
    let receivedTarget: unknown
    const server = await startServer((socket) => {
      onAuthenticatedMessage(socket, (data) => {
        const request = JSON.parse(rawDataToString(data)) as {
          id: string
          target: unknown
        }
        receivedTarget = request.target

        socket.send(
          JSON.stringify({
            type: 'message',
            id: request.id,
            payload: {
              type: 'page_context_response',
              ok: true,
              data: createRichPageContext()
            }
          })
        )
      })
    })

    await requestPageContext({
      websocketUrl: server.url,
      pairingToken: 'local-token',
      timeoutMs: 100,
      browserInstanceId: 'chrome-default-test',
      createRequestId: () => 'request-target-1'
    })

    assert.deepEqual(receivedTarget, {
      browserInstanceId: 'chrome-default-test'
    })
  })

  void it('adds tabId to the target when provided', async () => {
    let receivedTarget: unknown
    const server = await startServer((socket) => {
      onAuthenticatedMessage(socket, (data) => {
        const request = JSON.parse(rawDataToString(data)) as {
          id: string
          target: unknown
        }
        receivedTarget = request.target

        socket.send(
          JSON.stringify({
            type: 'message',
            id: request.id,
            payload: {
              type: 'page_context_response',
              ok: true,
              data: createRichPageContext()
            }
          })
        )
      })
    })

    await requestPageContext({
      websocketUrl: server.url,
      pairingToken: 'local-token',
      timeoutMs: 100,
      tabId: 'tab-42',
      createRequestId: () => 'request-tabid-1'
    })

    assert.deepEqual(receivedTarget, {
      tabId: 'tab-42'
    })
  })

  void it('adds both browserInstanceId and tabId to the target when provided', async () => {
    let receivedTarget: unknown
    const server = await startServer((socket) => {
      onAuthenticatedMessage(socket, (data) => {
        const request = JSON.parse(rawDataToString(data)) as {
          id: string
          target: unknown
        }
        receivedTarget = request.target

        socket.send(
          JSON.stringify({
            type: 'message',
            id: request.id,
            payload: {
              type: 'page_context_response',
              ok: true,
              data: createRichPageContext()
            }
          })
        )
      })
    })

    await requestPageContext({
      websocketUrl: server.url,
      pairingToken: 'local-token',
      timeoutMs: 100,
      browserInstanceId: 'chrome-default-test',
      tabId: 'tab-42',
      createRequestId: () => 'request-tabid-2'
    })

    assert.deepEqual(receivedTarget, {
      browserInstanceId: 'chrome-default-test',
      tabId: 'tab-42'
    })
  })

  void it('requests a click action and returns the matching action result', async () => {
    let receivedPayload: unknown
    const server = await startServer((socket) => {
      onAuthenticatedMessage(socket, (data) => {
        const request = JSON.parse(rawDataToString(data)) as {
          id: string
          payload: unknown
        }
        receivedPayload = request.payload

        socket.send(
          JSON.stringify({
            type: 'message',
            id: request.id,
            payload: {
              type: 'action_result',
              ok: true,
              data: {
                action: 'click',
                target: {
                  kind: 'link',
                  id: 'bb-1'
                }
              }
            }
          })
        )
      })
    })

    assert.deepEqual(
      await requestClickElement({
        websocketUrl: server.url,
        pairingToken: 'local-token',
        timeoutMs: 100,
        target: {
          kind: 'link',
          id: 'bb-1'
        },
        createRequestId: () => 'request-click-1'
      }),
      {
        ok: true,
        data: {
          action: 'click',
          target: {
            kind: 'link',
            id: 'bb-1'
          }
        }
      }
    )
    assert.deepEqual(receivedPayload, {
      type: 'perform_action',
      action: {
        type: 'click',
        target: {
          kind: 'link',
          id: 'bb-1'
        }
      }
    })
  })

  void it('requests a fill input action and returns the matching action result', async () => {
    let receivedPayload: unknown
    const server = await startServer((socket) => {
      onAuthenticatedMessage(socket, (data) => {
        const request = JSON.parse(rawDataToString(data)) as {
          id: string
          payload: unknown
        }
        receivedPayload = request.payload

        socket.send(
          JSON.stringify({
            type: 'message',
            id: request.id,
            payload: {
              type: 'action_result',
              ok: true,
              data: {
                action: 'write_text',
                target: {
                  formId: 'form-1',
                  controlId: 'control-1'
                },
                textLength: 5
              }
            }
          })
        )
      })
    })

    assert.deepEqual(
      await requestFillInput({
        websocketUrl: server.url,
        pairingToken: 'local-token',
        timeoutMs: 100,
        target: {
          formId: 'form-1',
          controlId: 'control-1'
        },
        text: 'hello',
        createRequestId: () => 'request-fill-1'
      }),
      {
        ok: true,
        data: {
          action: 'write_text',
          target: {
            formId: 'form-1',
            controlId: 'control-1'
          },
          textLength: 5
        }
      }
    )
    assert.deepEqual(receivedPayload, {
      type: 'perform_action',
      action: {
        type: 'write_text',
        target: {
          formId: 'form-1',
          controlId: 'control-1'
        },
        text: 'hello'
      }
    })
  })

  void it('requests a write editable action and returns the matching action result', async () => {
    let receivedPayload: unknown
    const server = await startServer((socket) => {
      onAuthenticatedMessage(socket, (data) => {
        const request = JSON.parse(rawDataToString(data)) as {
          id: string
          payload: unknown
        }
        receivedPayload = request.payload

        socket.send(
          JSON.stringify({
            type: 'message',
            id: request.id,
            payload: {
              type: 'action_result',
              ok: true,
              data: {
                action: 'write_text',
                target: {
                  kind: 'editable',
                  id: 'bb-1'
                },
                textLength: 5
              }
            }
          })
        )
      })
    })

    assert.deepEqual(
      await requestWriteEditable({
        websocketUrl: server.url,
        pairingToken: 'local-token',
        timeoutMs: 100,
        target: {
          kind: 'editable',
          id: 'bb-1'
        },
        text: 'hello',
        createRequestId: () => 'request-editable-1'
      }),
      {
        ok: true,
        data: {
          action: 'write_text',
          target: {
            kind: 'editable',
            id: 'bb-1'
          },
          textLength: 5
        }
      }
    )
    assert.deepEqual(receivedPayload, {
      type: 'perform_action',
      action: {
        type: 'write_text',
        target: {
          kind: 'editable',
          id: 'bb-1'
        },
        text: 'hello'
      }
    })
  })

  void it('requests a set checked action and returns the matching action result', async () => {
    let receivedPayload: unknown
    const server = await startServer((socket) => {
      onAuthenticatedMessage(socket, (data) => {
        const request = JSON.parse(rawDataToString(data)) as {
          id: string
          payload: unknown
        }
        receivedPayload = request.payload

        socket.send(
          JSON.stringify({
            type: 'message',
            id: request.id,
            payload: {
              type: 'action_result',
              ok: true,
              data: {
                action: 'set_checked',
                target: {
                  formId: 'form-1',
                  controlId: 'control-1'
                },
                checked: true,
                changed: true
              }
            }
          })
        )
      })
    })

    assert.deepEqual(
      await requestSetChecked({
        websocketUrl: server.url,
        pairingToken: 'local-token',
        timeoutMs: 100,
        target: {
          formId: 'form-1',
          controlId: 'control-1'
        },
        checked: true,
        createRequestId: () => 'request-check-1'
      }),
      {
        ok: true,
        data: {
          action: 'set_checked',
          target: {
            formId: 'form-1',
            controlId: 'control-1'
          },
          checked: true,
          changed: true
        }
      }
    )
    assert.deepEqual(receivedPayload, {
      type: 'perform_action',
      action: {
        type: 'set_checked',
        target: {
          formId: 'form-1',
          controlId: 'control-1'
        },
        checked: true
      }
    })
  })

  void it('requests a select options action and returns the matching action result', async () => {
    let receivedPayload: unknown
    const server = await startServer((socket) => {
      onAuthenticatedMessage(socket, (data) => {
        const request = JSON.parse(rawDataToString(data)) as {
          id: string
          payload: unknown
        }
        receivedPayload = request.payload

        socket.send(
          JSON.stringify({
            type: 'message',
            id: request.id,
            payload: {
              type: 'action_result',
              ok: true,
              data: {
                action: 'select_options',
                target: {
                  formId: 'form-1',
                  controlId: 'control-1'
                },
                values: ['alpha', 'gamma']
              }
            }
          })
        )
      })
    })

    assert.deepEqual(
      await requestSelectOptions({
        websocketUrl: server.url,
        pairingToken: 'local-token',
        timeoutMs: 100,
        target: {
          formId: 'form-1',
          controlId: 'control-1'
        },
        values: ['alpha', 'gamma'],
        createRequestId: () => 'request-select-1'
      }),
      {
        ok: true,
        data: {
          action: 'select_options',
          target: {
            formId: 'form-1',
            controlId: 'control-1'
          },
          values: ['alpha', 'gamma']
        }
      }
    )
    assert.deepEqual(receivedPayload, {
      type: 'perform_action',
      action: {
        type: 'select_options',
        target: {
          formId: 'form-1',
          controlId: 'control-1'
        },
        values: ['alpha', 'gamma']
      }
    })
  })

  void it('requests a submit form action and returns the matching action result', async () => {
    let receivedPayload: unknown
    const server = await startServer((socket) => {
      onAuthenticatedMessage(socket, (data) => {
        const request = JSON.parse(rawDataToString(data)) as {
          id: string
          payload: unknown
        }
        receivedPayload = request.payload

        socket.send(
          JSON.stringify({
            type: 'message',
            id: request.id,
            payload: {
              type: 'action_result',
              ok: true,
              data: {
                action: 'submit_form',
                target: {
                  formId: 'form-1'
                }
              }
            }
          })
        )
      })
    })

    assert.deepEqual(
      await requestSubmitForm({
        websocketUrl: server.url,
        pairingToken: 'local-token',
        timeoutMs: 100,
        target: {
          formId: 'form-1'
        },
        createRequestId: () => 'request-submit-1'
      }),
      {
        ok: true,
        data: {
          action: 'submit_form',
          target: {
            formId: 'form-1'
          }
        }
      }
    )
    const payload = receivedPayload as {
      type?: string
      action?: {
        type?: string
        target?: unknown
        approvalRequest?: boolean
        actionUUID?: string
      }
    }
    assert.equal(payload.type, 'perform_action')
    assert.equal(payload.action?.type, 'submit_form')
    assert.deepEqual(payload.action?.target, {
      formId: 'form-1'
    })
    assert.equal(payload.action?.approvalRequest, true)
    const actionUUID = payload.action?.actionUUID
    assert.ok(typeof actionUUID === 'string')
    assert.match(actionUUID, /^action-/)
  })

  void it('times out when no matching response arrives', async () => {
    const server = await startServer((socket) => {
      onAuthenticatedMessage(socket, () => {
        socket.send(
          JSON.stringify({
            type: 'message',
            id: 'other-request',
            payload: {
              type: 'page_context_response',
              ok: true,
              data: createRichPageContext()
            }
          })
        )
      })
    })

    assert.deepEqual(
      await requestPageContext({
        websocketUrl: server.url,
        pairingToken: 'local-token',
        timeoutMs: 25,
        createRequestId: () => 'request-2'
      }),
      {
        ok: false,
        error: {
          code: 'timeout',
          message: 'Timed out waiting for a browser page context response.'
        }
      }
    )
  })

  void it('returns a click-specific timeout when no action result arrives', async () => {
    const server = await startServer((socket) => {
      onAuthenticatedMessage(socket, () => {
        socket.send(
          JSON.stringify({
            type: 'message',
            id: 'other-request',
            payload: {
              type: 'action_result',
              ok: true,
              data: {
                action: 'click',
                target: {
                  kind: 'link',
                  id: 'bb-1'
                }
              }
            }
          })
        )
      })
    })

    assert.deepEqual(
      await requestClickElement({
        websocketUrl: server.url,
        pairingToken: 'local-token',
        timeoutMs: 25,
        target: {
          kind: 'link',
          id: 'bb-1'
        },
        createRequestId: () => 'request-click-2'
      }),
      {
        ok: false,
        error: {
          code: 'timeout',
          message: 'Timed out waiting for a browser action result.'
        }
      }
    )
  })

  void it('returns ambiguous_browser_target errors from the router', async () => {
    const server = await startServer((socket) => {
      onAuthenticatedMessage(socket, () => {
        socket.send(
          JSON.stringify({
            type: 'error',
            error: {
              code: 'ambiguous_browser_target',
              message:
                'Multiple Brijio browsers are online. Specify browserInstanceId.',
              browsers: [
                {
                  browserInstanceId: 'chrome-default-test',
                  label: 'Chrome Default',
                  browserName: 'Chrome',
                  profileName: 'Default',
                  connectedAt: '2026-05-25T10:00:00.000Z',
                  lastSeenAt: '2026-05-25T10:00:00.000Z',
                  capabilities: ['page_context']
                }
              ]
            }
          })
        )
      })
    })

    assert.deepEqual(
      await requestPageContext({
        websocketUrl: server.url,
        pairingToken: 'local-token',
        timeoutMs: 100,
        createRequestId: () => 'request-ambiguous-1'
      }),
      {
        ok: false,
        error: {
          code: 'ambiguous_browser_target',
          message:
            'Multiple Brijio browsers are online. Specify browserInstanceId.',
          browsers: [
            {
              browserInstanceId: 'chrome-default-test',
              label: 'Chrome Default',
              browserName: 'Chrome',
              profileName: 'Default',
              connectedAt: '2026-05-25T10:00:00.000Z',
              lastSeenAt: '2026-05-25T10:00:00.000Z',
              capabilities: ['page_context']
            }
          ]
        }
      }
    )
  })

  void it('returns connection_failed when the WebSocket cannot connect', async () => {
    const closedServer = await startServer(() => {})
    await closeServer(closedServer.server)

    assert.deepEqual(
      await requestPageContext({
        websocketUrl: closedServer.url,
        pairingToken: 'local-token',
        timeoutMs: 100,
        createRequestId: () => 'request-3'
      }),
      {
        ok: false,
        error: {
          code: 'connection_failed',
          message: `Unable to connect to Brijio WebSocket at ${closedServer.url}.`
        }
      }
    )
  })
})

function onAuthenticatedMessage (
  socket: WebSocket,
  onMessage: (data: RawData) => void
): void {
  socket.on('message', (data) => {
    const message = JSON.parse(rawDataToString(data)) as {
      id?: string
      payload?: {
        type?: string
      }
    }

    if (message.payload?.type === 'auth') {
      socket.send(
        JSON.stringify({
          type: 'message',
          id: message.id,
          payload: {
            type: 'auth_success'
          }
        })
      )
      return
    }

    onMessage(data)
  })
}

async function startServer (
  onConnection: (socket: WebSocket) => void
): Promise<{ server: WebSocketServer, url: string }> {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  server.on('connection', onConnection)

  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })

  servers.push(server)

  const address = getAddress(server)

  return {
    server,
    url: `ws://127.0.0.1:${address.port}`
  }
}

function getAddress (server: WebSocketServer): AddressInfo {
  const address = server.address()

  if (address === null || typeof address === 'string') {
    throw new Error('WebSocket test server is not listening on a TCP port.')
  }

  return address
}

async function closeServer (server: WebSocketServer): Promise<void> {
  for (const client of server.clients) {
    client.close()
  }

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

function createRichPageContext (): unknown {
  return {
    url: 'https://example.com/',
    title: 'Example',
    timestamp: '2026-05-25T10:00:00.000Z',
    selectedText: null,
    preview: {
      content: 'Example preview',
      truncated: false,
      maxBytes: 4096
    },
    structure: {
      headings: [],
      landmarks: [],
      links: [],
      images: [],
      forms: [],
      actions: []
    },
    content: {
      available: true,
      requestType: 'get_page_content',
      firstIndex: 1,
      defaultMaxPayloadBytes: 131072
    }
  }
}

function rawDataToString (data: RawData): string {
  if (Buffer.isBuffer(data)) {
    return data.toString('utf8')
  }

  if (Array.isArray(data)) {
    return Buffer.concat(data).toString('utf8')
  }

  return Buffer.from(data).toString('utf8')
}

void describe('requestNavigateToUrl', () => {
  void it('requests navigation and returns the matching response', async () => {
    let receivedPayload: unknown
    const server = await startServer((socket) => {
      onAuthenticatedMessage(socket, (data) => {
        const request = JSON.parse(rawDataToString(data)) as {
          id: string
          payload: unknown
        }
        receivedPayload = request.payload

        socket.send(
          JSON.stringify({
            type: 'message',
            id: request.id,
            payload: {
              type: 'navigate_to_url_response',
              ok: true,
              data: {
                url: 'https://example.com/',
                title: 'Example Domain',
                timestamp: '2026-06-08T10:00:00.000Z',
                redirected: false,
                navigationMs: 250
              }
            }
          })
        )
      })
    })

    assert.deepEqual(
      await requestNavigateToUrl({
        websocketUrl: server.url,
        pairingToken: 'local-token',
        timeoutMs: 100,
        url: 'https://example.com/',
        createRequestId: () => 'request-nav-1'
      }),
      {
        ok: true,
        data: {
          url: 'https://example.com/',
          title: 'Example Domain',
          timestamp: '2026-06-08T10:00:00.000Z',
          redirected: false,
          navigationMs: 250
        }
      }
    )
    assert.deepEqual(receivedPayload, {
      type: 'navigate_to_url',
      url: 'https://example.com/'
    })
  })

  void it('forwards unsupported_scheme error code from extension', async () => {
    const server = await startServer((socket) => {
      onAuthenticatedMessage(socket, (data) => {
        const request = JSON.parse(rawDataToString(data)) as { id: string }

        socket.send(
          JSON.stringify({
            type: 'message',
            id: request.id,
            payload: {
              type: 'navigate_to_url_response',
              ok: false,
              error: {
                code: 'unsupported_scheme',
                message: 'URL scheme \'ftp\' is not supported.'
              }
            }
          })
        )
      })
    })

    const result = await requestNavigateToUrl({
      websocketUrl: server.url,
      pairingToken: 'local-token',
      timeoutMs: 100,
      url: 'ftp://example.com/',
      createRequestId: () => 'request-nav-2'
    })

    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.code, 'unsupported_scheme')
      assert.equal(result.error.message, 'URL scheme \'ftp\' is not supported.')
    }
  })

  void it('returns auth_required when pairing token is empty', async () => {
    const result = await requestNavigateToUrl({
      websocketUrl: 'ws://127.0.0.1:1',
      pairingToken: '',
      timeoutMs: 100,
      url: 'https://example.com/',
      createRequestId: () => 'request-nav-3'
    })

    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.code, 'auth_required')
    }
  })
})
