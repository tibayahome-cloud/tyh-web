// utils/errors.ts
import { isAxiosError } from "axios";
import type { AxiosError } from "axios";

export function getApiError(err: unknown, fallback = "Something went wrong"): string {
  const axiosErr = err as AxiosError<{ error: { message: string } }>;
  const apiMessage = axiosErr?.response?.data?.error?.message;
  if (apiMessage && !GENERIC_HTTP_NAMES.test(apiMessage.trim())) return apiMessage;
  // A transport failure or a bare HTTP status: describe what happened instead of "Request failed
  // with status code 400".
  if (isAxiosError(err)) return friendlyApiMessage(err);
  return (err as Error)?.message || fallback;
}

// Every backend error response uses `{ error: { code, name, message } }` (see
// _register_error_handlers in app/__init__.py) -- there is no separate "conflict" or "stale"
// status code today, so those states surface as 400 with a message that already explains them.
// This only classifies what the transport layer can actually tell us; it does not guess finer
// categories the backend doesn't expose.
export type ApiErrorCategory = "unauthorized" | "forbidden" | "not_found" | "bad_request" | "timeout" | "unavailable" | "unknown";

export type ClassifiedApiError = {
  category: ApiErrorCategory;
  message: string;
};

export function classifyApiError(err: unknown, fallback = "Something went wrong"): ClassifiedApiError {
  const message = getApiError(err, fallback);

  if (!isAxiosError(err)) {
    return { category: "unknown", message };
  }
  if (err.code === "ECONNABORTED" || !err.response) {
    // No response at all: request timeout, offline, or the server/gateway never answered.
    return { category: err.code === "ECONNABORTED" ? "timeout" : "unavailable", message };
  }

  switch (err.response.status) {
    case 401:
      return { category: "unauthorized", message };
    case 403:
      return { category: "forbidden", message };
    case 404:
      return { category: "not_found", message };
    case 400:
    case 409:
    case 422:
      return { category: "bad_request", message };
    default:
      return { category: err.response.status >= 500 ? "unavailable" : "unknown", message };
  }
}
// The API reports validation failures as `error.details = { field: ["message", ...] }`. Returns the
// first message per field, or an empty object when the response carries none.
export function getApiFieldErrors(err: unknown): Record<string, string> {
  const details = (err as AxiosError<{ error?: { details?: unknown } }>)?.response?.data?.error?.details;
  if (!details || typeof details !== "object" || Array.isArray(details)) return {};
  const result: Record<string, string> = {};
  for (const [field, value] of Object.entries(details as Record<string, unknown>)) {
    const message = Array.isArray(value) ? value.map(String).join(" ") : typeof value === "string" ? value : "";
    if (message) result[field] = message;
  }
  return result;
}

const GENERIC_HTTP_NAMES = /^(bad request|unauthorized|forbidden|not found|conflict|unprocessable entity|internal server error|bad gateway|service unavailable|gateway timeout|too many requests|error)\.?$/i;

export const UNREACHABLE_MESSAGE = "We could not reach the server. Check your connection and try again.";
export const TIMEOUT_MESSAGE = "The server took too long to answer. Check your connection and try again.";

// What to tell a person when a request fails, in place of axios's own "Request failed with status
// code 400". The API's own explanation wins when it gave one. Otherwise the wording follows what
// actually happened, and always says what to do next.
export function friendlyApiMessage(err: AxiosError): string {
  const body = (err.response?.data as { error?: { message?: unknown; details?: unknown } } | undefined)?.error;
  const apiMessage = typeof body?.message === "string" ? body.message.trim() : "";
  if (apiMessage && !GENERIC_HTTP_NAMES.test(apiMessage)) {
    // A validation failure often carries the field-level reason in `details`; show the first one.
    const detail = Object.values(getApiFieldErrors(err))[0];
    return detail && !apiMessage.includes(detail) ? `${apiMessage} ${detail}` : apiMessage;
  }

  if (!err.response) {
    return err.code === "ECONNABORTED" || err.code === "ETIMEDOUT" ? TIMEOUT_MESSAGE : UNREACHABLE_MESSAGE;
  }

  const status = err.response.status;
  if (status === 401) return "Your session has ended. Sign in again to continue.";
  if (status === 403) return "You do not have permission to do this. Ask a super admin if you think you should.";
  if (status === 404) return "We could not find that. It may have been removed or changed. Refresh and try again.";
  if (status === 408 || status === 504) return TIMEOUT_MESSAGE;
  if (status === 409) return "This changed while you were working on it. Refresh and try again.";
  if (status === 413) return "That file or request is too large.";
  if (status === 422 || status === 400) return "The request was not accepted. Check what you entered and try again.";
  if (status === 429) return "Too many attempts. Wait a minute and try again.";
  if (status >= 500) return "Something went wrong on our side. Try again in a moment, and contact support if it keeps happening.";
  return "Something went wrong. Try again.";
}
