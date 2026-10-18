// Which booking statuses a provider's lists ask for. A booked video consultation is "scheduled" until
// it is completed, and one cancelled after payment is "telemedicine_cancelled_payment_review". Lists
// that did not name those statuses never showed a provider the consultations assigned to them, except
// under "All", so the provider saw a booking on one screen and not on another.

export const PROVIDER_UPCOMING_STATUSES = ["scheduled", "accepted", "en_route", "nearby", "arrived", "in_service"] as const;

export const PROVIDER_CANCELLED_STATUSES = [
  "cancelled_by_client",
  "cancelled_by_admin",
  "telemedicine_cancelled_payment_review",
  "expired_no_accept",
  "reassigned"
] as const;
