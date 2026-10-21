import { describe, expect, it } from "vitest";

import { categoryTiles, filterServices, formatPrice, isHomeService, type CatalogService } from "../serviceCatalog";

const svc = (overrides: Partial<CatalogService> = {}): CatalogService => ({
  id: "s",
  name: "Wound dressing",
  description: null,
  base_price_cents: 150000,
  default_estimate_minutes: 30,
  is_emergency_capable: false,
  active: true,
  remote_capable: false,
  category: { id: "c-nurse", name: "Nursing & Caregiver Services" },
  ...overrides
});

const ALL = { search: "", categoryId: "all", emergencyOnly: false, minPrice: "" as const, maxPrice: "" as const };

describe("isHomeService", () => {
  it("keeps care that comes to you and leaves video consultations to the Telemedicine tab", () => {
    expect(isHomeService(svc())).toBe(true);
    expect(isHomeService(svc({ remote_capable: true }))).toBe(false);
    expect(isHomeService(svc({ active: false }))).toBe(false);
  });
});

describe("categoryTiles", () => {
  it("makes one tile per kind of care with its count, biggest first, and never an empty one", () => {
    const tiles = categoryTiles([
      svc({ id: "1" }),
      svc({ id: "2", category: { id: "c-elder", name: "Elderly care" } }),
      svc({ id: "3" })
    ]);

    expect(tiles).toEqual([
      { id: "c-nurse", name: "Nursing & Caregiver Services", count: 2 },
      { id: "c-elder", name: "Elderly care", count: 1 }
    ]);
  });
});

describe("filterServices", () => {
  const list = [
    svc({ id: "1", name: "Wound dressing" }),
    svc({ id: "2", name: "Ambulance transfer", is_emergency_capable: true, base_price_cents: 500000, category: { id: "c-amb", name: "Ambulance" } })
  ];

  it("filters by kind of care, urgency and price", () => {
    expect(filterServices(list, { ...ALL, categoryId: "c-amb" }).map((s) => s.id)).toEqual(["2"]);
    expect(filterServices(list, { ...ALL, emergencyOnly: true }).map((s) => s.id)).toEqual(["2"]);
    expect(filterServices(list, { ...ALL, maxPrice: 2000 }).map((s) => s.id)).toEqual(["1"]);
    expect(filterServices(list, { ...ALL, minPrice: 2000 }).map((s) => s.id)).toEqual(["2"]);
  });

  it("searches the name, description and kind of care", () => {
    expect(filterServices(list, { ...ALL, search: "ambulance" }).map((s) => s.id)).toEqual(["2"]);
    expect(filterServices(list, { ...ALL, search: "nursing" }).map((s) => s.id)).toEqual(["1"]);
  });
});

describe("formatPrice", () => {
  it("spells out the unit with no empty cents", () => {
    expect(formatPrice(150000)).toBe("KES 1,500");
  });
});
