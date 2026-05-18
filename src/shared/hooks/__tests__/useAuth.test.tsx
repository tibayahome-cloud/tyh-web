import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { vi } from "vitest";

import { AuthProvider, useAuth } from "../useAuth";

const { mockPost, mockGet, mockConfigure } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockGet: vi.fn(),
  mockConfigure: vi.fn()
}));

vi.mock("../../libs/api", () => ({
  __esModule: true,
  default: {
    post: mockPost,
    get: mockGet,
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() }
    }
  },
  api: {
    post: mockPost,
    get: mockGet,
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() }
    }
  },
  configureApiAuth: mockConfigure
}));

const createWrapper = () => {
  const client = new QueryClient();
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
};

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockResolvedValue({ data: {} });
    mockGet.mockResolvedValue({ data: {} });
    localStorage.clear();
  });

  it("logs in client/provider user and stores tokens", async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        data: {
          tokens: {
            access_token: "access-1",
            refresh_token: "refresh-1"
          },
          user: {
            id: "1",
            attributes: {
              full_name: "Jane Client",
              phone: "+254712444422",
              roles: ["client"],
              permissions: []
            }
          }
        }
      }
    });
    mockGet.mockResolvedValue({
      data: {
        id: "1",
        attributes: {
          full_name: "Jane Client",
          phone: "+254712444422",
          roles: ["client"],
          permissions: []
        }
      }
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper });
    let loginResult;

    await act(async () => {
      loginResult = await result.current.loginClientProvider({
        emailOrPhone: "jane@example.com",
        password: "secret123",
        remember: true
      });
    });

    expect(loginResult?.status).toBe("authenticated");
    expect(loginResult?.user?.fullName).toBe("Jane Client");

    expect(mockPost).toHaveBeenCalledWith("/auth/login", {
      emailOrPhone: "jane@example.com",
      password: "secret123"
    }, {
      params: { fields: "id,full_name,phone", include: "roles:id,key,name" }
    });
    expect(result.current.accessToken).toBe("access-1");
    expect(result.current.refreshToken).toBe("refresh-1");
    expect(result.current.user?.fullName).toBe("Jane Client");
    const stored = window.localStorage.getItem("tiba.auth.user");
    expect(stored).toBeTruthy();
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, unknown>;
      expect(parsed.fullName).toBe("Jane Client");
      expect(parsed.phone).toBe("+254712444422");
    }
  });

  it("refreshes token when refresh() is called", async () => {
    mockPost
      .mockResolvedValueOnce({
        data: {
          data: {
            tokens: {
              access_token: "access-old",
              refresh_token: "refresh-old"
            },
            user: {
              id: "22",
              attributes: {
                full_name: "Provider",
                roles: ["provider"]
              }
            }
          }
        }
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            access_token: "access-new",
            refresh_token: "refresh-new"
          }
        }
      });

    mockGet.mockResolvedValue({
      data: {
        id: "22",
        attributes: {
          full_name: "Provider",
          roles: ["provider"],
          permissions: []
        }
      }
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      const initialLogin = await result.current.loginClientProvider({
        emailOrPhone: "provider@example.com",
        password: "secret123"
      });
      expect(initialLogin.status).toBe("authenticated");
    });

    await act(async () => {
      const token = await result.current.refresh();
      expect(token).toBe("access-new");
    });

    expect(mockPost).toHaveBeenLastCalledWith("/auth/refresh", {
      refresh_token: "refresh-old"
    });
    expect(result.current.accessToken).toBe("access-new");
    expect(result.current.refreshToken).toBe("refresh-new");
  });

  it("handles mfa challenge and verifies successfully", async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        data: {
          next: "2fa_required",
          method: "totp",
          session_hint: "session-123"
        }
      }
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper });

    let challengeResult;
    await act(async () => {
      challengeResult = await result.current.loginClientProvider({
        emailOrPhone: "jane@example.com",
        password: "secret123"
      });
    });

    expect(challengeResult).toEqual({
      status: "mfa_required",
      method: "totp",
      sessionHint: "session-123",
      userId: undefined
    });

    mockPost.mockResolvedValueOnce({
      data: {
        data: {
          tokens: {
            access_token: "access-2fa",
            refresh_token: "refresh-2fa"
          },
          user: {
            id: "1",
            attributes: {
              full_name: "Jane Client",
              phone: "+254712444422",
              roles: ["client"],
              permissions: []
            }
          }
        }
      }
    });

    const verifyResult = await act(async () =>
      result.current.verifyTwoFactor({ method: "totp", sessionHint: "session-123", code: "123456" })
    );

    expect(verifyResult.status).toBe("authenticated");
    expect(result.current.accessToken).toBe("access-2fa");
    expect(result.current.refreshToken).toBe("refresh-2fa");
  });

  it("throws backend error message when login fails", async () => {
    mockPost.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        data: {
          message: "Invalid credentials"
        }
      }
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await expect(
        result.current.loginClientProvider({
          emailOrPhone: "wrong@example.com",
          password: "badpass"
        })
      ).rejects.toThrow("Invalid credentials");
    });
  });
});
