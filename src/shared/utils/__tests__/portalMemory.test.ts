import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { adminLoginPath, areaForRoles, readArea, rememberArea, sessionLoginPath } from "../portalMemory";

describe("areaForRoles", () => {
  it.each([
    [["admin.super"], "system"],
    [["admin"], "system"],
    [["admin.ops"], "facility"],
    [["provider"], "provider"],
    [["client"], "client"],
    [["client", "provider"], "provider"],
    [["admin.ops", "admin.super"], "system"],
    [["something-unknown"], "client"]
  ])("maps %j to %s", (roles, area) => {
    expect(areaForRoles(roles)).toBe(area);
  });

  it("has no area for no roles", () => {
    expect(areaForRoles([])).toBeNull();
    expect(areaForRoles(undefined)).toBeNull();
    expect(areaForRoles(null)).toBeNull();
  });
});

describe("remembered area", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("starts empty and round-trips an area", () => {
    expect(readArea()).toBeNull();
    rememberArea("facility");
    expect(readArea()).toBe("facility");
  });

  it("ignores a missing area and a tampered value", () => {
    rememberArea(null);
    expect(readArea()).toBeNull();
    window.localStorage.setItem("tiba.lastArea", "superuser");
    expect(readArea()).toBeNull();
  });

  it("does not throw when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => rememberArea("system")).not.toThrow();
    expect(readArea()).toBeNull();
    expect(sessionLoginPath()).toBe("/login");
    expect(adminLoginPath()).toBe("/facility/login");
  });
});

describe("where to sign in again", () => {
  beforeEach(() => window.localStorage.clear());

  it.each([
    [null, "/login", "/facility/login"],
    ["client", "/login", "/facility/login"],
    ["provider", "/login", "/facility/login"],
    ["facility", "/facility/login", "/facility/login"],
    ["system", "/admin/login", "/admin/login"]
  ] as const)("area %s: session ends -> %s, admin area without a session -> %s", (area, afterSession, adminArea) => {
    rememberArea(area);
    expect(sessionLoginPath()).toBe(afterSession);
    expect(adminLoginPath()).toBe(adminArea);
  });

  it("never sends someone to the system sign-in unless they last used the system area", () => {
    for (const area of ["client", "provider", "facility"] as const) {
      rememberArea(area);
      expect(adminLoginPath()).not.toBe("/admin/login");
      expect(sessionLoginPath()).not.toBe("/admin/login");
    }
  });
});
