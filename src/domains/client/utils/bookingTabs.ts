// The status filters on a client's My Bookings, and which booking statuses each one holds. Every status the
// app knows belongs to exactly one tab (a test enforces it), so a booking never shows under "All" only. Video
// consultations have their own pre-service states (awaiting payment, awaiting a provider, unattended,
// cancelled with payment under review); leaving them out hid those bookings from every tab but "All".

export type ClientBookingTabKey = "all" | "pending" | "upcoming" | "active" | "completed" | "cancelled";

export type ClientBookingTab = {
  key: ClientBookingTabKey;
  label: string;
  /** What the tab means, in a sentence, for the screen-reader label and the empty state. */
  meaning: string;
  statuses: readonly string[];
};

export const CLIENT_BOOKING_TABS: readonly ClientBookingTab[] = [
  { key: "all", label: "All", meaning: "every booking", statuses: [] },
  {
    key: "pending",
    label: "Pending",
    meaning: "waiting for payment, a provider or your answer",
    statuses: [
      "requested",
      "broadcasting",
      "reassigned",
      "disputed",
      "telemedicine_payment_pending",
      "telemedicine_paid_pending_assignment",
      "telemedicine_unattended"
    ]
  },
  { key: "upcoming", label: "Upcoming", meaning: "confirmed appointments that have not started", statuses: ["scheduled"] },
  {
    key: "active",
    label: "Active",
    meaning: "under way, or waiting for you to confirm",
    statuses: ["accepted", "en_route", "nearby", "arrived", "in_service", "completed_by_provider"]
  },
  {
    key: "completed",
    label: "Completed",
    meaning: "finished",
    statuses: ["client_completed", "client_confirmed", "fully_completed", "paid"]
  },
  {
    key: "cancelled",
    label: "Cancelled",
    meaning: "cancelled or expired",
    statuses: ["cancelled_by_client", "cancelled_by_admin", "expired_no_accept", "telemedicine_cancelled_payment_review"]
  }
];

export const tabForStatus = (status: string): ClientBookingTabKey | null =>
  CLIENT_BOOKING_TABS.find((tab) => tab.statuses.includes(status))?.key ?? null;
