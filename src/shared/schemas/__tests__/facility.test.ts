import { describe, expect, it } from "vitest";

import {
  canViewProviderFinancials,
  formatOperatingHoursSummary,
  formatProviderCompensation,
  isFacilityAlwaysOpen,
  mapFacility,
  mapFacilityDiscoveryResult,
  mapProviderCompensation,
  WEEKDAYS
} from "../facility";

describe("facility schema mappers", () => {
  it("maps facility payloads to frontend shape", () => {
    const facility = mapFacility({
      id: "facility-1",
      attributes: {
        name: "Nairobi Clinic",
        facility_type: "clinic",
        address: "Kilimani",
        county: "Nairobi",
        email: "care@nairobi.test",
        status: "active",
        lat: "-1.2921",
        lng: "36.8219",
        platform_fee_percent: "10",
        provider_financials_visible: false,
        phones: [{ phone: "+254700000000", label: "Reception", is_primary: true }],
        operating_hours: [
          { weekday: "mon", open_time: "08:00", close_time: "17:00", is_closed: false, is_24_hours: false }
        ],
        services: [
          {
            id: "facility-service-1",
            facility_id: "facility-1",
            service_id: "service-1",
            price_cents: 150000,
            currency: "KES",
            active: true,
            is_emergency_capable: false,
            service: {
              id: "service-1",
              name: "Dressing",
              key: "dressing",
              base_price_cents: 120000,
              default_estimate_minutes: 45
            }
          }
        ],
        admins: [{ id: "admin-1", facility_id: "facility-1", user_id: "user-1", role_key: "admin.ops", active: true }]
      }
    });

    expect(facility).toMatchObject({
      id: "facility-1",
      name: "Nairobi Clinic",
      facilityType: "clinic",
      county: "Nairobi",
      platformFeePercent: 10,
      providerFinancialsVisible: false
    });
    expect(facility?.phones[0]).toMatchObject({ phone: "+254700000000", isPrimary: true });
    expect(facility?.services[0]).toMatchObject({
      id: "facility-service-1",
      serviceId: "service-1",
      priceCents: 150000,
      service: { name: "Dressing" }
    });
  });

  it("maps facility discovery waves and nested service pricing", () => {
    const result = mapFacilityDiscoveryResult({
      radius_m: 1500,
      next_radius_m: 3000,
      facilities: [
        {
          id: "facility-1",
          name: "Nairobi Clinic",
          facility_type: "clinic",
          address: "Kilimani",
          county: "Nairobi",
          lat: -1.2921,
          lng: 36.8219,
          distance_m: 850,
          operating_status: "open",
          availability_signal: "available",
          service: {
            facility_service_id: "facility-service-1",
            service_id: "service-1",
            price_cents: 150000,
            currency: "KES",
            estimate_duration_minutes: 45,
            is_emergency_capable: false,
            service: { id: "service-1", name: "Dressing", key: "dressing" }
          }
        }
      ]
    });

    expect(result.radiusM).toBe(1500);
    expect(result.nextRadiusM).toBe(3000);
    expect(result.facilities[0]).toMatchObject({
      distanceM: 850,
      operatingStatus: "open",
      service: {
        id: "facility-service-1",
        priceCents: 150000,
        estimateDurationMinutes: 45
      }
    });
  });
});

describe("facility display helpers", () => {
  it("formats 24/7 operating hours", () => {
    const hours = WEEKDAYS.map((weekday) => ({
      id: weekday,
      weekday,
      openTime: null,
      closeTime: null,
      isClosed: false,
      is24Hours: true
    }));

    expect(isFacilityAlwaysOpen(hours)).toBe(true);
    expect(formatOperatingHoursSummary(hours)).toBe("Open 24/7");
  });

  it("formats provider compensation and financial visibility", () => {
    const compensation = mapProviderCompensation({
      compensation_mode: "percentage",
      payout_percentage: "40"
    });

    expect(formatProviderCompensation(compensation)).toBe("40% split");
    expect(canViewProviderFinancials({ providerFinancialsVisible: false }, ["provider"])).toBe(false);
    expect(canViewProviderFinancials({ providerFinancialsVisible: false }, ["admin.ops"])).toBe(true);
  });
});
