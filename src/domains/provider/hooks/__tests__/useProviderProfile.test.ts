import { describe, expect, it } from "vitest";

import { providerFinancialsAreVisible, type ProviderProfile } from "../useProviderProfile";

const makeProfile = (visible: boolean | null | undefined): ProviderProfile => ({
  id: "provider-1",
  user_id: "user-1",
  facility_id: "facility-1",
  verified: true,
  is_available: true,
  daily_request_limit: 10,
  can_emergency: false,
  facility: {
    id: "facility-1",
    name: "Nairobi Clinic",
    provider_financials_visible: visible
  }
});

describe("providerFinancialsAreVisible", () => {
  it("hides provider financials when the facility disables visibility", () => {
    expect(providerFinancialsAreVisible(makeProfile(false))).toBe(false);
  });

  it("keeps provider financials visible when no facility restriction exists", () => {
    expect(providerFinancialsAreVisible(makeProfile(true))).toBe(true);
    expect(providerFinancialsAreVisible(makeProfile(null))).toBe(true);
    expect(providerFinancialsAreVisible(undefined)).toBe(true);
  });
});
