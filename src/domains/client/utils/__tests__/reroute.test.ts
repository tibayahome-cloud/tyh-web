import { describe, expect, it } from "vitest";

import { canConfirmFacilityReroute } from "../reroute";

const baseBooking = {
  requestMode: "selected_facility" as const,
  facilityStatus: "expired",
  provider: null
};

describe("facility reroute eligibility", () => {
  it("allows manual requests that expired without a provider", () => {
    expect(canConfirmFacilityReroute(baseBooking)).toBe(true);
  });

  it("does not ask for confirmation for fastest-available requests", () => {
    expect(canConfirmFacilityReroute({ ...baseBooking, requestMode: "fastest_available" })).toBe(false);
  });

  it("does not ask before the facility request expires", () => {
    expect(canConfirmFacilityReroute({ ...baseBooking, facilityStatus: "pending" })).toBe(false);
  });

  it("does not reroute a booking that already has a provider", () => {
    expect(canConfirmFacilityReroute({
      ...baseBooking,
      provider: { id: "provider-1", fullName: "Provider", avatarUrl: null, email: null, phone: null }
    })).toBe(false);
  });
});
