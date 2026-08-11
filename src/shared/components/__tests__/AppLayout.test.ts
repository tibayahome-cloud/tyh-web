import { describe, expect, it } from "vitest";

import { resolveSettingsPath, resolveSidebarLayoutVars } from "../AppLayout";

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

describe("resolveSidebarLayoutVars", () => {
  it("publishes the desktop sidebar width for overlay components", () => {
    expect(resolveSidebarLayoutVars(true, false)["--app-sidebar-width"]).toBe("16rem");
    expect(resolveSidebarLayoutVars(true, true)["--app-sidebar-width"]).toBe("5rem");
  });

  it("does not overwrite parent sidebar variables in nested page layouts", () => {
    expect(resolveSidebarLayoutVars(false, false)["--app-sidebar-width"]).toBeUndefined();
  });

  it("publishes occupied shell areas for call overlays", () => {
    expect(resolveSidebarLayoutVars(true, false, true)["--app-header-height"]).toBe("4rem");
    expect(resolveSidebarLayoutVars(true, false, true)["--app-bottom-nav-height"]).toBe("72px");
  });
});
