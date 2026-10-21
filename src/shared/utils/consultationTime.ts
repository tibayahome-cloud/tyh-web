import { formatTelemedicineDateTime, TELEMEDICINE_DEFAULT_TIMEZONE } from "./telemedicine";

// A consultation's date and time in the words people use, always in the facility's timezone (the call is
// anchored to the facility, not to wherever the device is). Date and time are separate so a screen can make
// the date large and the time range smaller.

/** "Africa/Nairobi" -> "Nairobi time". Falls back to the raw zone name for anything unusual. */
export const describeTimezone = (timezone: string | undefined): string => {
  const zone = timezone || TELEMEDICINE_DEFAULT_TIMEZONE;
  const city = zone.split("/").pop()?.replace(/_/g, " ");
  return city ? `${city} time` : zone;
};

export const consultationDateLabel = (scheduledAt: string | null | undefined, timezone: string | undefined): string | null => {
  if (!scheduledAt || Number.isNaN(new Date(scheduledAt).getTime())) return null;
  return formatTelemedicineDateTime(scheduledAt, timezone, { weekday: "long", day: "numeric", month: "long" });
};

const timeOnly = { hour: "2-digit", minute: "2-digit", hour12: false } as const;

/** "11:40 to 12:10", or just the start when the length is unknown. */
export const consultationTimeRange = (
  scheduledAt: string | null | undefined,
  durationMinutes: number | null | undefined,
  timezone: string | undefined
): string | null => {
  if (!scheduledAt) return null;
  const start = new Date(scheduledAt);
  if (Number.isNaN(start.getTime())) return null;
  const from = formatTelemedicineDateTime(scheduledAt, timezone, timeOnly);
  if (!durationMinutes || durationMinutes <= 0) return from;
  const to = formatTelemedicineDateTime(new Date(start.getTime() + durationMinutes * 60_000).toISOString(), timezone, timeOnly);
  return `${from} to ${to}`;
};

/** The time the call opens, for "The call opens at 11:30". */
export const joinOpensAt = (
  scheduledAt: string | null | undefined,
  joinWindowBeforeMinutes: number | undefined,
  timezone: string | undefined
): string | null => {
  if (!scheduledAt || joinWindowBeforeMinutes === undefined) return null;
  const start = new Date(scheduledAt);
  if (Number.isNaN(start.getTime())) return null;
  return formatTelemedicineDateTime(new Date(start.getTime() - joinWindowBeforeMinutes * 60_000).toISOString(), timezone, timeOnly);
};
