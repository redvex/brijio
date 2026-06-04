export interface WebSocketEnvelope {
  type: "message";
  id?: string;
  target?: {
    browserInstanceId?: string;
  };
  payload: unknown;
}

export interface BrowserPresence {
  browserInstanceId: string;
  label: string;
  browserName: string;
  profileName: string;
  connectedAt: string;
  lastSeenAt: string;
  capabilities: string[];
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

export interface ClickElementTarget {
  kind: "link" | "action";
  id: string;
  expectedText?: string;
  expectedHref?: string;
  expectedRole?: string;
}

export interface ClickElementActionResultData {
  action: "click";
  target: ClickElementTarget;
}

export interface FillInputTarget {
  formId: string;
  controlId: string;
}

export interface EditableTarget {
  kind: "editable";
  id: string;
}

export type WriteTextTarget = FillInputTarget | EditableTarget;

export interface FillInputActionResultData {
  action: "write_text";
  target: WriteTextTarget;
  textLength: number;
}

export interface SetCheckedActionResultData {
  action: "set_checked";
  target: FillInputTarget;
  checked: boolean;
  changed: boolean;
}

export interface SelectOptionsActionResultData {
  action: "select_options";
  target: FillInputTarget;
  values: string[];
}

export interface SubmitFormTarget {
  formId: string;
}

export interface SubmitFormActionResultData {
  action: "submit_form";
  target: SubmitFormTarget;
}

export type BrowserBridgeErrorCode =
  | "auth_required"
  | "auth_failed"
  | "invalid_auth_message"
  | "browser_unavailable"
  | "ambiguous_browser_target"
  | "invalid_browser_target"
  | "connection_failed"
  | "timeout"
  | "invalid_response"
  | "browser_error"
  | "stale_context"
  | "invalid_resource_uri";

export interface StaleContextDetail {
  id: string;
  kind: string;
  expectedText?: string;
  foundText?: string;
  expectedHref?: string;
  foundHref?: string;
  expectedRole?: string;
  foundRole?: string;
}

export type BrowserBridgeResourceResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: {
        code: BrowserBridgeErrorCode;
        message: string;
        detail?: StaleContextDetail;
        browsers?: BrowserPresence[];
      };
    };

export type BrowserBridgePageContextResult =
  BrowserBridgeResourceResult<PageContext>;

export type BrowserBridgePageContentResult =
  BrowserBridgeResourceResult<PageContent>;

export type BrowserBridgeClickElementResult =
  BrowserBridgeResourceResult<ClickElementActionResultData>;

export type BrowserBridgeFillInputResult =
  BrowserBridgeResourceResult<FillInputActionResultData>;

export type BrowserBridgeSetCheckedResult =
  BrowserBridgeResourceResult<SetCheckedActionResultData>;

export type BrowserBridgeSelectOptionsResult =
  BrowserBridgeResourceResult<SelectOptionsActionResultData>;

export type BrowserBridgeSubmitFormResult =
  BrowserBridgeResourceResult<SubmitFormActionResultData>;

export type BrowserBridgeBrowserListResult = BrowserBridgeResourceResult<{
  browsers: BrowserPresence[];
}>;

export type PageContextParseResult =
  | BrowserBridgePageContextResult
  | { ok: false; ignored: true };

export type PageContentParseResult =
  | BrowserBridgePageContentResult
  | { ok: false; ignored: true };

export type ActionResultParseResult =
  | BrowserBridgeClickElementResult
  | BrowserBridgeFillInputResult
  | BrowserBridgeSetCheckedResult
  | BrowserBridgeSelectOptionsResult
  | BrowserBridgeSubmitFormResult
  | { ok: false; ignored: true };

export type BrowserListParseResult =
  | BrowserBridgeBrowserListResult
  | { ok: false; ignored: true };

export function createGetPageContextEnvelope(
  requestId: string,
): WebSocketEnvelope {
  return {
    type: "message",
    id: requestId,
    payload: {
      type: "get_page_context",
    },
  };
}

export function createGetPageContentEnvelope(
  requestId: string,
  index: number,
): WebSocketEnvelope {
  return {
    type: "message",
    id: requestId,
    payload: {
      type: "get_page_content",
      index,
    },
  };
}

export function createClickElementEnvelope(
  requestId: string,
  target: ClickElementTarget,
): WebSocketEnvelope {
  return {
    type: "message",
    id: requestId,
    payload: {
      type: "perform_action",
      action: {
        type: "click",
        target,
      },
    },
  };
}

export function createFillInputEnvelope(
  requestId: string,
  target: FillInputTarget,
  text: string,
): WebSocketEnvelope {
  return {
    type: "message",
    id: requestId,
    payload: {
      type: "perform_action",
      action: {
        type: "write_text",
        target,
        text,
      },
    },
  };
}

export function createWriteEditableEnvelope(
  requestId: string,
  target: EditableTarget,
  text: string,
): WebSocketEnvelope {
  return {
    type: "message",
    id: requestId,
    payload: {
      type: "perform_action",
      action: {
        type: "write_text",
        target,
        text,
      },
    },
  };
}

export function createSetCheckedEnvelope(
  requestId: string,
  target: FillInputTarget,
  checked: boolean,
): WebSocketEnvelope {
  return {
    type: "message",
    id: requestId,
    payload: {
      type: "perform_action",
      action: {
        type: "set_checked",
        target,
        checked,
      },
    },
  };
}

export function createSelectOptionsEnvelope(
  requestId: string,
  target: FillInputTarget,
  values: string[],
): WebSocketEnvelope {
  return {
    type: "message",
    id: requestId,
    payload: {
      type: "perform_action",
      action: {
        type: "select_options",
        target,
        values,
      },
    },
  };
}

export function createSubmitFormEnvelope(
  requestId: string,
  target: SubmitFormTarget,
): WebSocketEnvelope {
  return {
    type: "message",
    id: requestId,
    payload: {
      type: "perform_action",
      action: {
        type: "submit_form",
        target,
      },
    },
  };
}

export function parsePageContextEnvelope(
  value: unknown,
  requestId: string,
): PageContextParseResult {
  if (!isRecord(value) || value.type !== "message") {
    return invalidResponse();
  }

  if (value.id !== requestId) {
    return { ok: false, ignored: true };
  }

  if (!isRecord(value.payload)) {
    return invalidResponse();
  }

  if (value.payload.type !== "page_context_response") {
    return invalidResponse();
  }

  if (value.payload.ok === true) {
    return parsePageContextSuccessPayload(value.payload);
  }

  if (value.payload.ok === false) {
    return parseErrorPayload(value.payload, invalidPageContextResponse());
  }

  return invalidPageContextResponse();
}

export function parsePageContentEnvelope(
  value: unknown,
  requestId: string,
): PageContentParseResult {
  if (!isRecord(value) || value.type !== "message") {
    return invalidResponse();
  }

  if (value.id !== requestId) {
    return { ok: false, ignored: true };
  }

  if (!isRecord(value.payload)) {
    return invalidResponse();
  }

  if (value.payload.type !== "page_content_response") {
    return invalidResponse();
  }

  if (value.payload.ok === true) {
    return parsePageContentSuccessPayload(value.payload);
  }

  if (value.payload.ok === false) {
    return parseErrorPayload(value.payload, invalidResponse());
  }

  return invalidResponse();
}

export function parseActionResultEnvelope(
  value: unknown,
  requestId: string,
): ActionResultParseResult {
  if (!isRecord(value) || value.type !== "message") {
    return invalidResponse();
  }

  if (value.id !== requestId) {
    return { ok: false, ignored: true };
  }

  if (!isRecord(value.payload)) {
    return invalidResponse();
  }

  if (value.payload.type !== "action_result") {
    return invalidResponse();
  }

  if (value.payload.ok === true) {
    return parseActionResultSuccessPayload(value.payload);
  }

  if (value.payload.ok === false) {
    return parseErrorPayload(value.payload, invalidResponse());
  }

  return invalidResponse();
}

export function parseBrowserListEnvelope(
  value: unknown,
  requestId: string,
): BrowserListParseResult {
  if (!isRecord(value) || value.type !== "message") {
    return invalidResponse();
  }

  if (value.id !== requestId) {
    return { ok: false, ignored: true };
  }

  if (!isRecord(value.payload) || value.payload.type !== "browser_list") {
    return invalidResponse();
  }

  if (value.payload.ok !== true || !isRecord(value.payload.data)) {
    return invalidResponse();
  }

  if (!isArrayOf(value.payload.data.browsers, isBrowserPresence)) {
    return invalidResponse();
  }

  return {
    ok: true,
    data: {
      browsers: value.payload.data.browsers,
    },
  };
}

export function parseRouterErrorEnvelope(
  value: unknown,
): BrowserBridgeResourceResult<never> | { ok: false; ignored: true } {
  if (!isRecord(value) || value.type !== "error") {
    return { ok: false, ignored: true };
  }

  if (!isRecord(value.error) || typeof value.error.message !== "string") {
    return invalidResponse();
  }

  if (!isBrowserBridgeErrorCode(value.error.code)) {
    return invalidResponse();
  }

  return {
    ok: false,
    error: {
      code: value.error.code,
      message: value.error.message,
      ...(isArrayOf(value.error.browsers, isBrowserPresence)
        ? { browsers: value.error.browsers }
        : {}),
    },
  };
}

function parsePageContextSuccessPayload(
  payload: Record<PropertyKey, unknown>,
): BrowserBridgePageContextResult {
  if (!isPageContext(payload.data)) {
    return invalidPageContextResponse();
  }

  return {
    ok: true,
    data: payload.data,
  };
}

function parsePageContentSuccessPayload(
  payload: Record<PropertyKey, unknown>,
): BrowserBridgePageContentResult {
  if (!isPageContent(payload.data)) {
    return invalidResponse();
  }

  return {
    ok: true,
    data: payload.data,
  };
}

function parseActionResultSuccessPayload(
  payload: Record<PropertyKey, unknown>,
):
  | BrowserBridgeClickElementResult
  | BrowserBridgeFillInputResult
  | BrowserBridgeSetCheckedResult
  | BrowserBridgeSelectOptionsResult
  | BrowserBridgeSubmitFormResult {
  const data = payload.data;

  if (isClickElementActionResultData(data)) {
    return {
      ok: true,
      data,
    };
  }

  if (isFillInputActionResultData(data)) {
    return {
      ok: true,
      data,
    };
  }

  if (isSetCheckedActionResultData(data)) {
    return {
      ok: true,
      data,
    };
  }

  if (isSelectOptionsActionResultData(data)) {
    return {
      ok: true,
      data,
    };
  }

  if (isSubmitFormActionResultData(data)) {
    return {
      ok: true,
      data,
    };
  }

  return invalidResponse();
}

function parseErrorPayload<T>(
  payload: Record<PropertyKey, unknown>,
  fallback: BrowserBridgeResourceResult<T>,
): BrowserBridgeResourceResult<T> {
  if (!isRecord(payload.error) || typeof payload.error.message !== "string") {
    return fallback;
  }

  const code = payload.error.code;
  // Pass through stale_context with its detail; wrap unknown codes as browser_error
  if (code === "stale_context") {
    const detail = isStaleContextDetail(payload.error.detail)
      ? payload.error.detail
      : undefined;
    return {
      ok: false,
      error: {
        code: "stale_context",
        message: payload.error.message,
        ...(detail !== undefined ? { detail } : {}),
      },
    };
  }

  return {
    ok: false,
    error: {
      code: "browser_error",
      message: payload.error.message,
    },
  };
}

export function invalidResponse(): BrowserBridgeResourceResult<never> {
  return {
    ok: false,
    error: {
      code: "invalid_response",
      message: "Received an invalid BrowserBridge response.",
    },
  };
}

export function invalidPageContextResponse(): BrowserBridgePageContextResult {
  return {
    ok: false,
    error: {
      code: "invalid_response",
      message: "Received an invalid page context response.",
    },
  };
}

export function invalidResourceUriResponse(): BrowserBridgeResourceResult<never> {
  return {
    ok: false,
    error: {
      code: "invalid_resource_uri",
      message:
        "Page content resource URI must end with a positive 1-based index.",
    },
  };
}

export function timeoutResponse(
  message = "Timed out waiting for a browser page context response.",
): BrowserBridgeResourceResult<never> {
  return {
    ok: false,
    error: {
      code: "timeout",
      message,
    },
  };
}

export function connectionFailedResponse(
  websocketUrl: string,
): BrowserBridgeResourceResult<never> {
  return {
    ok: false,
    error: {
      code: "connection_failed",
      message: `Unable to connect to BrowserBridge WebSocket at ${websocketUrl}.`,
    },
  };
}

export function authRequiredResponse(): BrowserBridgeResourceResult<never> {
  return {
    ok: false,
    error: {
      code: "auth_required",
      message: "BROWSERBRIDGE_PAIRING_TOKEN must be configured.",
    },
  };
}

export function createAuthEnvelope(token: string): WebSocketEnvelope {
  return {
    type: "message",
    payload: {
      type: "auth",
      role: "mcp",
      token,
    },
  };
}

function isPageContext(value: unknown): value is PageContext {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.url !== "string" ||
    typeof value.title !== "string" ||
    typeof value.timestamp !== "string" ||
    !(typeof value.selectedText === "string" || value.selectedText === null)
  ) {
    return false;
  }

  if (!isPagePreview(value.preview)) {
    return false;
  }

  if (!isRecord(value.structure)) {
    return false;
  }

  if (
    !isArrayOf(value.structure.headings, isPageHeading) ||
    !isArrayOf(value.structure.landmarks, isPageLandmark) ||
    !isArrayOf(value.structure.links, isPageLink) ||
    !isArrayOf(value.structure.images, isPageImage) ||
    !isArrayOf(value.structure.forms, isPageForm) ||
    !isArrayOf(value.structure.actions, isPageAction)
  ) {
    return false;
  }

  if (!isRecord(value.content)) {
    return false;
  }

  return (
    (value.content.available === true || value.content.available === false) &&
    value.content.requestType === "get_page_content" &&
    value.content.firstIndex === 1 &&
    isPositiveNumber(value.content.defaultMaxPayloadBytes)
  );
}

function isPageContent(value: unknown): value is PageContent {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.url === "string" &&
    typeof value.title === "string" &&
    typeof value.timestamp === "string" &&
    typeof value.index === "number" &&
    Number.isInteger(value.index) &&
    value.index >= 1 &&
    typeof value.content === "string" &&
    typeof value.truncated === "boolean" &&
    isPositiveNumber(value.maxPayloadBytes)
  );
}

function isPagePreview(value: unknown): value is PageContext["preview"] {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.content === "string" &&
    typeof value.truncated === "boolean" &&
    isPositiveNumber(value.maxBytes)
  );
}

function isPageHeading(value: unknown): value is PageHeading {
  return (
    hasStringProperties(value, ["id", "text"]) &&
    isRecord(value) &&
    typeof value.level === "number" &&
    Number.isInteger(value.level) &&
    value.level >= 1
  );
}

function isPageLandmark(value: unknown): value is PageLandmark {
  return hasStringProperties(value, ["id", "role", "name"]);
}

function isPageLink(value: unknown): value is PageLink {
  return hasStringProperties(value, ["id", "text", "href"]);
}

function isPageImage(value: unknown): value is PageImage {
  return hasStringProperties(value, ["id", "alt", "src"]);
}

function isPageFormControl(value: unknown): value is PageFormControl {
  if (!hasStringProperties(value, ["id", "label", "type"])) {
    return false;
  }

  return (
    isRecord(value) &&
    typeof value.required === "boolean" &&
    typeof value.disabled === "boolean" &&
    typeof value.sensitive === "boolean"
  );
}

function isPageForm(value: unknown): value is PageForm {
  if (!hasStringProperties(value, ["id", "label"]) || !isRecord(value)) {
    return false;
  }

  return isArrayOf(value.controls, isPageFormControl);
}

function isPageAction(value: unknown): value is PageAction {
  if (!hasStringProperties(value, ["id", "role", "name"])) {
    return false;
  }

  return isRecord(value) && typeof value.enabled === "boolean";
}

function isBrowserPresence(value: unknown): value is BrowserPresence {
  return (
    hasStringProperties(value, [
      "browserInstanceId",
      "label",
      "browserName",
      "profileName",
      "connectedAt",
      "lastSeenAt",
    ]) &&
    isRecord(value) &&
    Array.isArray(value.capabilities) &&
    value.capabilities.every((capability) => typeof capability === "string")
  );
}

function isBrowserBridgeErrorCode(
  value: unknown,
): value is BrowserBridgeErrorCode {
  return (
    value === "auth_required" ||
    value === "auth_failed" ||
    value === "invalid_auth_message" ||
    value === "browser_unavailable" ||
    value === "ambiguous_browser_target" ||
    value === "invalid_browser_target" ||
    value === "connection_failed" ||
    value === "timeout" ||
    value === "invalid_response" ||
    value === "browser_error" ||
    value === "stale_context" ||
    value === "invalid_resource_uri"
  );
}

function isStaleContextDetail(value: unknown): value is StaleContextDetail {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.id !== "string" || typeof value.kind !== "string") {
    return false;
  }

  // Optional string fields
  const optionalStrings: (keyof StaleContextDetail)[] = [
    "expectedText",
    "foundText",
    "expectedHref",
    "foundHref",
    "expectedRole",
    "foundRole",
  ];

  for (const key of optionalStrings) {
    if (value[key] !== undefined && typeof value[key] !== "string") {
      return false;
    }
  }

  return true;
}

function isClickElementActionResultData(
  value: unknown,
): value is ClickElementActionResultData {
  if (!isRecord(value)) {
    return false;
  }

  return value.action === "click" && isClickElementTarget(value.target);
}

function isFillInputActionResultData(
  value: unknown,
): value is FillInputActionResultData {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.action === "write_text" &&
    isWriteTextTarget(value.target) &&
    typeof value.textLength === "number" &&
    Number.isInteger(value.textLength) &&
    value.textLength >= 0
  );
}

function isSetCheckedActionResultData(
  value: unknown,
): value is SetCheckedActionResultData {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.action === "set_checked" &&
    isFillInputTarget(value.target) &&
    typeof value.checked === "boolean" &&
    typeof value.changed === "boolean"
  );
}

function isSelectOptionsActionResultData(
  value: unknown,
): value is SelectOptionsActionResultData {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.action === "select_options" &&
    isFillInputTarget(value.target) &&
    isArrayOf(value.values, isString)
  );
}

function isSubmitFormActionResultData(
  value: unknown,
): value is SubmitFormActionResultData {
  if (!isRecord(value)) {
    return false;
  }

  return value.action === "submit_form" && isSubmitFormTarget(value.target);
}

function isClickElementTarget(value: unknown): value is ClickElementTarget {
  if (!isRecord(value)) {
    return false;
  }

  if (
    (value.kind !== "link" && value.kind !== "action") ||
    typeof value.id !== "string"
  ) {
    return false;
  }

  // Validate optional fields — if present, must be strings
  if (
    value.expectedText !== undefined &&
    typeof value.expectedText !== "string"
  ) {
    return false;
  }
  if (
    value.expectedHref !== undefined &&
    typeof value.expectedHref !== "string"
  ) {
    return false;
  }
  if (
    value.expectedRole !== undefined &&
    typeof value.expectedRole !== "string"
  ) {
    return false;
  }

  return true;
}

function isFillInputTarget(value: unknown): value is FillInputTarget {
  return hasStringProperties(value, ["formId", "controlId"]);
}

function isEditableTarget(value: unknown): value is EditableTarget {
  if (!isRecord(value)) {
    return false;
  }

  return value.kind === "editable" && typeof value.id === "string";
}

function isWriteTextTarget(value: unknown): value is WriteTextTarget {
  return isFillInputTarget(value) || isEditableTarget(value);
}

function isSubmitFormTarget(value: unknown): value is SubmitFormTarget {
  return hasStringProperties(value, ["formId"]);
}

function hasStringProperties(value: unknown, properties: string[]): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return properties.every((property) => typeof value[property] === "string");
}

function isArrayOf<T>(
  value: unknown,
  predicate: (item: unknown) => item is T,
): value is T[] {
  return Array.isArray(value) && value.every(predicate);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isPositiveNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
