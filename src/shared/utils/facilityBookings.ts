// How a facility's bookings are grouped for the admin: by what needs doing, not by the thirty-odd
// internal statuses. Every status the API can return belongs to exactly one group.

export type BookingGroup = "attention" | "active" | "completed" | "cancelled" | "all";

export const BOOKING_GROUP_LABEL: Record<BookingGroup, string> = {
  attention: "Needs attention",
  active: "Upcoming and active",
  completed: "Completed",
  cancelled: "Cancelled",
  all: "All"
};

export const BOOKING_GROUP_STATUSES: Record<Exclude<BookingGroup, "all">, string[]> = {
  attention: [
    "requested",
    "broadcasting",
    "expired_no_accept",
    "disputed",
    "telemedicine_paid_pending_assignment",
    "telemedicine_cancelled_payment_review",
    "telemedicine_unattended"
  ],
  active: ["scheduled", "accepted", "en_route", "nearby", "arrived", "in_service", "reassigned", "telemedicine_payment_pending"],
  completed: ["completed_by_provider", "client_completed", "fully_completed", "client_confirmed", "paid"],
  cancelled: ["cancelled_by_client", "cancelled_by_admin"]
};

export const BOOKING_GROUPS: BookingGroup[] = ["attention", "active", "completed", "cancelled", "all"];

// The value for filter[status], or undefined to ask for everything.
export const statusFilterFor = (group: BookingGroup): string | undefined =>
  group === "all" ? undefined : BOOKING_GROUP_STATUSES[group].join(",");

export const groupCount = (group: BookingGroup, byStatus: Record<string, number>, total: number): number =>
  group === "all" ? total : BOOKING_GROUP_STATUSES[group].reduce((sum, status) => sum + (byStatus[status] ?? 0), 0);

export const groupOfStatus = (status: string): Exclude<BookingGroup, "all"> | null =>
  (Object.keys(BOOKING_GROUP_STATUSES) as Array<Exclude<BookingGroup, "all">>).find((group) => BOOKING_GROUP_STATUSES[group].includes(status)) ?? null;

// A provider can be assigned or changed only before the appointment starts. The API makes the
// final call; this decides whether to offer the button.
const ASSIGNABLE = new Set([
  "requested",
  "broadcasting",
  "scheduled",
  "accepted",
  "expired_no_accept",
  "reassigned",
  "telemedicine_paid_pending_assignment"
]);
export const canAssignStatus = (status: string): boolean => ASSIGNABLE.has(status);

type SessionLike = { providerJoinedAt?: string | null; clientJoinedAt?: string | null } | null | undefined;

// Once either person has joined the video call the consultation is under way, and the API refuses to
// swap the provider underneath it. Say so instead of offering a button that can only fail.
export const assignBlockedReason = (booking: { isTelemedicine?: boolean; telemedicineSession?: SessionLike }): string | null =>
  booking.isTelemedicine && (booking.telemedicineSession?.providerJoinedAt || booking.telemedicineSession?.clientJoinedAt)
    ? "The telemedicine consultation has already started, so the provider can no longer be changed."
    : null;

export const statusLabel = (status: string): string => {
  const text = status.replace(/^telemedicine_/, "").replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};
