import "server-only";

export type XeroErrorCode =
  | "config_error"
  | "not_connected"
  | "expired_session"
  | "insufficient_scope"
  | "validation_error"
  | "unknown";

// Safe to show to the user and to send back through an API route — never
// wraps raw Xero response bodies, tokens, or stack traces from the SDK.
export class XeroAppError extends Error {
  readonly code: XeroErrorCode;
  readonly httpStatus: number;
  readonly actionHint?: string;

  constructor(code: XeroErrorCode, message: string, httpStatus: number, actionHint?: string) {
    super(message);
    this.name = "XeroAppError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.actionHint = actionHint;
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      actionHint: this.actionHint,
    };
  }
}

export function notConnectedError(): XeroAppError {
  return new XeroAppError(
    "not_connected",
    "No Xero organisation is connected yet.",
    409,
    "Go to Xero Connection and click Connect to Xero."
  );
}

export function configError(message: string): XeroAppError {
  return new XeroAppError("config_error", message, 500);
}

interface AxiosLikeError {
  response?: {
    // xero-node's own HTTP wrapper uses `statusCode` and rejects with a
    // JSON-stringified version of this shape (not a real Error/object) —
    // see parseRawXeroError below. A plain axios error would use `status`.
    status?: number;
    statusCode?: number;
    statusText?: string;
    headers?: Record<string, unknown> | { get?: (name: string) => string | null };
    data?: unknown;
    body?: unknown;
  };
  message?: string;
}

function readHeader(headers: unknown, name: string): string | null {
  if (!headers || typeof headers !== "object") return null;
  const maybeGet = (headers as { get?: unknown }).get;
  if (typeof maybeGet === "function") {
    return maybeGet.call(headers, name) ?? null;
  }
  const record = headers as Record<string, unknown>;
  const value = record[name] ?? record[name.toLowerCase()];
  return typeof value === "string" ? value : null;
}

function extractValidationMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const body = data as {
    Message?: string;
    Detail?: string;
    Title?: string;
    Elements?: Array<{ ValidationErrors?: Array<{ Message?: string }> }>;
  };
  const elementMessage = body.Elements?.[0]?.ValidationErrors?.[0]?.Message;
  return elementMessage ?? body.Message ?? body.Detail ?? body.Title ?? null;
}

// xero-node's generated Accounting API client rejects with a JSON string
// (not an Error, not a plain object) containing the full axios-like error —
// including, critically, the Authorization header with the raw bearer
// token. Parse it defensively and never let the raw string leak into a
// message that could reach the client.
function parseRawXeroError(err: unknown): AxiosLikeError | null {
  if (err && typeof err === "object") return err as AxiosLikeError;
  if (typeof err === "string") {
    try {
      return JSON.parse(err) as AxiosLikeError;
    } catch {
      return null;
    }
  }
  return null;
}

// Converts any error thrown by the xero-node SDK into a XeroAppError with a
// message that is safe to return to the browser — never the original
// response body, headers, or tokens.
export function toXeroAppError(err: unknown): XeroAppError {
  if (err instanceof XeroAppError) return err;

  const axiosErr = parseRawXeroError(err);
  const status = axiosErr?.response?.status ?? axiosErr?.response?.statusCode;

  if (typeof status === "number") {
    const wwwAuth = readHeader(axiosErr?.response?.headers, "www-authenticate") ?? "";

    if (status === 401 || status === 403) {
      if (wwwAuth.toLowerCase().includes("insufficient_scope") || status === 403) {
        return new XeroAppError(
          "insufficient_scope",
          "Xero rejected this request because the connected app doesn't have permission for it.",
          403,
          "Update Xero permissions and reconnect to grant the missing scope."
        );
      }
      return new XeroAppError(
        "expired_session",
        "The Xero session has expired or was disconnected.",
        401,
        "Reconnect to Xero from the Xero Connection page."
      );
    }

    if (status === 400) {
      const detail = extractValidationMessage(axiosErr?.response?.data ?? axiosErr?.response?.body);
      return new XeroAppError(
        "validation_error",
        detail ? `Xero rejected the request: ${detail}` : "Xero rejected the request as invalid.",
        400
      );
    }
  }

  // Couldn't classify this into a known case — log server-side only. Never
  // include the raw `err` (string or object) in the returned message: it can
  // contain the bearer access token embedded in request.headers.authorization.
  console.error("Unrecognized Xero error:", err);
  const message = err instanceof Error ? err.message : "Unexpected error talking to Xero.";
  return new XeroAppError("unknown", message, 502);
}
