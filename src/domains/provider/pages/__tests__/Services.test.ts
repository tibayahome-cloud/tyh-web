import { describe, expect, it } from "vitest";

import { mapAvailableServices } from "../Services";

const serviceFactory = (overrides: Partial<{ id: string; active: boolean }> = {}) => ({
  id: "service-1",
  key: "iv_therapy",
  name: "IV Therapy",
  base_price_cents: 150000,
  default_estimate_minutes: 60,
  is_emergency_capable: false,
  active: true,
  ...overrides
});

describe("mapAvailableServices", () => {
  it("keeps only active offerings of active services", () => {
    const services = mapAvailableServices([
      { id: "offering-1", active: true, service: serviceFactory({ id: "service-1" }) },
      { id: "offering-2", active: false, service: serviceFactory({ id: "service-2" }) },
      { id: "offering-3", active: true, service: serviceFactory({ id: "service-3", active: false }) },
      { id: "offering-4", active: true, service: null }
    ]);

    expect(services).toHaveLength(1);
    expect(services[0].id).toBe("service-1");
  });

  it("returns an empty list when the facility offers nothing active", () => {
    expect(mapAvailableServices([])).toEqual([]);
  });
});
