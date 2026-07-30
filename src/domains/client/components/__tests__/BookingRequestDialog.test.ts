import { describe, expect, it } from "vitest";

import { resolveBookingFacilitySelection } from "../BookingRequestDialog";
import type { FacilityDiscoveryItem } from "../../../../shared/schemas/facility";

const facility = (id: string): FacilityDiscoveryItem =>
  ({
    id,
    name: `Facility ${id}`,
    facilityType: "clinic",
    address: "Kilimani",
    county: "Nairobi",
    lat: -1.2921,
    lng: 36.8219,
    distanceM: 500,
    operatingStatus: "open",
    availabilitySignal: "available",
    service: {
      id: `facility-service-${id}`,
      facilityId: id,
      serviceId: "service-1",
      priceCents: 150000,
      currency: "KES",
      estimateDurationMinutes: 45,
      active: true,
      isEmergencyCapable: false,
      service: {
        id: "service-1",
        name: "Dressing",
        key: "dressing",
        basePriceCents: 120000,
        defaultEstimateMinutes: 45
      }
    }
  }) satisfies FacilityDiscoveryItem;

describe("BookingRequestDialog facility selection", () => {
  it("uses the first discovered facility for fastest available bookings", () => {
    expect(resolveBookingFacilitySelection("fastest_available", null, [facility("facility-1"), facility("facility-2")])).toEqual({
      facilityId: "facility-1",
      requestMode: "fastest_available"
    });
  });

  it("uses the manually selected facility for selected facility bookings", () => {
    expect(resolveBookingFacilitySelection("selected_facility", "facility-2", [facility("facility-1"), facility("facility-2")])).toEqual({
      facilityId: "facility-2",
      requestMode: "selected_facility"
    });
  });

  it("blocks booking when no facility can be resolved", () => {
    expect(resolveBookingFacilitySelection("fastest_available", null, [])).toBeNull();
    expect(resolveBookingFacilitySelection("selected_facility", null, [facility("facility-1")])).toBeNull();
  });
});
