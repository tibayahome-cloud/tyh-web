import { describe, expect, it } from "vitest";

import {
  buildFacilitySettingsForm,
  validateFacilitySettingsForm
} from "../FacilityWorkspacePage";
import type { Facility } from "../../../../../shared/schemas/facility";

const facilityFactory = (overrides: Partial<Facility> = {}): Facility => ({
  id: "facility-1",
  name: "Nairobi Facility",
  facilityType: "clinic",
  address: "Kilimani",
  county: "Nairobi",
  email: "facility@example.test",
  status: "active",
  lat: -1.29,
  lng: 36.82,
  platformFeePercent: 10,
  providerFinancialsVisible: false,
  approvedAt: null,
  suspendedAt: null,
  phones: [
    { id: "phone-1", phone: "+254700000000", label: "Reception", isPrimary: true },
    { id: "phone-2", phone: "+254711000000", label: "Emergency", isPrimary: false }
  ],
  operatingHours: [
    { id: "mon", weekday: "mon", openTime: null, closeTime: null, isClosed: false, is24Hours: true }
  ],
  services: [],
  admins: [],
  ...overrides
});

describe("facility operations settings", () => {
  it("maps existing phone numbers and fills missing weekdays", () => {
    const form = buildFacilitySettingsForm(facilityFactory());

    expect(form.phones).toHaveLength(2);
    expect(form.phones[1]).toMatchObject({ phone: "+254711000000", label: "Emergency" });
    expect(form.operatingHours).toHaveLength(7);
    expect(form.operatingHours.find((hour) => hour.weekday === "mon")?.is24Hours).toBe(true);
    expect(form.operatingHours.find((hour) => hour.weekday === "sun")?.is24Hours).toBe(true);
  });

  it("requires a contact number and complete hours for open non-24-hour days", () => {
    const form = buildFacilitySettingsForm(facilityFactory({ phones: [] }));
    expect(validateFacilitySettingsForm(form)).toBe("At least one facility phone number is required.");

    form.phones = [{ phone: "+254700000000", label: "Reception", isPrimary: true }];
    form.operatingHours[0] = { ...form.operatingHours[0], is24Hours: false, openTime: null };
    expect(validateFacilitySettingsForm(form)).toBe("Enter opening and closing times for every open day.");
  });
});
