# Extension Rich Page Context And Paginated Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement ADR 0008 in the Chrome extension by returning rich active-tab structure from `get_page_context` and paginated readable text from `get_page_content`.

**Architecture:** Keep WebSocket request handling in the background controller, DOM extraction in an on-demand content script, and shared request/response constructors in the extension protocol module. The background worker injects the content script only for explicit page read requests, then forwards a structured content-script request and returns the result over the existing WebSocket envelope.

**Tech Stack:** TypeScript, Chrome Manifest V3, Node test runner, `tsx`, `ts-standard`, `tsc`, `linkedom` for DOM extraction tests.

---

## File Structure

- Modify `clients/extensions/chrome/src/protocol.ts`: add `get_page_content`, rich page context types, page content response types, and response constructors.
- Modify `clients/extensions/chrome/src/protocol.test.ts`: cover rich context response and page content response protocol behavior.
- Create `clients/extensions/chrome/src/page-content.ts`: normalize extracted text, render light Markdown, chunk payloads below the serialized WebSocket upper bound.
- Create `clients/extensions/chrome/src/page-content.test.ts`: cover chunking, markdown links/images/tables, hidden value omission, and limit behavior.
- Create `clients/extensions/chrome/src/page-context.ts`: extract selected text, preview, headings, landmarks, links, images, forms, and actions from the active document.
- Create `clients/extensions/chrome/src/page-context.test.ts`: cover structure extraction and sensitive field handling with `linkedom`.
- Create `clients/extensions/chrome/src/content.ts`: Chrome runtime message handler for `extract_page_context` and `extract_page_content`.
- Create `clients/extensions/chrome/src/content.test.ts`: cover content-script request dispatch and error responses without requiring Chrome.
- Modify `clients/extensions/chrome/src/background-controller.ts`: route `get_page_context` and `get_page_content` through a tab page reader adapter.
- Modify `clients/extensions/chrome/src/background-controller.test.ts`: cover WebSocket responses for rich context, content chunks, invalid indexes, and unavailable content script.
- Modify `clients/extensions/chrome/src/background.ts`: implement active-tab lookup, on-demand `chrome.scripting.executeScript`, and `chrome.tabs.sendMessage`.
- Modify `clients/extensions/chrome/src/background-controller.test.ts`: update fake tab adapter for the new page reader interface.
- Modify `clients/extensions/chrome/manifest.json`: add `scripting` and `activeTab` permissions.
- Modify `clients/extensions/chrome/tsconfig.build.json`: include `src/content.ts` in build output.
- Modify `clients/extensions/chrome/package.json`: add `linkedom` as a dev dependency for DOM extraction tests.
- Modify `clients/extensions/chrome/README.md`: document rich context, paginated content, permissions, and request examples.

## Task 1: Expand Extension Protocol Types

**Files:**

- Modify: `clients/extensions/chrome/src/protocol.ts`
- Modify: `clients/extensions/chrome/src/protocol.test.ts`

- [ ] **Step 1: Write failing protocol tests**

Add tests to `clients/extensions/chrome/src/protocol.test.ts`:

```ts
import {
  createPageContentErrorResponse,
  createPageContentResponse,
  createPageContextErrorResponse,
  createPageContextResponse,
  isGetPageContentEnvelope,
  isGetPageContextEnvelope,
} from "./protocol.js";

void it("recognizes get_page_content message envelopes", () => {
  assert.equal(
    isGetPageContentEnvelope({
      type: "message",
      id: "content-1",
      payload: {
        type: "get_page_content",
        index: 2,
      },
    }),
    true,
  );
});

void it("rejects get_page_content envelopes with invalid indexes", () => {
  assert.equal(
    isGetPageContentEnvelope({
      type: "message",
      id: "content-2",
      payload: {
        type: "get_page_content",
        index: 0,
      },
    }),
    false,
  );
});

void it("builds rich page context responses", () => {
  assert.deepEqual(
    createPageContextResponse("context-1", {
      url: "https://example.com/",
      title: "Example Domain",
      timestamp: "2026-05-25T10:00:00.000Z",
      selectedText: "selected words",
      preview: {
        content: "Example preview",
        truncated: false,
        maxBytes: 4096,
      },
      structure: {
        headings: [{ id: "bb-1", level: 1, text: "Example" }],
        landmarks: [],
        links: [],
        images: [],
        forms: [],
        actions: [],
      },
      content: {
        available: true,
        requestType: "get_page_content",
        firstIndex: 1,
        defaultMaxPayloadBytes: 131072,
      },
    }),
    {
      type: "message",
      id: "context-1",
      payload: {
        type: "page_context_response",
        ok: true,
        data: {
          url: "https://example.com/",
          title: "Example Domain",
          timestamp: "2026-05-25T10:00:00.000Z",
          selectedText: "selected words",
          preview: {
            content: "Example preview",
            truncated: false,
            maxBytes: 4096,
          },
          structure: {
            headings: [{ id: "bb-1", level: 1, text: "Example" }],
            landmarks: [],
            links: [],
            images: [],
            forms: [],
            actions: [],
          },
          content: {
            available: true,
            requestType: "get_page_content",
            firstIndex: 1,
            defaultMaxPayloadBytes: 131072,
          },
        },
      },
    },
  );
});

void it("builds page content responses", () => {
  assert.deepEqual(
    createPageContentResponse("content-3", {
      url: "https://example.com/",
      title: "Example Domain",
      timestamp: "2026-05-25T10:01:00.000Z",
      index: 1,
      content: "# Example\n\nReadable content",
      truncated: true,
      maxPayloadBytes: 131072,
    }),
    {
      type: "message",
      id: "content-3",
      payload: {
        type: "page_content_response",
        ok: true,
        data: {
          url: "https://example.com/",
          title: "Example Domain",
          timestamp: "2026-05-25T10:01:00.000Z",
          index: 1,
          content: "# Example\n\nReadable content",
          truncated: true,
          maxPayloadBytes: 131072,
        },
      },
    },
  );
});

void it("builds page content error responses", () => {
  assert.deepEqual(
    createPageContentErrorResponse(
      "content-4",
      "invalid_index",
      "Page content chunk index must be available and 1-based.",
    ),
    {
      type: "message",
      id: "content-4",
      payload: {
        type: "page_content_response",
        ok: false,
        error: {
          code: "invalid_index",
          message: "Page content chunk index must be available and 1-based.",
        },
      },
    },
  );
});
```

- [ ] **Step 2: Run protocol tests and verify red**

Run:

```sh
pnpm --filter @browserbridge/chrome-extension test -- src/protocol.test.ts
```

Expected: tests fail because `isGetPageContentEnvelope`, `createPageContentResponse`, and `createPageContentErrorResponse` are not exported.

- [ ] **Step 3: Implement protocol types and constructors**

In `clients/extensions/chrome/src/protocol.ts`, add:

```ts
export const defaultPageContentMaxPayloadBytes = 131072;

export interface GetPageContentRequest {
  type: "get_page_content";
  index?: number;
}

export interface PageHeading {
  id: string;
  level: number;
  text: string;
}

export interface PageLandmark {
  id: string;
  role: string;
  name: string;
}

export interface PageLink {
  id: string;
  text: string;
  href: string;
}

export interface PageImage {
  id: string;
  alt: string;
  src: string;
}

export interface PageFormControl {
  id: string;
  label: string;
  type: string;
  required: boolean;
  disabled: boolean;
  sensitive: boolean;
}

export interface PageForm {
  id: string;
  label: string;
  controls: PageFormControl[];
}

export interface PageAction {
  id: string;
  role: string;
  name: string;
  enabled: boolean;
}

export interface PageContext {
  url: string;
  title: string;
  timestamp: string;
  selectedText: string | null;
  preview: {
    content: string;
    truncated: boolean;
    maxBytes: number;
  };
  structure: {
    headings: PageHeading[];
    landmarks: PageLandmark[];
    links: PageLink[];
    images: PageImage[];
    forms: PageForm[];
    actions: PageAction[];
  };
  content: {
    available: boolean;
    requestType: "get_page_content";
    firstIndex: 1;
    defaultMaxPayloadBytes: number;
  };
}

export interface PageContent {
  url: string;
  title: string;
  timestamp: string;
  index: number;
  content: string;
  truncated: boolean;
  maxPayloadBytes: number;
}

export type PageContentErrorCode =
  | "no_active_tab"
  | "unsupported_page"
  | "content_script_unavailable"
  | "extraction_failed"
  | "invalid_index"
  | "unsupported_request";

export interface PageContentResponse {
  type: "page_content_response";
  ok: true;
  data: PageContent;
}

export interface PageContentErrorResponse {
  type: "page_content_response";
  ok: false;
  error: {
    code: PageContentErrorCode;
    message: string;
  };
}
```

Update `ExtensionResponse` to include `PageContentResponse | PageContentErrorResponse`.

Add:

```ts
export function isGetPageContentEnvelope(
  value: unknown,
): value is WebSocketEnvelope & { payload: GetPageContentRequest } {
  if (!isRecord(value) || value.type !== "message") {
    return false;
  }

  if (Object.hasOwn(value, "id") && typeof value.id !== "string") {
    return false;
  }

  if (!isRecord(value.payload) || value.payload.type !== "get_page_content") {
    return false;
  }

  if (
    Object.hasOwn(value.payload, "index") &&
    (!Number.isInteger(value.payload.index) || Number(value.payload.index) < 1)
  ) {
    return false;
  }

  return true;
}

export function createPageContentResponse(
  id: string | undefined,
  content: PageContent,
): WebSocketEnvelope {
  return createEnvelope(id, {
    type: "page_content_response",
    ok: true,
    data: content,
  });
}

export function createPageContentErrorResponse(
  id: string | undefined,
  code: PageContentErrorCode,
  message: string,
): WebSocketEnvelope {
  return createEnvelope(id, {
    type: "page_content_response",
    ok: false,
    error: {
      code,
      message,
    },
  });
}
```

Update `createEnvelope` to accept the expanded `ExtensionResponse`.

- [ ] **Step 4: Run protocol tests and verify green**

Run:

```sh
pnpm --filter @browserbridge/chrome-extension test -- src/protocol.test.ts
```

Expected: protocol tests pass.

- [ ] **Step 5: Commit protocol changes**

```sh
git add clients/extensions/chrome/src/protocol.ts clients/extensions/chrome/src/protocol.test.ts
git commit -m "feat: expand extension page context protocol"
```

## Task 2: Add Readable Content Rendering And Chunking

**Files:**

- Create: `clients/extensions/chrome/src/page-content.ts`
- Create: `clients/extensions/chrome/src/page-content.test.ts`

- [ ] **Step 1: Write failing content rendering tests**

Create `clients/extensions/chrome/src/page-content.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  chunkReadableContent,
  renderMarkdownImage,
  renderMarkdownLink,
  renderMarkdownTable,
} from "./page-content.js";

void describe("page content helpers", () => {
  void it("renders links as minimal Markdown", () => {
    assert.equal(
      renderMarkdownLink("Example Domain", "https://example.com/"),
      "[Example Domain](https://example.com/)",
    );
  });

  void it("renders images as minimal Markdown", () => {
    assert.equal(
      renderMarkdownImage("Company logo", "https://example.com/logo.png"),
      "![Company logo](https://example.com/logo.png)",
    );
  });

  void it("renders simple tables as Markdown tables", () => {
    assert.equal(
      renderMarkdownTable({
        headers: ["Name", "Role"],
        rows: [
          ["Ava", "Admin"],
          ["Noah", "Viewer"],
        ],
      }),
      "| Name | Role |\n| --- | --- |\n| Ava | Admin |\n| Noah | Viewer |",
    );
  });

  void it("chunks content under the serialized message limit", () => {
    const content = ["alpha", "beta", "gamma", "delta"].join("\n");

    assert.deepEqual(chunkReadableContent(content, 1, 100), {
      index: 1,
      content,
      truncated: false,
    });
  });

  void it("returns later chunks using 1-based indexes", () => {
    const content = "first paragraph\nsecond paragraph\nthird paragraph";

    assert.deepEqual(chunkReadableContent(content, 2, 42), {
      index: 2,
      content: "third paragraph",
      truncated: false,
    });
  });

  void it("throws invalid_index when chunk index is unavailable", () => {
    assert.throws(
      () => chunkReadableContent("only chunk", 2, 100),
      /invalid_index/,
    );
  });
});
```

- [ ] **Step 2: Run content helper tests and verify red**

Run:

```sh
pnpm --filter @browserbridge/chrome-extension test -- src/page-content.test.ts
```

Expected: test command fails because `src/page-content.ts` does not exist.

- [ ] **Step 3: Implement content rendering and chunking helpers**

Create `clients/extensions/chrome/src/page-content.ts`:

```ts
export interface MarkdownTable {
  headers: string[];
  rows: string[][];
}

export interface ContentChunk {
  index: number;
  content: string;
  truncated: boolean;
}

export function renderMarkdownLink(text: string, href: string): string {
  return `[${escapeMarkdownLabel(text)}](${href})`;
}

export function renderMarkdownImage(alt: string, src: string): string {
  return `![${escapeMarkdownLabel(alt)}](${src})`;
}

export function renderMarkdownTable(table: MarkdownTable): string {
  const headers = table.headers.map(escapeTableCell);
  const separator = headers.map(() => "---");
  const rows = table.rows.map((row) => row.map(escapeTableCell));

  return [headers, separator, ...rows]
    .map((row) => `| ${row.join(" | ")} |`)
    .join("\n");
}

export function chunkReadableContent(
  content: string,
  index: number,
  maxContentBytes: number,
): ContentChunk {
  if (!Number.isInteger(index) || index < 1) {
    throw new Error("invalid_index");
  }

  const chunks = splitContent(content, maxContentBytes);

  if (index > chunks.length) {
    throw new Error("invalid_index");
  }

  return {
    index,
    content: chunks[index - 1],
    truncated: index < chunks.length,
  };
}

function splitContent(content: string, maxContentBytes: number): string[] {
  if (Buffer.byteLength(content, "utf8") <= maxContentBytes) {
    return [content];
  }

  const chunks: string[] = [];
  let current = "";

  for (const block of content.split(/\n{2,}/u)) {
    const next = current === "" ? block : `${current}\n\n${block}`;

    if (Buffer.byteLength(next, "utf8") <= maxContentBytes) {
      current = next;
      continue;
    }

    if (current !== "") {
      chunks.push(current);
      current = "";
    }

    if (Buffer.byteLength(block, "utf8") <= maxContentBytes) {
      current = block;
      continue;
    }

    chunks.push(...splitLongBlock(block, maxContentBytes));
  }

  if (current !== "") {
    chunks.push(current);
  }

  return chunks.length === 0 ? [""] : chunks;
}

function splitLongBlock(block: string, maxContentBytes: number): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const character of block) {
    const next = `${current}${character}`;

    if (Buffer.byteLength(next, "utf8") > maxContentBytes) {
      chunks.push(current);
      current = character;
      continue;
    }

    current = next;
  }

  if (current !== "") {
    chunks.push(current);
  }

  return chunks;
}

function escapeMarkdownLabel(value: string): string {
  return value.replaceAll("[", "\\[").replaceAll("]", "\\]");
}

function escapeTableCell(value: string): string {
  return value.replaceAll("|", "\\|").replace(/\s+/gu, " ").trim();
}
```

- [ ] **Step 4: Run content helper tests and verify green**

Run:

```sh
pnpm --filter @browserbridge/chrome-extension test -- src/page-content.test.ts
```

Expected: page content helper tests pass.

- [ ] **Step 5: Commit content helper changes**

```sh
git add clients/extensions/chrome/src/page-content.ts clients/extensions/chrome/src/page-content.test.ts
git commit -m "feat: add page content chunking helpers"
```

## Task 3: Add DOM Page Context Extraction

**Files:**

- Modify: `clients/extensions/chrome/package.json`
- Create: `clients/extensions/chrome/src/page-context.ts`
- Create: `clients/extensions/chrome/src/page-context.test.ts`

- [ ] **Step 1: Add DOM test dependency**

Run:

```sh
pnpm --filter @browserbridge/chrome-extension add -D linkedom
```

Expected: `linkedom` appears in `clients/extensions/chrome/package.json` dev dependencies and the lockfile updates.

- [ ] **Step 2: Write failing DOM extraction tests**

Create `clients/extensions/chrome/src/page-context.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseHTML } from "linkedom";
import { extractPageContent, extractPageContext } from "./page-context.js";

void describe("page context extraction", () => {
  void it("extracts structure, selected text, and preview", () => {
    const { document } = parseHTML(`
      <main>
        <h1>Dashboard</h1>
        <p>Welcome to the dashboard.</p>
        <a href="/reports">Reports</a>
        <button>Refresh</button>
        <form aria-label="Sign in">
          <label>Email <input type="email" value="ava@example.com" required /></label>
          <label>Password <input type="password" value="secret" /></label>
        </form>
      </main>
    `);

    const context = extractPageContext({
      document,
      locationHref: "https://example.com/dashboard",
      title: "Dashboard",
      selectedText: "Welcome",
      now: () => "2026-05-25T10:00:00.000Z",
      previewMaxBytes: 4096,
      defaultMaxPayloadBytes: 131072,
    });

    assert.equal(context.url, "https://example.com/dashboard");
    assert.equal(context.title, "Dashboard");
    assert.equal(context.selectedText, "Welcome");
    assert.equal(
      context.preview.content.includes("Welcome to the dashboard."),
      true,
    );
    assert.deepEqual(context.structure.headings[0], {
      id: "bb-1",
      level: 1,
      text: "Dashboard",
    });
    assert.equal(context.structure.links[0].text, "Reports");
    assert.equal(context.structure.actions[0].name, "Refresh");
    assert.equal(context.structure.forms[0].controls[0].label, "Email");
    assert.equal(context.structure.forms[0].controls[0].sensitive, true);
    assert.equal(context.structure.forms[0].controls[1].type, "password");
    assert.equal(context.structure.forms[0].controls[1].sensitive, true);
  });

  void it("extracts readable content without hidden or sensitive values", () => {
    const { document } = parseHTML(`
      <article>
        <h1>Release Notes</h1>
        <p>Public text</p>
        <p hidden>Hidden text</p>
        <script>console.log('private')</script>
        <a href="https://example.com/docs">Docs</a>
        <img alt="Architecture diagram" src="https://example.com/diagram.png" />
        <table>
          <thead><tr><th>Name</th><th>Status</th></tr></thead>
          <tbody><tr><td>Bridge</td><td>Ready</td></tr></tbody>
        </table>
        <label>Password <input type="password" value="secret" /></label>
      </article>
    `);

    const content = extractPageContent(document);

    assert.equal(content.includes("# Release Notes"), true);
    assert.equal(content.includes("Public text"), true);
    assert.equal(content.includes("[Docs](https://example.com/docs)"), true);
    assert.equal(
      content.includes(
        "![Architecture diagram](https://example.com/diagram.png)",
      ),
      true,
    );
    assert.equal(content.includes("| Name | Status |"), true);
    assert.equal(content.includes("Hidden text"), false);
    assert.equal(content.includes("console.log"), false);
    assert.equal(content.includes("secret"), false);
    assert.equal(content.includes("Password"), true);
  });
});
```

- [ ] **Step 3: Run DOM extraction tests and verify red**

Run:

```sh
pnpm --filter @browserbridge/chrome-extension test -- src/page-context.test.ts
```

Expected: tests fail because `src/page-context.ts` does not exist.

- [ ] **Step 4: Implement DOM extraction**

Create `clients/extensions/chrome/src/page-context.ts` with these exported functions and types:

```ts
import {
  defaultPageContentMaxPayloadBytes,
  type PageAction,
  type PageContext,
  type PageForm,
  type PageHeading,
  type PageImage,
  type PageLandmark,
  type PageLink,
} from "./protocol.js";
import {
  chunkReadableContent,
  renderMarkdownImage,
  renderMarkdownLink,
  renderMarkdownTable,
} from "./page-content.js";

export interface ExtractPageContextOptions {
  document: Document;
  locationHref: string;
  title: string;
  selectedText: string | null;
  now: () => string;
  previewMaxBytes: number;
  defaultMaxPayloadBytes?: number;
}

export function extractPageContext(
  options: ExtractPageContextOptions,
): PageContext {
  const readableContent = extractPageContent(options.document);
  const preview = chunkReadableContent(
    readableContent,
    1,
    options.previewMaxBytes,
  );

  return {
    url: options.locationHref,
    title: options.title,
    timestamp: options.now(),
    selectedText: normalizeText(options.selectedText ?? "") || null,
    preview: {
      content: preview.content,
      truncated: preview.truncated,
      maxBytes: options.previewMaxBytes,
    },
    structure: {
      headings: extractHeadings(options.document),
      landmarks: extractLandmarks(options.document),
      links: extractLinks(options.document),
      images: extractImages(options.document),
      forms: extractForms(options.document),
      actions: extractActions(options.document),
    },
    content: {
      available: true,
      requestType: "get_page_content",
      firstIndex: 1,
      defaultMaxPayloadBytes:
        options.defaultMaxPayloadBytes ?? defaultPageContentMaxPayloadBytes,
    },
  };
}

export function extractPageContent(document: Document): string {
  const blocks: string[] = [];
  const body = document.body;

  if (body === null) {
    return "";
  }

  visitReadableNode(body, blocks);
  return blocks.filter((block) => block.trim() !== "").join("\n\n");
}
```

Implement helper functions in the same file:

- `extractHeadings(document): PageHeading[]`
- `extractLandmarks(document): PageLandmark[]`
- `extractLinks(document): PageLink[]`
- `extractImages(document): PageImage[]`
- `extractForms(document): PageForm[]`
- `extractActions(document): PageAction[]`
- `visitReadableNode(node, blocks): void`
- `isVisible(element): boolean`
- `normalizeText(value): string`
- `createId(counter): string`
- `isSensitiveControl(input): boolean`

Use these exact ID semantics:

```ts
function createId(index: number): string {
  return `bb-${index}`;
}
```

Use these sensitive control rules:

```ts
function isSensitiveType(type: string): boolean {
  return ["email", "password", "tel", "number", "search"].includes(type);
}
```

Use these hidden rules:

```ts
function isSkippedElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();

  return (
    ["script", "style", "template", "noscript"].includes(tagName) ||
    element.hasAttribute("hidden") ||
    element.getAttribute("aria-hidden") === "true"
  );
}
```

When reading form controls, return labels and types but never return `value`.

- [ ] **Step 5: Run DOM extraction tests and verify green**

Run:

```sh
pnpm --filter @browserbridge/chrome-extension test -- src/page-context.test.ts
```

Expected: page context extraction tests pass.

- [ ] **Step 6: Commit DOM extraction changes**

```sh
git add clients/extensions/chrome/package.json pnpm-lock.yaml clients/extensions/chrome/src/page-context.ts clients/extensions/chrome/src/page-context.test.ts
git commit -m "feat: extract rich page context from active tab"
```

## Task 4: Add Content Script Request Handler

**Files:**

- Create: `clients/extensions/chrome/src/content.ts`
- Create: `clients/extensions/chrome/src/content.test.ts`

- [ ] **Step 1: Write failing content script tests**

Create `clients/extensions/chrome/src/content.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseHTML } from "linkedom";
import { handleContentRequest } from "./content.js";

void describe("content script request handler", () => {
  void it("handles extract_page_context requests", () => {
    const { document } = parseHTML("<main><h1>Example</h1><p>Hello</p></main>");

    const response = handleContentRequest(
      {
        type: "extract_page_context",
        previewMaxBytes: 4096,
        defaultMaxPayloadBytes: 131072,
      },
      {
        document,
        locationHref: "https://example.com/",
        title: "Example",
        selectedText: "",
        now: () => "2026-05-25T10:00:00.000Z",
      },
    );

    assert.equal(response.ok, true);
    assert.equal(
      response.ok === true && response.data.url,
      "https://example.com/",
    );
  });

  void it("handles extract_page_content requests", () => {
    const { document } = parseHTML("<main><h1>Example</h1><p>Hello</p></main>");

    const response = handleContentRequest(
      {
        type: "extract_page_content",
        index: 1,
        maxContentBytes: 120000,
        maxPayloadBytes: 131072,
      },
      {
        document,
        locationHref: "https://example.com/",
        title: "Example",
        selectedText: "",
        now: () => "2026-05-25T10:01:00.000Z",
      },
    );

    assert.equal(response.ok, true);
    assert.equal(response.ok === true && response.data.index, 1);
    assert.equal(
      response.ok === true && response.data.content.includes("# Example"),
      true,
    );
  });

  void it("returns invalid_index for unavailable chunks", () => {
    const { document } = parseHTML("<main><p>Only one chunk</p></main>");

    const response = handleContentRequest(
      {
        type: "extract_page_content",
        index: 2,
        maxContentBytes: 120000,
        maxPayloadBytes: 131072,
      },
      {
        document,
        locationHref: "https://example.com/",
        title: "Example",
        selectedText: "",
        now: () => "2026-05-25T10:02:00.000Z",
      },
    );

    assert.deepEqual(response, {
      ok: false,
      error: {
        code: "invalid_index",
        message: "Page content chunk index must be available and 1-based.",
      },
    });
  });
});
```

- [ ] **Step 2: Run content script tests and verify red**

Run:

```sh
pnpm --filter @browserbridge/chrome-extension test -- src/content.test.ts
```

Expected: tests fail because `src/content.ts` does not exist.

- [ ] **Step 3: Implement content script handler**

Create `clients/extensions/chrome/src/content.ts`:

```ts
import { chunkReadableContent } from "./page-content.js";
import { extractPageContent, extractPageContext } from "./page-context.js";
import {
  type PageContent,
  type PageContentErrorCode,
  type PageContext,
} from "./protocol.js";

export type ContentRequest =
  | {
      type: "extract_page_context";
      previewMaxBytes: number;
      defaultMaxPayloadBytes: number;
    }
  | {
      type: "extract_page_content";
      index: number;
      maxContentBytes: number;
      maxPayloadBytes: number;
    };

export type ContentResponse =
  | {
      ok: true;
      data: PageContext | PageContent;
    }
  | {
      ok: false;
      error: {
        code: PageContentErrorCode;
        message: string;
      };
    };

export interface ContentEnvironment {
  document: Document;
  locationHref: string;
  title: string;
  selectedText: string;
  now: () => string;
}

export function handleContentRequest(
  request: ContentRequest,
  environment: ContentEnvironment,
): ContentResponse {
  try {
    if (request.type === "extract_page_context") {
      return {
        ok: true,
        data: extractPageContext({
          document: environment.document,
          locationHref: environment.locationHref,
          title: environment.title,
          selectedText: environment.selectedText,
          now: environment.now,
          previewMaxBytes: request.previewMaxBytes,
          defaultMaxPayloadBytes: request.defaultMaxPayloadBytes,
        }),
      };
    }

    const content = extractPageContent(environment.document);
    const chunk = chunkReadableContent(
      content,
      request.index,
      request.maxContentBytes,
    );

    return {
      ok: true,
      data: {
        url: environment.locationHref,
        title: environment.title,
        timestamp: environment.now(),
        index: chunk.index,
        content: chunk.content,
        truncated: chunk.truncated,
        maxPayloadBytes: request.maxPayloadBytes,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_index") {
      return {
        ok: false,
        error: {
          code: "invalid_index",
          message: "Page content chunk index must be available and 1-based.",
        },
      };
    }

    return {
      ok: false,
      error: {
        code: "extraction_failed",
        message: "Unable to extract page content from the active tab.",
      },
    };
  }
}

declare const chrome:
  | {
      runtime: {
        onMessage: {
          addListener: (
            callback: (
              message: ContentRequest,
              sender: unknown,
              sendResponse: (response: ContentResponse) => void,
            ) => boolean,
          ) => void;
        };
      };
    }
  | undefined;

if (typeof chrome !== "undefined") {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const selection = globalThis.getSelection?.()?.toString() ?? "";

    sendResponse(
      handleContentRequest(message, {
        document: globalThis.document,
        locationHref: globalThis.location.href,
        title: globalThis.document.title,
        selectedText: selection,
        now: () => new Date().toISOString(),
      }),
    );

    return false;
  });
}
```

- [ ] **Step 4: Run content script tests and verify green**

Run:

```sh
pnpm --filter @browserbridge/chrome-extension test -- src/content.test.ts
```

Expected: content script tests pass.

- [ ] **Step 5: Commit content script changes**

```sh
git add clients/extensions/chrome/src/content.ts clients/extensions/chrome/src/content.test.ts
git commit -m "feat: add page extraction content script handler"
```

## Task 5: Route WebSocket Requests Through The Background Controller

**Files:**

- Modify: `clients/extensions/chrome/src/background-controller.ts`
- Modify: `clients/extensions/chrome/src/background-controller.test.ts`

- [ ] **Step 1: Write failing background controller tests**

Update `clients/extensions/chrome/src/background-controller.test.ts`:

```ts
void it("responds to get_page_context with rich active tab context", async () => {
  const harness = createHarness({
    websocketUrl: "ws://127.0.0.1:8787",
    pageContext: {
      url: "https://example.com/",
      title: "Example Domain",
      timestamp: "2026-05-25T10:00:00.000Z",
      selectedText: null,
      preview: {
        content: "Example preview",
        truncated: false,
        maxBytes: 4096,
      },
      structure: {
        headings: [],
        landmarks: [],
        links: [],
        images: [],
        forms: [],
        actions: [],
      },
      content: {
        available: true,
        requestType: "get_page_content",
        firstIndex: 1,
        defaultMaxPayloadBytes: 131072,
      },
    },
  });

  await harness.controller.handleActionClicked();
  harness.sockets.created[0].open();
  await harness.sockets.created[0].receive(
    JSON.stringify({
      type: "message",
      id: "context-1",
      payload: {
        type: "get_page_context",
      },
    }),
  );

  assert.equal(JSON.parse(harness.sockets.created[0].sent[0]).payload.ok, true);
  assert.equal(
    JSON.parse(harness.sockets.created[0].sent[0]).payload.data.preview.content,
    "Example preview",
  );
});

void it("responds to get_page_content with the requested chunk", async () => {
  const harness = createHarness({
    websocketUrl: "ws://127.0.0.1:8787",
    pageContent: {
      url: "https://example.com/",
      title: "Example Domain",
      timestamp: "2026-05-25T10:01:00.000Z",
      index: 2,
      content: "Second chunk",
      truncated: false,
      maxPayloadBytes: 131072,
    },
  });

  await harness.controller.handleActionClicked();
  harness.sockets.created[0].open();
  await harness.sockets.created[0].receive(
    JSON.stringify({
      type: "message",
      id: "content-1",
      payload: {
        type: "get_page_content",
        index: 2,
      },
    }),
  );

  assert.deepEqual(JSON.parse(harness.sockets.created[0].sent[0]).payload, {
    type: "page_content_response",
    ok: true,
    data: {
      url: "https://example.com/",
      title: "Example Domain",
      timestamp: "2026-05-25T10:01:00.000Z",
      index: 2,
      content: "Second chunk",
      truncated: false,
      maxPayloadBytes: 131072,
    },
  });
});

void it("returns content_script_unavailable when active tab extraction fails", async () => {
  const harness = createHarness({
    websocketUrl: "ws://127.0.0.1:8787",
    pageReaderError: {
      code: "content_script_unavailable",
      message: "Unable to reach the page content script.",
    },
  });

  await harness.controller.handleActionClicked();
  harness.sockets.created[0].open();
  await harness.sockets.created[0].receive(
    JSON.stringify({
      type: "message",
      id: "content-2",
      payload: {
        type: "get_page_content",
        index: 1,
      },
    }),
  );

  assert.deepEqual(JSON.parse(harness.sockets.created[0].sent[0]).payload, {
    type: "page_content_response",
    ok: false,
    error: {
      code: "content_script_unavailable",
      message: "Unable to reach the page content script.",
    },
  });
});
```

Update the fake harness types to pass `pageContext`, `pageContent`, and `pageReaderError`.

- [ ] **Step 2: Run background controller tests and verify red**

Run:

```sh
pnpm --filter @browserbridge/chrome-extension test -- src/background-controller.test.ts
```

Expected: tests fail because the controller still uses `getActiveTabContext` and does not handle `get_page_content`.

- [ ] **Step 3: Implement page reader adapter routing**

In `clients/extensions/chrome/src/background-controller.ts`:

- Replace `TabsAdapter` with `PageReaderAdapter`.
- Add methods:

```ts
export type PageReadResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: PageContentErrorCode;
        message: string;
      };
    };

export interface PageReaderAdapter {
  getPageContext: () => Promise<PageReadResult<PageContext>>;
  getPageContent: (index: number) => Promise<PageReadResult<PageContent>>;
}
```

- Import `isGetPageContentEnvelope`, `createPageContentResponse`, and `createPageContentErrorResponse`.
- Route `get_page_context` through `this.options.pageReader.getPageContext()`.
- Route `get_page_content` through `this.options.pageReader.getPageContent(message.payload.index ?? 1)`.
- Use `page_context_response` for context errors and `page_content_response` for content errors.

- [ ] **Step 4: Run background controller tests and verify green**

Run:

```sh
pnpm --filter @browserbridge/chrome-extension test -- src/background-controller.test.ts
```

Expected: background controller tests pass.

- [ ] **Step 5: Commit background routing changes**

```sh
git add clients/extensions/chrome/src/background-controller.ts clients/extensions/chrome/src/background-controller.test.ts
git commit -m "feat: route page content requests in extension background"
```

## Task 6: Wire Chrome APIs And Build Output

**Files:**

- Modify: `clients/extensions/chrome/src/background.ts`
- Modify: `clients/extensions/chrome/manifest.json`
- Modify: `clients/extensions/chrome/tsconfig.build.json`

- [ ] **Step 1: Update manifest and build config first**

Modify `clients/extensions/chrome/manifest.json` permissions:

```json
"permissions": ["activeTab", "scripting", "storage", "tabs"]
```

Modify `clients/extensions/chrome/tsconfig.build.json` include list:

```json
"include": [
  "src/background.ts",
  "src/background-controller.ts",
  "src/content.ts",
  "src/page-content.ts",
  "src/page-context.ts",
  "src/protocol.ts",
  "src/setup.ts",
  "src/timers.ts"
]
```

- [ ] **Step 2: Run build and verify red**

Run:

```sh
pnpm --filter @browserbridge/chrome-extension build
```

Expected: build fails because `background.ts` still constructs the old `tabs` adapter and does not implement the new page reader adapter.

- [ ] **Step 3: Implement Chrome page reader adapter**

In `clients/extensions/chrome/src/background.ts`, extend `ChromeApi`:

```ts
scripting: {
  executeScript: (details: { target: { tabId: number }; files: string[] }) =>
    Promise<unknown>;
}
tabs: {
  create: (properties: { url: string }) => Promise<unknown>;
  query: (queryInfo: { active: boolean; currentWindow: boolean }) =>
    Promise<
      Array<{
        id?: number;
        title?: string;
        url?: string;
      }>
    >;
  sendMessage: (tabId: number, message: unknown) => Promise<unknown>;
}
```

Replace the old `tabs` option with `pageReader`:

```ts
pageReader: {
  async getPageContext () {
    return await readActiveTabPage({
      type: 'extract_page_context',
      previewMaxBytes: 4096,
      defaultMaxPayloadBytes: 131072
    })
  },
  async getPageContent (index) {
    return await readActiveTabPage({
      type: 'extract_page_content',
      index,
      maxContentBytes: 120000,
      maxPayloadBytes: 131072
    })
  }
}
```

Add helper:

```ts
async function readActiveTabPage(message: unknown): Promise<
  | {
      ok: true;
      data: unknown;
    }
  | {
      ok: false;
      error: {
        code:
          | "no_active_tab"
          | "content_script_unavailable"
          | "unsupported_page"
          | "extraction_failed"
          | "invalid_index"
          | "unsupported_request";
        message: string;
      };
    }
> {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (activeTab?.id === undefined || activeTab.url === undefined) {
    return {
      ok: false,
      error: {
        code: "no_active_tab",
        message: "No active tab with a URL is available.",
      },
    };
  }

  if (
    !activeTab.url.startsWith("http://") &&
    !activeTab.url.startsWith("https://")
  ) {
    return {
      ok: false,
      error: {
        code: "unsupported_page",
        message:
          "BrowserBridge can read page content only from HTTP and HTTPS tabs.",
      },
    };
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ["content.js"],
    });

    const response = await chrome.tabs.sendMessage(activeTab.id, message);

    if (!isContentResponse(response)) {
      return {
        ok: false,
        error: {
          code: "content_script_unavailable",
          message: "Unable to reach the page content script.",
        },
      };
    }

    return response;
  } catch {
    return {
      ok: false,
      error: {
        code: "content_script_unavailable",
        message: "Unable to reach the page content script.",
      },
    };
  }
}
```

Add a local type guard `isContentResponse(value: unknown): value is { ok: boolean }` that accepts objects with `ok: true` and `data`, or `ok: false` and `error.message`.

- [ ] **Step 4: Run build and verify green**

Run:

```sh
pnpm --filter @browserbridge/chrome-extension build
```

Expected: Chrome extension build succeeds and `clients/extensions/chrome/dist/content.js` exists.

- [ ] **Step 5: Commit Chrome API wiring**

```sh
git add clients/extensions/chrome/src/background.ts clients/extensions/chrome/manifest.json clients/extensions/chrome/tsconfig.build.json
git commit -m "feat: wire extension content extraction to chrome api"
```

## Task 7: Update Chrome Extension Documentation

**Files:**

- Modify: `clients/extensions/chrome/README.md`

- [ ] **Step 1: Write documentation update**

Update `clients/extensions/chrome/README.md` to say:

```md
Current page read behavior:

- `get_page_context` returns the active tab URL, title, selected text, a small
  readable preview, and a structure snapshot for headings, landmarks, links,
  images, forms, and actions.
- `get_page_content` returns readable page content in 1-based chunks.
- Page content is plain text with light Markdown for headings, links, images,
  and simple tables.
- `page_content_response.data.truncated` tells the requester whether another
  chunk is available at the next index.

The extension reads DOM content only after an explicit WebSocket request while
the user-started bridge is connected. It does not stream or store page content.
```

Update permissions:

```md
- `activeTab`: grants temporary access to the active page after the user starts
  the bridge from the toolbar.
- `scripting`: injects the content script on demand for explicit page context
  and page content requests.
- `storage`: remembers the user-entered WebSocket URL.
- `tabs`: reads the active tab URL and title and sends messages to the active
  tab.
```

Add `get_page_content` example:

```json
{
  "type": "message",
  "id": "content-1",
  "payload": {
    "type": "get_page_content",
    "index": 1
  }
}
```

- [ ] **Step 2: Run README formatting check**

Run:

```sh
pnpm exec prettier --check clients/extensions/chrome/README.md
```

Expected: README formatting passes.

- [ ] **Step 3: Commit documentation**

```sh
git add clients/extensions/chrome/README.md
git commit -m "docs: document rich extension page context"
```

## Task 8: Final Verification

**Files:**

- Read: `docs/architecture/decisions/0008-extension-rich-page-context-and-paginated-content.md`
- Read: `clients/extensions/chrome/README.md`

- [ ] **Step 1: Run package tests**

Run:

```sh
pnpm --filter @browserbridge/chrome-extension test
```

Expected: all Chrome extension tests pass.

- [ ] **Step 2: Run package type check**

Run:

```sh
pnpm --filter @browserbridge/chrome-extension check
```

Expected: TypeScript check passes.

- [ ] **Step 3: Run package build**

Run:

```sh
pnpm --filter @browserbridge/chrome-extension build
```

Expected: build succeeds and `dist/background.js`, `dist/content.js`, `dist/manifest.json`, and `dist/setup.html` exist.

- [ ] **Step 4: Run root checks**

Run:

```sh
pnpm test
pnpm run check
pnpm run lint:md
```

Expected: root test, type check, and Markdown formatting checks pass.

- [ ] **Step 5: Inspect final diff**

Run:

```sh
git status --short
git diff --stat
```

Expected: only ADR 0008, the implementation plan, and Chrome extension rich-context implementation files are changed.

## Self-Review

- Spec coverage: ADR 0008 requirements map to protocol expansion, DOM extraction, content chunking, content script dispatch, background routing, permissions, docs, and verification tasks.
- Placeholder scan: The plan contains no placeholder markers, no incomplete sections, and no deferred behavior.
- Type consistency: The plan consistently uses `get_page_context`, `page_context_response`, `get_page_content`, `page_content_response`, 1-based `index`, `truncated`, and `maxPayloadBytes`.
