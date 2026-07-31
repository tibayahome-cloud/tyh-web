import { describe, expect, it } from "vitest";

import { buildAdminNavItems } from "../AdminShell";

const navSummary = (roles: string[]) =>
  buildAdminNavItems({ roles, conversationUnread: 4 }).map((item) => ({
    label: item.label,
    to: item.to,
    badge: item.badge
  }));

describe("AdminShell navigation", () => {
  it("points admin ops to their facility workspace landing route", () => {
    expect(navSummary(["admin.ops"])).toEqual([
      { label: "Queue", to: "/admin/bookings", badge: undefined },
      { label: "Self Care", to: "/admin/selfcare", badge: undefined },
      { label: "Facility", to: "/admin/facility", badge: undefined },
      { label: "Payments", to: "/admin/finance/payments", badge: undefined },
      { label: "Inbox", to: "/admin/conversations", badge: 4 }
    ]);
  });

  it("keeps super admin on global facility management navigation", () => {
    const summary = navSummary(["admin.super"]);

    expect(summary).toContainEqual({ label: "Facilities", to: "/admin/facilities", badge: undefined });
    expect(summary).toContainEqual({ label: "Users", to: "/admin/users", badge: undefined });
    expect(summary).toContainEqual({ label: "Settings", to: "/admin/system-settings", badge: undefined });
    expect(summary).not.toContainEqual({ label: "Facility", to: "/admin/facility", badge: undefined });
  });
});
