/**
 * The booking now makes an account in the middle of the journey and creates the slot hold straight afterwards. That
 * request is sent in the same moment as the sign-in, before React has re-rendered, so the token the API client reads
 * has to be the new one at once, not only after the next render.
 */

import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "../useAuth";

const { mockPost, mockGet, configureApiAuth } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockGet: vi.fn(),
  configureApiAuth: vi.fn()
}));

vi.mock("../../libs/api", () => ({
  __esModule: true,
  default: { post: mockPost, get: mockGet, interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } } },
  api: { post: mockPost, get: mockGet, interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } } },
  configureApiAuth
}));

const base64Url = (value: unknown) =>
  btoa(JSON.stringify(value)).replace(/=+$/u, "").replace(/\+/gu, "-").replace(/\//gu, "_");

const tokenExpiringIn = (seconds: number) =>
  `${base64Url({ alg: "none" })}.${base64Url({ exp: Math.floor(Date.now() / 1000) + seconds })}.signature`;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    <AuthProvider>{children}</AuthProvider>
  </QueryClientProvider>
);

describe("signing in a client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("makes the new access token available to a request sent in the same moment", async () => {
    const access = tokenExpiringIn(2 * 60 * 60);
    mockPost.mockResolvedValue({
      data: {
        data: {
          tokens: { access_token: access, refresh_token: "refresh-1" },
          user: { id: "u1", attributes: { full_name: "Jane Client", roles: ["client"], permissions: [] } }
        }
      }
    });
    mockGet.mockResolvedValue({ data: { id: "u1", attributes: { full_name: "Jane Client", roles: ["client"] } } });
    const { result } = renderHook(() => useAuth(), { wrapper });

    let tokenInTheSameMoment: string | null = "unset";
    let refreshInTheSameMoment: string | null = "unset";
    await act(async () => {
      await result.current.loginClientProvider({ emailOrPhone: "0712345678", password: "Ab1!xy", remember: true });
      // Still inside the same act: React has not committed the new state yet, which is exactly when the booking's
      // next request is built.
      const handlers = configureApiAuth.mock.calls.at(-1)?.[0] as {
        getAccessToken: () => string | null;
        getRefreshToken: () => string | null;
      };
      tokenInTheSameMoment = handlers.getAccessToken();
      refreshInTheSameMoment = handlers.getRefreshToken();
    });

    expect(tokenInTheSameMoment).toBe(access);
    expect(refreshInTheSameMoment).toBe("refresh-1");
  });
});
