import { describe, expect, it } from "vitest";

import { isAdminPortalRole } from "../roles";
import { isFacilityAdminRole, isSystemAdminRole } from "../portalRoles";

describe("portal roles", () => {
  it("treats only admin.ops as a facility admin", () => {
    expect(isFacilityAdminRole("admin.ops")).toBe(true);
    for (const role of ["admin", "admin.super", "client", "provider", null, undefined]) {
      expect(isFacilityAdminRole(role), String(role)).toBe(false);
    }
  });

  it("treats admin and admin.super as system administrators, never admin.ops", () => {
    expect(isSystemAdminRole("admin")).toBe(true);
    expect(isSystemAdminRole("admin.super")).toBe(true);
    for (const role of ["admin.ops", "client", "provider", null, undefined]) {
      expect(isSystemAdminRole(role), String(role)).toBe(false);
    }
  });

  it("keeps the two audiences disjoint and together equal to the admin portal roles", () => {
    for (const role of ["admin", "admin.super", "admin.ops", "client", "provider"]) {
      expect(isFacilityAdminRole(role) && isSystemAdminRole(role)).toBe(false);
      expect(isFacilityAdminRole(role) || isSystemAdminRole(role)).toBe(isAdminPortalRole(role));
    }
  });
});
