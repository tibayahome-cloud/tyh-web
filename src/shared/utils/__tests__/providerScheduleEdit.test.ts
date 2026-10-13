import { describe, expect, it } from "vitest";

import {
  blankWindow,
  sameSchedule,
  toAvailabilityPayload,
  validateWindows,
  windowsToEditable
} from "../providerScheduleEdit";

const entry = (over: Record<string, unknown> = {}) => ({
  id: "w1", weekday: "mon", startTime: "05:00:00+00", endTime: "14:00:00+00",
  startTimeLocal: "08:00:00", endTimeLocal: "17:00:00", deliveryMode: "remote",
  effectiveFrom: "2026-10-01T00:00:00+00:00", effectiveTo: null, slotDurationMinutes: 45, ...over
});

describe("provider schedule editing", () => {
  it("edits the local clock the slot engine reads, not the UTC snapshot", () => {
    expect(windowsToEditable([entry()])[0]).toMatchObject({ start: "08:00", end: "17:00", weekday: "mon" });
  });

  it("round-trips delivery mode, effective dates and slot length so a save does not reset them", () => {
    const payload = toAvailabilityPayload(windowsToEditable([entry()]));
    expect(payload).toEqual([
      {
        weekday: "mon", start_time: "08:00", end_time: "17:00", delivery_mode: "remote",
        effective_from: "2026-10-01T00:00:00+00:00", effective_to: null, slot_duration_minutes: 45
      }
    ]);
  });

  it("treats a missing delivery mode as both, as the API does", () => {
    expect(windowsToEditable([entry({ deliveryMode: null })])[0].mode).toBe("both");
  });

  it("orders the payload Monday first by start time", () => {
    const rows = [
      { ...blankWindow("tue"), start: "10:00", end: "11:00" },
      { ...blankWindow("mon"), start: "13:00", end: "14:00" },
      { ...blankWindow("mon"), start: "08:00", end: "09:00" }
    ];
    expect(toAvailabilityPayload(rows).map((r) => `${r.weekday} ${r.start_time}`)).toEqual(["mon 08:00", "mon 13:00", "tue 10:00"]);
  });

  describe("validation", () => {
    it("accepts a normal day", () => {
      expect(validateWindows([blankWindow("mon")])).toEqual({});
    });

    it("refuses an end that is not after the start, naming the overnight workaround", () => {
      const row = { ...blankWindow("mon"), start: "22:00", end: "06:00" };
      expect(validateWindows([row])[row.key]).toMatch(/after start/);
    });

    it("refuses an empty time", () => {
      const row = { ...blankWindow("mon"), start: "" };
      expect(validateWindows([row])[row.key]).toMatch(/start and end/);
    });

    it("flags overlap on the same day only", () => {
      const a = { ...blankWindow("mon"), start: "08:00", end: "12:00" };
      const b = { ...blankWindow("mon"), start: "11:00", end: "15:00" };
      const other = { ...blankWindow("tue"), start: "11:00", end: "15:00" };
      const errors = validateWindows([a, b, other]);
      expect(errors[b.key]).toMatch(/overlaps/);
      expect(errors[a.key]).toBeUndefined();
      expect(errors[other.key]).toBeUndefined();
    });

    it("allows back-to-back windows", () => {
      const a = { ...blankWindow("mon"), start: "08:00", end: "12:00" };
      const b = { ...blankWindow("mon"), start: "12:00", end: "15:00" };
      expect(validateWindows([a, b])).toEqual({});
    });
  });

  it("tells whether anything changed", () => {
    const original = windowsToEditable([entry()]);
    expect(sameSchedule(original, windowsToEditable([entry()]))).toBe(true);
    expect(sameSchedule(original, [{ ...original[0], mode: "both" }])).toBe(false);
  });
});
