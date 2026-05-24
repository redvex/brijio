# WebSocket Peer Forwarding And Extension Keepalive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove noisy sender echo from the local WebSocket server and keep the Chrome extension WebSocket active while the user has the bridge turned ON.

**Architecture:** `servers/websocket/src/server.ts` remains the local single-channel peer forwarder, but no longer sends valid messages back to the sender. `clients/extensions/chrome/src/background-controller.ts` owns keepalive scheduling through injected timer adapters so the behavior stays testable.

**Tech Stack:** TypeScript, Node.js 22, `ws`, Chrome Manifest V3, Node test runner through `tsx`.

---

### Task 1: WebSocket Peer Forwarding

**Files:**

- Modify: `servers/websocket/src/server.test.ts`
- Modify: `servers/websocket/src/server.ts`

- [x] **Step 1: Write failing server tests**

Change the sender echo test to assert that valid messages are not returned to the sender, keep the peer broadcast test, and add a test that `extension_keepalive` is not forwarded to peers.

- [x] **Step 2: Run server tests to verify red**

Run: `pnpm --filter @browserbridge/websocket test`

Expected: failure because the server still echoes valid messages and forwards all valid messages.

- [x] **Step 3: Implement peer forwarding**

Forward valid messages only to open peers other than the sender. Do not forward `extension_keepalive` payloads.

- [x] **Step 4: Run server tests to verify green**

Run: `pnpm --filter @browserbridge/websocket test`

Expected: all WebSocket server tests pass.

### Task 2: Extension Keepalive

**Files:**

- Modify: `clients/extensions/chrome/src/background-controller.test.ts`
- Modify: `clients/extensions/chrome/src/background-controller.ts`
- Modify: `clients/extensions/chrome/src/background.ts`
- Modify: `clients/extensions/chrome/manifest.json`

- [x] **Step 1: Write failing extension tests**

Add tests that connected extensions send `extension_keepalive` on the timer interval and stop sending keepalives after disconnect.

- [x] **Step 2: Run extension tests to verify red**

Run: `pnpm --filter @browserbridge/chrome-extension test`

Expected: failure because keepalive scheduling is not implemented.

- [x] **Step 3: Implement keepalive scheduling**

Inject timer adapters into the background controller. Start a 20-second interval after connecting, send `{"type":"message","payload":{"type":"extension_keepalive"}}`, and clear the interval on disconnect, close, or error.

- [x] **Step 4: Wire production timers**

Pass `setInterval` and `clearInterval` adapters from `background.ts`, and set `minimum_chrome_version` to `116` in the manifest.

- [x] **Step 5: Run extension tests to verify green**

Run: `pnpm --filter @browserbridge/chrome-extension test`

Expected: all Chrome extension tests pass.

### Task 3: Documentation And Verification

**Files:**

- Modify: `servers/websocket/README.md`
- Modify: `clients/extensions/chrome/README.md`
- Modify: `docs/architecture/decisions/0006-websocket-peer-forwarding-and-extension-keepalive.md`

- [x] **Step 1: Update docs**

Document peer-forwarding behavior, keepalive suppression, and the Chrome 116 minimum.

- [x] **Step 2: Run verification**

Run:

```sh
pnpm --filter @browserbridge/websocket test
pnpm --filter @browserbridge/chrome-extension test
pnpm --filter @browserbridge/chrome-extension build
pnpm lint:ts
pnpm lint:md
pnpm test
pnpm build
pnpm check
```

Expected: each command exits with code 0.
