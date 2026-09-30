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

import { discoverRemoteFacilities, fetchJitsiHealth, reassignProvider } from "../telemedicine";
import { mapTelemedicineHold } from "../../schemas/telemedicine";

describe("telemedicine client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps the server-derived hold countdown", () => {
    expect(
      mapTelemedicineHold({
        id: "hold-1",
        facility_id: "facility-1",
        facility_service_id: "service-1",
        start_at: "2026-08-28T10:00:00Z",
        end_at: "2026-08-28T10:30:00Z",
        status: "active",
        is_active: true,
        expires_at: "2026-08-28T09:10:00Z",
        remaining_seconds: 417,
      })?.remainingSeconds,
    ).toBe(417);
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

describe("remote facility discovery", () => {
  const entry = {
    id: "facility-1",
    name: "Kilimani Clinic",
    facility_type: "clinic",
    address: "Kilimani",
    county: "Nairobi",
    timezone: "Africa/Nairobi",
    service: { facility_service_id: "fs-1", price_cents: 150000, currency: "KES", estimate_duration_minutes: 30 }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the default request and ordering unchanged: no ranking parameter", async () => {
    mockGet.mockResolvedValue({ data: { data: [entry] } });

    const result = await discoverRemoteFacilities("service-1", "KE");

    expect(mockGet).toHaveBeenCalledWith("/facilities/discover-remote", {
      params: { service_id: "service-1", country_code: "KE" }
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "facility-1", earliestAvailableAt: null, availableSlotCount: 0 });
  });

  it("only asks for earliest-slot ranking when explicitly opted in, and maps the slot preview", async () => {
    mockGet.mockResolvedValue({
      data: { data: [{ ...entry, earliest_available_at: "2026-10-01T06:00:00Z", available_slot_count: 4 }] }
    });

    const result = await discoverRemoteFacilities("service-1", undefined, { ranking: "earliest_slot" });

    expect(mockGet).toHaveBeenCalledWith("/facilities/discover-remote", {
      params: { service_id: "service-1", ranking: "earliest_slot" }
    });
    expect(result[0]).toMatchObject({ earliestAvailableAt: "2026-10-01T06:00:00Z", availableSlotCount: 4 });
  });

  it("ignores malformed slot preview values instead of trusting them", async () => {
    mockGet.mockResolvedValue({
      data: { data: [{ ...entry, earliest_available_at: 12345, available_slot_count: "four" }] }
    });

    const result = await discoverRemoteFacilities("service-1", "KE", { ranking: "earliest_slot" });

    expect(result[0]).toMatchObject({ earliestAvailableAt: null, availableSlotCount: 0 });
  });
});
