import { describe, expect, it } from "vitest";

import { resolveSettingsPath } from "../AppLayout";

describe("resolveSettingsPath", () => {
  it("routes clients and providers to their workspace settings", () => {
    expect(resolveSettingsPath("/app/home", ["client"])).toBe("/app/settings");
    expect(resolveSettingsPath("/pro/home", ["provider"])).toBe("/pro/settings");
  });

  it("routes facility admins to account settings and platform admins to system settings", () => {
    expect(resolveSettingsPath("/admin/facility", ["admin.ops"])).toBe("/admin/settings");
    expect(resolveSettingsPath("/admin/dashboard", ["admin.super"])).toBe("/admin/system-settings");
  });
});
