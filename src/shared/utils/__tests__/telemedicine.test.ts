import { describe, expect, it } from "vitest";

import { formatTelemedicineDateTime, isWithinJoinWindow } from "../telemedicine";

describe("isWithinJoinWindow", () => {
  const scheduledAt = "2026-08-13T12:00:00.000Z";

  it("is closed before the join window opens", () => {
    const nineMinutesBefore = new Date(scheduledAt).getTime() - 11 * 60_000;
    expect(isWithinJoinWindow(scheduledAt, 60, nineMinutesBefore, 10)).toBe(false);
  });

  it("opens at exactly the configured window", () => {
    const tenMinutesBefore = new Date(scheduledAt).getTime() - 10 * 60_000;
    expect(isWithinJoinWindow(scheduledAt, 60, tenMinutesBefore, 10)).toBe(true);
  });

  it("respects a live policy window different from the fallback default", () => {
    const twelveMinutesBefore = new Date(scheduledAt).getTime() - 12 * 60_000;
    expect(isWithinJoinWindow(scheduledAt, 60, twelveMinutesBefore, 10)).toBe(false);
    expect(isWithinJoinWindow(scheduledAt, 60, twelveMinutesBefore, 15)).toBe(true);
  });

  it("closes after the appointment duration plus the after-window buffer", () => {
    const wellAfter = new Date(scheduledAt).getTime() + 60 * 60_000 + 31 * 60_000;
    expect(isWithinJoinWindow(scheduledAt, 60, wellAfter, 10)).toBe(false);
  });

  it("is false with no scheduled time", () => {
    expect(isWithinJoinWindow(null, 60)).toBe(false);
  });
});

describe("formatTelemedicineDateTime", () => {
  it("renders the appointment's real local time, not the viewer's device timezone", () => {
    // 09:00 UTC is 12:00 in Nairobi (UTC+3) and 04:00 in New York (UTC-5) -- the point of this
    // formatter is that it shows Nairobi time regardless of which of those the test runner is in.
    const result = formatTelemedicineDateTime("2026-08-13T09:00:00.000Z", "Africa/Nairobi", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    expect(result).toContain("12:00");
  });

  it("falls back to Africa/Nairobi when no timezone is given, since KE is the only supported country", () => {
    const result = formatTelemedicineDateTime("2026-08-13T09:00:00.000Z", undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    expect(result).toContain("12:00");
  });

  it("returns a fallback label for a missing or invalid timestamp", () => {
    expect(formatTelemedicineDateTime(null)).toBe("Not scheduled");
    expect(formatTelemedicineDateTime("not-a-date")).toBe("Not scheduled");
  });
});
