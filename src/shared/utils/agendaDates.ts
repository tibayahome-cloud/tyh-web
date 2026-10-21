import type { Booking } from "../schemas/booking";

// The date rail of an agenda row. A video consultation is anchored to the facility's timezone and a home visit
// happens wherever the client is, so each uses its own zone. A booking with no appointment yet (still being
// matched to a provider) has no day: the rail says "Soon" instead of showing a date that is not the appointment.

export type AgendaDay = {
  /** Same key for bookings on the same day, so the rail is shown once per day. */
  key: string;
  weekday: string;
  day: string;
  month: string;
  year: string;
  time: string;
  soon: boolean;
};

const parts = (iso: string, timeZone: string | undefined) => {
  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    ...(timeZone ? { timeZone } : {})
  });
  const out: Record<string, string> = {};
  formatter.formatToParts(new Date(iso)).forEach((part) => {
    out[part.type] = part.value;
  });
  return out;
};

export const agendaDay = (booking: Pick<Booking, "scheduledAt" | "isTelemedicine">, telemedicineTimezone: string | undefined): AgendaDay => {
  if (!booking.scheduledAt || Number.isNaN(new Date(booking.scheduledAt).getTime())) {
    return { key: "soon", weekday: "Soon", day: "", month: "", year: "", time: "", soon: true };
  }
  const p = parts(booking.scheduledAt, booking.isTelemedicine ? telemedicineTimezone : undefined);
  return {
    key: `${p.year}-${p.month}-${p.day}`,
    weekday: p.weekday ?? "",
    day: p.day ?? "",
    month: p.month ?? "",
    year: p.year ?? "",
    time: `${p.hour ?? ""}:${p.minute ?? ""}`,
    soon: false
  };
};
