export type WebSocketEnvelope = {
  type: "message";
  id?: string;
  payload: unknown;
};

export type WebSocketErrorCode = "invalid_json" | "invalid_message";

export type WebSocketErrorEnvelope = {
  type: "error";
  error: {
    code: WebSocketErrorCode;
    message: string;
  };
};

export type ParseMessageResult =
  | { ok: true; message: WebSocketEnvelope }
  | { ok: false; error: WebSocketErrorEnvelope };

export function parseWebSocketMessage(rawMessage: string): ParseMessageResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawMessage);
  } catch {
    return {
      ok: false,
      error: createError("invalid_json", "Message must be valid JSON.")
    };
  }

  if (!isWebSocketEnvelope(parsed)) {
    return {
      ok: false,
      error: createError(
        "invalid_message",
        'Message must be an object with type "message" and a payload property.'
      )
    };
  }

  return { ok: true, message: parsed };
}

function createError(
  code: WebSocketErrorCode,
  message: string
): WebSocketErrorEnvelope {
  return {
    type: "error",
    error: {
      code,
      message
    }
  };
}

function isWebSocketEnvelope(value: unknown): value is WebSocketEnvelope {
  if (!isRecord(value)) {
    return false;
  }

  if (value.type !== "message") {
    return false;
  }

  if (!Object.hasOwn(value, "payload")) {
    return false;
  }

  return !Object.hasOwn(value, "id") || typeof value.id === "string";
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
