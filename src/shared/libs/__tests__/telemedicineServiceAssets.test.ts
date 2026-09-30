import { Ambulance } from "lucide-react";
import { describe, expect, it } from "vitest";

import { getTelemedicineCategoryAsset, getTelemedicineServiceAsset } from "../telemedicineCategoryAssets";
import { APPROVED_CATALOG_KEYS } from "./telemedicineCatalogKeys";

const basename = (src: string | undefined) => (src ?? "").split("/").pop()?.replace(/\.[a-z0-9]+$/i, "") ?? "";

const ALL_SERVICES = Object.entries(APPROVED_CATALOG_KEYS).flatMap(([categoryKey, subcategories]) =>
  Object.entries(subcategories).flatMap(([subcategoryKey, serviceKeys]) =>
    serviceKeys.map((serviceKey) => ({ categoryKey, subcategoryKey, serviceKey }))
  )
);

// Expected subcategory-level picture for every one of the 37 approved subcategories; null means
// the subcategory keeps its icon (no supplied artwork is a semantic fit).
const EXPECTED_SUBCATEGORY_IMAGE: Record<string, string | null> = {
  "home-based-care": null,
  "hospital-referrals": null,
  "imaging-diagnostics": "imaging-review",
  "laboratory-services": "lab-results-review",
  pharmacy: "medication-review",
  "surgery-coordination": null,
  "chronic-disease-follow-up": "chronic-disease-care",
  "long-term-care-coordination": null,
  "medication-follow-up": "medication-review",
  "post-hospitalisation-follow-up": null,
  "post-operative-follow-up": null,
  "second-medical-opinions": null,
  "specialist-follow-up": null,
  "treatment-monitoring": null,
  "clinical-officers": "general-consultation",
  "general-practitioners": "general-consultation",
  cardiology: null,
  dermatology: "dermatology",
  ent: "ent-consultation",
  endocrinology: null,
  gastroenterology: null,
  "internal-medicine": null,
  nephrology: null,
  neurology: null,
  "obstetrics-gynaecology": "womens-health",
  oncology: "cancer-care",
  orthopaedics: null,
  paediatrics: "paediatric-consultation",
  psychiatry: "mental-health-support",
  urology: null,
  "chronic-disease-education": "chronic-disease-care",
  "lifestyle-wellness": null,
  "nutrition-dietetics": "nutrition-advice",
  "occupational-therapy": null,
  physiotherapy: "physiotherapy",
  "psychology-counselling": "mental-health-support",
  "speech-language-therapy": null
};

// Services whose picture differs from their subcategory's (service key -> expected image).
const EXPECTED_SERVICE_OVERRIDES: Record<string, string> = {
  "child-growth-development-review": "child-growth-review",
  "childrens-health-consultation": "paediatric-consultation",
  "antenatal-consultation": "maternity-care",
  "post-delivery-follow-up": "maternity-care",
  "womens-health-consultation": "womens-health",
  "laboratory-test-guidance": "lab-test-guidance",
  "multi-condition-care-review": "chronic-disease-care",
  "diabetes-hypertension-review": "chronic-disease-care",
  "complex-diabetes-review": "chronic-disease-care",
  "chronic-kidney-disease-follow-up": "chronic-disease-care",
  "injury-imaging-review": "imaging-review",
  "specialist-follow-up-consultation": "specialist-follow-up",
  "post-hospitalisation-review": "post-hospitalisation-review",
  "post-operative-wound-guidance": "post-operative-wound-guidance",
  "second-medical-opinion": "second-medical-opinion",
  "cardiology-consultation": "cardiology-consultation",
  "neurology-consultation": "neurology-consultation",
  "endocrinology-consultation": "endocrinology-consultation",
  "urology-consultation": "urology-consultation",
  "digestive-health-consultation": "gastroenterology-consultation",
  "kidney-health-consultation": "nephrology-consultation",
  "internal-medicine-consultation": "internal-medicine-consultation",
  "occupational-therapy-assessment": "occupational-therapy-consultation",
  "occupational-therapy-follow-up": "occupational-therapy-consultation",
  "speech-language-assessment": "speech-therapy-consultation",
  "speech-therapy-follow-up": "speech-therapy-consultation",
  "home-care-assessment": "home-care-assessment",
  "home-care-coordination": "home-care-assessment",
  "hospital-referral-coordination": "care-navigation",
  "facility-care-navigation": "care-navigation",
  "surgery-referral-consultation": "surgery-coordination",
  "surgical-care-coordination": "surgery-coordination",
  "endoscopy-report-review": "endoscopy-review",
  "clinical-officer-consultation": "clinical-officer-consultation",
  "recovery-monitoring-consultation": "treatment-monitoring",
  "treatment-progress-review": "treatment-monitoring",
  "lifestyle-wellness-consultation": "lifestyle-wellness",
  "wellness-follow-up": "lifestyle-wellness",
  "specialist-treatment-review": "specialist-treatment-review",
  "care-coordination-follow-up": "care-coordination",
  "long-term-care-planning": "care-coordination",
  "discharge-plan-review": "discharge-plan-review",
  "post-operative-review": "post-operative-review",
  "cardiac-report-review": "cardiac-report-review",
  "neurological-report-review": "neurological-report-review",
  "orthopaedic-consultation": "orthopaedic-consultation",
  "urology-follow-up": "urology-follow-up",
  "specialist-second-opinion": "specialist-second-opinion"
};

const resolve = (entry: { categoryKey: string; subcategoryKey: string; serviceKey: string }) =>
  getTelemedicineServiceAsset(entry);

describe("getTelemedicineServiceAsset lookup order", () => {
  it("prefers a service-level image over the subcategory's", () => {
    const asset = getTelemedicineServiceAsset({
      serviceKey: "child-growth-development-review",
      subcategoryKey: "paediatrics",
      categoryKey: "specialistcare"
    });
    expect(asset.imageSource).toBe("service");
    expect(basename(asset.image)).toBe("child-growth-review");
  });

  it("uses the subcategory image when the service has no override", () => {
    const asset = getTelemedicineServiceAsset({
      serviceKey: "a-service-added-later",
      subcategoryKey: "paediatrics",
      categoryKey: "specialistcare"
    });
    expect(asset.imageSource).toBe("subcategory");
    expect(basename(asset.image)).toBe("paediatric-consultation");
  });

  it("uses the category image only where the whole category is one family", () => {
    const first = getTelemedicineServiceAsset({
      serviceKey: "future-first-care-service",
      subcategoryKey: "future-first-care-group",
      categoryKey: "firstcare"
    });
    expect(first.imageSource).toBe("category");
    expect(basename(first.image)).toBe("general-consultation");

    for (const categoryKey of ["careconnect", "continucare", "specialistcare", "wellnesscare"]) {
      const asset = getTelemedicineServiceAsset({ serviceKey: "x", subcategoryKey: "y", categoryKey });
      expect(asset.imageSource).toBe("none");
      expect(asset.image).toBeUndefined();
    }
  });

  it("falls back to a neutral icon (no image) for unknown or missing keys", () => {
    for (const keys of [
      { serviceKey: "brand-new", subcategoryKey: "brand-new-group", categoryKey: "brand-new-category" },
      { serviceKey: null, subcategoryKey: null, categoryKey: null },
      {}
    ]) {
      const asset = getTelemedicineServiceAsset(keys);
      expect(asset.imageSource).toBe("none");
      expect(asset.image).toBeUndefined();
      expect(asset.imageAlt).toBeUndefined();
      expect(asset.key).toMatch(/^fallback-/);
      expect(asset.Icon).toBeDefined();
    }
  });

  it("is deterministic for the same keys", () => {
    const keys = { serviceKey: "cancer-consultation", subcategoryKey: "oncology", categoryKey: "specialistcare" };
    expect(getTelemedicineServiceAsset(keys)).toEqual(getTelemedicineServiceAsset(keys));
  });
});

describe("approved catalog coverage", () => {
  it("covers the 6 categories, 37 subcategories and 77 services", () => {
    expect(Object.keys(APPROVED_CATALOG_KEYS)).toHaveLength(6);
    expect(Object.values(APPROVED_CATALOG_KEYS).reduce((n, subs) => n + Object.keys(subs).length, 0)).toBe(37);
    expect(ALL_SERVICES).toHaveLength(77);
  });

  it("gives every service a visual treatment: an image, or an icon with a tint", () => {
    for (const entry of ALL_SERVICES) {
      const asset = resolve(entry);
      expect(asset.Icon, entry.serviceKey).toBeDefined();
      expect(asset.bgClass, entry.serviceKey).toMatch(/^bg-/);
      expect(asset.iconClass, entry.serviceKey).toMatch(/^text-/);
      if (asset.image) {
        expect(asset.imageAlt, entry.serviceKey).toBeTruthy();
      }
    }
  });

  it("resolves dedicated artwork for every approved service", () => {
    for (const entry of ALL_SERVICES) {
      const asset = resolve(entry);
      expect(asset.image, entry.serviceKey).toBeDefined();
      expect(asset.imageAlt, entry.serviceKey).toBeTruthy();
    }
  });

  it("maps every approved subcategory to its expected picture (or to the icon)", () => {
    const subcategoryKeys = Object.values(APPROVED_CATALOG_KEYS).flatMap((subs) => Object.keys(subs));
    expect(Object.keys(EXPECTED_SUBCATEGORY_IMAGE).sort()).toEqual([...subcategoryKeys].sort());

    for (const entry of ALL_SERVICES) {
      const expected = EXPECTED_SERVICE_OVERRIDES[entry.serviceKey] ?? EXPECTED_SUBCATEGORY_IMAGE[entry.subcategoryKey];
      const asset = resolve(entry);
      if (expected) {
        expect(basename(asset.image), entry.serviceKey).toBe(expected);
      } else if (entry.categoryKey === "firstcare") {
        expect(basename(asset.image), entry.serviceKey).toBe("general-consultation");
      } else {
        expect(asset.image, entry.serviceKey).toBeUndefined();
      }
    }
  });

  it("gives both mental-health services the same picture as every other psychology/counselling service", () => {
    const mental = ["mental-health-assessment", "counselling-session"].map((serviceKey) =>
      getTelemedicineServiceAsset({ serviceKey, subcategoryKey: "psychology-counselling", categoryKey: "mental-health" })
    );
    for (const asset of mental) {
      expect(basename(asset.image)).toBe("mental-health-support");
    }
  });

  it("never shows a service under an image from an unrelated family", () => {
    const paediatric = ALL_SERVICES.filter((e) => basename(resolve(e).image).match(/paediatric|child-growth/));
    expect(new Set(paediatric.map((e) => e.subcategoryKey))).toEqual(new Set(["paediatrics"]));

    const maternity = ALL_SERVICES.filter((e) => basename(resolve(e).image).match(/maternity|womens-health/));
    expect(new Set(maternity.map((e) => e.subcategoryKey))).toEqual(new Set(["obstetrics-gynaecology"]));

    const lab = ALL_SERVICES.filter((e) => basename(resolve(e).image).match(/^lab-/));
    expect(new Set(lab.map((e) => e.subcategoryKey))).toEqual(new Set(["laboratory-services"]));
  });
});

describe("ambulance / emergency imagery is excluded from telemedicine", () => {
  const EXCLUDED = /ambulance|emergency/i;

  it("ships no ambulance or emergency artwork in the telemedicine asset folder", () => {
    const files = Object.keys(import.meta.glob("../../../assets/images/telemedicine/**/*.webp"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(basename(file)).not.toMatch(EXCLUDED);
    }
  });

  it("never resolves an excluded picture for any approved service or category", () => {
    for (const entry of ALL_SERVICES) {
      expect(basename(resolve(entry).image), entry.serviceKey).not.toMatch(EXCLUDED);
    }
  });

  it("uses safe non-emergency artwork for care navigation, home-care and surgery", () => {
    for (const subcategoryKey of ["hospital-referrals", "home-based-care", "surgery-coordination"]) {
      for (const serviceKey of APPROVED_CATALOG_KEYS.careconnect[subcategoryKey]) {
        const asset = getTelemedicineServiceAsset({ serviceKey, subcategoryKey, categoryKey: "careconnect" });
        expect(asset.image, serviceKey).toBeDefined();
        expect(asset.imageSource, serviceKey).toBe("service");
      }
    }
  });

  it("does not use an ambulance glyph for the CareConnect category or its fallbacks", () => {
    expect(getTelemedicineCategoryAsset("careconnect").Icon).not.toBe(Ambulance);
    for (const entry of ALL_SERVICES.filter((e) => e.categoryKey === "careconnect")) {
      expect(resolve(entry).Icon, entry.serviceKey).not.toBe(Ambulance);
    }
  });

  it("does not surface the source-file wording 'clinical physiologist' anywhere in the alt text", () => {
    for (const entry of ALL_SERVICES) {
      expect(resolve(entry).imageAlt ?? "").not.toMatch(/physiologist/i);
    }
  });

  it("uses every shipped picture at least once (no orphaned assets)", () => {
    const shipped = Object.keys(import.meta.glob("../../../assets/images/telemedicine/*.webp")).map(basename);
    const used = new Set(ALL_SERVICES.map((entry) => basename(resolve(entry).image)).filter(Boolean));
    for (const name of shipped) {
      expect(used.has(name), name).toBe(true);
    }
  });
});
