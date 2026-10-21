import type { Booking } from "../../../shared/schemas/booking";
import { noShowReportState } from "../../../shared/utils/noShowReport";

// How the provider's Telemedicine page sorts consultations: by what needs doing, with the one to join first.
//  - Now: the soonest consultation that has not finished (the call to join, or the next one).
//  - Needs you: nobody joined (suggest a new time), or the client is absent and a report is possible.
//  - Coming up: the rest of what is ahead, soonest first.
//  - Earlier: finished, cancelled, paid or ended, most recent first, folded away.
// Every status the app knows is in exactly one of OPEN or EARLIER (a test enforces it). `paid` used to fall
// through and show a finished consultation under "upcoming".

export const OPEN_CONSULTATION_STATUSES = [
  "scheduled",
  "telemedicine_unattended",
  "accepted",
  "en_route",
  "nearby",
  "arrived",
  "in_service",
  "requested",
  "broadcasting",
  "telemedicine_payment_pending",
  "telemedicine_paid_pending_assignment"
] as const;

export const EARLIER_CONSULTATION_STATUSES = [
  "completed_by_provider",
  "client_completed",
  "client_confirmed",
  "fully_completed",
  "paid",
  "cancelled_by_client",
  "cancelled_by_admin",
  "expired_no_accept",
  "reassigned",
  "disputed",
  "telemedicine_cancelled_payment_review"
] as const;

/** A call whose session has ended is finished, whatever the booking status still says. */
const sessionEnded = (booking: Booking): boolean =>
  booking.telemedicineSession?.status === "ended" || booking.telemedicineSession?.status === "expired";

export const isEarlierConsultation = (booking: Booking): boolean =>
  sessionEnded(booking) || (EARLIER_CONSULTATION_STATUSES as readonly string[]).includes(booking.status);

const timeOf = (booking: Booking): number => {
  const time = booking.scheduledAt ? new Date(booking.scheduledAt).getTime() : NaN;
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
};

export const sortOpen = (bookings: readonly Booking[]): Booking[] => [...bookings].sort((a, b) => timeOf(a) - timeOf(b));
export const sortEarlier = (bookings: readonly Booking[]): Booking[] => [...bookings].sort((a, b) => timeOf(b) - timeOf(a));

const GRACE_AFTER_START_MS = 30 * 60_000;

/** The consultation to feature: the soonest scheduled one that has not been over for long. */
export const pickNowConsultation = (open: readonly Booking[], now: number): Booking | null =>
  open.find((booking) => {
    if (booking.status !== "scheduled" || !booking.scheduledAt) return false;
    const start = new Date(booking.scheduledAt).getTime();
    const duration = (booking.estimateDurationMinutes ?? 30) * 60_000;
    return !Number.isNaN(start) && start + duration + GRACE_AFTER_START_MS >= now;
  }) ?? null;

export type ProviderNeedsKind = "new_time" | "report";

export type ProviderNeedsItem = { kind: ProviderNeedsKind; booking: Booking; message: string; action: string };

export const needsYouForConsultation = (booking: Booking, now: number): ProviderNeedsItem | null => {
  if (booking.status === "telemedicine_unattended") {
    return { kind: "new_time", booking, message: "Nobody joined. Suggest a new time", action: "Choose a time" };
  }
  if (noShowReportState(booking, "provider", now).state === "available") {
    const who = booking.client?.fullName;
    return { kind: "report", booking, message: `${who ?? "Your client"} has not joined. You can report it`, action: "Report" };
  }
  return null;
};
