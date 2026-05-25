# First MCP Page Reading Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first read-only MCP tool, `read_current_page`, so tool-first
agents can read page context and bounded readable content.

**Architecture:** Register one MCP SDK tool in `servers/mcp/src/index.ts` and
delegate tool result shaping to a new `servers/mcp/src/page-reading-tool.ts`
module. The tool reuses existing page-context helpers and WebSocket protocol
messages; no Chrome extension or WebSocket server behavior changes.

**Tech Stack:** TypeScript, Node test runner, official MCP TypeScript SDK,
`zod`, existing BrowserBridge WebSocket client helpers.

---

### Task 1: Accept ADR And Add Tool Behavior Tests

**Files:**

- Modify: `docs/architecture/decisions/0010-first-mcp-page-reading-tool.md`
- Modify: `servers/mcp/src/index.test.ts`
- Create: `servers/mcp/src/page-reading-tool.test.ts`

- [x] **Step 1: Mark ADR 0010 accepted**

Change the status from `Proposed` to `Accepted`.

- [x] **Step 2: Write failing unit tests for tool result shaping**

Create `servers/mcp/src/page-reading-tool.test.ts` with tests for:

- context-only reads when `includeContent` is false;
- default context plus first content chunk;
- multiple content chunks up to `maxContentChunks`;
- invalid `maxContentChunks` mapping to `invalid_tool_input`;
- browser/WebSocket errors returning structured tool errors.

- [x] **Step 3: Write failing SDK integration tests**

Update `servers/mcp/src/index.test.ts` so `tools/list` expects
`read_current_page`, then add `client.callTool(...)` checks for default page
reading and invalid input.

- [x] **Step 4: Run tests and verify red**

Run: `pnpm --filter @browserbridge/mcp test`

Expected: fails because `page-reading-tool.ts` and `read_current_page` do not
exist yet.

### Task 2: Implement Read-Only Tool

**Files:**

- Create: `servers/mcp/src/page-reading-tool.ts`
- Modify: `servers/mcp/src/protocol.ts`
- Modify: `servers/mcp/src/index.ts`

- [x] **Step 1: Add minimal tool module**

Implement:

- `readCurrentPage(config, input)`;
- input parsing for `includeContent` and `maxContentChunks`;
- `invalid_tool_input` errors;
- content chunk loop that starts at `context.content.firstIndex`, stops when a
  chunk is not truncated, and never fetches more than five chunks.

- [x] **Step 2: Register the MCP SDK tool**

Use the SDK's tool registration API in `servers/mcp/src/index.ts` and return
the structured result as one JSON text content item.

- [x] **Step 3: Run tests and verify green**

Run: `pnpm --filter @browserbridge/mcp test`

Expected: all MCP tests pass.

### Task 3: Documentation And Verification

**Files:**

- Modify: `servers/mcp/README.md`
- Create: `docs/artifacts/2026-05-25-first-mcp-page-reading-tool.md`

- [x] **Step 1: Document MCP tool behavior**

Update `servers/mcp/README.md` with the `read_current_page` tool name, input
schema, output shape, and local usage note.

- [x] **Step 2: Add artifact documentation**

Create `docs/artifacts/2026-05-25-first-mcp-page-reading-tool.md` summarizing
the implemented behavior, flow, security boundary, and verification.

- [x] **Step 3: Run final verification**

Run:

```sh
pnpm --filter @browserbridge/mcp test
pnpm --filter @browserbridge/mcp build
pnpm lint:ts
pnpm lint:md
pnpm test
```

Expected: all commands pass.
