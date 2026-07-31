import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn()
}));

vi.mock("../api", () => ({
  __esModule: true,
  default: { get: mockGet }
}));

import { fetchFacilityPayments } from "../payments";
import { fetchFacilityWithdrawals } from "../wallet";

describe("facility finance API helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests payments through the facility-scoped endpoint", async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [{
          id: "payment-1",
          booking_id: "booking-1",
          client_user_id: "client-1",
          provider_user_id: "provider-1",
          status: "succeeded",
          method: "mpesa",
          amount_cents: 100000,
          currency: "KES",
          b2b_settlement: {
            booking_amount_cents: 100000,
            platform_fee_cents: 15000,
            facility_share_cents: 25500,
            provider_payout_cents: 59500,
            provider_compensation_mode: "percentage"
          }
        }],
        meta: { page: { number: 1, size: 25, total: 1, total_pages: 1 } }
      }
    });

    const result = await fetchFacilityPayments("facility-1", { page: 2, pageSize: 25, status: "succeeded" });

    expect(mockGet).toHaveBeenCalledWith("/admin/payments/facilities/facility-1/payments", {
      params: {
        "page[number]": 2,
        "page[size]": 25,
        "filter[status]": "succeeded"
      }
    });
    expect(result.payments[0]?.settlement?.facilityShareCents).toBe(25500);
  });

  it("requests withdrawals through the facility-scoped endpoint", async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [{
          id: "withdrawal-1",
          wallet_id: "wallet-1",
          provider_user_id: "provider-1",
          status: "requested",
          amount_cents: 20000,
          currency: "KES",
          requested_at: "2026-07-30T10:00:00Z"
        }],
        meta: { page: { number: 1, size: 25, total: 1, total_pages: 1 } }
      }
    });

    const result = await fetchFacilityWithdrawals("facility-1", { page: 2, size: 25, status: "requested" });

    expect(mockGet).toHaveBeenCalledWith("/admin/payments/facilities/facility-1/withdrawals", {
      params: {
        "page[number]": 2,
        "page[size]": 25,
        "filter[status]": "requested"
      }
    });
    expect(result.withdrawals[0]?.amountCents).toBe(20000);
  });
});
