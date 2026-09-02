import { BOOKING_STATUS_TELEMEDICINE_UNATTENDED } from "../schemas/telemedicine";

// Fallback only for screens rendered before GET /telemedicine/policy resolves; once loaded, the
// live joinWindowBeforeMinutes from useTelemedicinePolicy() should always be passed in instead.
// The backend re-enforces the real window itself regardless -- this only gates button visibility.
const JOIN_WINDOW_BEFORE_MINUTES_FALLBACK = 10;
const JOIN_WINDOW_AFTER_MINUTES = 30;
const DEFAULT_DURATION_MINUTES = 60;

// Kenya is currently the only supported country (SUPPORTED_COUNTRY_CODES = ("KE",) on the
// backend), so this is a safe default while the policy query is still loading. The policy
// endpoint remains authoritative when the supported-country configuration expands.
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
  BOOKING_STATUS_TELEMEDICINE_UNATTENDED,
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

// --- Facility-local calendar -------------------------------------------------------------
//
// Appointment slots arrive as UTC instants, but the calendar a client picks from belongs to
// the facility: a Nairobi clinic's Tuesday runs 21:00 Monday to 21:00 Tuesday UTC. Deriving
// "today" or a slot's date from the device clock puts three hours of every day on the wrong
// side of midnight, and the error is invisible -- the times still look plausible.
//
// These helpers do the arithmetic through Intl rather than a date library, since Intl already
// carries the IANA rules and is the same source the formatting below uses.

/** The facility-local calendar date of an instant, as YYYY-MM-DD. */
export const facilityLocalDate = (instant: Date | string, timezone: string): string => {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) return "";
  // en-CA yields ISO-ordered parts, so no reassembly by hand is needed.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
};

/** Today's date in the facility's timezone, as YYYY-MM-DD. */
export const facilityToday = (timezone: string, now: Date = new Date()): string =>
  facilityLocalDate(now, timezone);

/**
 * `count` consecutive facility-local dates starting at `startDate`.
 *
 * Steps by calendar date rather than by adding 24 hours, so a day that a DST transition makes
 * 23 or 25 hours long still advances exactly one day.
 */
export const facilityLocalDateRange = (startDate: string, count: number): string[] => {
  const [year, month, day] = startDate.split("-").map(Number);
  if (!year || !month || !day) return [];
  const dates: string[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    // Constructed in UTC purely as calendar arithmetic; no timezone meaning is implied.
    const cursor = new Date(Date.UTC(year, month - 1, day + offset));
    dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
};

/** Group slots by the facility-local date they fall on. */
export const groupSlotsByFacilityLocalDate = <T extends { startAt: string }>(
  slots: T[],
  timezone: string
): Map<string, T[]> => {
  const grouped = new Map<string, T[]>();
  for (const slot of slots) {
    const key = facilityLocalDate(slot.startAt, timezone);
    if (!key) continue;
    const bucket = grouped.get(key);
    if (bucket) bucket.push(slot);
    else grouped.set(key, [slot]);
  }
  return grouped;
};

/**
 * A weekday and day-of-month label for a facility-local date, for the day strip.
 *
 * Takes no timezone, deliberately. The input is already a facility-local calendar date, so
 * converting it through a zone would shift it again -- for a facility at UTC+14 an anchor of
 * noon UTC lands on the following day. Formatting in UTC against a UTC-constructed date keeps
 * the label showing exactly the date it was handed.
 */
export const facilityLocalDayLabel = (date: string): { weekday: string; day: string } => {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return { weekday: "", day: "" };
  const instant = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(instant.getTime())) return { weekday: "", day: "" };
  return {
    weekday: new Intl.DateTimeFormat(undefined, { timeZone: "UTC", weekday: "short" }).format(instant),
    day: new Intl.DateTimeFormat(undefined, { timeZone: "UTC", day: "numeric" }).format(instant)
  };
};
