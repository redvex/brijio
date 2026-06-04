import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clickElement } from "./click-element-tool.js";

void describe("MCP click element tool", () => {
  void it("returns invalid tool input for unsupported target kinds", async () => {
    const result = await clickElement(
      {
        websocketUrl: "ws://127.0.0.1:8787",
        timeoutMs: 5000,
        requestClickElement: async () => {
          throw new Error("click should not be requested");
        },
      },
      {
        kind: "image",
        id: "bb-1",
      },
    );

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: "invalid_tool_input",
        message: 'kind must be either "link" or "action".',
      },
    });
  });

  void it("returns invalid tool input for empty target IDs", async () => {
    const result = await clickElement(
      {
        websocketUrl: "ws://127.0.0.1:8787",
        timeoutMs: 5000,
        requestClickElement: async () => {
          throw new Error("click should not be requested");
        },
      },
      {
        kind: "link",
        id: "",
      },
    );

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: "invalid_tool_input",
        message: "id must be a non-empty string.",
      },
    });
  });

  void it("clicks a valid page context target", async () => {
    const requestedTargets: unknown[] = [];
    const requestedBrowserInstanceIds: Array<string | undefined> = [];

    const result = await clickElement(
      {
        websocketUrl: "ws://127.0.0.1:8787",
        timeoutMs: 5000,
        requestClickElement: async (options) => {
          requestedTargets.push(options.target);
          requestedBrowserInstanceIds.push(options.browserInstanceId);
          return {
            ok: true,
            data: {
              action: "click",
              target: options.target,
            },
          };
        },
      },
      {
        kind: "action",
        id: "bb-2",
        browserInstanceId: "chrome-default-test",
      },
    );

    assert.deepEqual(requestedBrowserInstanceIds, ["chrome-default-test"]);
    assert.deepEqual(requestedTargets, [
      {
        kind: "action",
        id: "bb-2",
      },
    ]);
    assert.deepEqual(result, {
      ok: true,
      data: {
        action: "click",
        target: {
          kind: "action",
          id: "bb-2",
        },
      },
    });
  });

  void it("returns WebSocket and browser errors without rewriting them", async () => {
    const result = await clickElement(
      {
        websocketUrl: "ws://127.0.0.1:8787",
        timeoutMs: 5000,
        requestClickElement: async () => ({
          ok: false,
          error: {
            code: "browser_error",
            message: "No matching click target was found.",
          },
        }),
      },
      {
        kind: "link",
        id: "bb-9",
      },
    );

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: "browser_error",
        message: "No matching click target was found.",
      },
    });
  });

  // ── Stale-context validation field tests ───────────────────────────

  void it("passes expectedText through to requestClickElement", async () => {
    const requestedTargets: unknown[] = [];
    const result = await clickElement(
      {
        websocketUrl: "ws://127.0.0.1:8787",
        timeoutMs: 5000,
        requestClickElement: async (options) => {
          requestedTargets.push(options.target);
          return {
            ok: true,
            data: { action: "click", target: options.target },
          };
        },
      },
      {
        kind: "link",
        id: "bb-3",
        expectedText: "Settings",
      },
    );

    assert.equal(result.ok, true);
    if (!result.ok) {
      assert.fail("Expected success");
      return;
    }
    assert.deepEqual(result.data.target, {
      kind: "link",
      id: "bb-3",
      expectedText: "Settings",
    });
  });

  void it("passes all validation fields through to requestClickElement", async () => {
    const requestedTargets: unknown[] = [];
    const result = await clickElement(
      {
        websocketUrl: "ws://127.0.0.1:8787",
        timeoutMs: 5000,
        requestClickElement: async (options) => {
          requestedTargets.push(options.target);
          return {
            ok: true,
            data: { action: "click", target: options.target },
          };
        },
      },
      {
        kind: "link",
        id: "bb-1",
        expectedText: "Home",
        expectedHref: "/home",
        expectedRole: "link",
      },
    );

    assert.equal(result.ok, true);
    if (!result.ok) {
      assert.fail("Expected success");
      return;
    }
    assert.deepEqual(result.data.target, {
      kind: "link",
      id: "bb-1",
      expectedText: "Home",
      expectedHref: "/home",
      expectedRole: "link",
    });
  });

  void it("rejects non-string expectedText", async () => {
    const result = await clickElement(
      {
        websocketUrl: "ws://127.0.0.1:8787",
        timeoutMs: 5000,
        requestClickElement: async () => {
          throw new Error("should not be called");
        },
      },
      {
        kind: "link",
        id: "bb-1",
        expectedText: 42,
      },
    );

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: "invalid_tool_input",
        message: "expectedText must be a string when provided.",
      },
    });
  });

  void it("rejects non-string expectedHref", async () => {
    const result = await clickElement(
      {
        websocketUrl: "ws://127.0.0.1:8787",
        timeoutMs: 5000,
        requestClickElement: async () => {
          throw new Error("should not be called");
        },
      },
      {
        kind: "link",
        id: "bb-1",
        expectedHref: true,
      },
    );

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: "invalid_tool_input",
        message: "expectedHref must be a string when provided.",
      },
    });
  });

  void it("rejects non-string expectedRole", async () => {
    const result = await clickElement(
      {
        websocketUrl: "ws://127.0.0.1:8787",
        timeoutMs: 5000,
        requestClickElement: async () => {
          throw new Error("should not be called");
        },
      },
      {
        kind: "action",
        id: "bb-1",
        expectedRole: 123,
      },
    );

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: "invalid_tool_input",
        message: "expectedRole must be a string when provided.",
      },
    });
  });

  void it("passes stale_context error through with detail", async () => {
    const result = await clickElement(
      {
        websocketUrl: "ws://127.0.0.1:8787",
        timeoutMs: 5000,
        requestClickElement: async () => ({
          ok: false,
          error: {
            code: "stale_context",
            message:
              'Element bb-2 (link) does not match expected text "Dashboard". Call read_current_page first.',
            detail: {
              id: "bb-2",
              kind: "link",
              expectedText: "Dashboard",
              foundText: "Settings",
            },
          },
        }),
      },
      {
        kind: "link",
        id: "bb-2",
        expectedText: "Dashboard",
      },
    );

    assert.equal(result.ok, false);
    if (result.ok) {
      assert.fail("Expected stale_context error");
      return;
    }
    assert.equal(result.error.code, "stale_context");
    if (!result.error.detail) {
      assert.fail("Expected detail on stale_context error");
      return;
    }
    assert.equal(result.error.detail.id, "bb-2");
    assert.equal(result.error.detail.kind, "link");
    assert.equal(result.error.detail.expectedText, "Dashboard");
    assert.equal(result.error.detail.foundText, "Settings");
  });
});
