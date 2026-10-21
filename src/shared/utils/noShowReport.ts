import type { Booking } from "../schemas/booking";
import { TELEMEDICINE_DISPUTE_TYPE_NO_SHOW } from "../schemas/telemedicine";

// When a person may say "the other side did not join". A report asks the team to review a call that did not
// happen, so it is offered only once there is something to report: the appointment time has passed by the
// grace period, the person was there themselves and the other side was not, and nothing was reported already.
// The server refuses an early report too (see report_no_show); this stops the screen offering what would fail.

// The server's grace period (NO_SHOW_GRACE_MINUTES in the telemedicine service). It is not in the policy the
// server sends yet, so it is repeated here; tyh-api tracks exposing it.
export const NO_SHOW_GRACE_MINUTES = 10;

export type NoShowRole = "client" | "provider";

type Reportable = Pick<Booking, "isTelemedicine" | "status" | "scheduledAt" | "disputes" | "telemedicineSession">;

/** The moment a report becomes possible, or null when the booking has no appointment time. */
export const noShowReportableAt = (booking: Pick<Booking, "scheduledAt">): number | null => {
  if (!booking.scheduledAt) return null;
  const start = new Date(booking.scheduledAt).getTime();
  return Number.isNaN(start) ? null : start + NO_SHOW_GRACE_MINUTES * 60_000;
};

export type NoShowState =
  | { state: "reported" }
  | { state: "available" }
  /** The person is in the call and the other side has not come yet; reporting opens at `at`. */
  | { state: "waiting"; at: number }
  | { state: "unavailable" };

export const noShowReportState = (booking: Reportable, role: NoShowRole, now: number): NoShowState => {
  if (!booking.isTelemedicine || booking.status !== "scheduled") return { state: "unavailable" };
  if (booking.disputes?.some((dispute) => dispute.disputeType === TELEMEDICINE_DISPUTE_TYPE_NO_SHOW)) return { state: "reported" };

  const reportableAt = noShowReportableAt(booking);
  if (reportableAt === null) return { state: "unavailable" };

  const session = booking.telemedicineSession;
  const mine = role === "provider" ? session?.providerJoinedAt : session?.clientJoinedAt;
  const theirs = role === "provider" ? session?.clientJoinedAt : session?.providerJoinedAt;
  // Someone who never joined cannot say the other side was absent (a connection problem is a technical issue),
  // and if both joined there is nothing to report.
  if (!mine || theirs) return { state: "unavailable" };

  // Before the appointment time there is nothing to wait for, so nothing is shown at all.
  if (now < reportableAt - NO_SHOW_GRACE_MINUTES * 60_000) return { state: "unavailable" };
  return now >= reportableAt ? { state: "available" } : { state: "waiting", at: reportableAt };
};
