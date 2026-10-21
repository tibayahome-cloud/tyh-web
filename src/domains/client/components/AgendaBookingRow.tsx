import classNames from "classnames";
import { ChevronRight, Clock, MapPin, Star } from "lucide-react";

import { BookingKindBadge } from "../../../shared/components/BookingKindBadge";
import type { Booking } from "../../../shared/schemas/booking";
import { getBookingStatusTheme } from "../../../shared/utils/bookingStatus";
import type { AgendaDay } from "../utils/agendaDates";

type Props = {
  booking: Booking;
  day: AgendaDay;
  /** Show the date rail. Only the first booking of a day shows it, so the rail reads as one entry per day. */
  showDate: boolean;
  /** Include the year in the rail, for bookings that are not from this year. */
  showYear?: boolean;
  onOpen: () => void;
  onRate?: () => void;
  onPrefetch?: () => void;
};

// One booking in the agenda: the date on a rail at the left, then what it is, when, who with, and its state. The
// whole row opens the booking; the service name is the real button (stretched over the row) so it works by keyboard
// and screen reader, and Rate sits above it.
export const AgendaBookingRow = ({ booking, day, showDate, showYear, onOpen, onRate, onPrefetch }: Props) => {
  const theme = getBookingStatusTheme(booking.status);
  const place = booking.isTelemedicine ? null : booking.addressText;

  return (
    <li className="border-b border-slate-100 last:border-b-0" onMouseEnter={onPrefetch}>
      <div className="group relative grid grid-cols-[3.75rem_minmax(0,1fr)] gap-x-4 py-4">
        <div aria-hidden={!showDate} className={classNames("text-center leading-none", !showDate && "invisible")}>
          {day.soon ? (
            <p className="text-sm font-semibold text-slate-600">Soon</p>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-600">{day.weekday}</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{day.day}</p>
              <p className="mt-1 text-xs text-slate-600">
                {day.month}
                {showYear ? ` ${day.year}` : ""}
              </p>
            </>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <BookingKindBadge isTelemedicine={booking.isTelemedicine} />
            <span className={classNames("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", theme.className)}>{theme.label}</span>
          </div>

          <h3 className="mt-2 truncate text-base font-bold text-slate-900">
            <button
              type="button"
              onClick={onOpen}
              className="static text-left after:absolute after:inset-0 after:rounded-xl focus:outline-none focus-visible:after:ring-2 focus-visible:after:ring-tiba-blue group-hover:text-tiba-blue"
            >
              {booking.service?.name || "Service request"}
            </button>
          </h3>

          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-700">
            {day.time && (
              <span className="flex items-center gap-1.5">
                <Clock size={14} className="text-slate-500" aria-hidden="true" />
                {day.time}
                {booking.estimateDurationMinutes ? <span className="text-slate-600"> · {booking.estimateDurationMinutes} min</span> : null}
              </span>
            )}
            {place && (
              <span className="flex min-w-0 items-center gap-1.5">
                <MapPin size={14} className="shrink-0 text-slate-500" aria-hidden="true" />
                <span className="truncate">{place}</span>
              </span>
            )}
          </p>

          <div className="mt-2 flex items-center justify-between gap-2">
            {booking.provider ? (
              <div className="flex min-w-0 items-center gap-2">
                {booking.provider.avatarUrl ? (
                  <img src={booking.provider.avatarUrl} alt="" className="h-6 w-6 rounded-md object-cover" />
                ) : (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-100 text-xs font-bold text-brand-700">
                    {booking.provider.fullName?.charAt(0) || "D"}
                  </span>
                )}
                <span className="truncate text-sm font-medium text-slate-800">{booking.provider.fullName}</span>
              </div>
            ) : (
              <span className="text-sm italic text-slate-600">{booking.isTelemedicine ? "Finding a doctor..." : "Finding a provider..."}</span>
            )}
            {onRate ? (
              <button
                type="button"
                onClick={onRate}
                className="relative z-10 flex min-h-[36px] shrink-0 items-center gap-1 rounded-lg bg-amber-50 px-3 text-sm font-semibold text-amber-900 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue"
              >
                <Star size={14} aria-hidden="true" />
                Rate
              </button>
            ) : (
              <ChevronRight size={16} className="shrink-0 text-slate-400 group-hover:text-tiba-blue" aria-hidden="true" />
            )}
          </div>
        </div>
      </div>
    </li>
  );
};

export default AgendaBookingRow;
