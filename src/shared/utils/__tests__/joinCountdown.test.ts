import { describe, expect, it } from "vitest";

import { describeStart, describeWait } from "../joinCountdown";

const base = new Date("2026-10-20T09:00:00Z").getTime();
const at = (minutesFromNow: number) => new Date(base + minutesFromNow * 60_000).toISOString();

describe("describeStart", () => {
  it.each([
    [135, "Starts in 2 h 15 min"],
    [120, "Starts in 2 h"],
    [60, "Starts in 1 h"],
    [45, "Starts in 45 min"],
    [1, "Starts in 1 min"],
    [0, "Starting now"],
    [-7, "Started 7 min ago"]
  ])("%i minutes -> %s", (minutes, expected) => expect(describeStart(at(minutes), base)).toBe(expected));

  it("gives no count for something more than a day away, and none for a missing or bad time", () => {
    expect(describeStart(at(25 * 60), base)).toBeNull();
    expect(describeStart(null, base)).toBeNull();
    expect(describeStart("not a date", base)).toBeNull();
  });
});

describe("describeWait", () => {
  it("reads in minutes, then hours, then days, never as a long minute count", () => {
    expect(describeWait(4)).toBe("4 min");
    expect(describeWait(60)).toBe("1 h");
    expect(describeWait(197)).toBe("3 h 17 min");
    expect(describeWait(1544)).toBe("1 day");
    expect(describeWait(3 * 24 * 60 + 100)).toBe("3 days");
  });

  it("does not go below zero", () => {
    expect(describeWait(-5)).toBe("0 min");
  });
});
