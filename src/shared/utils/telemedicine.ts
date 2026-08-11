// Mirrors JOIN_WINDOW_BEFORE_MINUTES/JOIN_WINDOW_AFTER_MINUTES in
// app/services/telemedicine_session_service.py -- purely for showing/hiding the "Join call"
// button; the backend re-enforces this window itself and is the actual authority.
const JOIN_WINDOW_BEFORE_MINUTES = 10;
const JOIN_WINDOW_AFTER_MINUTES = 30;
const DEFAULT_DURATION_MINUTES = 60;

export const isWithinJoinWindow = (
  scheduledAt: string | null,
  estimateDurationMinutes: number | null,
  now = Date.now()
): boolean => {
  if (!scheduledAt) return false;
  const start = new Date(scheduledAt).getTime();
  if (Number.isNaN(start)) return false;
  const durationMs = (estimateDurationMinutes ?? DEFAULT_DURATION_MINUTES) * 60_000;
  const windowStart = start - JOIN_WINDOW_BEFORE_MINUTES * 60_000;
  const windowEnd = start + durationMs + JOIN_WINDOW_AFTER_MINUTES * 60_000;
  return now >= windowStart && now <= windowEnd;
};
