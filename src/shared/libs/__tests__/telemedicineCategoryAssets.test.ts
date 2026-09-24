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

  it("falls back to the neutral asset for an unknown category key", () => {
    const asset = getTelemedicineCategoryAsset("some-brand-new-category-2027");
    expect(asset.key).toBe("fallback");
    expect(asset.bgClass).toBe("bg-slate-100");
    expect(asset.iconClass).toBe("text-slate-500");
  });

  it("falls back to the neutral asset for a null or undefined key", () => {
    expect(getTelemedicineCategoryAsset(null).key).toBe("fallback");
    expect(getTelemedicineCategoryAsset(undefined).key).toBe("fallback");
  });

  it("does not reuse the fallback asset's icon for any real category", () => {
    const fallbackIcon = getTelemedicineCategoryAsset("unknown").Icon;
    KNOWN_CATEGORY_KEYS.forEach((key) => {
      expect(getTelemedicineCategoryAsset(key).Icon).not.toBe(fallbackIcon);
    });
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

  it("falls back to the neutral asset when neither the specialty nor the category is known", () => {
    const asset = getTelemedicineSpecialtyAsset("some-new-specialty", "some-brand-new-category");
    expect(asset.key).toBe("fallback");
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
