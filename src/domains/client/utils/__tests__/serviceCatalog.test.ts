import { describe, expect, it } from "vitest";

import { serviceImageKey, careImageKey, categoryTiles, filterServices, formatPrice, isHomeService, type CatalogService } from "../serviceCatalog";

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

describe("careImageKey and free services", () => {
  it("picks a photo for each kind of care, and a safe default for a new one", () => {
    expect(careImageKey("Nursing & Caregiver Services")).toBe("nurse");
    expect(careImageKey("Elderly & Assisted Living")).toBe("elderly");
    expect(careImageKey("Therapy & Rehabilitation")).toBe("therapy");
    expect(careImageKey("Diagnostics & Monitoring")).toBe("lab");
    expect(careImageKey("Ambulance")).toBe("ambulance");
    expect(careImageKey("Doctor & Nurse Home Visits")).toBe("doctor");
    expect(careImageKey("Something new")).toBe("home");
    expect(careImageKey(null)).toBe("home");
  });

  it("does not print KES 0 for a service priced on request", () => {
    expect(formatPrice(0)).toBe("Quote on request");
  });
});

describe("serviceImageKey: the photo follows the service, not just its category", () => {
  const cat = "Nursing & Caregiver Services";

  it("matches what the service is", () => {
    expect(serviceImageKey("Wound Care at Home", cat)).toMatch(/^nurse/);
    expect(serviceImageKey("Antenatal Ultrasound Scan", "Diagnostics")).toBe("scan");
    expect(serviceImageKey("ECG at Home", "Diagnostics")).toBe("ecg");
    expect(serviceImageKey("Occupational Therapy", "Therapy")).toBe("occupational");
    expect(serviceImageKey("Speech Therapy", "Therapy")).toBe("speech");
    expect(serviceImageKey("Cancer Home Care Plan", "Plans")).toBe("cancer");
    expect(serviceImageKey("Companion Care Visit", "Elderly")).toBe("elderly");
    expect(serviceImageKey("Laboratory sample collection at home", "Diagnostics")).toBe("lab");
    expect(serviceImageKey("Equipment Rental/Purchase Inquiry", "Consultations")).toBe("equipment");
  });

  it("falls back to the kind of care when nothing in the name says more", () => {
    expect(serviceImageKey("Something unusual", "Therapy & Rehabilitation")).toBe("therapy");
  });

  it("gives different services different photos where several fit, the same one each time", () => {
    const keys = ["24-Hour Nursing Care", "Day Nurse Care (8 Hours)", "Night Nurse Care (12 Hours)", "Weekly Nursing Care", "Monthly Nursing Care", "Nurse Visit at Home"].map((n) => serviceImageKey(n, cat));
    expect(new Set(keys).size).toBeGreaterThan(1);
    expect(serviceImageKey("Weekly Nursing Care", cat)).toBe(serviceImageKey("Weekly Nursing Care", cat));
  });
});
