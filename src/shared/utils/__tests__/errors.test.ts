import { describe, expect, it } from "vitest";
import { AxiosError } from "axios";

import { classifyApiError, getApiError } from "../errors";

const axiosErrorWithStatus = (status: number, message: string) =>
  new AxiosError(`Request failed with status code ${status}`, "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: {},
    data: { error: { message } }
  });

describe("getApiError", () => {
  it("uses the backend error envelope instead of Axios status text", () => {
    const error = new AxiosError("Request failed with status code 400", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 400,
      statusText: "Bad Request",
      headers: {},
      config: {},
      data: { error: { message: "Phone belongs to an existing user" } }
    });

    expect(getApiError(error)).toBe("Phone belongs to an existing user");
  });

  it("uses the fallback when an error has no API message", () => {
    expect(getApiError({}, "Unable to save provider")).toBe("Unable to save provider");
  });
});

describe("classifyApiError", () => {
  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [400, "bad_request"],
    [409, "bad_request"],
    [422, "bad_request"],
    [500, "unavailable"],
    [503, "unavailable"]
  ] as const)("maps HTTP %i to category %s", (status, category) => {
    const error = axiosErrorWithStatus(status, "This hold has expired or is no longer active");
    expect(classifyApiError(error)).toEqual({
      category,
      message: "This hold has expired or is no longer active"
    });
  });

  it("classifies a client-side timeout distinctly from a dead server", () => {
    const error = new AxiosError("timeout of 10000ms exceeded", "ECONNABORTED");
    expect(classifyApiError(error).category).toBe("timeout");
  });

  it("classifies a response-less network failure as unavailable, not bad_request", () => {
    const error = new AxiosError("Network Error");
    expect(classifyApiError(error).category).toBe("unavailable");
  });

  it("falls back to unknown for a non-Axios error while still carrying a message", () => {
    expect(classifyApiError(new Error("Failed to create telemedicine hold"))).toEqual({
      category: "unknown",
      message: "Failed to create telemedicine hold"
    });
  });
});
