import type { Booking } from "../../../shared/schemas/booking";

// How My bookings sorts a client's bookings: by what they need to do, not by system status.
//  - Needs you: something is waiting for the client (pay, confirm a visit, choose a new time, rate a visit).
//  - Coming up: everything still ahead or in progress, soonest first.
//  - Earlier: finished, cancelled or expired.
// Every status the app knows is in exactly one of OPEN or EARLIER (a test enforces it), so a booking never falls
// out of the page. Video-consultation states (awaiting payment, awaiting a provider, unattended, cancelled with
// payment under review) are named here too.

/** Still ahead, in progress, or waiting on someone. */
export const OPEN_BOOKING_STATUSES = [
  "requested",
  "broadcasting",
  "reassigned",
  "disputed",
  "scheduled",
  "accepted",
  "en_route",
  "nearby",
  "arrived",
  "in_service",
  "completed_by_provider",
  "telemedicine_payment_pending",
  "telemedicine_paid_pending_assignment",
  "telemedicine_unattended"
] as const;

/** Finished, cancelled or expired. */
export const EARLIER_BOOKING_STATUSES = [
  "client_completed",
  "client_confirmed",
  "fully_completed",
  "paid",
  "cancelled_by_client",
  "cancelled_by_admin",
  "expired_no_accept",
  "telemedicine_cancelled_payment_review"
] as const;

const RATABLE_STATUSES = ["fully_completed", "paid", "client_completed"];
/** A rating prompt is shown for a little while after the visit, then it is left alone. */
const RATING_PROMPT_DAYS = 14;

export type NeedsYouKind = "pay" | "confirm" | "choose_time" | "rate";

export type NeedsYouItem = {
  kind: NeedsYouKind;
  booking: Booking;
  /** Plain words: what is waiting. */
  message: string;
  /** The button label. */
  action: string;
};

export const needsYouForOpenBooking = (booking: Booking): NeedsYouItem | null => {
  switch (booking.status) {
    case "telemedicine_payment_pending":
      return { kind: "pay", booking, message: "Pay to confirm your consultation", action: "Complete payment" };
    case "completed_by_provider":
      return { kind: "confirm", booking, message: "Confirm that your visit is complete", action: "Review" };
    case "telemedicine_unattended":
      return { kind: "choose_time", booking, message: "Nobody joined your consultation. Choose a new time", action: "Choose a time" };
    default:
      return null;
  }
};

export const needsYouForRating = (booking: Booking, now: number): NeedsYouItem | null => {
  if (!RATABLE_STATUSES.includes(booking.status) || booking.feedback?.length) return null;
  const when = booking.scheduledAt ?? booking.createdAt;
  const time = when ? new Date(when).getTime() : NaN;
  if (Number.isNaN(time) || now - time > RATING_PROMPT_DAYS * 24 * 60 * 60_000) return null;
  const who = booking.provider?.fullName;
  return { kind: "rate", booking, message: who ? `Rate your visit with ${who}` : "Rate your visit", action: "Rate" };
};

const timeOf = (booking: Booking): number => {
  const value = booking.scheduledAt ?? booking.createdAt;
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
};

/** Open bookings, soonest first. A booking with no appointment yet (waiting for a provider) sorts by when it was asked for. */
export const sortComingUp = (bookings: readonly Booking[]): Booking[] => [...bookings].sort((a, b) => timeOf(a) - timeOf(b));

/** Earlier bookings, most recent first. */
export const sortEarlier = (bookings: readonly Booking[]): Booking[] => [...bookings].sort((a, b) => timeOf(b) - timeOf(a));

const NEXT_STATUSES = ["scheduled"];

/**
 * The consultation to feature at the top: the soonest scheduled telemedicine booking that has not finished. The
 * call can be joined a little before and for a while after the start, so a call that began a few minutes ago still
 * counts as next.
 */
export const pickNextConsultation = (comingUp: readonly Booking[], now: number): Booking | null => {
  const GRACE_AFTER_START_MS = 30 * 60_000;
  return (
    comingUp.find((booking) => {
      // Nothing to join until a doctor is assigned, so an unassigned request is never "next".
      if (!booking.isTelemedicine || !booking.provider || !NEXT_STATUSES.includes(booking.status) || !booking.scheduledAt) return false;
      const start = new Date(booking.scheduledAt).getTime();
      return !Number.isNaN(start) && start + GRACE_AFTER_START_MS >= now;
    }) ?? null
  );
};
