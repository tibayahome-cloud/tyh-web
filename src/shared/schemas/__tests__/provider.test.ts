import { describe, expect, it } from "vitest";

import { mapProvider } from "../provider";

describe("provider schema mappers", () => {
  it("maps facility membership and compensation settings", () => {
    const provider = mapProvider({
      id: "provider-1",
      user_id: "user-1",
      facility_id: "facility-1",
      verified: true,
      compensation_mode: "fixed",
      fixed_payout_cents: 45000,
      payout_percentage: null,
      user: {
        id: "user-1",
        full_name: "Provider One",
        email: "provider@test.local"
      }
    });

    expect(provider).toMatchObject({
      id: "provider-1",
      userId: "user-1",
      facilityId: "facility-1",
      verified: true,
      compensation: {
        mode: "fixed",
        fixedPayoutCents: 45000,
        payoutPercentage: null
      },
      user: {
        fullName: "Provider One"
      }
    });
  });
});
