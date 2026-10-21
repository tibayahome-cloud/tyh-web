import type { Booking } from "../../../shared/schemas/booking";

// How the provider's Bookings page sorts every booking they hold, home visits and telemedicine together, by what
// needs doing: a call to join, anything waiting on them, a visit under way, what is coming up, and everything
// earlier folded away. Every status the app knows is in exactly one of OPEN or EARLIER (a test enforces it).
// `completed_by_provider` stays open: the provider has finished but the client has not paid yet.

export const OPEN_PROVIDER_BOOKING_STATUSES = [
  "scheduled",
  "accepted",
  "en_route",
  "nearby",
  "arrived",
  "in_service",
  "completed_by_provider",
  "telemedicine_unattended",
  "requested",
  "broadcasting",
  "telemedicine_payment_pending",
  "telemedicine_paid_pending_assignment"
] as const;

export const EARLIER_PROVIDER_BOOKING_STATUSES = [
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

const VISIT_UNDER_WAY = ["accepted", "en_route", "nearby", "arrived", "in_service"];

/** A home visit the provider is in the middle of: the urgent thing on a day of visits. */
export const isVisitUnderWay = (booking: Booking): boolean => !booking.isTelemedicine && VISIT_UNDER_WAY.includes(booking.status);

const RATABLE_STATUSES = ["fully_completed", "paid", "client_completed"];
const RATING_PROMPT_DAYS = 14;

export type ProviderBookingNeedsKind = "new_time" | "rate";
export type ProviderBookingNeeds = { kind: ProviderBookingNeedsKind; booking: Booking; message: string; action: string };

export const needsYouForOpenBooking = (booking: Booking): ProviderBookingNeeds | null =>
  booking.status === "telemedicine_unattended"
    ? { kind: "new_time", booking, message: "Nobody joined. Suggest a new time", action: "Choose a time" }
    : null;

/** A recent finished visit the provider has not rated the client for. */
export const needsRatingFromProvider = (booking: Booking, providerId: string | undefined, now: number): ProviderBookingNeeds | null => {
  if (!RATABLE_STATUSES.includes(booking.status)) return null;
  if (providerId && booking.feedback?.some((entry) => entry.rater?.id === providerId)) return null;
  const when = booking.scheduledAt ?? booking.createdAt;
  const time = when ? new Date(when).getTime() : NaN;
  if (Number.isNaN(time) || now - time > RATING_PROMPT_DAYS * 24 * 60 * 60_000) return null;
  const who = booking.client?.fullName;
  return { kind: "rate", booking, message: who ? `Rate your visit with ${who}` : "Rate your visit", action: "Rate" };
};
