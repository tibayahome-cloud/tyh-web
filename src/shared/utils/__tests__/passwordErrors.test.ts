import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";

import { describePasswordSubmitError } from "../passwordErrors";

const httpError = (status: number, message?: string) =>
  new AxiosError("Request failed", "ERR_BAD_RESPONSE", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: {} as never,
    data: message === undefined ? {} : { error: { code: "x", name: "y", message } }
  });

describe("describePasswordSubmitError", () => {
  it("puts a rejected password on the password field, in the server's words", () => {
    const result = describePasswordSubmitError(
      httpError(400, "Password must be 10+ chars with upper, lower, digit, special."),
      "fallback"
    );
    expect(result).toEqual({
      message: "Password must be 10+ chars with upper, lower, digit, special.",
      field: "password",
      retryable: false
    });
  });

  it("explains an invalid or expired link plainly and does not offer a blind retry", () => {
    for (const message of ["Invalid token", "This reset link has expired", "Token already redeemed"]) {
      const result = describePasswordSubmitError(httpError(400, message), "fallback");
      expect(result.message).toMatch(/invalid or has expired/i);
      expect(result.field).toBeNull();
      expect(result.retryable).toBe(false);
    }
  });

  it("marks a timeout as retryable with a connection message", () => {
    const timeout = new AxiosError("timeout", "ECONNABORTED");
    expect(describePasswordSubmitError(timeout, "fallback")).toEqual({
      message: "We could not reach the server. Check your connection and try again.",
      field: null,
      retryable: true
    });
  });

  it("marks a request that never got a response as retryable", () => {
    const offline = new AxiosError("Network Error", "ERR_NETWORK");
    const result = describePasswordSubmitError(offline, "fallback");
    expect(result.retryable).toBe(true);
    expect(result.message).toMatch(/could not reach the server/i);
  });

  it("marks a server error as retryable without exposing internals", () => {
    const result = describePasswordSubmitError(httpError(500, "Traceback: boom"), "fallback");
    expect(result).toEqual({
      message: "Something went wrong on our side. Try again in a moment.",
      field: null,
      retryable: true
    });
  });

  it("shows any other server message as it is, and falls back when there is none", () => {
    expect(describePasswordSubmitError(httpError(400, "Account is suspended"), "fallback").message).toBe(
      "Account is suspended"
    );
    expect(describePasswordSubmitError(new Error(""), "We could not save your password").message).toBe(
      "We could not save your password"
    );
  });
});
