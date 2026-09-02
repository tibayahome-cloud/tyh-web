import { describe, expect, it } from "vitest";

import { buildAdminNavItems } from "../AdminShell";

const navSummary = (roles: string[]) =>
  buildAdminNavItems({ roles, conversationUnread: 4 }).map((item) => ({
    label: item.label,
    to: item.to,
    badge: item.badge
  }));

describe("AdminShell navigation", () => {
  it("shows admin ops the tenant workflow in the agreed order", () => {
    expect(navSummary(["admin.ops"])).toEqual([
      { label: "Overview", to: "/admin/facility/overview", badge: undefined },
      { label: "Facility", to: "/admin/facility", badge: undefined },
      { label: "Providers", to: "/admin/facility/providers", badge: undefined },
      { label: "Queue", to: "/admin/bookings", badge: undefined },
      { label: "Telemedicine", to: "/admin/telemedicine", badge: undefined },
      { label: "Payments", to: "/admin/finance/payments", badge: undefined },
      { label: "Reviews", to: "/admin/finance/reviews", badge: undefined },
      { label: "Inbox", to: "/admin/conversations", badge: 4 },
      { label: "Settings", to: "/admin/settings", badge: undefined }
    ]);
  });

  it("keeps super admin on global facility management navigation", () => {
    const summary = navSummary(["admin.super"]);

    expect(summary).toContainEqual({ label: "Facilities", to: "/admin/facilities", badge: undefined });
    expect(summary).toContainEqual({ label: "Users", to: "/admin/users", badge: undefined });
    expect(summary).toContainEqual({ label: "Settings", to: "/admin/system-settings", badge: undefined });
    expect(summary).toContainEqual({ label: "Telemedicine", to: "/admin/telemedicine", badge: undefined });
    expect(summary).toContainEqual({ label: "Reviews", to: "/admin/finance/reviews", badge: undefined });
    expect(summary).not.toContainEqual({ label: "Facility", to: "/admin/facility", badge: undefined });
  });
});
