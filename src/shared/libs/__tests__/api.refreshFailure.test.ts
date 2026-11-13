/**
 * When a request gets a 401 the API client asks the session code to renew and retries. If the renewal cannot be made for a
 * reason that says nothing about the session (no network, a timeout, a server error), the person is still signed in: only
 * that request fails. If the renewal is refused the session is ended.
 */

import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, configureApiAuth } from "../api";

const unauthorized = (config: InternalAxiosRequestConfig) =>
  new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, null, { status: 401, statusText: "Unauthorized", headers: {}, config, data: {} });

const original = api.defaults.adapter;
const clear = vi.fn();
const onUnauthorized = vi.fn();

beforeEach(() => {
  clear.mockReset();
  onUnauthorized.mockReset();
  api.defaults.adapter = async (config) => {
    throw unauthorized(config);
  };
});
afterEach(() => {
  api.defaults.adapter = original;
  configureApiAuth({ sessionKept: undefined, refresh: async () => null, clear: () => undefined, onUnauthorized: undefined });
});

describe("a 401 whose renewal cannot be made", () => {
  it("fails only that request and leaves the session alone when the renewal failed for a reason that does not end it", async () => {
    configureApiAuth({ refresh: async () => null, sessionKept: () => true, clear, onUnauthorized });

    await expect(api.get("/anything")).rejects.toMatchObject({ response: { status: 401 } });

    expect(clear).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("ends the session when the renewal was refused", async () => {
    configureApiAuth({ refresh: async () => null, sessionKept: () => false, clear, onUnauthorized });

    await expect(api.get("/anything")).rejects.toMatchObject({ response: { status: 401 } });

    expect(clear).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
