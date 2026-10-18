import { describe, expect, it } from "vitest";

import {
  buildFacilityServiceInput,
  buildBulkFacilityServiceInputs,
  buildProviderCompensationInput,
  canAdminOpsAccessFacility,
  facilityResponseCountdownTone,
  filterAssignableProviders,
  formatFacilityResponseCountdown,
  priceToCents,
  validateProviderForm,
  validateBulkServiceRows,
  validateServiceForm
} from "../FacilityWorkspacePage";
import type { Booking } from "../../../../../shared/schemas/booking";
import type { Facility } from "../../../../../shared/schemas/facility";
import type { Provider } from "../../../../../shared/schemas/provider";

describe("FacilityWorkspacePage helpers", () => {
  it("limits admin ops to its single backend-scoped facility", () => {
    const facilities = [{ id: "facility-1" }] as Facility[];

    expect(canAdminOpsAccessFacility("facility-1", ["admin.ops"], facilities)).toBe(true);
    expect(canAdminOpsAccessFacility("facility-2", ["admin.ops"], facilities)).toBe(false);
    expect(canAdminOpsAccessFacility("facility-1", ["admin.ops"], [...facilities, { id: "facility-2" }])).toBe(false);
    expect(canAdminOpsAccessFacility("facility-2", ["admin.super"], facilities)).toBe(true);
  });

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
        isEmergencyCapable: false,
        deliveryMode: "in_person"
      })
    ).toEqual({
      serviceId: "service-1",
      priceCents: 150000,
      currency: "KES",
      estimateDurationMinutes: 45,
      active: true,
      isEmergencyCapable: false,
      deliveryMode: "in_person"
    });

    expect(
      buildFacilityServiceInput({
        serviceId: "service-1",
        price: "1500",
        estimateDurationMinutes: "45",
        active: true,
        isEmergencyCapable: false,
        deliveryMode: "both"
      })
    ).toMatchObject({ deliveryMode: "both" });
  });

  it("validates facility service form requirements", () => {
    expect(
      validateServiceForm({
        serviceId: "",
        price: "1500",
        estimateDurationMinutes: "45",
        active: true,
        isEmergencyCapable: false,
        deliveryMode: "in_person"
      })
    ).toBe("Select a service.");

    expect(
      validateServiceForm({
        serviceId: "service-1",
        price: "-1",
        estimateDurationMinutes: "45",
        active: true,
        isEmergencyCapable: false,
        deliveryMode: "in_person"
      })
    ).toBe("Price must be zero or greater.");

    expect(
      validateServiceForm({
        serviceId: "service-1",
        price: "1500",
        estimateDurationMinutes: "0",
        active: true,
        isEmergencyCapable: false,
        deliveryMode: "in_person"
      })
    ).toBe("Duration must be at least 1 minute.");
  });

  it("builds and validates multiple facility service rows", () => {
    const rows = [
      {
        serviceId: "service-1",
        name: "Nurse visit",
        price: "1500",
        estimateDurationMinutes: "45",
        active: true,
        isEmergencyCapable: false,
        deliveryMode: "in_person" as const,
        remoteCapable: false
      },
      {
        serviceId: "service-2",
        name: "Remote consultation",
        price: "2500",
        estimateDurationMinutes: "30",
        active: true,
        isEmergencyCapable: false,
        deliveryMode: "remote" as const,
        remoteCapable: true
      }
    ];

    expect(validateBulkServiceRows(rows)).toBeNull();
    expect(buildBulkFacilityServiceInputs(rows)).toEqual([
      expect.objectContaining({ serviceId: "service-1", priceCents: 150000 }),
      expect.objectContaining({ serviceId: "service-2", priceCents: 250000, deliveryMode: "remote" })
    ]);
    expect(validateBulkServiceRows([])).toBe("Select at least one service.");
    expect(validateBulkServiceRows([{ ...rows[0], deliveryMode: "remote", remoteCapable: false }])).toContain(
      "remote delivery is not available"
    );
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

  it("validates provider compensation form requirements", () => {
    expect(
      validateProviderForm({
        userId: "",
        mode: "employee",
        fixedPayout: "",
        payoutPercentage: ""
      })
    ).toBe("Provider user ID is required.");

    expect(
      validateProviderForm({
        userId: "provider-user-1",
        mode: "fixed",
        fixedPayout: "-1",
        payoutPercentage: ""
      })
    ).toBe("Fixed payout must be zero or greater.");

    expect(
      validateProviderForm({
        userId: "provider-user-1",
        mode: "percentage",
        fixedPayout: "",
        payoutPercentage: "101"
      })
    ).toBe("Payout percentage must be between 0 and 100.");
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

  describe("assignable providers for a telemedicine booking", () => {
    const remote = (subcategoryId: string | null | undefined) =>
      ({ isTelemedicine: true, service: { id: "svc", telemedicineSubcategoryId: subcategoryId } }) as unknown as Booking;
    const specialist = (userId: string, over: Record<string, unknown> = {}) =>
      ({
        userId, verified: true, telemedicineEnabled: true, services: [], user: { status: "active" },
        telemedicineSubcategoryAssignments: [{ subcategoryId: "mental-health", status: "active" }],
        ...over
      }) as unknown as Provider;

    it("offers providers who hold the service's specialty, with no provider-service row needed", () => {
      // The reported case: a facility with a counselling provider was told none was configured.
      expect(filterAssignableProviders(remote("mental-health"), [specialist("p1")]).map((p) => p.userId)).toEqual(["p1"]);
    });

    it("leaves out providers who lack the specialty, have it removed, or are not ready", () => {
      const providers = [
        specialist("other-specialty", { telemedicineSubcategoryAssignments: [{ subcategoryId: "cardiology", status: "active" }] }),
        specialist("removed", { telemedicineSubcategoryAssignments: [{ subcategoryId: "mental-health", status: "removed" }] }),
        specialist("unverified", { verified: false }),
        specialist("telemedicine-off", { telemedicineEnabled: false }),
        specialist("suspended", { user: { status: "suspended" } }),
        specialist("ok")
      ];
      expect(filterAssignableProviders(remote("mental-health"), providers).map((p) => p.userId)).toEqual(["ok"]);
    });

    it("keeps using service membership for a legacy remote service with no specialty", () => {
      const member = specialist("member", { telemedicineSubcategoryAssignments: [], services: [{ serviceId: "svc", active: true }] });
      const stranger = specialist("stranger", { telemedicineSubcategoryAssignments: [] });
      expect(filterAssignableProviders(remote(null), [member, stranger]).map((p) => p.userId)).toEqual(["member"]);
    });

    it("offers anyone qualified either way when the API does not say which specialty applies", () => {
      const member = specialist("member", { telemedicineSubcategoryAssignments: [], services: [{ serviceId: "svc", active: true }] });
      expect(filterAssignableProviders(remote(undefined), [member, specialist("specialist")]).map((p) => p.userId)).toEqual(["member", "specialist"]);
    });

    it("does not let home-based care reuse the specialty rule", () => {
      const home = { isTelemedicine: false, service: { id: "svc" } } as unknown as Booking;
      expect(filterAssignableProviders(home, [specialist("p1")])).toEqual([]);
    });
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
