import { describe, expect, it } from "vitest";

import { mapPayment, mapPaymentSettlement } from "../payment";

describe("payment schema mappers", () => {
  it("maps B2B settlement metadata from payment responses", () => {
    const payment = mapPayment({
      id: "payment-1",
      booking_id: "booking-1",
      client_user_id: "client-1",
      provider_user_id: "provider-1",
      status: "succeeded",
      method: "mpesa",
      amount_cents: 100000,
      retry_count: 0,
      provider_ref: "MPESA123",
      initiated_at: "2026-07-30T08:00:00Z",
      succeeded_at: "2026-07-30T08:02:00Z",
      meta_data: {
        b2b_settlement: {
          booking_amount_cents: 100000,
          platform_fee_cents: 10000,
          facility_share_cents: 54000,
          provider_payout_cents: 36000,
          provider_compensation_mode: "percentage"
        }
      }
    });

    expect(payment).toMatchObject({
      id: "payment-1",
      bookingId: "booking-1",
      channel: "mpesa",
      currency: "KES",
      providerRef: "MPESA123",
      completedAt: "2026-07-30T08:02:00Z",
      settlement: {
        bookingAmountCents: 100000,
        platformFeeCents: 10000,
        facilityShareCents: 54000,
        providerPayoutCents: 36000,
        providerCompensationMode: "percentage"
      }
    });
  });

  it("returns null settlement when backend has not exposed split metadata", () => {
    expect(mapPaymentSettlement(undefined)).toBeNull();
    expect(mapPaymentSettlement({})).toBeNull();
  });
});
