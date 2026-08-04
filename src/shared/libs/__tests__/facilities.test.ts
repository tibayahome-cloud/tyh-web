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
  assignFacilityBookingProvider,
  createFacility,
  discoverFacilities,
  fetchFacilityOverview,
  bootstrapFacilityProvider,
  createFacilityProvider,
  fetchFacilityBookings,
  fetchFacilityProviders,
  fetchFacilityAdminInvitationStatus,
  resendFacilityAdminInvitation,
  facilityServiceUpdatePayload,
  updateFacilityStatus,
  updateFacilityProviderCompensation,
  updateFacilityProvider,
  updateFacilityProviderLifecycle
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
      lng: 36.8219,
      excludeFacilityId: "facility-1"
    });

    expect(mockGet).toHaveBeenCalledWith("/facilities/discover", {
      params: {
        service_id: "service-1",
        lat: -1.2921,
        lng: 36.8219,
        exclude_facility_id: "facility-1"
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

  it("assigns facility admin ops by email", async () => {
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

    const result = await assignFacilityAdmin("facility-1", "admin@example.com");

    expect(mockPost).toHaveBeenCalledWith("/facilities/facility-1/admins", { email: "admin@example.com" });
    expect(result).toEqual({
      id: "admin-link-1",
      facilityId: "facility-1",
      userId: "user-1",
      roleKey: "admin.ops",
      active: true
    });
  });

  it("fetches facility admin invitation status without exposing a token", async () => {
    mockGet.mockResolvedValueOnce({
      data: { data: { status: "pending", reset_id: "reset-1", expires_at: "2026-08-04T10:00:00Z" } }
    });

    const result = await fetchFacilityAdminInvitationStatus("facility-1", "user-1");

    expect(mockGet).toHaveBeenCalledWith("/facilities/facility-1/admins/user-1/invitation");
    expect(result).toEqual({
      status: "pending",
      resetId: "reset-1",
      expiresAt: "2026-08-04T10:00:00Z",
      redeemedAt: null
    });
  });

  it("resends a facility admin invitation", async () => {
    mockPost.mockResolvedValueOnce({
      data: { data: { invitation_sent: true, invitation_expires_at: "2026-08-04T11:00:00Z" } }
    });

    const result = await resendFacilityAdminInvitation("facility-1", "user-1");

    expect(mockPost).toHaveBeenCalledWith("/facilities/facility-1/admins/user-1/invitation/resend");
    expect(result).toEqual({ invitationSent: true, invitationExpiresAt: "2026-08-04T11:00:00Z" });
  });

  it("keeps facility service partial update payloads partial", () => {
    expect(facilityServiceUpdatePayload({ active: false, priceCents: 120000 })).toEqual({
      active: false,
      price_cents: 120000
    });
  });

  it("updates facility lifecycle status with backend field names", async () => {
    mockPatch.mockResolvedValueOnce({
      data: {
        data: {
          ...facilityResponse,
          status: "suspended"
        }
      }
    });

    const result = await updateFacilityStatus("facility-1", "suspended");

    expect(mockPatch).toHaveBeenCalledWith("/facilities/facility-1/status", { status: "suspended" });
    expect(result.status).toBe("suspended");
  });

  it("updates provider compensation with backend field names", async () => {
    mockPatch.mockResolvedValueOnce({
      data: {
        data: {
          id: "provider-1",
          user_id: "provider-user-1",
          facility_id: "facility-1",
          compensation_mode: "percentage",
          payout_percentage: "40",
          verified: true
        }
      }
    });

    const result = await updateFacilityProviderCompensation("facility-1", "provider-user-1", {
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
    expect(result.compensation).toEqual({
      mode: "percentage",
      fixedPayoutCents: null,
      payoutPercentage: 40
    });
  });

  it("filters facility provider list by facility id from provider payload", async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          { id: "provider-1", user_id: "user-1", facility_id: "facility-1", verified: true },
          { id: "provider-2", user_id: "user-2", facility_id: "facility-2", verified: true }
        ],
        meta: { page: { number: 1, size: 25, total: 2, total_pages: 1 } }
      }
    });

    const result = await fetchFacilityProviders("facility-1");

    expect(mockGet).toHaveBeenCalledWith("/providers", {
      params: expect.objectContaining({
        "filter[facility_id]": "facility-1",
        fields: expect.stringContaining("facility_id")
      })
    });
    expect(result.providers.map((provider) => provider.userId)).toEqual(["user-1"]);
  });

  it("maps the facility overview summary without exposing collections", async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: {
          facility: { ...facilityResponse, lat: -1.2, lng: 36.8 },
          metrics: {
            open_bookings: 4,
            unassigned_bookings: 2,
            providers_total: 8,
            providers_available: 3,
            providers_pending_verification: 1,
            active_services: 5
          },
          readiness: { location_ready: true, contact_ready: true, operating_hours_configured: false }
        }
      }
    });

    await expect(fetchFacilityOverview("facility-1")).resolves.toMatchObject({
      facility: { id: "facility-1" },
      metrics: { openBookings: 4, unassignedBookings: 2, providersTotal: 8, activeServices: 5 },
      readiness: { locationReady: true, operatingHoursConfigured: false }
    });
    expect(mockGet).toHaveBeenCalledWith("/facilities/facility-1/overview");
  });

  it("creates a provider with facility services, compensation, and visibility settings", async () => {
    mockPost.mockResolvedValueOnce({
      data: { data: { provider: { id: "provider-1", user_id: "user-1", facility_id: "facility-1" }, created: true, invitation_sent: true } }
    });

    const result = await createFacilityProvider("facility-1", {
      fullName: "Provider One",
      email: "provider@example.com",
      serviceIds: ["service-1"],
      compensation: { mode: "percentage", fixedPayoutCents: null, payoutPercentage: 60 },
      providerFinancialsVisible: false
    });

    expect(mockPost).toHaveBeenCalledWith("/facilities/facility-1/providers", {
      full_name: "Provider One",
      email: "provider@example.com",
      phone: undefined,
      service_ids: ["service-1"],
      invitation_channel: undefined,
      compensation_mode: "percentage",
      fixed_payout_cents: null,
      payout_percentage: 60,
      provider_financials_visible: false
    });
    expect(result).toMatchObject({ created: true, invitationSent: true, provider: { facilityId: "facility-1" } });
  });

  it("updates provider details, services, compensation, and visibility in one facility-scoped request", async () => {
    mockPatch.mockResolvedValueOnce({
      data: {
        data: {
          id: "provider-1",
          user_id: "user-1",
          facility_id: "facility-1",
          provider_financials_visible: null
        }
      }
    });

    const result = await updateFacilityProvider("facility-1", "user-1", {
      fullName: "Updated Provider",
      email: "updated@example.com",
      phone: "+254700000001",
      serviceIds: ["service-2"],
      providerFinancialsVisible: null,
      compensation: { mode: "fixed", fixedPayoutCents: 150000, payoutPercentage: null }
    });

    expect(mockPatch).toHaveBeenCalledWith("/facilities/facility-1/providers/user-1", {
      full_name: "Updated Provider",
      email: "updated@example.com",
      phone: "+254700000001",
      service_ids: ["service-2"],
      provider_financials_visible: null,
      mode: "fixed",
      fixed_payout_cents: 150000,
      payout_percentage: null
    });
    expect(result.facilityId).toBe("facility-1");
  });

  it("updates provider lifecycle through the facility-scoped endpoint", async () => {
    mockPatch.mockResolvedValueOnce({
      data: { data: { id: "provider-1", user_id: "user-1", facility_id: "facility-1", verified: true, is_available: true } }
    });

    const result = await updateFacilityProviderLifecycle("facility-1", "user-1", {
      status: "active",
      verified: true,
      isAvailable: true
    });

    expect(mockPatch).toHaveBeenCalledWith(
      "/facilities/facility-1/providers/user-1/lifecycle",
      { status: "active", verified: true, is_available: true }
    );
    expect(result).toMatchObject({ facilityId: "facility-1", verified: true, isAvailable: true });
  });

  it("fetches facility booking queues with facility status filters", async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "booking-1",
            status: "pending",
            booking_type: "immediate",
            facility_id: "facility-1",
            facility_status: "pending",
            request_mode: "selected_facility",
            price_cents: 120000,
            currency: "KES"
          }
        ],
        meta: { page: { number: 1, size: 25, total: 1, total_pages: 1 } }
      }
    });

    const result = await fetchFacilityBookings("facility-1", {
      pageSize: 25,
      facilityStatus: "pending,claimed"
    });

    expect(mockGet).toHaveBeenCalledWith("/facilities/facility-1/bookings", {
      params: {
        "page[number]": 1,
        "page[size]": 25,
        "filter[facility_status]": "pending,claimed"
      }
    });
    expect(result.bookings[0]).toMatchObject({
      id: "booking-1",
      facilityId: "facility-1",
      facilityStatus: "pending"
    });
  });

  it("assigns a provider to a facility booking with backend field names", async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        data: {
          id: "booking-1",
          status: "accepted",
          booking_type: "immediate",
          facility_id: "facility-1",
          facility_status: "claimed",
          request_mode: "selected_facility",
          provider: { id: "provider-user-1", full_name: "Provider One" },
          price_cents: 120000,
          currency: "KES"
        }
      }
    });

    const result = await assignFacilityBookingProvider("facility-1", "booking-1", {
      providerUserId: "provider-user-1",
      reason: "facility_assignment"
    });

    expect(mockPost).toHaveBeenCalledWith("/facilities/facility-1/bookings/booking-1/assign", {
      provider_user_id: "provider-user-1",
      reason: "facility_assignment"
    });
    expect(result).toMatchObject({
      id: "booking-1",
      facilityId: "facility-1",
      facilityStatus: "claimed",
      provider: { id: "provider-user-1", fullName: "Provider One" }
    });
  });

  it("bootstraps a provider into a facility", async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        data: {
          provider: {
            id: "provider-1",
            user_id: "user-1",
            facility_id: "facility-1",
            verified: false
          },
          application: { id: "application-1" }
        }
      }
    });

    const result = await bootstrapFacilityProvider("facility-1", "user-1", {
      services: ["service-1"],
      compensation: {
        mode: "employee",
        fixedPayoutCents: null,
        payoutPercentage: null
      }
    });

    expect(mockPost).toHaveBeenCalledWith("/facilities/facility-1/providers/user-1/bootstrap", {
      services: ["service-1"],
      compensation: {
        mode: "employee",
        fixed_payout_cents: null,
        payout_percentage: null
      }
    });
    expect(result.provider?.facilityId).toBe("facility-1");
  });
});
