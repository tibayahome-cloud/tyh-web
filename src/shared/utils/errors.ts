// utils/errors.ts
import { isAxiosError } from "axios";
import type { AxiosError } from "axios";

export function getApiError(err: unknown, fallback = "Something went wrong"): string {
  const axiosErr = err as AxiosError<{ error: { message: string } }>;
  return axiosErr?.response?.data?.error?.message || (err as Error)?.message || fallback;
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
