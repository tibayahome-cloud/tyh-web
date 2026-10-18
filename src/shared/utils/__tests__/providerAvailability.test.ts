import { describe, expect, it } from "vitest";

import { deliveryModeLabel, formatClock, groupAvailabilityByDay, remoteWindowCount, weekdayName } from "../providerAvailability";

const window = (over: Record<string, unknown> = {}) =>
  ({ id: "w", weekday: "mon", startTime: "05:00:00+00", endTime: "14:00:00+00", startTimeLocal: "08:00:00", endTimeLocal: "17:00:00", deliveryMode: "both", effectiveFrom: null, effectiveTo: null, ...over }) as never;

describe("formatClock", () => {
  it.each([["08:00:00", "08:00"], ["8:30", "08:30"], ["17:45:00+03:00", "17:45"], ["", ""]])("%s", (input, out) => {
    expect(formatClock(input)).toBe(out);
  });
});

describe("weekdayName and deliveryModeLabel", () => {
  it("names weekdays from the API's short keys", () => {
    expect(weekdayName("wed")).toBe("Wednesday");
    expect(weekdayName("Saturday")).toBe("Saturday");
  });
  it("labels each delivery mode", () => {
    expect(deliveryModeLabel("remote")).toBe("Remote");
    expect(deliveryModeLabel("in_person")).toBe("In person");
    expect(deliveryModeLabel("both")).toBe("Remote and in person");
  });
});

describe("groupAvailabilityByDay", () => {
  it("lists all seven days Monday first, empty days included", () => {
    const days = groupAvailabilityByDay([window({ weekday: "sat" })]);
    expect(days.map((d) => d.name)).toEqual(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
    expect(days.find((d) => d.weekday === "tue")?.windows).toEqual([]);
  });

  it("shows the local times the slot engine uses, not the offset times", () => {
    const [monday] = groupAvailabilityByDay([window()]);
    expect(monday.windows[0]).toMatchObject({ from: "08:00", to: "17:00", mode: "Remote and in person", remote: true });
  });

  it("falls back to start_time and end_time when local times are absent", () => {
    const [monday] = groupAvailabilityByDay([window({ startTimeLocal: null, endTimeLocal: null, startTime: "09:00:00", endTime: "12:00:00" })]);
    expect(monday.windows[0]).toMatchObject({ from: "09:00", to: "12:00" });
  });

  it("orders several windows on one day by start time", () => {
    const [monday] = groupAvailabilityByDay([
      window({ id: "b", startTimeLocal: "14:00:00", endTimeLocal: "17:00:00" }),
      window({ id: "a", startTimeLocal: "08:00:00", endTimeLocal: "12:00:00" })
    ]);
    expect(monday.windows.map((w) => w.id)).toEqual(["a", "b"]);
  });

  it("marks in-person windows as not remote", () => {
    const [monday] = groupAvailabilityByDay([window({ deliveryMode: "in_person" })]);
    expect(monday.windows[0].remote).toBe(false);
  });

  it("describes an effective date range", () => {
    const [monday] = groupAvailabilityByDay([window({ effectiveFrom: "2026-11-01T00:00:00Z", effectiveTo: "2026-12-01T00:00:00Z" })]);
    expect(monday.windows[0].effective).toMatch(/^from .* until /);
  });
});

describe("remoteWindowCount", () => {
  it("counts remote and both windows, and treats an unknown mode as remote-capable", () => {
    expect(remoteWindowCount([window({ deliveryMode: "remote" }), window({ deliveryMode: "both" }), window({ deliveryMode: "in_person" }), window({ deliveryMode: null })])).toBe(3);
  });
});
