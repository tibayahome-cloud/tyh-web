import { describe, expect, it } from "vitest";

import { agendaDay } from "../agendaDates";

describe("agendaDay", () => {
  it("uses the facility's timezone for a telemedicine booking", () => {
    // 21:30Z on the 21st is 00:30 on the 22nd in Nairobi.
    const day = agendaDay({ scheduledAt: "2026-10-21T21:30:00Z", isTelemedicine: true }, "Africa/Nairobi");

    expect(day).toMatchObject({ day: "22", time: "00:30", soon: false });
  });

  it("gives bookings on the same day the same key, and different days different keys", () => {
    const a = agendaDay({ scheduledAt: "2026-10-22T05:00:00Z", isTelemedicine: true }, "Africa/Nairobi");
    const b = agendaDay({ scheduledAt: "2026-10-22T11:00:00Z", isTelemedicine: true }, "Africa/Nairobi");
    const c = agendaDay({ scheduledAt: "2026-10-23T05:00:00Z", isTelemedicine: true }, "Africa/Nairobi");

    expect(a.key).toBe(b.key);
    expect(a.key).not.toBe(c.key);
  });

  it("says Soon, with no date, for a booking that has no appointment yet", () => {
    for (const scheduledAt of [null, "not a date"]) {
      expect(agendaDay({ scheduledAt, isTelemedicine: false }, undefined)).toMatchObject({ soon: true, weekday: "Soon", day: "", time: "" });
    }
  });

  it("includes the weekday, month and year for the rail", () => {
    const day = agendaDay({ scheduledAt: "2026-10-22T08:40:00Z", isTelemedicine: true }, "Africa/Nairobi");

    expect(day.weekday).toMatch(/Thu/);
    expect(day.month).toMatch(/Oct/);
    expect(day.year).toBe("2026");
  });
});
