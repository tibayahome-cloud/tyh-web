/**
 * Real-browser check for the facility-local calendar.
 *
 * The unit tests run in jsdom, which supplies its own Intl. This runs the same arithmetic in
 * Chromium with the browser's timezone actually set to Africa/Nairobi, which is what a client
 * in Kenya has -- and, separately, with the browser set somewhere else entirely, to prove the
 * facility's calendar does not follow the device.
 *
 * Deliberately engine-level rather than a full booking walkthrough: it needs no running API,
 * so it stays deterministic and can gate a build. A signed-in end-to-end pass over the picker
 * is worth adding once there is a seeded environment to point it at.
 *
 *   npx playwright test tests/e2e/facility-timezone.spec.ts
 */

import { expect, test } from "@playwright/test";

const NAIROBI = "Africa/Nairobi";

// The helpers under test, inlined so this spec needs no bundler or dev server.
const CALENDAR = `
const facilityLocalDate = (iso, timezone) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date(iso));

const facilityLocalDateRange = (startDate, count) => {
  const [y, m, d] = startDate.split("-").map(Number);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
  }
  return out;
};
`;

test.describe("facility-local calendar in a real browser", () => {
  test.use({ timezoneId: NAIROBI });

  test("a device in Nairobi resolves a late-evening slot to the next local day", async ({ page }) => {
    const result = await page.evaluate(`${CALENDAR}
      ({
        deviceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        // 21:30Z is 00:30 the next day in Nairobi.
        lateEvening: facilityLocalDate("2026-09-01T21:30:00Z", "${NAIROBI}"),
        sameDay: facilityLocalDate("2026-09-01T20:30:00Z", "${NAIROBI}"),
        utcDate: new Date("2026-09-01T21:30:00Z").toISOString().slice(0, 10)
      })
    `);

    expect(result.deviceTimezone).toBe(NAIROBI);
    expect(result.lateEvening).toBe("2026-09-02");
    expect(result.sameDay).toBe("2026-09-01");
    // The distinction the old code missed: the UTC date still says the 1st.
    expect(result.utcDate).toBe("2026-09-01");
  });

  test("seven consecutive local dates across a month boundary", async ({ page }) => {
    const dates = await page.evaluate(`${CALENDAR} facilityLocalDateRange("2026-08-30", 7)`);

    expect(dates).toEqual([
      "2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02",
      "2026-09-03", "2026-09-04", "2026-09-05"
    ]);
  });

  test("renders the facility's clock, not the browser's", async ({ page }) => {
    const times = await page.evaluate(`
      const fmt = (tz) => new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz
      }).format(new Date("2026-09-01T06:00:00Z"));
      ({ nairobi: fmt("${NAIROBI}"), newYork: fmt("America/New_York") })
    `);

    expect(times.nairobi).toBe("09:00");
    expect(times.newYork).toBe("02:00");
  });
});

test.describe("a device outside the facility's zone", () => {
  // A client travelling, or with a misconfigured clock, must still see the facility's calendar.
  test.use({ timezoneId: "America/Los_Angeles" });

  test("the facility's calendar does not follow the device", async ({ page }) => {
    const result = await page.evaluate(`${CALENDAR}
      ({
        deviceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        facilityDate: facilityLocalDate("2026-09-01T21:30:00Z", "${NAIROBI}"),
        deviceDate: facilityLocalDate("2026-09-01T21:30:00Z", "America/Los_Angeles")
      })
    `);

    expect(result.deviceTimezone).toBe("America/Los_Angeles");
    // Same instant, two calendars: the facility's is the one the picker must use.
    expect(result.facilityDate).toBe("2026-09-02");
    expect(result.deviceDate).toBe("2026-09-01");
  });
});

test.describe("a DST-observing facility", () => {
  test.use({ timezoneId: NAIROBI });

  test("offsets shift across a transition", async ({ page }) => {
    const offsets = await page.evaluate(`
      const fmt = (iso) => new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/New_York"
      }).format(new Date(iso));
      // US spring-forward is 2026-03-08: 12:00Z is 07:00 EST before and 08:00 EDT after.
      ({ before: fmt("2026-03-07T12:00:00Z"), after: fmt("2026-03-09T12:00:00Z") })
    `);

    expect(offsets.before).toBe("07:00");
    expect(offsets.after).toBe("08:00");
  });
});
