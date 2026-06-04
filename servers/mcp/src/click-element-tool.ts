import {
  clickCurrentPageElement,
  type BrowserBridgePageActionsConfig,
} from "./page-actions.js";
import { type ClickElementTarget } from "./protocol.js";
import { type BrowserBridgeToolResult } from "./page-reading-tool.js";

export interface ClickElementInput {
  kind?: unknown;
  id?: unknown;
  browserInstanceId?: unknown;
  expectedText?: unknown;
  expectedHref?: unknown;
  expectedRole?: unknown;
}

export type ClickElementResult = BrowserBridgeToolResult<{
  action: "click";
  target: ClickElementTarget;
}>;

export async function clickElement(
  config: BrowserBridgePageActionsConfig,
  input: ClickElementInput,
): Promise<ClickElementResult> {
  const normalizedInput = normalizeInput(input);

  if (!normalizedInput.ok) {
    return normalizedInput;
  }

  return await clickCurrentPageElement(
    config,
    normalizedInput.data.target,
    normalizedInput.data.browserInstanceId,
  );
}

function normalizeInput(input: ClickElementInput): BrowserBridgeToolResult<{
  target: ClickElementTarget;
  browserInstanceId?: string;
}> {
  if (input.kind !== "link" && input.kind !== "action") {
    return invalidToolInputResponse('kind must be either "link" or "action".');
  }

  if (typeof input.id !== "string" || input.id.length === 0) {
    return invalidToolInputResponse("id must be a non-empty string.");
  }

  const browserInstanceId = normalizeBrowserInstanceId(input.browserInstanceId);

  if (!browserInstanceId.ok) {
    return browserInstanceId;
  }

  // Validate optional expected fields — if provided, must be strings
  if (
    input.expectedText !== undefined &&
    typeof input.expectedText !== "string"
  ) {
    return invalidToolInputResponse(
      "expectedText must be a string when provided.",
    );
  }

  if (
    input.expectedHref !== undefined &&
    typeof input.expectedHref !== "string"
  ) {
    return invalidToolInputResponse(
      "expectedHref must be a string when provided.",
    );
  }

  if (
    input.expectedRole !== undefined &&
    typeof input.expectedRole !== "string"
  ) {
    return invalidToolInputResponse(
      "expectedRole must be a string when provided.",
    );
  }

  const target: ClickElementTarget = {
    kind: input.kind,
    id: input.id,
    ...(input.expectedText !== undefined
      ? { expectedText: input.expectedText }
      : {}),
    ...(input.expectedHref !== undefined
      ? { expectedHref: input.expectedHref }
      : {}),
    ...(input.expectedRole !== undefined
      ? { expectedRole: input.expectedRole }
      : {}),
  };

  return {
    ok: true,
    data: {
      target,
      ...(browserInstanceId.data !== undefined
        ? { browserInstanceId: browserInstanceId.data }
        : {}),
    },
  };
}

function normalizeBrowserInstanceId(
  value: unknown,
): BrowserBridgeToolResult<string | undefined> {
  if (value === undefined) {
    return {
      ok: true,
      data: undefined,
    };
  }

  if (typeof value !== "string" || value.length === 0) {
    return invalidToolInputResponse(
      "browserInstanceId must be a non-empty string when provided.",
    );
  }

  return {
    ok: true,
    data: value,
  };
}

function invalidToolInputResponse(
  message: string,
): BrowserBridgeToolResult<never> {
  return {
    ok: false,
    error: {
      code: "invalid_tool_input",
      message,
    },
  };
}
