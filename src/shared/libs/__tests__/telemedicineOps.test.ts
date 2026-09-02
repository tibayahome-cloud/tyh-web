import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGet, mockPost, mockPut } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn()
}));

vi.mock("../api", () => ({
  __esModule: true,
  default: { get: mockGet, post: mockPost, put: mockPut }
}));

import {
  fetchPaymentReport,
  fetchProviderPreference,
  fetchReviewQueue,
  proposeReschedule,
  resolveReviewItem,
  saveProviderPreference
} from "../telemedicineOps";

describe("provider preferences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when no preference has been recorded", async () => {
    // Absent is the normal case, and must not surface as an object of nulls that reads like
    // a preference somebody actually expressed.
    mockGet.mockResolvedValueOnce({ data: { data: null } });

    expect(await fetchProviderPreference("booking-1")).toBeNull();
  });

  it("sends every field so clearing one actually clears it", async () => {
    // Omitting a key would leave the previous value in place, which is indistinguishable from
    // the client's edit silently failing.
    mockPut.mockResolvedValueOnce({ data: { data: {} } });

    await saveProviderPreference("booking-1", { preferredGender: "female" });

    expect(mockPut).toHaveBeenCalledWith(
      "/telemedicine/bookings/booking-1/provider-preference",
      expect.objectContaining({
        preferred_gender: "female",
        preferred_language: null,
        note: null
      })
    );
  });
});

describe("rescheduling", () => {
  beforeEach(() => vi.clearAllMocks());

  it("proposes a time without touching the appointment", async () => {
    mockPost.mockResolvedValueOnce({
      data: { data: { id: "r1", booking_id: "b1", status: "pending", proposed_start_at: "2026-09-01T10:00:00Z" } }
    });

    const created = await proposeReschedule("b1", "2026-09-01T10:00:00Z", "clashes with work");

    expect(created.status).toBe("pending");
    expect(mockPost).toHaveBeenCalledWith(
      "/telemedicine/bookings/b1/reschedule-requests",
      expect.objectContaining({ proposed_start_at: "2026-09-01T10:00:00Z", reason: "clashes with work" })
    );
  });
});

describe("payment report", () => {
  beforeEach(() => vi.clearAllMocks());

  it("never reports an unsettled payment as settled", async () => {
    // recorded:false means no payout exists, not that one is assumed.
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          {
            payment_id: "p1",
            status: "succeeded",
            amount_cents: 150000,
            currency: "KES",
            booking: { booking_id: "b1" },
            settlement: { recorded: false },
            review: { pending: false },
            refund: {}
          }
        ],
        meta: {}
      }
    });

    const { rows } = await fetchPaymentReport();

    expect(rows[0].settlement.recorded).toBe(false);
    expect(rows[0].settlement.providerPayoutCents).toBeNull();
    expect(rows[0].refund.status).toBeNull();
  });

  it("omits filters that were not supplied", async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [], meta: {} } });

    await fetchPaymentReport({ status: "failed" });

    const params = mockGet.mock.calls[0][1].params as Record<string, unknown>;
    expect(params["filter[status]"]).toBe("failed");
    expect(params).not.toHaveProperty("filter[facility_id]");
  });
});

describe("review queue", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses to resolve without a reason, before the round trip", async () => {
    // The backend requires it. Failing here means the operator finds out at the form rather
    // than after a request that was always going to be rejected.
    await expect(resolveReviewItem("payment_review", "d1", "   ")).rejects.toThrow("reason is required");
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("passes categories as a comma separated filter", async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [] } });

    await fetchReviewQueue(["payment_review", "no_show"]);

    const params = mockGet.mock.calls[0][1].params as Record<string, unknown>;
    expect(params["filter[category]"]).toBe("payment_review,no_show");
  });
});
