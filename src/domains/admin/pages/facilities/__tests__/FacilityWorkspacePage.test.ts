import { describe, expect, it } from "vitest";

import {
  buildFacilityServiceInput,
  buildProviderCompensationInput,
  facilityResponseCountdownTone,
  filterAssignableProviders,
  formatFacilityResponseCountdown,
  priceToCents
} from "../FacilityWorkspacePage";
import type { Booking } from "../../../../../shared/schemas/booking";
import type { Provider } from "../../../../../shared/schemas/provider";

describe("FacilityWorkspacePage helpers", () => {
  it("converts facility service pricing into cents", () => {
    expect(priceToCents("1200")).toBe(120000);
    expect(priceToCents("1200.50")).toBe(120050);
  });

  it("builds facility service payloads for backend endpoints", () => {
    expect(
      buildFacilityServiceInput({
        serviceId: "service-1",
        price: "1500",
        estimateDurationMinutes: "45",
        active: true,
        isEmergencyCapable: false
      })
    ).toEqual({
      serviceId: "service-1",
      priceCents: 150000,
      currency: "KES",
      estimateDurationMinutes: 45,
      active: true,
      isEmergencyCapable: false
    });
  });

  it("builds provider compensation payloads by mode", () => {
    expect(
      buildProviderCompensationInput({
        userId: "user-1",
        mode: "employee",
        fixedPayout: "500",
        payoutPercentage: "40"
      })
    ).toEqual({
      mode: "employee",
      fixedPayoutCents: null,
      payoutPercentage: null
    });

    expect(
      buildProviderCompensationInput({
        userId: "user-1",
        mode: "fixed",
        fixedPayout: "500",
        payoutPercentage: ""
      })
    ).toEqual({
      mode: "fixed",
      fixedPayoutCents: 50000,
      payoutPercentage: null
    });

    expect(
      buildProviderCompensationInput({
        userId: "user-1",
        mode: "percentage",
        fixedPayout: "",
        payoutPercentage: "40"
      })
    ).toEqual({
      mode: "percentage",
      fixedPayoutCents: null,
      payoutPercentage: 40
    });
  });

  it("filters assignable providers by verification and service membership", () => {
    const booking = {
      service: {
        id: "service-1"
      }
    } as Booking;
    const providers = [
      {
        userId: "provider-1",
        verified: true,
        services: [{ serviceId: "service-1", active: true }]
      },
      {
        userId: "provider-2",
        verified: false,
        services: [{ serviceId: "service-1", active: true }]
      },
      {
        userId: "provider-3",
        verified: true,
        services: [{ serviceId: "service-2", active: true }]
      },
      {
        userId: "provider-4",
        verified: true,
        services: [{ serviceId: "service-1", active: false }]
      }
    ] as Provider[];

    expect(filterAssignableProviders(booking, providers).map((provider) => provider.userId)).toEqual(["provider-1"]);
  });

  it("formats facility response countdown urgency", () => {
    const now = new Date("2026-07-30T08:00:00Z").getTime();

    expect(formatFacilityResponseCountdown("2026-07-30T08:03:05Z", now)).toBe("3m 05s");
    expect(formatFacilityResponseCountdown("2026-07-30T08:00:30Z", now)).toBe("30s");
    expect(formatFacilityResponseCountdown("2026-07-30T07:59:59Z", now)).toBe("Expired");
    expect(formatFacilityResponseCountdown(null, now)).toBe("-");

    expect(facilityResponseCountdownTone("2026-07-30T08:03:05Z", now)).toBe("text-slate-800");
    expect(facilityResponseCountdownTone("2026-07-30T08:00:30Z", now)).toBe("text-warning-500");
    expect(facilityResponseCountdownTone("2026-07-30T07:59:59Z", now)).toBe("text-danger-600");
  });
});
