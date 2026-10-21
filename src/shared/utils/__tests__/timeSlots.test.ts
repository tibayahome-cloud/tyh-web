import { describe, expect, it } from "vitest";

import { groupSlotsByDay, zoneDisplayName } from "../timeSlots";

const slot = (iso: string) => ({ startAt: iso, endAt: iso });

describe("groupSlotsByDay", () => {
  it("groups by the facility's calendar day, not the viewer's, so a late evening stays on its own day", () => {
    // 20:30 UTC is 23:30 in Nairobi on the 10th; 21:30 UTC is 00:30 on the 11th.
    const days = groupSlotsByDay([slot("2026-09-10T20:30:00Z"), slot("2026-09-10T21:30:00Z")], "Africa/Nairobi");

    expect(days.map((day) => day.key)).toEqual(["2026-09-10", "2026-09-11"]);
    expect(days[0].slots[0].time).toBe("23:30");
    expect(days[1].slots[0].time).toBe("00:30");
  });

  it("sorts days and times soonest first however they arrive", () => {
    const days = groupSlotsByDay(
      [slot("2026-09-11T06:00:00Z"), slot("2026-09-10T08:00:00Z"), slot("2026-09-10T06:00:00Z")],
      "Africa/Nairobi"
    );

    expect(days.map((day) => day.key)).toEqual(["2026-09-10", "2026-09-11"]);
    expect(days[0].slots.map((s) => s.time)).toEqual(["09:00", "11:00"]);
  });

  it("labels days for a person", () => {
    const [day] = groupSlotsByDay([slot("2026-09-10T06:00:00Z")], "Africa/Nairobi");

    expect(day.weekday).toBe("Thu");
    expect(day.dayMonth).toBe("10 Sept");
    expect(day.longLabel).toBe("Thursday 10 September");
  });

  it("skips an instant it cannot read", () => {
    expect(groupSlotsByDay([slot("not a date")], "Africa/Nairobi")).toEqual([]);
  });
});

describe("zoneDisplayName", () => {
  it("names the place, not the zone id", () => {
    expect(zoneDisplayName("Africa/Nairobi")).toBe("Nairobi time");
    expect(zoneDisplayName("America/New_York")).toBe("New York time");
  });
});
