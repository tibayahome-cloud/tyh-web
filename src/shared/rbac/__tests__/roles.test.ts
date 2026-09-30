import { describe, expect, it } from "vitest";

import { isAdminPortalRole } from "../roles";

describe("isAdminPortalRole", () => {
  it.each(["admin", "admin.super", "admin.ops"])("recognises %s as an admin portal role", (role) => {
    expect(isAdminPortalRole(role)).toBe(true);
  });

  it.each(["client", "provider", "unknown", null, undefined])("rejects %s", (role) => {
    expect(isAdminPortalRole(role)).toBe(false);
  });
});
