import { describe, expect, it } from "vitest";

import { computeBookingDateRange } from "../bookingDateRange";

const now = new Date("2026-10-20T10:00:00.000Z");

describe("computeBookingDateRange", () => {
  it("asks for appointments from now onwards, so a rescheduled consultation stays visible", () => {
    expect(computeBookingDateRange("upcoming", now)).toEqual({ scheduledFrom: "2026-10-20T10:00:00.000Z" });
  });

  it("has no range for any time", () => {
    expect(computeBookingDateRange("all", now)).toEqual({});
  });

  it("looks back seven and thirty days, ending now", () => {
    expect(computeBookingDateRange("7d", now)).toEqual({
      from: "2026-10-13T10:00:00.000Z",
      to: "2026-10-20T10:00:00.000Z"
    });
    expect(computeBookingDateRange("30d", now).from).toBe("2026-09-20T10:00:00.000Z");
  });

  it("covers the local day for today", () => {
    const range = computeBookingDateRange("today", now);
    expect(new Date(range.from as string).getTime()).toBeLessThanOrEqual(now.getTime());
    expect(new Date(range.to as string).getTime()).toBeGreaterThanOrEqual(now.getTime());
  });
});
