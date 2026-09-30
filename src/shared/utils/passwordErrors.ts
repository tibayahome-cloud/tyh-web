import { classifyApiError } from "./errors";

export type PasswordSubmitError = {
  message: string;
  // "password" when the server rejected the password itself, so the message can sit on that field.
  field: "password" | null;
  // True when trying again with the same input could succeed (network trouble, server error).
  retryable: boolean;
};

const UNREACHABLE = "We could not reach the server. Check your connection and try again.";
const SERVER_TROUBLE = "Something went wrong on our side. Try again in a moment.";

// Turns a failed password request into something a person can act on. The API answers with
// { error: { message } }; a rejected password is shown against the password field, an invalid
// or expired link says so plainly, and network or server trouble is marked retryable.
export const describePasswordSubmitError = (err: unknown, fallback: string): PasswordSubmitError => {
  const { category, message } = classifyApiError(err, fallback);

  if (category === "timeout" || category === "unavailable") {
    const serverError = category === "unavailable" && message && message !== "Network Error";
    return { message: serverError ? SERVER_TROUBLE : UNREACHABLE, field: null, retryable: true };
  }

  if (/password/i.test(message)) {
    return { message, field: "password", retryable: false };
  }

  if (/invalid token|expired|already (used|redeemed)/i.test(message)) {
    return {
      message: "This link is invalid or has expired. Ask for a new one and try again.",
      field: null,
      retryable: false
    };
  }

  return { message: message || fallback, field: null, retryable: category === "unknown" };
};
