import { describe, expect, it } from "vitest";

import { KNOWN_BOOKING_STATUSES } from "../../../../shared/utils/bookingStatus";
import {
  EARLIER_BOOKING_STATUSES,
  OPEN_BOOKING_STATUSES,
  needsYouForOpenBooking,
  needsYouForRating,
  pickNextConsultation,
  sortComingUp,
  sortEarlier
} from "../bookingGroups";

const NOW = new Date("2026-10-22T08:00:00Z").getTime();
const minutes = (n: number) => new Date(NOW + n * 60_000).toISOString();

const booking = (overrides: Record<string, unknown> = {}) =>
  ({
    id: "b",
    status: "scheduled",
    isTelemedicine: true,
    scheduledAt: minutes(60),
    createdAt: minutes(-600),
    feedback: [],
    provider: { fullName: "Dr Example" },
    ...overrides
  }) as never;

describe("booking groups", () => {
  it("places every known status in exactly one of open or earlier", () => {
    for (const status of KNOWN_BOOKING_STATUSES) {
      const inOpen = (OPEN_BOOKING_STATUSES as readonly string[]).includes(status);
      const inEarlier = (EARLIER_BOOKING_STATUSES as readonly string[]).includes(status);
      expect(inOpen !== inEarlier, `status ${status}`).toBe(true);
    }
  });

  it("lists no status the app does not know", () => {
    const known = new Set(KNOWN_BOOKING_STATUSES);
    for (const status of [...OPEN_BOOKING_STATUSES, ...EARLIER_BOOKING_STATUSES]) expect(known.has(status), status).toBe(true);
  });

  it("keeps the video-consultation states where a person would look", () => {
    for (const status of ["telemedicine_payment_pending", "telemedicine_paid_pending_assignment", "telemedicine_unattended"]) {
      expect(OPEN_BOOKING_STATUSES).toContain(status);
    }
    expect(EARLIER_BOOKING_STATUSES).toContain("telemedicine_cancelled_payment_review");
  });
});

describe("needs you", () => {
  it("asks for payment, a confirmation, or a new time", () => {
    expect(needsYouForOpenBooking(booking({ status: "telemedicine_payment_pending" }))?.kind).toBe("pay");
    expect(needsYouForOpenBooking(booking({ status: "completed_by_provider" }))?.kind).toBe("confirm");
    expect(needsYouForOpenBooking(booking({ status: "telemedicine_unattended" }))?.kind).toBe("choose_time");
  });

  it("asks for nothing on an ordinary upcoming booking", () => {
    expect(needsYouForOpenBooking(booking())).toBeNull();
    expect(needsYouForOpenBooking(booking({ status: "telemedicine_paid_pending_assignment" }))).toBeNull();
  });

  it("asks for a rating on a recent finished visit that has none, and names the provider", () => {
    const done = booking({ status: "fully_completed", scheduledAt: minutes(-2 * 24 * 60) });
    expect(needsYouForRating(done, NOW)).toMatchObject({ kind: "rate", message: "Rate your visit with Dr Example" });
  });

  it("stops asking once rated, or after two weeks, or for an unfinished or cancelled visit", () => {
    const base = { status: "fully_completed", scheduledAt: minutes(-2 * 24 * 60) };
    expect(needsYouForRating(booking({ ...base, feedback: [{ id: "f" }] }), NOW)).toBeNull();
    expect(needsYouForRating(booking({ ...base, scheduledAt: minutes(-20 * 24 * 60) }), NOW)).toBeNull();
    expect(needsYouForRating(booking({ status: "cancelled_by_client" }), NOW)).toBeNull();
    expect(needsYouForRating(booking({ status: "scheduled" }), NOW)).toBeNull();
  });
});

describe("ordering", () => {
  it("puts coming up soonest first, and a booking with no time by when it was asked for", () => {
    const later = booking({ id: "later", scheduledAt: minutes(300) });
    const soon = booking({ id: "soon", scheduledAt: minutes(30) });
    const waiting = booking({ id: "waiting", scheduledAt: null, status: "requested", createdAt: minutes(-5) });
    expect(sortComingUp([later, soon, waiting]).map((b: { id: string }) => b.id)).toEqual(["waiting", "soon", "later"]);
  });

  it("puts earlier most recent first", () => {
    const old = booking({ id: "old", scheduledAt: minutes(-5000) });
    const recent = booking({ id: "recent", scheduledAt: minutes(-100) });
    expect(sortEarlier([old, recent]).map((b: { id: string }) => b.id)).toEqual(["recent", "old"]);
  });
});

describe("pickNextConsultation", () => {
  it("features the soonest scheduled telemedicine booking", () => {
    const a = booking({ id: "a", scheduledAt: minutes(20) });
    const b = booking({ id: "b", scheduledAt: minutes(120) });
    expect((pickNextConsultation([a, b], NOW) as unknown as { id: string }).id).toBe("a");
  });

  it("still features a call that began a few minutes ago, but not one long over", () => {
    expect(pickNextConsultation([booking({ scheduledAt: minutes(-10) })], NOW)).not.toBeNull();
    expect(pickNextConsultation([booking({ scheduledAt: minutes(-90) })], NOW)).toBeNull();
  });

  it("skips home visits, bookings still being matched, and anything else", () => {
    expect(pickNextConsultation([booking({ isTelemedicine: false })], NOW)).toBeNull();
    expect(pickNextConsultation([booking({ status: "telemedicine_paid_pending_assignment" })], NOW)).toBeNull();
    expect(pickNextConsultation([], NOW)).toBeNull();
  });
});
