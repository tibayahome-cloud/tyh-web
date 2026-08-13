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
