/**
 * ["admin", "facility-scope"] was independently defined with two different pageSize values
 * across four files (paymentAccess.tsx, FacilityWorkspacePage.tsx, FacilityOverviewPage.tsx,
 * FacilityProvidersPage.tsx). Because React Query dedups purely by key, whichever call site
 * populated the cache first "won" for all the others -- a page expecting 5 results could
 * silently receive a 2-result cache entry (or vice versa), a real data-integrity bug disguised
 * as working cache reuse. This locks the key to its one canonical definition.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { useAdminFacilityScope } from "../paymentAccess";

const repoRoot = resolve(__dirname, "../../../../../..");

const CONSUMER_FILES = [
  "src/domains/admin/pages/facilities/FacilityWorkspacePage.tsx",
  "src/domains/admin/pages/facilities/FacilityOverviewPage.tsx",
  "src/domains/admin/pages/facilities/FacilityProvidersPage.tsx"
];

describe("facility-scope query-key consolidation", () => {
  it("defines the ['admin', 'facility-scope'] key in exactly one place", () => {
    const definitionSite = readFileSync(resolve(repoRoot, "src/domains/admin/pages/finance/paymentAccess.tsx"), "utf-8");
    expect(definitionSite).toContain('["admin", "facility-scope"]');

    for (const file of CONSUMER_FILES) {
      const source = readFileSync(resolve(repoRoot, file), "utf-8");
      expect(source).not.toContain('"admin", "facility-scope"');
      expect(source).not.toContain("'admin', 'facility-scope'");
    }
  });

  it("routes every former inline consumer through the shared useAdminFacilityScope hook", () => {
    for (const file of CONSUMER_FILES) {
      const source = readFileSync(resolve(repoRoot, file), "utf-8");
      expect(source).toContain("useAdminFacilityScope");
    }
  });

  it("the shared hook is a real function that can be imported by every consumer", () => {
    expect(typeof useAdminFacilityScope).toBe("function");
  });
});
