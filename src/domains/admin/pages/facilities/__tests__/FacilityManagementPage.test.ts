import { describe, expect, it } from "vitest";

import { buildFacilityCreateInput } from "../FacilityManagementPage";

describe("FacilityManagementPage helpers", () => {
  it("builds a 24/7 facility onboarding payload", () => {
    const payload = buildFacilityCreateInput({
      name: " Nairobi Clinic ",
      facilityType: "clinic",
      address: " Kilimani ",
      county: " Nairobi ",
      phone: " +254700000000 ",
      phoneLabel: " Reception ",
      email: " care@nairobi.test ",
      initialAdminEmail: " ops@nairobi.test ",
      lat: "-1.2921",
      lng: "36.8219",
      platformFeePercent: "10",
      is24Hours: true,
      openTime: "08:00",
      closeTime: "17:00"
    });

    expect(payload).toMatchObject({
      name: "Nairobi Clinic",
      facilityType: "clinic",
      address: "Kilimani",
      county: "Nairobi",
      phones: [{ phone: "+254700000000", label: "Reception", isPrimary: true }],
      email: "care@nairobi.test",
      initialAdminEmail: "ops@nairobi.test",
      lat: -1.2921,
      lng: 36.8219,
      platformFeePercent: 10
    });
    expect(payload.operatingHours).toHaveLength(7);
    expect(payload.operatingHours.every((hour) => hour.is24Hours && !hour.isClosed)).toBe(true);
  });
});
