/**
 * useAdminFacilityScope fetches with a deliberate pageSize:2 -- just enough to tell "exactly
 * one facility" apart from "zero or more than one," never enough to enumerate every facility a
 * multi-facility admin might have. That's only safe because every consumer's access model
 * (canAdminOpsAccessFacility here; hasInvalidScope in paymentAccess.tsx) already requires
 * facilities.length === 1 for a facility-admin -- it was never meant to look someone up by ID
 * inside a longer list. This locks that contract down directly: a facility-admin scoped to more
 * than one facility must be denied even when the requested facility is among the ones returned,
 * and super-admin/admin roles must bypass the facilities list entirely (they use the global
 * ledger / arbitrary facility browsing instead of this single-facility model).
 */

import { describe, expect, it } from "vitest";

import { canAdminOpsAccessFacility } from "../FacilityWorkspacePage";

describe("canAdminOpsAccessFacility", () => {
  it("grants a facility-admin access to the one facility they are scoped to", () => {
    expect(canAdminOpsAccessFacility("facility-1", ["admin.ops"], [{ id: "facility-1" }])).toBe(true);
  });

  it("denies a facility-admin access to a facility that isn't the one they're scoped to", () => {
    expect(canAdminOpsAccessFacility("facility-2", ["admin.ops"], [{ id: "facility-1" }])).toBe(false);
  });

  it("denies a facility-admin with zero linked facilities", () => {
    expect(canAdminOpsAccessFacility("facility-1", ["admin.ops"], [])).toBe(false);
  });

  it("denies a facility-admin scoped to more than one facility, even if the requested one is among them", () => {
    // This is the case pageSize:2 exists to detect cheaply: the backend scope query should
    // never return more than one facility for a real admin.ops account, so seeing two here
    // means the scope itself is invalid/ambiguous -- it must not fall back to "well, one of
    // them matches, so allow it," which would silently paper over a bad scope assignment.
    expect(
      canAdminOpsAccessFacility("facility-1", ["admin.ops"], [{ id: "facility-1" }, { id: "facility-2" }])
    ).toBe(false);
  });

  it("bypasses the facility list entirely for a super-admin, regardless of what it contains", () => {
    expect(canAdminOpsAccessFacility("facility-99", ["admin.super"], [])).toBe(true);
    expect(canAdminOpsAccessFacility("facility-99", ["admin.super"], [{ id: "facility-1" }, { id: "facility-2" }])).toBe(
      true
    );
  });

  it("bypasses the facility list entirely for a platform admin, regardless of what it contains", () => {
    expect(canAdminOpsAccessFacility("facility-99", ["admin"], [])).toBe(true);
  });

  it("treats admin.ops combined with admin.super as not facility-scoped", () => {
    expect(canAdminOpsAccessFacility("facility-99", ["admin.ops", "admin.super"], [])).toBe(true);
  });
});
