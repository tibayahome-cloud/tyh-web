import { describe, expect, it } from "vitest";

import type { ReviewItem } from "../../../../shared/libs/telemedicineOps";
import { ANSWERED_ELSEWHERE, CATEGORIES, CATEGORY_LABEL, ageOf, countByCategory, formatMoney, oldestFirst, outcomeEffect } from "../reviewQueue";

const NOW = new Date("2026-10-21T12:00:00Z").getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

const item = (overrides: Partial<ReviewItem> = {}): ReviewItem => ({
  category: "payment_review",
  id: "i1",
  status: "open",
  bookingId: "b1",
  facilityId: "f1",
  scheduledAt: null,
  paymentId: null,
  openedAt: hoursAgo(1),
  summary: null,
  clientName: "Amina Client",
  providerName: null,
  serviceName: "Consultation",
  outcomes: [
    { key: "refund_full", label: "Refund the client in full", effect: "Sends the whole payment back to the client." },
    { key: "no_action", label: "No action needed", effect: "Closes this item. No money moves." }
  ],
  refundableAmountCents: 150000,
  refundableCurrency: "KES",
  ...overrides
});

describe("categories", () => {
  it("labels every kind the server can report, including client complaints", () => {
    expect(CATEGORIES.sort()).toEqual([
      "cancellation_payment_review",
      "no_show",
      "payment_review",
      "provider_earnings_complaint",
      "reschedule_escalation",
      "technical_issue"
    ]);
    expect(CATEGORY_LABEL.provider_earnings_complaint).toBe("Client complaint about a visit");
    expect(Object.values(CATEGORY_LABEL).join(" ")).not.toMatch(/telemedicine_|_review/);
  });

  it("only diverts the kind that is answered on the booking", () => {
    expect(Object.keys(ANSWERED_ELSEWHERE)).toEqual(["reschedule_escalation"]);
  });
});

describe("ageOf", () => {
  it("reads minutes, hours and days, and marks anything over a day", () => {
    expect(ageOf(hoursAgo(0.2), NOW)).toEqual({ label: "Open for less than an hour", overdue: false });
    expect(ageOf(hoursAgo(1), NOW)).toEqual({ label: "Open for 1 hour", overdue: false });
    expect(ageOf(hoursAgo(5), NOW)).toEqual({ label: "Open for 5 hours", overdue: false });
    expect(ageOf(hoursAgo(24), NOW)).toEqual({ label: "Open for 1 day", overdue: true });
    expect(ageOf(hoursAgo(75), NOW)).toEqual({ label: "Open for 3 days", overdue: true });
  });
});

describe("ordering and counts", () => {
  it("puts the item that has waited longest first", () => {
    const order = oldestFirst([item({ id: "new", openedAt: hoursAgo(1) }), item({ id: "old", openedAt: hoursAgo(50) })]);
    expect(order.map((i) => i.id)).toEqual(["old", "new"]);
  });

  it("counts open items per kind", () => {
    const counts = countByCategory([item(), item({ id: "2" }), item({ id: "3", category: "no_show" })]);
    expect(counts.payment_review).toBe(2);
    expect(counts.no_show).toBe(1);
    expect(counts.technical_issue).toBe(0);
  });
});

describe("outcomeEffect", () => {
  it("shows the amount a refund will send, from the server's figure", () => {
    expect(outcomeEffect(item(), "refund_full")).toBe("Sends KES 1,500 back to the client.");
  });

  it("says plainly when nothing moves", () => {
    expect(outcomeEffect(item(), "no_action")).toBe("Closes this item. No money moves.");
  });

  it("formats money with its unit", () => {
    expect(formatMoney(250000, "KES")).toBe("KES 2,500");
  });
});
