export type BookingDateFilter = "all" | "upcoming" | "today" | "7d" | "30d";

export type BookingDateRange = {
  from?: string;
  to?: string;
  scheduledFrom?: string;
};

// "Upcoming" filters on the appointment time. The other ranges filter on when the booking was made, and
// end at now, so none of them can ever show an appointment that is still in the future -- a rescheduled
// consultation vanished from the list the moment it was moved.
export const computeBookingDateRange = (value: string, now: Date = new Date()): BookingDateRange => {
  if (value === "upcoming") {
    return { scheduledFrom: now.toISOString() };
  }
  if (value === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  if (value === "7d" || value === "30d") {
    const from = new Date(now);
    from.setDate(from.getDate() - (value === "7d" ? 7 : 30));
    return { from: from.toISOString(), to: now.toISOString() };
  }
  return {};
};
