import { describe, expect, it } from "vitest";

import { buildFacilityCreateInput, validateCreateForm } from "../FacilityManagementPage";

const validForm = {
  name: "Nairobi Clinic",
  facilityType: "clinic" as const,
  address: "Kilimani",
  county: "Nairobi",
  phones: [{ phone: "+254700000000", label: "Reception", isPrimary: true }],
  email: "care@nairobi.test",
  initialAdminEmail: "ops@nairobi.test",
  lat: "-1.2921",
  lng: "36.8219",
  platformFeePercent: "10",
  is24Hours: true,
  openTime: "08:00",
  closeTime: "17:00"
};

describe("FacilityManagementPage helpers", () => {
  it("builds a 24/7 facility onboarding payload", () => {
    const payload = buildFacilityCreateInput({
      ...validForm,
      name: " Nairobi Clinic ",
      address: " Kilimani ",
      county: " Nairobi ",
      phones: [{ phone: " +254700000000 ", label: " Reception ", isPrimary: true }],
      email: " care@nairobi.test ",
      initialAdminEmail: " ops@nairobi.test "
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

  it("builds daily operating-hour payloads when not open 24/7", () => {
    const payload = buildFacilityCreateInput({
      ...validForm,
      is24Hours: false,
      openTime: "07:30",
      closeTime: "19:00"
    });

    expect(payload.operatingHours).toHaveLength(7);
    expect(payload.operatingHours.every((hour) => hour.openTime === "07:30")).toBe(true);
    expect(payload.operatingHours.every((hour) => hour.closeTime === "19:00")).toBe(true);
    expect(payload.operatingHours.every((hour) => !hour.is24Hours && !hour.isClosed)).toBe(true);
  });

  it("validates required facility onboarding fields", () => {
    expect(validateCreateForm({ ...validForm, name: "" })).toBe(
      "Name, address, county, and facility email are required."
    );
    expect(validateCreateForm({ ...validForm, phones: [{ phone: "", label: "Reception", isPrimary: true }] })).toBe("At least one facility phone number is required.");
    expect(validateCreateForm({ ...validForm, initialAdminEmail: "" })).toBe("Initial admin email is required.");
  });

  it("validates facility fee, coordinates, and operating hours", () => {
    expect(validateCreateForm({ ...validForm, platformFeePercent: "101" })).toBe(
      "Platform fee must be between 0 and 100."
    );
    expect(validateCreateForm({ ...validForm, lat: "" })).toBe("Select the facility location on the map.");
    expect(validateCreateForm({ ...validForm, is24Hours: false, openTime: "" })).toBe(
      "Opening and closing time are required unless the facility is 24/7."
    );
  });
});
