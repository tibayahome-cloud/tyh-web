import { describe, expect, it } from "vitest";

import { KNOWN_BOOKING_STATUSES } from "../../../../shared/utils/bookingStatus";
import {
  EARLIER_PROVIDER_BOOKING_STATUSES,
  OPEN_PROVIDER_BOOKING_STATUSES,
  isVisitUnderWay,
  needsRatingFromProvider,
  needsYouForOpenBooking
} from "../bookingGroups";

const NOW = new Date("2026-10-22T08:00:00Z").getTime();
const at = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();

const booking = (overrides: Record<string, unknown> = {}) =>
  ({
    id: "b",
    status: "scheduled",
    isTelemedicine: false,
    scheduledAt: at(-2 * 24 * 60),
    createdAt: at(-3 * 24 * 60),
    feedback: [],
    client: { fullName: "Amina Client" },
    ...overrides
  }) as never;

describe("provider booking groups", () => {
  it("places every known status in exactly one of open or earlier", () => {
    for (const status of KNOWN_BOOKING_STATUSES) {
      const inOpen = (OPEN_PROVIDER_BOOKING_STATUSES as readonly string[]).includes(status);
      const inEarlier = (EARLIER_PROVIDER_BOOKING_STATUSES as readonly string[]).includes(status);
      expect(inOpen !== inEarlier, `status ${status}`).toBe(true);
    }
  });

  it("keeps a finished visit that is awaiting payment open, and a paid one earlier", () => {
    expect(OPEN_PROVIDER_BOOKING_STATUSES).toContain("completed_by_provider");
    expect(EARLIER_PROVIDER_BOOKING_STATUSES).toContain("paid");
  });

  it("recognises a home visit under way, and not a telemedicine booking or a finished visit", () => {
    expect(isVisitUnderWay(booking({ status: "en_route" }))).toBe(true);
    expect(isVisitUnderWay(booking({ status: "in_service" }))).toBe(true);
    expect(isVisitUnderWay(booking({ status: "en_route", isTelemedicine: true }))).toBe(false);
    expect(isVisitUnderWay(booking({ status: "paid" }))).toBe(false);
  });
});

describe("what needs the provider", () => {
  it("asks for a new time when nobody joined, and for nothing on an ordinary booking", () => {
    expect(needsYouForOpenBooking(booking({ status: "telemedicine_unattended", isTelemedicine: true }))?.kind).toBe("new_time");
    expect(needsYouForOpenBooking(booking())).toBeNull();
  });

  it("asks for a rating of the client on a recent finished visit, naming them", () => {
    expect(needsRatingFromProvider(booking({ status: "fully_completed" }), "p1", NOW)).toMatchObject({
      kind: "rate",
      message: "Rate your visit with Amina Client"
    });
  });

  it("stops asking once this provider has rated, after two weeks, or for an unfinished visit", () => {
    const rated = booking({ status: "paid", feedback: [{ rater: { id: "p1" } }] });
    expect(needsRatingFromProvider(rated, "p1", NOW)).toBeNull();
    // Someone else's rating (the client's) does not count as the provider's.
    expect(needsRatingFromProvider(booking({ status: "paid", feedback: [{ rater: { id: "c1" } }] }), "p1", NOW)).not.toBeNull();
    expect(needsRatingFromProvider(booking({ status: "paid", scheduledAt: at(-20 * 24 * 60) }), "p1", NOW)).toBeNull();
    expect(needsRatingFromProvider(booking({ status: "scheduled" }), "p1", NOW)).toBeNull();
  });
});
