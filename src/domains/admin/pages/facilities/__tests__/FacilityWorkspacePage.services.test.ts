/**
 * A facility can carry dozens of services (80+ in practice), previously all rendered in one
 * unbroken scroll with no way to jump to a specific one. These two pure functions back the
 * search box and pager that replace that -- kept as plain functions so the paging logic is
 * verifiable without mounting the whole facility workspace page.
 */

import { describe, expect, it } from "vitest";

import {
  SERVICES_PAGE_SIZE,
  filterFacilityServicesBySearch,
  paginateFacilityServices
} from "../FacilityWorkspacePage";
import type { FacilityService } from "../../../../../shared/schemas/facility";

const serviceFactory = (overrides: Partial<FacilityService> = {}): FacilityService => ({
  id: overrides.id ?? "fs-1",
  facilityId: "facility-1",
  serviceId: overrides.serviceId ?? "svc-1",
  priceCents: 100000,
  currency: "KES",
  estimateDurationMinutes: 30,
  active: true,
  isEmergencyCapable: false,
  deliveryMode: "in_person",
  service: { id: "svc-1", name: "IV Therapy", key: "iv_therapy", basePriceCents: 100000, defaultEstimateMinutes: 30 },
  ...overrides
});

describe("filterFacilityServicesBySearch", () => {
  it("returns every service when the search is empty", () => {
    const services = [serviceFactory(), serviceFactory({ id: "fs-2" })];
    expect(filterFacilityServicesBySearch(services, "")).toBe(services);
    expect(filterFacilityServicesBySearch(services, "   ")).toBe(services);
  });

  it("matches on the underlying service name, case-insensitively", () => {
    const services = [
      serviceFactory({ id: "fs-1", service: { id: "svc-1", name: "IV Therapy", key: null, basePriceCents: null, defaultEstimateMinutes: null } }),
      serviceFactory({ id: "fs-2", service: { id: "svc-2", name: "Wound Dressing", key: null, basePriceCents: null, defaultEstimateMinutes: null } })
    ];

    expect(filterFacilityServicesBySearch(services, "therapy").map((s) => s.id)).toEqual(["fs-1"]);
    expect(filterFacilityServicesBySearch(services, "DRESSING").map((s) => s.id)).toEqual(["fs-2"]);
  });

  it("doesn't throw on a service with no catalog name attached", () => {
    const services = [serviceFactory({ service: null })];
    expect(filterFacilityServicesBySearch(services, "anything")).toEqual([]);
  });
});

describe("paginateFacilityServices", () => {
  const services = Array.from({ length: 23 }, (_, i) => serviceFactory({ id: `fs-${i}` }));

  it("slices the first page at the default page size", () => {
    const result = paginateFacilityServices(services, 1);
    expect(result.items).toHaveLength(SERVICES_PAGE_SIZE);
    expect(result.items[0].id).toBe("fs-0");
    expect(result.totalPages).toBe(3);
    expect(result.page).toBe(1);
  });

  it("returns the remainder on the last page", () => {
    const result = paginateFacilityServices(services, 3);
    expect(result.items).toHaveLength(3);
    expect(result.page).toBe(3);
  });

  it("clamps a page number past the end instead of returning nothing", () => {
    // A search that shrinks the result set (or a service getting disabled) must not strand
    // the view on a now-empty trailing page.
    const result = paginateFacilityServices(services, 99);
    expect(result.page).toBe(3);
    expect(result.items).toHaveLength(3);
  });

  it("always reports at least one page, even for an empty list", () => {
    const result = paginateFacilityServices([], 1);
    expect(result.totalPages).toBe(1);
    expect(result.items).toEqual([]);
  });
});
