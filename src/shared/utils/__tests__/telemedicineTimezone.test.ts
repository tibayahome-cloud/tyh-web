import { describe, expect, it, beforeAll, afterAll } from "vitest";

import { facilityLocalToUtcIso } from "../telemedicine";

const NAIROBI = "Africa/Nairobi";

/** The wall clock an instant shows in a given zone, as "YYYY-MM-DDTHH:mm". */
const wallClockIn = (iso: string, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  })
    .formatToParts(new Date(iso))
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${String(Number(parts.hour) % 24).padStart(2, "0")}:${parts.minute}`;
};

// The operator is not in Nairobi. Node re-reads process.env.TZ on assignment, so this really
// does move the ambient zone the way sitting at a machine in New York would -- which is the
// whole point: the conversion must not depend on it.
const ORIGINAL_TZ = process.env.TZ;

describe("facilityLocalToUtcIso with an operator outside the facility's timezone", () => {
  beforeAll(() => {
    process.env.TZ = "America/New_York";
  });

  afterAll(() => {
    process.env.TZ = ORIGINAL_TZ;
  });

  it("confirms the ambient timezone really is not the facility's", () => {
    // Guards the tests below: if the environment silently ignored TZ they would pass without
    // testing anything, because the browser zone and the facility zone would agree.
    expect(new Date("2026-09-10T09:00:00Z").getTimezoneOffset()).not.toBe(-180);
  });

  it("submits the instant the operator's chosen facility-local time actually names", () => {
    const iso = facilityLocalToUtcIso("2026-09-10T09:00", NAIROBI);

    // Nairobi is UTC+3 year round.
    expect(iso).toBe("2026-09-10T06:00:00.000Z");
    expect(wallClockIn(iso!, NAIROBI)).toBe("2026-09-10T09:00");
  });

  it("does not resolve the value against the operator's own timezone", () => {
    // The bug this replaces: new Date("2026-09-10T09:00") is read in the browser's zone, so a
    // New York operator offering 09:00 would have booked 16:00 in Nairobi.
    const browserResolved = new Date("2026-09-10T09:00").toISOString();
    const facilityResolved = facilityLocalToUtcIso("2026-09-10T09:00", NAIROBI);

    expect(facilityResolved).not.toBe(browserResolved);
    expect(wallClockIn(browserResolved, NAIROBI)).not.toBe("2026-09-10T09:00");
  });

  it("round-trips every hour of a day back to the same facility wall clock", () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const wallClock = `2026-09-10T${String(hour).padStart(2, "0")}:30`;
      const iso = facilityLocalToUtcIso(wallClock, NAIROBI);
      expect(wallClockIn(iso!, NAIROBI)).toBe(wallClock);
    }
  });

  it("handles a facility zone that observes daylight saving, on both sides of the change", () => {
    // Not a zone Tiba serves today, but the conversion must not be Nairobi-specific: a fixed
    // +3 assumption would pass every test above and be wrong the moment a DST zone is added.
    const london = "Europe/London";
    expect(facilityLocalToUtcIso("2026-01-15T09:00", london)).toBe("2026-01-15T09:00:00.000Z");
    expect(facilityLocalToUtcIso("2026-07-15T09:00", london)).toBe("2026-07-15T08:00:00.000Z");
    expect(wallClockIn(facilityLocalToUtcIso("2026-07-15T09:00", london)!, london)).toBe(
      "2026-07-15T09:00"
    );
  });

  it("accepts a value carrying seconds, as some browsers emit", () => {
    expect(facilityLocalToUtcIso("2026-09-10T09:00:00", NAIROBI)).toBe("2026-09-10T06:00:00.000Z");
  });

  it("returns null rather than an invalid instant for unusable input", () => {
    for (const value of ["", "not-a-date", "2026-09-10", "10/09/2026 09:00"]) {
      expect(facilityLocalToUtcIso(value, NAIROBI)).toBeNull();
    }
  });
});
