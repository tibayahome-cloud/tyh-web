import { describe, expect, it } from "vitest";

import { isAdminPortalRole } from "../roles";
import {
  adminPortalHome,
  areaOfPath,
  areasOpenedBy,
  isFacilityAdminRole,
  isSystemAdminRole,
  personalSignInDestination
} from "../portalRoles";

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

describe("areasOpenedBy", () => {
  const keys = (roles: string[]) => areasOpenedBy(roles).map((area) => area.key);

  it("gives a person with one role one area", () => {
    expect(keys(["client"])).toEqual(["client"]);
    expect(keys(["provider"])).toEqual(["provider"]);
    expect(keys(["admin.ops"])).toEqual(["admin"]);
    expect(keys(["admin.super"])).toEqual(["admin"]);
  });

  it("gives an administrator who is also a provider both areas, whichever role comes first", () => {
    expect(keys(["admin.ops", "provider"])).toEqual(["admin", "provider"]);
    expect(keys(["provider", "admin.ops"])).toEqual(["admin", "provider"]);
  });

  it("gives a person with an administrator role and the patient role both areas", () => {
    expect(keys(["client", "admin.ops"])).toEqual(["admin", "client"]);
  });

  it("counts the two kinds of administrator as one area, the system one winning", () => {
    expect(areasOpenedBy(["admin.ops", "admin.super"])).toEqual([
      { key: "admin", label: "system admin area", path: "/admin/dashboard" }
    ]);
  });

  it("names and addresses each area for the menu", () => {
    expect(areasOpenedBy(["admin.ops", "provider", "client"])).toEqual([
      { key: "admin", label: "facility admin area", path: "/admin/facility" },
      { key: "provider", label: "provider area", path: "/pro/home" },
      { key: "client", label: "patient area", path: "/app/home" }
    ]);
  });

  it("opens nothing for no roles", () => {
    expect(areasOpenedBy([])).toEqual([]);
    expect(areasOpenedBy(null)).toEqual([]);
    expect(areasOpenedBy(undefined)).toEqual([]);
  });
});

describe("areaOfPath", () => {
  it("names the area an address is in", () => {
    expect(areaOfPath("/admin/facility")).toBe("admin");
    expect(areaOfPath("/admin")).toBe("admin");
    expect(areaOfPath("/pro/home")).toBe("provider");
    expect(areaOfPath("/app/bookings/abc")).toBe("client");
  });

  it("does not mistake another address for one of them", () => {
    expect(areaOfPath("/profile")).toBeNull();
    expect(areaOfPath("/pro-tips")).toBeNull();
    expect(areaOfPath("/application")).toBeNull();
    expect(areaOfPath("/")).toBeNull();
  });
});

describe("personalSignInDestination", () => {
  it("sends a provider to the provider area, a patient to the patient area", () => {
    expect(personalSignInDestination(["provider"])).toEqual({ kind: "provider" });
    expect(personalSignInDestination(["client"])).toEqual({ kind: "client" });
  });

  it("sends someone who holds only administrator roles to a staff sign-in, the right one", () => {
    expect(personalSignInDestination(["admin.ops"])).toEqual({ kind: "staff", audience: "facility" });
    expect(personalSignInDestination(["admin.super"])).toEqual({ kind: "staff", audience: "system" });
    expect(personalSignInDestination(["admin.ops", "admin.super"])).toEqual({ kind: "staff", audience: "system" });
  });

  it("lands an administrator who is also a provider in the provider area, whichever role comes first", () => {
    expect(personalSignInDestination(["admin.ops", "provider"])).toEqual({ kind: "provider" });
    expect(personalSignInDestination(["provider", "admin.ops"])).toEqual({ kind: "provider" });
  });

  it("lands an administrator who is also a patient in the patient area, whichever role comes first", () => {
    expect(personalSignInDestination(["admin.ops", "client"])).toEqual({ kind: "client" });
    expect(personalSignInDestination(["client", "admin.ops"])).toEqual({ kind: "client" });
  });

  it("treats no roles as a patient, as before", () => {
    expect(personalSignInDestination([])).toEqual({ kind: "client" });
    expect(personalSignInDestination(undefined)).toEqual({ kind: "client" });
  });
});
