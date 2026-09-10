/**
 * Slots arrive as UTC instants; the calendar the client picks from belongs to the facility.
 * A Nairobi clinic's Tuesday runs 21:00 Monday to 21:00 Tuesday UTC, so deriving "today" or a
 * slot's date from the device clock puts three hours of every day on the wrong side of
 * midnight -- invisibly, because the times still look plausible.
 *
 * Every case here fixes the clock, so a run at 23:00 Nairobi asserts the same thing as a run
 * at 09:00.
 */

import { describe, expect, it } from "vitest";

import {
  facilityLocalDate,
  facilityLocalDateRange,
  facilityLocalDayLabel,
  facilityToday,
  groupSlotsByFacilityLocalDate
} from "../telemedicine";

const NAIROBI = "Africa/Nairobi";
const NEW_YORK = "America/New_York";

describe("facilityLocalDate", () => {
  it("reads 22:00 UTC as the next day in Nairobi", () => {
    // 2026-09-01T22:00Z is 2026-09-02T01:00 in Nairobi.
    expect(facilityLocalDate("2026-09-01T22:00:00Z", NAIROBI)).toBe("2026-09-02");
  });

  it("reads 20:00 UTC as the same day in Nairobi", () => {
    expect(facilityLocalDate("2026-09-01T20:00:00Z", NAIROBI)).toBe("2026-09-01");
  });

  it("reads 02:00 UTC as the previous day in New York", () => {
    expect(facilityLocalDate("2026-09-02T02:00:00Z", NEW_YORK)).toBe("2026-09-01");
  });

  it("returns an empty string for an unparseable instant", () => {
    expect(facilityLocalDate("not-a-date", NAIROBI)).toBe("");
  });
});

describe("facilityToday", () => {
  it("names tomorrow once it is tomorrow at the facility", () => {
    // 21:30 UTC on the 1st is 00:30 on the 2nd in Nairobi. The device's UTC date still says
    // the 1st, which is exactly the bug: the picker opened on a day already past.
    const lateEvening = new Date("2026-09-01T21:30:00Z");
    expect(facilityToday(NAIROBI, lateEvening)).toBe("2026-09-02");
    expect(lateEvening.toISOString().slice(0, 10)).toBe("2026-09-01");
  });

  it("agrees with the UTC date during the facility's working hours", () => {
    expect(facilityToday(NAIROBI, new Date("2026-09-01T09:00:00Z"))).toBe("2026-09-01");
  });

  it("names yesterday for a facility behind UTC", () => {
    expect(facilityToday(NEW_YORK, new Date("2026-09-02T01:00:00Z"))).toBe("2026-09-01");
  });
});

describe("facilityLocalDateRange", () => {
  it("returns seven consecutive dates", () => {
    expect(facilityLocalDateRange("2026-09-01", 7)).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
      "2026-09-06",
      "2026-09-07"
    ]);
  });

  it("crosses a month boundary", () => {
    expect(facilityLocalDateRange("2026-08-30", 3)).toEqual(["2026-08-30", "2026-08-31", "2026-09-01"]);
  });

  it("crosses a year boundary", () => {
    expect(facilityLocalDateRange("2026-12-31", 2)).toEqual(["2026-12-31", "2027-01-01"]);
  });

  it("advances one calendar day across a DST transition, not 24 hours", () => {
    // US spring-forward, 2026-03-08. A 24-hour step would land back on the 8th.
    expect(facilityLocalDateRange("2026-03-07", 3)).toEqual(["2026-03-07", "2026-03-08", "2026-03-09"]);
  });

  it("returns nothing for a malformed start date", () => {
    expect(facilityLocalDateRange("", 7)).toEqual([]);
  });
});

describe("groupSlotsByFacilityLocalDate", () => {
  it("keeps a late-evening Nairobi slot on its own local day", () => {
    // 20:30Z is 23:30 Nairobi on the 1st; 21:30Z is 00:30 on the 2nd. Grouping by the UTC
    // date would file both under the 1st and the second would never appear on the 2nd.
    const slots = [
      { startAt: "2026-09-01T20:30:00Z" },
      { startAt: "2026-09-01T21:30:00Z" }
    ];

    const grouped = groupSlotsByFacilityLocalDate(slots, NAIROBI);

    expect(grouped.get("2026-09-01")).toEqual([{ startAt: "2026-09-01T20:30:00Z" }]);
    expect(grouped.get("2026-09-02")).toEqual([{ startAt: "2026-09-01T21:30:00Z" }]);
  });

  it("buckets a full day of slots under one date", () => {
    const slots = ["06:00", "07:00", "08:00"].map((time) => ({
      startAt: `2026-09-01T${time}:00Z`
    }));

    const grouped = groupSlotsByFacilityLocalDate(slots, NAIROBI);

    expect([...grouped.keys()]).toEqual(["2026-09-01"]);
    expect(grouped.get("2026-09-01")).toHaveLength(3);
  });

  it("preserves the order slots arrived in", () => {
    const slots = [
      { startAt: "2026-09-01T06:00:00Z" },
      { startAt: "2026-09-01T07:00:00Z" }
    ];

    const grouped = groupSlotsByFacilityLocalDate(slots, NAIROBI);

    expect(grouped.get("2026-09-01")?.map((slot) => slot.startAt)).toEqual([
      "2026-09-01T06:00:00Z",
      "2026-09-01T07:00:00Z"
    ]);
  });

  it("drops a slot whose instant cannot be read rather than bucketing it under an empty key", () => {
    const grouped = groupSlotsByFacilityLocalDate([{ startAt: "nonsense" }], NAIROBI);
    expect(grouped.size).toBe(0);
  });

  it("groups the same instants differently for facilities in different zones", () => {
    const slots = [{ startAt: "2026-09-01T22:00:00Z" }];

    expect([...groupSlotsByFacilityLocalDate(slots, NAIROBI).keys()]).toEqual(["2026-09-02"]);
    expect([...groupSlotsByFacilityLocalDate(slots, NEW_YORK).keys()]).toEqual(["2026-09-01"]);
  });
});

describe("facilityLocalDayLabel", () => {
  it("labels a date with its own weekday", () => {
    // 2026-09-01 is a Tuesday.
    expect(facilityLocalDayLabel("2026-09-01")).toEqual({ weekday: "Tue", day: "1" });
  });

  it("does not shift the date it was handed", () => {
    // The input is already facility-local. Re-converting through a zone would move it, which
    // for a facility at UTC+14 would show the following day on every chip.
    expect(facilityLocalDayLabel("2026-09-30").day).toBe("30");
    expect(facilityLocalDayLabel("2026-01-01").day).toBe("1");
  });

  it("returns empty parts for a malformed date", () => {
    expect(facilityLocalDayLabel("")).toEqual({ weekday: "", day: "" });
  });
});
