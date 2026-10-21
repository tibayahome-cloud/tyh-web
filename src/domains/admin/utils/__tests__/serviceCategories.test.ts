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
