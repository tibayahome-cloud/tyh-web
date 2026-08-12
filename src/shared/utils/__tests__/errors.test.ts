import { describe, expect, it } from "vitest";
import { AxiosError } from "axios";

import { getApiError } from "../errors";

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
