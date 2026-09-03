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


test.describe("the slot picker at mobile and desktop widths", () => {
  test.use({ timezoneId: NAIROBI });

  // The day strip is seven columns. At a phone width that is the layout most at risk of
  // overflowing, and a horizontally scrolling booking dialog is the kind of thing that only
  // shows up on a real device -- jsdom has no layout, so a unit test cannot see it.
  const WIDTHS = [
    { name: "small phone", width: 320, height: 720 },
    { name: "phone", width: 390, height: 844 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1440, height: 900 }
  ];

  for (const { name, width, height } of WIDTHS) {
    test(`a seven-column day strip fits at ${name} (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.setContent(`
        <style>
          * { box-sizing: border-box; margin: 0; }
          body { font-family: system-ui, sans-serif; }
          .dialog { max-width: 42rem; margin: 0 auto; padding: 1rem; }
          .strip { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 0.25rem; }
          .day { display: flex; flex-direction: column; align-items: center;
                 border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 0.5rem 0.25rem; }
          .wd { font-size: 10px; text-transform: uppercase; }
          .dt { font-size: 1rem; font-weight: 600; }
          .ct { font-size: 10px; color: #64748b; }
        </style>
        <div class="dialog">
          <div class="strip" role="group" aria-label="Choose a day">
            ${["Wed 2", "Thu 3", "Fri 4", "Sat 5", "Sun 6", "Mon 7", "Tue 8"]
              .map((d) => {
                const [wd, dt] = d.split(" ");
                return `<button class="day"><span class="wd">${wd}</span>` +
                       `<span class="dt">${dt}</span><span class="ct">53 open</span></button>`;
              })
              .join("")}
          </div>
        </div>
      `);

      const strip = page.getByRole("group", { name: /choose a day/i });
      await expect(strip).toBeVisible();
      await expect(strip.getByRole("button")).toHaveCount(7);

      // Nothing may push the page sideways.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);

      // Every day has to stay tappable; 24px is well under the 44px guideline but catches a
      // strip that has collapsed rather than one that is merely tight.
      const boxes = await strip.getByRole("button").evaluateAll((nodes) =>
        nodes.map((n) => n.getBoundingClientRect().width)
      );
      for (const boxWidth of boxes) {
        expect(boxWidth).toBeGreaterThan(24);
      }
    });
  }
});
