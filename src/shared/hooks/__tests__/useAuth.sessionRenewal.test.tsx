/**
 * A client stays signed in for as long as their refresh token lives.
 *
 * The access token is short-lived (about two hours). The app used to wipe both tokens the moment it ran out, so every
 * client was signed out every couple of hours although a 14-day refresh token existed. It now renews the session
 * shortly before the access token expires, renews on start-up when the stored one has already expired, and only
 * ends the session when the renewal is refused or there is no refresh token.
 */

import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "../useAuth";

const { mockPost, mockGet } = vi.hoisted(() => ({ mockPost: vi.fn(), mockGet: vi.fn() }));

vi.mock("../../libs/api", () => ({
  __esModule: true,
  default: { post: mockPost, get: mockGet, interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } } },
  api: { post: mockPost, get: mockGet, interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } } },
  configureApiAuth: vi.fn()
}));

const base64Url = (value: unknown) =>
  btoa(JSON.stringify(value)).replace(/=+$/u, "").replace(/\+/gu, "-").replace(/\//gu, "_");

/** A token whose only readable claim is when it expires, `seconds` from the (fake) present. */
const tokenExpiringIn = (seconds: number) =>
  `${base64Url({ alg: "none" })}.${base64Url({ exp: Math.floor(Date.now() / 1000) + seconds })}.signature`;

const MINUTE = 60_000;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    <AuthProvider>{children}</AuthProvider>
  </QueryClientProvider>
);

const storeTokens = (accessToken: string, refreshToken: string | null) =>
  localStorage.setItem("tiba.auth.tokens", JSON.stringify({ accessToken, refreshToken, persist: true }));

const refreshAnswers = (accessToken: string, refreshToken = "refresh-2") =>
  mockPost.mockResolvedValue({ data: { data: { access_token: accessToken, refresh_token: refreshToken } } });

const settle = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe("session renewal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();
    mockGet.mockResolvedValue({
      data: { id: "1", attributes: { full_name: "Jane Client", roles: ["client"], permissions: [] } }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renews the session shortly before the access token runs out, instead of signing the client out", async () => {
    storeTokens(tokenExpiringIn(5 * 60), "refresh-1");
    const renewed = tokenExpiringIn(2 * 60 * 60);
    refreshAnswers(renewed);
    const { result } = renderHook(() => useAuth(), { wrapper });

    await settle(4 * MINUTE);
    expect(mockPost).not.toHaveBeenCalledWith("/auth/refresh", expect.anything());

    await settle(MINUTE);

    expect(mockPost).toHaveBeenCalledWith("/auth/refresh", { refresh_token: "refresh-1" });
    expect(result.current.accessToken).toBe(renewed);
    expect(result.current.refreshToken).toBe("refresh-2");
    expect(result.current.sessionExpired).toBe(false);
  });

  it("keeps renewing for as long as the refresh token is accepted", async () => {
    storeTokens(tokenExpiringIn(5 * 60), "refresh-1");
    mockPost.mockImplementation(async () => ({
      data: { data: { access_token: tokenExpiringIn(10 * 60), refresh_token: "next" } }
    }));
    const { result } = renderHook(() => useAuth(), { wrapper });

    // An hour in ten-minute steps: each renewal schedules the next one once React has applied the new tokens.
    for (let step = 0; step < 6; step += 1) {
      await settle(10 * MINUTE);
    }

    const renewals = mockPost.mock.calls.filter(([url]) => url === "/auth/refresh").length;
    expect(renewals).toBeGreaterThanOrEqual(5);
    expect(result.current.sessionExpired).toBe(false);
    expect(result.current.accessToken).toBeTruthy();
  });

  it("renews at start-up when the stored access token has already expired", async () => {
    storeTokens(tokenExpiringIn(-120), "refresh-1");
    const renewed = tokenExpiringIn(2 * 60 * 60);
    refreshAnswers(renewed);
    const { result } = renderHook(() => useAuth(), { wrapper });

    await settle(1);

    expect(mockPost).toHaveBeenCalledWith("/auth/refresh", { refresh_token: "refresh-1" });
    expect(result.current.accessToken).toBe(renewed);
    expect(result.current.sessionExpired).toBe(false);
  });

  const answeredWith = (status: number) => ({ isAxiosError: true, response: { status } });

  it.each([400, 401])("ends the session when the server refuses the renewal (%i)", async (status) => {
    storeTokens(tokenExpiringIn(5 * 60), "refresh-1");
    mockPost.mockRejectedValue(answeredWith(status));
    const { result } = renderHook(() => useAuth(), { wrapper });

    await settle(5 * MINUTE);

    expect(result.current.accessToken).toBeNull();
    expect(result.current.sessionExpired).toBe(true);
  });

  it("stays signed in when the renewal fails for a reason that says nothing about the session, and tries again", async () => {
    storeTokens(tokenExpiringIn(5 * 60), "refresh-1");
    const renewed = tokenExpiringIn(2 * 60 * 60);
    mockPost
      .mockRejectedValueOnce({ isAxiosError: true, code: "ERR_NETWORK", message: "Network Error" }) // no response at all
      .mockRejectedValueOnce(answeredWith(503))
      .mockResolvedValue({ data: { data: { access_token: renewed, refresh_token: "refresh-2" } } });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await settle(5 * MINUTE);
    expect(result.current.sessionExpired).toBe(false);
    expect(result.current.refreshToken).toBe("refresh-1");

    await settle(30_000);
    expect(result.current.sessionExpired).toBe(false);

    await settle(30_000);
    expect(result.current.accessToken).toBe(renewed);
    expect(result.current.refreshToken).toBe("refresh-2");
  });

  it("takes the new tokens another tab already stored instead of signing out when its own renewal is refused", async () => {
    storeTokens(tokenExpiringIn(5 * 60), "refresh-1");
    const fromOtherTab = tokenExpiringIn(2 * 60 * 60);
    mockPost.mockImplementation(async () => {
      // The other tab used refresh-1 first and stored the pair it got back; this tab's call is then refused.
      storeTokens(fromOtherTab, "refresh-2");
      throw answeredWith(401);
    });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await settle(5 * MINUTE);

    expect(result.current.sessionExpired).toBe(false);
    expect(result.current.accessToken).toBe(fromOtherTab);
    expect(result.current.refreshToken).toBe("refresh-2");
  });

  it("ends the session when there is no refresh token to renew with", async () => {
    storeTokens(tokenExpiringIn(5 * 60), null);
    const { result } = renderHook(() => useAuth(), { wrapper });

    await settle(5 * MINUTE);

    expect(mockPost).not.toHaveBeenCalledWith("/auth/refresh", expect.anything());
    expect(result.current.accessToken).toBeNull();
    expect(result.current.sessionExpired).toBe(true);
  });

  it("does not renew in a loop on a phone whose clock is wrong", async () => {
    storeTokens(tokenExpiringIn(5 * 60), "refresh-1");
    // The server's new token looks expired by this phone's clock (the phone thinks it is two hours later).
    refreshAnswers(tokenExpiringIn(-2 * 60 * 60));
    const { result } = renderHook(() => useAuth(), { wrapper });

    await settle(5 * MINUTE);
    await settle(30 * MINUTE);

    const renewals = mockPost.mock.calls.filter(([url]) => url === "/auth/refresh").length;
    expect(renewals).toBe(1);
    expect(result.current.sessionExpired).toBe(false);
    expect(result.current.accessToken).toBeTruthy();
  });
});
