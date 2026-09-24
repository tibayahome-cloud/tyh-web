import { describe, expect, it } from "vitest";

import {
  getTelemedicineCategoryAsset,
  getTelemedicineSpecialtyAsset,
  TELEMEDICINE_ALL_SERVICES_ASSET
} from "../telemedicineCategoryAssets";

const KNOWN_CATEGORY_KEYS = ["firstcare", "specialistcare", "wellnesscare", "careconnect", "continucare"];

describe("getTelemedicineCategoryAsset", () => {
  it.each(KNOWN_CATEGORY_KEYS)("resolves a distinct asset for the known category key %s", (key) => {
    const asset = getTelemedicineCategoryAsset(key);
    expect(asset.key).toBe(key);
    expect(asset.Icon).toBeDefined();
    expect(asset.bgClass).toMatch(/^bg-/);
    expect(asset.iconClass).toMatch(/^text-/);
  });

  it("gives every known category a visually distinct icon", () => {
    const icons = KNOWN_CATEGORY_KEYS.map((key) => getTelemedicineCategoryAsset(key).Icon);
    expect(new Set(icons).size).toBe(KNOWN_CATEGORY_KEYS.length);
  });

  it("falls back to a neutral (not brand-colored) asset for an unknown category key", () => {
    const asset = getTelemedicineCategoryAsset("some-brand-new-category-2027");
    expect(asset.key).toMatch(/^fallback-/);
    expect(asset.bgClass).toMatch(/-100$/);
  });

  it("falls back to the same neutral asset for a null or undefined key", () => {
    expect(getTelemedicineCategoryAsset(null).key).toMatch(/^fallback-/);
    expect(getTelemedicineCategoryAsset(undefined).key).toMatch(/^fallback-/);
  });

  it("does not reuse a fallback icon for any real category", () => {
    const fallbackIcon = getTelemedicineCategoryAsset("some-unknown-key").Icon;
    KNOWN_CATEGORY_KEYS.forEach((key) => {
      expect(getTelemedicineCategoryAsset(key).Icon).not.toBe(fallbackIcon);
    });
  });

  it("is deterministic: the same unknown key always resolves the same fallback", () => {
    const first = getTelemedicineCategoryAsset("General Medicine");
    const second = getTelemedicineCategoryAsset("General Medicine");
    expect(second.key).toBe(first.key);
  });

  it("gives visually distinct fallbacks to different unrecognized categories -- the actual production gap", () => {
    // Regression for real prod data: "General Medicine" and "Mental Health" are both admin-created
    // categories with no entry in CATEGORY_ASSETS. A single fixed fallback made them render as the
    // same icon and tint, indistinguishable from each other in the tile row.
    const generalMedicine = getTelemedicineCategoryAsset("General Medicine");
    const mentalHealth = getTelemedicineCategoryAsset("Mental Health");
    expect(generalMedicine.key).not.toBe(mentalHealth.key);
  });
});

describe("getTelemedicineSpecialtyAsset", () => {
  it("resolves a specific icon for a well-known specialty", () => {
    const asset = getTelemedicineSpecialtyAsset("cardiology", "specialistcare");
    expect(asset.key).toBe("cardiology");
  });

  it("falls back to the parent category asset for a specialty with no specific icon", () => {
    const asset = getTelemedicineSpecialtyAsset("some-new-specialty", "wellnesscare");
    expect(asset.key).toBe("wellnesscare");
  });

  it("falls back to a neutral asset when neither the specialty nor the category is known", () => {
    const asset = getTelemedicineSpecialtyAsset("some-new-specialty", "some-brand-new-category");
    expect(asset.key).toMatch(/^fallback-/);
  });

  it("falls back to the parent category when the subcategory key is missing", () => {
    const asset = getTelemedicineSpecialtyAsset(null, "careconnect");
    expect(asset.key).toBe("careconnect");
  });
});

describe("TELEMEDICINE_ALL_SERVICES_ASSET", () => {
  it("is a distinct asset, not aliased to any single category", () => {
    KNOWN_CATEGORY_KEYS.forEach((key) => {
      expect(TELEMEDICINE_ALL_SERVICES_ASSET.Icon).not.toBe(getTelemedicineCategoryAsset(key).Icon);
    });
  });
});
