# @brijio/shared

Shared TypeScript types, protocol message schemas, and browser-agnostic logic
for Brijio.

This package is the single source of truth for code used by both the Chrome and
Safari browser extensions. It contains no browser API calls — all
browser-specific behavior is injected through adapter interfaces.

## What it contains

| Module                     | Description                                                                                                                                                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `protocol.ts`              | WebSocket envelope types, request/response discriminated unions, type guards, and response constructors. All `get_page_context`, `page_context_response`, `get_page_content`, `page_content_response`, `perform_action`, `action_result`, `extension_keepalive`, and `error` message types.            |
| `background-controller.ts` | `BrijioBackgroundController` — the adapter-driven background controller that manages WebSocket connections, badge state, and message routing. Browser extensions wire their own adapters (action badge, storage, setup, page reader, page actions, timers, WebSocket) and instantiate this controller. |
| `page-context.ts`          | Pure DOM page-context extraction (`extractPageContext`). Takes a `Document` and environment, returns structured page context (URL, title, selected text, preview, structure). No browser API dependencies.                                                                                             |
| `page-content.ts`          | Pure DOM page-content chunking. Takes a `Document` and parameters, returns paginated readable content. No browser API dependencies.                                                                                                                                                                    |
| `content-handler.ts`       | `handleContentRequest` — the content-script request handler. Validates incoming `ContentRequest` messages and delegates to page-context or page-content extraction. Takes a `ContentEnvironment` (document, location, title, selected text, timestamp), not a browser API.                             |
| `timers.ts`                | `createGlobalTimers` factory — returns `setInterval`/`clearInterval`/`setTimeout`/`clearTimeout`. Browser extensions inject this to support test timers.                                                                                                                                               |

## How browser extensions use it

Both the Chrome and Safari extensions import from `@brijio/shared` and
provide only browser-specific adapters and entry-point wiring:

```text
Browser extension package
  ├── Imports from @brijio/shared:
  │     BrijioBackgroundController
  │     handleContentRequest
  │     createGlobalTimers
  │     Protocol types (ContentRequest, ContentResponse, PageContext, …)
  │     Adapter interfaces (StorageAdapter, ActionAdapter, PageReaderAdapter, …)
  │
  └── Provides browser-specific:
        Adapter implementations (chrome.* or browser.* API calls)
        Entry-point files (background-entry, content-script-entry, popup-entry)
        Manifest and permissions
        Popup or setup UI
```

## Build

```sh
pnpm --filter @brijio/shared build
```

## Test

```sh
pnpm --filter @brijio/shared test
```

## Type checks

```sh
pnpm --filter @brijio/shared check
```
