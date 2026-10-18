import { describe, expect, it } from "vitest";

import {
  BOOKING_GROUP_STATUSES,
  canAssignStatus,
  groupCount,
  groupOfStatus,
  statusFilterFor,
  statusLabel
} from "../facilityBookings";

// Every status the API accepts for a booking (app/models/bookings.py BOOKING_STATUSES).
const API_STATUSES = [
  "scheduled", "requested", "broadcasting", "accepted", "en_route", "nearby", "arrived", "in_service",
  "completed_by_provider", "client_completed", "fully_completed", "client_confirmed", "paid",
  "cancelled_by_client", "cancelled_by_admin", "expired_no_accept", "reassigned", "disputed",
  "telemedicine_payment_pending", "telemedicine_paid_pending_assignment", "telemedicine_cancelled_payment_review", "telemedicine_unattended"
];

describe("booking groups", () => {
  it("puts every status the API can return in exactly one group", () => {
    for (const status of API_STATUSES) {
      const groups = (Object.keys(BOOKING_GROUP_STATUSES) as Array<keyof typeof BOOKING_GROUP_STATUSES>).filter((group) => BOOKING_GROUP_STATUSES[group].includes(status));
      expect({ status, groups: groups.length }).toEqual({ status, groups: 1 });
    }
  });

  it("has no group status the API does not know", () => {
    const all = Object.values(BOOKING_GROUP_STATUSES).flat();
    expect(all.filter((status) => !API_STATUSES.includes(status))).toEqual([]);
  });

  it("builds the status filter for a group, and none for All", () => {
    expect(statusFilterFor("cancelled")).toBe("cancelled_by_client,cancelled_by_admin");
    expect(statusFilterFor("all")).toBeUndefined();
  });

  it("counts a group from the per-status counts, and All from the total", () => {
    const byStatus = { requested: 2, disputed: 1, scheduled: 4, fully_completed: 7 };
    expect(groupCount("attention", byStatus, 14)).toBe(3);
    expect(groupCount("active", byStatus, 14)).toBe(4);
    expect(groupCount("completed", byStatus, 14)).toBe(7);
    expect(groupCount("cancelled", byStatus, 14)).toBe(0);
    expect(groupCount("all", byStatus, 14)).toBe(14);
  });

  it("finds the group of a status", () => {
    expect(groupOfStatus("in_service")).toBe("active");
    expect(groupOfStatus("telemedicine_unattended")).toBe("attention");
    expect(groupOfStatus("something_new")).toBeNull();
  });
});

describe("canAssignStatus", () => {
  it.each(["requested", "broadcasting", "scheduled", "accepted", "telemedicine_paid_pending_assignment"])("offers it for %s", (status) => {
    expect(canAssignStatus(status)).toBe(true);
  });
  it.each(["in_service", "arrived", "fully_completed", "cancelled_by_admin", "telemedicine_payment_pending"])("does not offer it for %s", (status) => {
    expect(canAssignStatus(status)).toBe(false);
  });
});

describe("statusLabel", () => {
  it("makes a readable label, dropping the telemedicine prefix", () => {
    expect(statusLabel("in_service")).toBe("In service");
    expect(statusLabel("telemedicine_paid_pending_assignment")).toBe("Paid pending assignment");
  });
});

describe("assignBlockedReason", () => {
  it("blocks changing the provider once either person has joined the video call", async () => {
    const { assignBlockedReason } = await import("../facilityBookings");
    expect(assignBlockedReason({ isTelemedicine: true, telemedicineSession: { providerJoinedAt: "2026-10-15T10:00:00Z", clientJoinedAt: null } })).toMatch(/already started/);
    expect(assignBlockedReason({ isTelemedicine: true, telemedicineSession: { providerJoinedAt: null, clientJoinedAt: "2026-10-15T10:00:00Z" } })).toMatch(/already started/);
  });

  it("allows it before anyone joins, with no session, and for home-based care", async () => {
    const { assignBlockedReason } = await import("../facilityBookings");
    expect(assignBlockedReason({ isTelemedicine: true, telemedicineSession: { providerJoinedAt: null, clientJoinedAt: null } })).toBeNull();
    expect(assignBlockedReason({ isTelemedicine: true, telemedicineSession: null })).toBeNull();
    expect(assignBlockedReason({ isTelemedicine: false, telemedicineSession: { providerJoinedAt: "x", clientJoinedAt: null } })).toBeNull();
  });
});
