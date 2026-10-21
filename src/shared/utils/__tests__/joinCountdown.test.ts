import { describe, expect, it } from "vitest";

import { describeStart } from "../joinCountdown";

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
