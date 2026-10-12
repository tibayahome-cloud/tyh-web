import { describe, expect, it } from "vitest";

import { facilitySetupChecklist, providerTelemedicineReadiness } from "../telemedicineReadiness";

const provider = (over: Record<string, unknown> = {}) =>
  ({
    verified: true,
    telemedicineEnabled: true,
    user: { status: "active" },
    telemedicineSubcategoryAssignments: [{ subcategoryId: "s1", status: "active" }],
    availability: [{ deliveryMode: "both" }],
    ...over
  }) as never;

const selectable = new Set(["s1", "s2"]);
const codes = (p: unknown, sel: ReadonlySet<string> | null = selectable) =>
  providerTelemedicineReadiness(p as never, sel).blockers.map((b) => b.code);

describe("providerTelemedicineReadiness", () => {
  it("is ready when every step is done", () => {
    expect(providerTelemedicineReadiness(provider(), selectable)).toEqual({ ready: true, blockers: [] });
  });

  it.each([
    ["pending account", { user: { status: "pending" } }, "account_inactive"],
    ["suspended account", { user: { status: "suspended" } }, "account_inactive"],
    ["not verified", { verified: false }, "not_verified"],
    ["telemedicine off", { telemedicineEnabled: false }, "telemedicine_off"],
    ["no specialties", { telemedicineSubcategoryAssignments: [] }, "no_specialties"],
    ["only removed specialties", { telemedicineSubcategoryAssignments: [{ subcategoryId: "s1", status: "removed" }] }, "no_specialties"],
    ["no availability", { availability: [] }, "no_availability"],
    ["in-person-only availability", { availability: [{ deliveryMode: "in_person" }] }, "no_availability"]
  ])("flags %s", (_name, over, code) => {
    expect(codes(provider(over))).toEqual([code]);
  });

  it("does not count a specialty that has since been archived", () => {
    const p = provider({ telemedicineSubcategoryAssignments: [{ subcategoryId: "gone", status: "active" }] });
    expect(codes(p)).toEqual(["no_specialties"]);
    // While the selectable list is still loading, nothing is judged against it.
    expect(codes(p, null)).toEqual([]);
  });

  it("does not call an unknown account status pending", () => {
    expect(codes(provider({ user: {} }))).toEqual([]);
  });

  it("reports every blocker, with what to do about each", () => {
    const result = providerTelemedicineReadiness(provider({ verified: false, telemedicineEnabled: false, availability: [] }), selectable);
    expect(result.blockers.map((b) => b.code)).toEqual(["not_verified", "telemedicine_off", "no_availability"]);
    expect(result.blockers.every((b) => b.fix.length > 0)).toBe(true);
  });

  it("explains that services alone is not enough for specialties", () => {
    expect(providerTelemedicineReadiness(provider({ telemedicineSubcategoryAssignments: [] }), selectable).blockers[0].fix).toMatch(/services alone is not enough/i);
  });
});

describe("facilitySetupChecklist", () => {
  const base = () => ({
    facility: { status: "active", countryCode: "KE" } as never,
    facilityServices: [{ active: true, deliveryMode: "remote", serviceId: "svc1" }] as never,
    catalogServices: [{ id: "svc1", subcategoryId: "s1" }],
    providers: [provider()],
    selectableSubcategoryIds: selectable
  });
  const keys = (r: ReturnType<typeof facilitySetupChecklist>) => r.steps.filter((s) => !s.done).map((s) => s.key);

  it("is complete when everything is in place", () => {
    const result = facilitySetupChecklist(base());
    expect(result.complete).toBe(true);
    expect(result.firstMissing).toBeNull();
    expect(result.steps).toHaveLength(6);
  });

  it("finds a facility with providers but no telemedicine services (CARE POINT case)", () => {
    const result = facilitySetupChecklist({ ...base(), facilityServices: [{ active: true, deliveryMode: "in_person", serviceId: "x" }] as never });
    expect(keys(result)).toEqual(["services", "coverage"]);
    expect(result.firstMissing?.blocker?.fix).toMatch(/add telemedicine services/i);
  });

  it("finds a facility with telemedicine services but no providers (second CAREPOINT case)", () => {
    const result = facilitySetupChecklist({ ...base(), providers: [] });
    expect(keys(result)).toEqual(["providers", "ready", "coverage"]);
    expect(result.firstMissing?.key).toBe("providers");
  });

  it("finds providers whose specialties do not match the services", () => {
    const result = facilitySetupChecklist({ ...base(), catalogServices: [{ id: "svc1", subcategoryId: "s2" }] });
    expect(keys(result)).toEqual(["coverage"]);
  });

  it("finds a ready-looking team whose providers are all blocked", () => {
    const result = facilitySetupChecklist({ ...base(), providers: [provider({ verified: false })] });
    expect(keys(result)).toEqual(["ready", "coverage"]);
  });

  it("flags a suspended facility and a missing country", () => {
    const result = facilitySetupChecklist({ ...base(), facility: { status: "suspended", countryCode: null } as never });
    expect(keys(result)).toEqual(["status", "country"]);
    expect(result.firstMissing?.key).toBe("status");
  });

  it("ignores inactive services", () => {
    const result = facilitySetupChecklist({ ...base(), facilityServices: [{ active: false, deliveryMode: "remote", serviceId: "svc1" }] as never });
    expect(keys(result)).toContain("services");
  });
});
