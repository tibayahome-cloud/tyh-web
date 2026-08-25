import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn()
}));

vi.mock("../api", () => ({
  __esModule: true,
  default: {
    get: mockGet,
    post: mockPost
  }
}));

import { fetchJitsiHealth, reassignProvider } from "../telemedicine";

describe("telemedicine client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the dedicated telemedicine reassignment endpoint", async () => {
    mockPost.mockResolvedValueOnce({
      data: { data: { id: "booking-1", status: "scheduled", provider_user_id: "provider-2" } }
    });

    await expect(reassignProvider("booking-1", "provider-2", "Provider unavailable")).resolves.toEqual({
      id: "booking-1",
      status: "scheduled",
      providerUserId: "provider-2"
    });
    expect(mockPost).toHaveBeenCalledWith("/telemedicine/bookings/booking-1/reassign", {
      provider_user_id: "provider-2",
      reason: "Provider unavailable"
    });
  });

  it("accepts the backend's 503 degraded response instead of treating it as a request failure", async () => {
    // GET /admin/telemedicine/jitsi-health deliberately returns 503 (with a populated body)
    // when Jitsi is degraded -- that's real data, not an error, so the call must resolve.
    mockGet.mockImplementation(async (_url: string, config: { validateStatus?: (status: number) => boolean }) => {
      if (!config?.validateStatus?.(503)) {
        throw new Error("request rejected a 503 the backend uses to carry valid degraded-status data");
      }
      return {
        data: {
          data: {
            status: "degraded",
            checked_at: "2026-08-14T10:00:00Z",
            latency_ms: null,
            error_category: "timeout"
          }
        }
      };
    });

    await expect(fetchJitsiHealth()).resolves.toEqual({
      status: "degraded",
      checkedAt: "2026-08-14T10:00:00Z",
      latencyMs: null,
      errorCategory: "timeout"
    });
  });

  it("still maps a healthy 200 response", async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: {
          status: "ok",
          checked_at: "2026-08-14T10:00:00Z",
          latency_ms: 42,
          error_category: null
        }
      }
    });

    await expect(fetchJitsiHealth()).resolves.toEqual({
      status: "ok",
      checkedAt: "2026-08-14T10:00:00Z",
      latencyMs: 42,
      errorCategory: null
    });
  });
});
