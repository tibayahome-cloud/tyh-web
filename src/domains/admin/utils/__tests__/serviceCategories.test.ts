import { describe, expect, it } from "vitest";

import { TELEMEDICINE_CATEGORY_NOTE, categoryDescription, selectableCategories, type AdminServiceCategory } from "../serviceCategories";

const home: AdminServiceCategory = { id: "h", key: "nursing", name: "Nursing", description: "Night nurse" };
const tele: AdminServiceCategory = { id: "t", key: "telemedicine", name: "Telemedicine", description: null, is_system: true };

describe("service categories in the admin catalogue", () => {
  it("never offers the Telemedicine category for a home-care service", () => {
    expect(selectableCategories([home, tele]).map((c) => c.id)).toEqual(["h"]);
  });

  it("still shows it for a service that is already in it, so the form does not lose its value", () => {
    expect(selectableCategories([home, tele], "t").map((c) => c.id)).toEqual(["h", "t"]);
  });

  it("explains the Telemedicine category instead of leaving its description empty", () => {
    expect(categoryDescription(tele)).toBe(TELEMEDICINE_CATEGORY_NOTE);
    expect(categoryDescription(home)).toBe("Night nurse");
    expect(categoryDescription({ ...home, description: null })).toBe("—");
  });

  it("copes with categories not loaded yet", () => {
    expect(selectableCategories(undefined)).toEqual([]);
  });
});

import { AMBULANCE_CATEGORY, KIND_LABEL, categoriesOfKind } from "../serviceCategories";

describe("categoriesOfKind: home-based care, ambulance and telemedicine are kept apart", () => {
  const nursing: AdminServiceCategory = { id: "n", key: "nursing", name: "Nursing", care_type: "home_based" };
  const ambulance: AdminServiceCategory = { id: "a", key: "ambulance", name: "Ambulance", care_type: "ambulance" };
  const untyped: AdminServiceCategory = { id: "u", key: "old", name: "Old" };

  it("lists only the categories of the chosen kind, and never the Telemedicine one", () => {
    const all = [nursing, ambulance, untyped, { ...tele, care_type: "telemedicine" as const }];

    expect(categoriesOfKind(all, "home_based").map((c) => c.id)).toEqual(["n", "u"]);
    expect(categoriesOfKind(all, "ambulance").map((c) => c.id)).toEqual(["a"]);
  });

  it("names the kinds in plain words", () => {
    expect(KIND_LABEL).toEqual({ home_based: "Home-based care", ambulance: "Ambulance", telemedicine: "Telemedicine" });
    expect(AMBULANCE_CATEGORY.key).toBe("ambulance");
  });
});
