import { describe, expect, it } from "vitest";

import { consultationDateLabel, consultationTimeRange, describeTimezone, joinOpensAt } from "../consultationTime";

// 08:40Z is 11:40 in Nairobi (UTC+3).
const START = "2026-10-22T08:40:00Z";

describe("consultationTime", () => {
  it("names the facility timezone by its city", () => {
    expect(describeTimezone("Africa/Nairobi")).toBe("Nairobi time");
    expect(describeTimezone("America/Los_Angeles")).toBe("Los Angeles time");
    expect(describeTimezone(undefined)).toBe("Nairobi time");
  });

  it("writes the date with the weekday, in the facility's timezone", () => {
    // The order of the words follows the viewer's locale; the weekday, day and month are what matter.
    const label = consultationDateLabel(START, "Africa/Nairobi") ?? "";
    expect(label).toMatch(/Thursday/);
    expect(label).toMatch(/22/);
    expect(label).toMatch(/October/);
    // 22:30Z on the 21st is already the 22nd in Nairobi.
    expect(consultationDateLabel("2026-10-21T22:30:00Z", "Africa/Nairobi")).toMatch(/Thursday.*22|22.*Thursday/);
  });

  it("gives a start and end time", () => {
    expect(consultationTimeRange(START, 30, "Africa/Nairobi")).toBe("11:40 to 12:10");
  });

  it("gives only the start when the length is unknown", () => {
    expect(consultationTimeRange(START, null, "Africa/Nairobi")).toBe("11:40");
  });

  it("says when the call opens", () => {
    expect(joinOpensAt(START, 10, "Africa/Nairobi")).toBe("11:30");
    expect(joinOpensAt(START, undefined, "Africa/Nairobi")).toBeNull();
  });

  it("returns nothing for a missing or invalid time", () => {
    expect(consultationDateLabel(null, "Africa/Nairobi")).toBeNull();
    expect(consultationDateLabel("not a date", "Africa/Nairobi")).toBeNull();
    expect(consultationTimeRange("not a date", 30, "Africa/Nairobi")).toBeNull();
  });
});
