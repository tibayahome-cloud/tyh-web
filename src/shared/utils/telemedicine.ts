// Fallback only for screens rendered before GET /telemedicine/policy resolves; once loaded, the
// live joinWindowBeforeMinutes from useTelemedicinePolicy() should always be passed in instead.
// The backend re-enforces the real window itself regardless -- this only gates button visibility.
const JOIN_WINDOW_BEFORE_MINUTES_FALLBACK = 10;
const JOIN_WINDOW_AFTER_MINUTES = 30;
const DEFAULT_DURATION_MINUTES = 60;

// Kenya is the only supported country in V1.2 (SUPPORTED_COUNTRY_CODES = ("KE",) on the
// backend), so this is a safe non-arbitrary default while the policy query is still loading --
// not a guess, the only value it could currently be.
export const TELEMEDICINE_DEFAULT_TIMEZONE = "Africa/Nairobi";

export const isWithinJoinWindow = (
  scheduledAt: string | null,
  estimateDurationMinutes: number | null,
  now = Date.now(),
  joinWindowBeforeMinutes = JOIN_WINDOW_BEFORE_MINUTES_FALLBACK
): boolean => {
  if (!scheduledAt) return false;
  const start = new Date(scheduledAt).getTime();
  if (Number.isNaN(start)) return false;
  const durationMs = (estimateDurationMinutes ?? DEFAULT_DURATION_MINUTES) * 60_000;
  const windowStart = start - joinWindowBeforeMinutes * 60_000;
  const windowEnd = start + durationMs + JOIN_WINDOW_AFTER_MINUTES * 60_000;
  return now >= windowStart && now <= windowEnd;
};

// Mirrors report_technical_issue's window in app/services/telemedicine_service.py exactly:
// scheduled_at - join_window_before_minutes, through scheduled_at + duration + 30min +
// TECHNICAL_ISSUE_REPORT_AFTER_HOURS (24h). This is deliberately not the same window as
// isWithinJoinWindow -- reporting stays open for a day after the call, joining does not.
const TECHNICAL_ISSUE_REPORT_AFTER_HOURS = 24;

export const isWithinTechnicalIssueReportWindow = (
  scheduledAt: string | null,
  estimateDurationMinutes: number | null,
  now = Date.now(),
  joinWindowBeforeMinutes = JOIN_WINDOW_BEFORE_MINUTES_FALLBACK
): boolean => {
  if (!scheduledAt) return false;
  const start = new Date(scheduledAt).getTime();
  if (Number.isNaN(start)) return false;
  const durationMs = (estimateDurationMinutes ?? DEFAULT_DURATION_MINUTES) * 60_000;
  const windowStart = start - joinWindowBeforeMinutes * 60_000;
  const windowEnd = start + durationMs + JOIN_WINDOW_AFTER_MINUTES * 60_000 + TECHNICAL_ISSUE_REPORT_AFTER_HOURS * 60 * 60_000;
  return now >= windowStart && now <= windowEnd;
};

// Appointments are anchored to the facility's operating timezone, not the viewer's device
// timezone -- a client checking a Nairobi appointment while traveling, or with a misconfigured
// device clock, must still see the real local time of the consultation.
export const formatTelemedicineDateTime = (
  iso: string | null | undefined,
  timezone: string = TELEMEDICINE_DEFAULT_TIMEZONE,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
): string => {
  if (!iso) return "Not scheduled";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: timezone }).format(date);
};

const TERMINAL_TELEMEDICINE_BOOKING_STATUSES = new Set([
  "fully_completed",
  "completed_by_provider",
  "client_completed",
  "client_confirmed",
  "cancelled_by_client",
  "cancelled_by_admin",
  "expired_no_accept",
  "telemedicine_cancelled_payment_review",
  "disputed"
]);

export const isHistoricalTelemedicineBooking = (booking: {
  status: string;
  telemedicineSession?: { status?: string | null } | null;
}): boolean => {
  if (TERMINAL_TELEMEDICINE_BOOKING_STATUSES.has(booking.status)) return true;
  return booking.telemedicineSession?.status === "ended" || booking.telemedicineSession?.status === "expired";
};

export const splitTelemedicineBookings = <T extends { status: string; telemedicineSession?: { status?: string | null } | null }>(
  bookings: T[]
) => ({
  upcoming: bookings.filter((booking) => !isHistoricalTelemedicineBooking(booking)),
  history: bookings.filter(isHistoricalTelemedicineBooking)
});
