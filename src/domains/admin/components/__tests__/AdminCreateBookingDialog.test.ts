import { describe, expect, it } from "vitest";

import { buildAdminBookingPayload, resolveAdminBookingFacilityId } from "../AdminCreateBookingDialog";

const facility = (id: string) => ({ id });

describe("AdminCreateBookingDialog facility selection", () => {
  it("defaults admin ops to its only scoped facility", () => {
    expect(resolveAdminBookingFacilityId(["admin.ops"], [facility("facility-1")])).toBe("facility-1");
  });

  it("does not guess a facility for missing or malformed admin ops scope", () => {
    expect(resolveAdminBookingFacilityId(["admin.ops"], [])).toBe("");
    expect(resolveAdminBookingFacilityId(["admin.ops"], [facility("facility-1"), facility("facility-2")])).toBe("");
  });

  it("requires an explicit facility selection for super admins", () => {
    expect(resolveAdminBookingFacilityId(["admin.super"], [facility("facility-1")])).toBe("");
  });

  it("includes facility context and selected-facility routing in the request", () => {
    expect(buildAdminBookingPayload({
      facilityId: "facility-1",
      clientMode: "new",
      clientUserId: "",
      clientName: "Jane Doe",
      clientPhone: "+254700000000",
      serviceId: "service-1",
      addressText: "Westlands",
      lat: -1.26,
      lng: 36.8,
    })).toMatchObject({
      facility_id: "facility-1",
      request_mode: "selected_facility",
      service_id: "service-1",
    });
  });
});
