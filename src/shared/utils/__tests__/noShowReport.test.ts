import { describe, expect, it } from "vitest";

import { NO_SHOW_GRACE_MINUTES, noShowReportState, noShowReportableAt } from "../noShowReport";

const START = new Date("2026-10-22T08:00:00Z").getTime();
const at = (minutesFromStart: number) => START + minutesFromStart * 60_000;

const booking = (overrides: Record<string, unknown> = {}) =>
  ({
    isTelemedicine: true,
    status: "scheduled",
    scheduledAt: new Date(START).toISOString(),
    disputes: [],
    telemedicineSession: { providerJoinedAt: "2026-10-22T07:58:00Z", clientJoinedAt: null },
    ...overrides
  }) as never;

describe("noShowReportState", () => {
  it("offers nothing before the call time, even when the person is already in the call", () => {
    expect(noShowReportState(booking(), "provider", at(-30))).toEqual({ state: "unavailable" });
    expect(noShowReportState(booking({ telemedicineSession: null }), "provider", at(-197))).toEqual({ state: "unavailable" });
  });

  it("tells a person who is waiting when reporting opens, instead of offering it early", () => {
    expect(noShowReportState(booking(), "provider", at(3))).toEqual({
      state: "waiting",
      at: at(NO_SHOW_GRACE_MINUTES)
    });
  });

  it("offers the report once the grace period has passed and the other side is still absent", () => {
    expect(noShowReportState(booking(), "provider", at(NO_SHOW_GRACE_MINUTES))).toEqual({ state: "available" });
    expect(noShowReportState(booking(), "provider", at(25))).toEqual({ state: "available" });
  });

  it("does not offer it to someone who never joined: that is a technical problem, not an absence", () => {
    expect(noShowReportState(booking({ telemedicineSession: null }), "provider", at(25))).toEqual({ state: "unavailable" });
    expect(
      noShowReportState(booking({ telemedicineSession: { providerJoinedAt: null, clientJoinedAt: null } }), "provider", at(25))
    ).toEqual({ state: "unavailable" });
  });

  it("does not offer it when both sides joined", () => {
    const both = { providerJoinedAt: "2026-10-22T07:58:00Z", clientJoinedAt: "2026-10-22T08:02:00Z" };
    expect(noShowReportState(booking({ telemedicineSession: both }), "provider", at(25))).toEqual({ state: "unavailable" });
  });

  it("works the other way round for a client reporting the provider", () => {
    const clientHere = { providerJoinedAt: null, clientJoinedAt: "2026-10-22T07:59:00Z" };
    expect(noShowReportState(booking({ telemedicineSession: clientHere }), "client", at(25))).toEqual({ state: "available" });
    // A provider-only session is not something the client can report.
    expect(noShowReportState(booking(), "client", at(25))).toEqual({ state: "unavailable" });
  });

  it("says a report was already made, instead of offering it again", () => {
    const reported = booking({ disputes: [{ disputeType: "telemedicine_no_show" }] });
    expect(noShowReportState(reported, "provider", at(25))).toEqual({ state: "reported" });
  });

  it("only applies to a scheduled video consultation", () => {
    expect(noShowReportState(booking({ isTelemedicine: false }), "provider", at(25))).toEqual({ state: "unavailable" });
    for (const status of ["fully_completed", "cancelled_by_client", "telemedicine_unattended", "telemedicine_cancelled_payment_review"]) {
      expect(noShowReportState(booking({ status }), "provider", at(25)), status).toEqual({ state: "unavailable" });
    }
  });

  it("offers nothing without an appointment time", () => {
    expect(noShowReportState(booking({ scheduledAt: null }), "provider", at(25))).toEqual({ state: "unavailable" });
    expect(noShowReportableAt({ scheduledAt: null })).toBeNull();
    expect(noShowReportableAt({ scheduledAt: "not a date" })).toBeNull();
  });
});
