import { describe, expect, it } from "vitest";

import { isAdminPortalRole } from "../roles";
import { adminPortalHome, isFacilityAdminRole, isSystemAdminRole } from "../portalRoles";

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

describe("adminPortalHome", () => {
  it("sends facility admins to the facility portal", () => {
    expect(adminPortalHome(["admin.ops"])).toBe("/admin/facility");
  });

  it("sends system administrators to the system dashboard", () => {
    expect(adminPortalHome(["admin.super"])).toBe("/admin/dashboard");
    expect(adminPortalHome(["admin"])).toBe("/admin/dashboard");
  });

  it("prefers the system dashboard when an account holds both", () => {
    expect(adminPortalHome(["admin.ops", "admin.super"])).toBe("/admin/dashboard");
  });

  it("falls back to the dashboard, whose guard redirects, for unknown or missing roles", () => {
    expect(adminPortalHome([])).toBe("/admin/dashboard");
    expect(adminPortalHome(undefined)).toBe("/admin/dashboard");
    expect(adminPortalHome(["client"])).toBe("/admin/dashboard");
  });
});
