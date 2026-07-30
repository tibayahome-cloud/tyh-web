import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGet, mockPatch, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPatch: vi.fn(),
  mockPost: vi.fn()
}));

vi.mock("../api", () => ({
  __esModule: true,
  default: {
    get: mockGet,
    patch: mockPatch,
    post: mockPost
  }
}));

import {
  assignFacilityAdmin,
  createFacility,
  discoverFacilities,
  facilityServiceUpdatePayload,
  updateFacilityProviderCompensation
} from "../facilities";

const facilityResponse = {
  id: "facility-1",
  name: "Nairobi Clinic",
  facility_type: "clinic",
  address: "Kilimani",
  county: "Nairobi",
  email: "care@nairobi.test",
  status: "active",
  platform_fee_percent: 10,
  provider_financials_visible: true
};

describe("facility API helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls discovery endpoint with service and coordinates", async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: {
          radius_m: 1500,
          next_radius_m: 3000,
          facilities: []
        }
      }
    });

    const result = await discoverFacilities({
      serviceId: "service-1",
      lat: -1.2921,
      lng: 36.8219
    });

    expect(mockGet).toHaveBeenCalledWith("/facilities/discover", {
      params: {
        service_id: "service-1",
        lat: -1.2921,
        lng: 36.8219
      }
    });
    expect(result).toEqual({ radiusM: 1500, nextRadiusM: 3000, facilities: [] });
  });

  it("creates facilities with backend field names", async () => {
    mockPost.mockResolvedValueOnce({ data: { data: facilityResponse } });

    await createFacility({
      name: "Nairobi Clinic",
      facilityType: "clinic",
      address: "Kilimani",
      county: "Nairobi",
      phones: [{ phone: "+254700000000", label: "Reception", isPrimary: true }],
      email: "care@nairobi.test",
      lat: -1.2921,
      lng: 36.8219,
      operatingHours: [
        {
          weekday: "mon",
          openTime: "08:00",
          closeTime: "17:00",
          isClosed: false,
          is24Hours: false
        }
      ],
      initialAdminEmail: "admin@nairobi.test",
      platformFeePercent: 10
    });

    expect(mockPost).toHaveBeenCalledWith("/facilities", {
      name: "Nairobi Clinic",
      facility_type: "clinic",
      address: "Kilimani",
      county: "Nairobi",
      phones: [{ phone: "+254700000000", label: "Reception", is_primary: true }],
      email: "care@nairobi.test",
      lat: -1.2921,
      lng: 36.8219,
      operating_hours: [
        {
          weekday: "mon",
          open_time: "08:00",
          close_time: "17:00",
          is_closed: false,
          is_24_hours: false
        }
      ],
      initial_admin_email: "admin@nairobi.test",
      platform_fee_percent: 10
    });
  });

  it("assigns facility admin ops by backend user id", async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        data: {
          id: "admin-link-1",
          facility_id: "facility-1",
          user_id: "user-1",
          role_key: "admin.ops",
          active: true
        }
      }
    });

    const result = await assignFacilityAdmin("facility-1", "user-1");

    expect(mockPost).toHaveBeenCalledWith("/facilities/facility-1/admins", { user_id: "user-1" });
    expect(result).toEqual({
      id: "admin-link-1",
      facilityId: "facility-1",
      userId: "user-1",
      roleKey: "admin.ops",
      active: true
    });
  });

  it("keeps facility service partial update payloads partial", () => {
    expect(facilityServiceUpdatePayload({ active: false, priceCents: 120000 })).toEqual({
      active: false,
      price_cents: 120000
    });
  });

  it("updates provider compensation with backend field names", async () => {
    mockPatch.mockResolvedValueOnce({ data: { data: {} } });

    await updateFacilityProviderCompensation("facility-1", "provider-user-1", {
      mode: "percentage",
      payoutPercentage: 40,
      fixedPayoutCents: null
    });

    expect(mockPatch).toHaveBeenCalledWith(
      "/facilities/facility-1/providers/provider-user-1/compensation",
      {
        mode: "percentage",
        fixed_payout_cents: null,
        payout_percentage: 40
      }
    );
  });
});
