import { describe, expect, it } from "vitest";

import {
  NO_FILTERS,
  activeFilterCount,
  careGroupOf,
  careImageKey,
  filterServices,
  formatPrice,
  groupTiles,
  isHomeService,
  photoForService,
  serviceImageKey,
  type CatalogService
} from "../serviceCatalog";

const svc = (overrides: Partial<CatalogService> = {}): CatalogService => ({
  id: "s",
  key: "wound_care_home",
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

describe("careGroupOf: ten catalogue categories become five plain groups", () => {
  it("places every category the catalogue has today", () => {
    const expected: Record<string, string> = {
      "Nursing & Caregiver Services": "nursing",
      "Doctor & Nurse Home Visits": "nursing",
      Consultations: "nursing",
      "Post-Hospitalization & Recovery Care": "nursing",
      "Elderly & Assisted Living": "elderly",
      "Palliative & Oncology Care": "elderly",
      "Therapy & Rehabilitation": "therapy",
      "Diagnostics & Monitoring": "checkups",
      "Corporate & Executive Health": "checkups",
      "TibaCare Monthly Care Plans": "plans",
      "Membership & Subscription Plans": "plans"
    };
    Object.entries(expected).forEach(([name, group]) => expect(careGroupOf(name), name).toBe(group));
  });

  it("puts a category it has never seen under Other care, not nowhere", () => {
    expect(careGroupOf("Something new")).toBe("other");
    expect(careGroupOf(null)).toBe("other");
  });
});

describe("groupTiles", () => {
  it("lists each group that has something to book, with its count, in a fixed order", () => {
    const tiles = groupTiles([
      svc({ id: "1", category: { id: "a", name: "Membership & Subscription Plans" } }),
      svc({ id: "2" }),
      svc({ id: "3", category: { id: "b", name: "Doctor & Nurse Home Visits" } })
    ]);

    expect(tiles.map((t) => [t.id, t.count])).toEqual([["nursing", 2], ["plans", 1]]);
  });
});

describe("filterServices", () => {
  const list = [
    svc({ id: "1", name: "Wound dressing" }),
    svc({ id: "2", name: "Ambulance transfer", is_emergency_capable: true, base_price_cents: 600000, category: { id: "c-amb", name: "Elderly & Assisted Living" } }),
    svc({ id: "3", name: "Quote only", base_price_cents: 0 })
  ];

  it("filters by group, urgency and price band", () => {
    expect(filterServices(list, { ...NO_FILTERS, groupId: "elderly" }).map((s) => s.id)).toEqual(["2"]);
    expect(filterServices(list, { ...NO_FILTERS, urgentOnly: true }).map((s) => s.id)).toEqual(["2"]);
    expect(filterServices(list, { ...NO_FILTERS, priceBand: "low" }).map((s) => s.id)).toEqual(["1", "3"]);
    expect(filterServices(list, { ...NO_FILTERS, priceBand: "high" }).map((s) => s.id)).toEqual(["2", "3"]);
  });

  it("never hides a service priced on request because of a price band", () => {
    expect(filterServices(list, { ...NO_FILTERS, priceBand: "mid" }).map((s) => s.id)).toEqual(["3"]);
  });

  it("searches the name, description and kind of care", () => {
    expect(filterServices(list, { ...NO_FILTERS, search: "ambulance" }).map((s) => s.id)).toEqual(["2"]);
    expect(filterServices(list, { ...NO_FILTERS, search: "nursing" }).map((s) => s.id)).toEqual(["1", "3"]);
  });
});

describe("activeFilterCount", () => {
  it("counts sheet filters that are on, not the search box", () => {
    expect(activeFilterCount(NO_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...NO_FILTERS, search: "x" })).toBe(0);
    expect(activeFilterCount({ search: "", groupId: "nursing", urgentOnly: true, priceBand: "low" })).toBe(3);
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

describe("photoForService", () => {
  it("uses the photo made for the service when there is one, and the stock photo otherwise", () => {
    expect(photoForService("ecg_home", { ecg_home: "/ecg.webp" }, "/stock.png")).toBe("/ecg.webp");
    expect(photoForService("speech_therapy", { ecg_home: "/ecg.webp" }, "/stock.png")).toBe("/stock.png");
  });
});

describe("an ambulance service is its own group", () => {
  it("is grouped as Ambulance whatever its category says, and counted separately", () => {
    const tiles = groupTiles([svc({ id: "1" }), svc({ id: "2", care_type: "ambulance", category: { id: "x", name: "Elderly & Assisted Living" } })]);

    expect(tiles.map((t) => t.id)).toEqual(["ambulance", "nursing"]);
    expect(filterServices([svc({ id: "2", care_type: "ambulance" })], { ...NO_FILTERS, groupId: "ambulance" })).toHaveLength(1);
  });

  it("never lists a telemedicine service on the home care page", () => {
    expect(isHomeService(svc({ care_type: "telemedicine" }))).toBe(false);
    expect(isHomeService(svc({ care_type: "home_based" }))).toBe(true);
  });
});
