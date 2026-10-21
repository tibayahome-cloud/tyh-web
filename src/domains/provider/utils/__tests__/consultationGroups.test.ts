import { describe, expect, it } from "vitest";

import { KNOWN_BOOKING_STATUSES } from "../../../../shared/utils/bookingStatus";
import {
  EARLIER_CONSULTATION_STATUSES,
  OPEN_CONSULTATION_STATUSES,
  isEarlierConsultation,
  needsYouForConsultation,
  pickNowConsultation,
  sortEarlier,
  sortOpen
} from "../consultationGroups";

const NOW = new Date("2026-10-22T08:00:00Z").getTime();
const at = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();

const booking = (overrides: Record<string, unknown> = {}) =>
  ({
    id: "b",
    status: "scheduled",
    isTelemedicine: true,
    scheduledAt: at(60),
    estimateDurationMinutes: 30,
    disputes: [],
    client: { fullName: "Amina Client" },
    telemedicineSession: null,
    ...overrides
  }) as never;

const ids = (list: unknown[]) => list.map((item) => (item as { id: string }).id);

describe("consultation groups", () => {
  it("places every known status in exactly one of open or earlier", () => {
    for (const status of KNOWN_BOOKING_STATUSES) {
      const inOpen = (OPEN_CONSULTATION_STATUSES as readonly string[]).includes(status);
      const inEarlier = (EARLIER_CONSULTATION_STATUSES as readonly string[]).includes(status);
      expect(inOpen !== inEarlier, `status ${status}`).toBe(true);
    }
  });

  it("puts a paid consultation in earlier, not upcoming", () => {
    expect(isEarlierConsultation(booking({ status: "paid" }))).toBe(true);
  });

  it("treats a call whose session has ended as earlier, whatever the booking says", () => {
    expect(isEarlierConsultation(booking({ telemedicineSession: { status: "ended" } }))).toBe(true);
    expect(isEarlierConsultation(booking({ telemedicineSession: { status: "in_progress" } }))).toBe(false);
  });

  it("keeps an unattended consultation open, because it needs the provider", () => {
    expect(isEarlierConsultation(booking({ status: "telemedicine_unattended" }))).toBe(false);
  });
});

describe("ordering and the one to feature", () => {
  it("sorts open soonest first and earlier most recent first", () => {
    const a = booking({ id: "a", scheduledAt: at(300) });
    const b = booking({ id: "b", scheduledAt: at(20) });
    expect(ids(sortOpen([a, b]))).toEqual(["b", "a"]);
    expect(ids(sortEarlier([a, b]))).toEqual(["a", "b"]);
  });

  it("features the soonest scheduled consultation, so a call that is open is first", () => {
    const open = sortOpen([booking({ id: "later", scheduledAt: at(1500) }), booking({ id: "now", scheduledAt: at(5) })]);
    expect(ids([pickNowConsultation(open, NOW)])).toEqual(["now"]);
  });

  it("still features a call that began a few minutes ago, but not one long over", () => {
    expect(pickNowConsultation([booking({ scheduledAt: at(-20) })], NOW)).not.toBeNull();
    expect(pickNowConsultation([booking({ scheduledAt: at(-120) })], NOW)).toBeNull();
  });

  it("does not feature an unattended or unassigned consultation", () => {
    expect(pickNowConsultation([booking({ status: "telemedicine_unattended" })], NOW)).toBeNull();
    expect(pickNowConsultation([], NOW)).toBeNull();
  });
});

describe("needs you", () => {
  it("asks for a new time when nobody joined", () => {
    expect(needsYouForConsultation(booking({ status: "telemedicine_unattended" }), NOW)?.kind).toBe("new_time");
  });

  it("offers a report only once the client is absent past the grace and the provider was there", () => {
    const here = { providerJoinedAt: at(-14), clientJoinedAt: null, status: "scheduled" };
    expect(needsYouForConsultation(booking({ scheduledAt: at(-15), telemedicineSession: here }), NOW)).toMatchObject({
      kind: "report",
      message: "Amina Client has not joined. You can report it"
    });
    expect(needsYouForConsultation(booking({ scheduledAt: at(-3), telemedicineSession: here }), NOW)).toBeNull();
    expect(needsYouForConsultation(booking({ scheduledAt: at(-15), telemedicineSession: null }), NOW)).toBeNull();
  });

  it("asks for nothing on an ordinary upcoming consultation", () => {
    expect(needsYouForConsultation(booking(), NOW)).toBeNull();
  });
});
