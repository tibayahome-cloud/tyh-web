import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AppLayout } from "../../../shared/components/AppLayout";
import { BookingFeedbackDialog } from "../../../shared/components/BookingFeedbackDialog";
import { NeedsYourResponse } from "../../../shared/components/NeedsYourResponse";
import { NextConsultationCard } from "../../../shared/components/NextConsultationCard";
import { WidgetError } from "../../../shared/components/WidgetError";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useBookingList } from "../../../shared/hooks/useBookings";
import { useNow } from "../../../shared/hooks/useNow";
import { useTelemedicinePolicy } from "../../../shared/hooks/useTelemedicine";
import { prefetchBooking } from "../../../shared/libs/query";
import type { Booking } from "../../../shared/schemas/booking";
import { AgendaBookingRow } from "../../../shared/components/AgendaBookingRow";
import { agendaDay } from "../../../shared/utils/agendaDates";
import {
  EARLIER_BOOKING_STATUSES,
  OPEN_BOOKING_STATUSES,
  needsYouForOpenBooking,
  needsYouForRating,
  pickNextConsultation,
  sortComingUp,
  sortEarlier,
  type NeedsYouItem
} from "../utils/bookingGroups";

const OPEN_PAGE_SIZE = 50;
const EARLIER_STEP = 10;

const linkButtonClass =
  "inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue focus-visible:ring-offset-2";

type AgendaListProps = {
  bookings: Booking[];
  timezone: string | undefined;
  showYear?: boolean;
  onOpen: (booking: Booking) => void;
  /** Returns a Rate handler for a booking that can still be rated, otherwise undefined. */
  rateFor?: (booking: Booking) => (() => void) | undefined;
};

// Rows in time order with the date shown once per day, so the left rail reads as one entry per day.
const AgendaList = ({ bookings, timezone, showYear, onOpen, rateFor }: AgendaListProps) => (
  <ul>
    {bookings.map((booking, index) => {
      const day = agendaDay(booking, timezone);
      const previous = index > 0 ? agendaDay(bookings[index - 1], timezone) : null;
      return (
        <AgendaBookingRow
          key={booking.id}
          booking={booking}
          party={booking.provider}
          day={day}
          showDate={!previous || previous.key !== day.key}
          showYear={showYear}
          onOpen={() => onOpen(booking)}
          onRate={rateFor?.(booking)}
          onPrefetch={() => prefetchBooking(booking.id)}
        />
      );
    })}
  </ul>
);

const SectionTitle = ({ children, count }: { children: React.ReactNode; count?: number }) => (
  <h2 className="text-base font-semibold text-slate-900">
    {children}
    {count !== undefined && <span className="ml-1.5 font-normal text-slate-600">({count})</span>}
  </h2>
);

const AgendaSkeleton = () => (
  <div className="space-y-6" aria-busy="true" aria-label="Loading your bookings">
    <div className="h-36 animate-pulse rounded-2xl bg-slate-100" />
    {[1, 2, 3].map((row) => (
      <div key={row} className="grid animate-pulse grid-cols-[3.75rem_1fr] gap-4">
        <div className="mx-auto h-14 w-10 rounded-lg bg-slate-100" />
        <div className="space-y-2">
          <div className="h-5 w-28 rounded-full bg-slate-100" />
          <div className="h-5 w-48 rounded bg-slate-100" />
          <div className="h-4 w-36 rounded bg-slate-50" />
        </div>
      </div>
    ))}
  </div>
);

const BookActions = () => (
  <div className="mt-4 flex flex-wrap justify-center gap-2">
    <Link to="/app/telemedicine" className={`${linkButtonClass} bg-tiba-blue text-white hover:bg-blue-800`}>
      Book a consultation
    </Link>
    <Link to="/app/services" className={`${linkButtonClass} border-2 border-slate-200 text-slate-700 hover:border-tiba-blue hover:text-tiba-blue`}>
      Book a home visit
    </Link>
  </div>
);

// My bookings, sorted by what the client needs to do rather than by system status: the next consultation with
// its Join button, anything waiting on them, what is coming up, and everything earlier tucked behind one button.
const BookingsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const policyQuery = useTelemedicinePolicy();
  const now = useNow(60_000);
  const [earlierOpen, setEarlierOpen] = useState(false);
  const [earlierLimit, setEarlierLimit] = useState(EARLIER_STEP);
  const [feedbackPrompt, setFeedbackPrompt] = useState<{ bookingId: string; providerName: string } | null>(null);

  const enabled = { enabled: Boolean(user?.id) };
  const openQuery = useBookingList(
    { clientId: user?.id ?? undefined, statuses: [...OPEN_BOOKING_STATUSES], pageSize: OPEN_PAGE_SIZE, preset: "card" },
    enabled
  );
  // Fetched even while the list is closed: a recent visit with no rating is asked about under "Needs you".
  const earlierQuery = useBookingList(
    { clientId: user?.id ?? undefined, statuses: [...EARLIER_BOOKING_STATUSES], pageSize: earlierLimit, preset: "card" },
    enabled
  );

  const timezone = policyQuery.data?.defaultTimezone;
  const openBookings = useMemo(() => sortComingUp((openQuery.data as { bookings?: Booking[] } | undefined)?.bookings ?? []), [openQuery.data]);
  const earlierBookings = useMemo(() => sortEarlier((earlierQuery.data as { bookings?: Booking[] } | undefined)?.bookings ?? []), [earlierQuery.data]);
  const earlierTotal = (earlierQuery.data as { meta?: { page?: { total?: number } } } | undefined)?.meta?.page?.total ?? earlierBookings.length;

  const next = useMemo(() => pickNextConsultation(openBookings, now), [openBookings, now]);
  const needsYou = useMemo<NeedsYouItem[]>(() => {
    const open = openBookings.map(needsYouForOpenBooking).filter((item): item is NeedsYouItem => item !== null);
    const rate = earlierBookings.map((booking) => needsYouForRating(booking, now)).filter((item): item is NeedsYouItem => item !== null);
    return [...open, ...rate];
  }, [openBookings, earlierBookings, now]);
  // A booking already shown under "Needs you" or as the featured consultation is not repeated in the list.
  const comingUp = useMemo(() => {
    const shown = new Set<string>([...needsYou.filter((item) => item.kind !== "rate").map((item) => item.booking.id), ...(next ? [next.id] : [])]);
    return openBookings.filter((booking) => !shown.has(booking.id));
  }, [openBookings, needsYou, next]);

  const openBooking = (booking: Booking) => navigate(`/app/bookings/${booking.id}`);
  const rate = (booking: Booking) =>
    setFeedbackPrompt({ bookingId: booking.id, providerName: booking.provider?.fullName || "the provider" });
  const ratable = new Set(needsYou.filter((item) => item.kind === "rate").map((item) => item.booking.id));

  const loading = openQuery.isLoading || earlierQuery.isLoading;
  const nothingAtAll = !loading && !openQuery.isError && !earlierQuery.isError && openBookings.length === 0 && earlierBookings.length === 0;

  return (
    <AppLayout fullWidth showHeader={false} disablePadding>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pb-24 pt-4 sm:px-6">
        <h1 className="text-xl font-bold text-slate-900">My bookings</h1>

        {loading ? (
          <AgendaSkeleton />
        ) : nothingAtAll ? (
          <div className="rounded-2xl bg-white px-6 py-12 text-center ring-1 ring-slate-100">
            <h2 className="text-base font-bold text-slate-900">No bookings yet</h2>
            <p className="mx-auto mt-1 max-w-xs text-sm text-slate-600">When you book a consultation or a home visit, it appears here.</p>
            <BookActions />
          </div>
        ) : (
          <>
            {openQuery.isError && <WidgetError what="your upcoming bookings" onRetry={() => void openQuery.refetch()} />}

            {next && (
              <NextConsultationCard
                booking={next}
                withName={next.provider?.fullName}
                joinTo={`/app/bookings/${next.id}?join=1`}
                detailsTo={`/app/bookings/${next.id}`}
                joinWindowBeforeMinutes={policyQuery.data?.joinWindowBeforeMinutes}
              />
            )}

            <NeedsYourResponse bookingPath={(id) => `/app/bookings/${id}`} />

            {needsYou.length > 0 && (
              <section aria-label="Needs you" className="space-y-3">
                <SectionTitle>Needs you</SectionTitle>
                <ul className="space-y-2">
                  {needsYou.map((item) => (
                    <li
                      key={`${item.kind}-${item.booking.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
                    >
                      <p className="text-sm font-medium text-amber-950">{item.message}</p>
                      <button
                        type="button"
                        onClick={() => (item.kind === "rate" ? rate(item.booking) : openBooking(item.booking))}
                        className="min-h-[44px] shrink-0 rounded-lg bg-white px-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue"
                      >
                        {item.action}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {!openQuery.isError && (
              <section aria-label="Coming up" className="space-y-1">
                <SectionTitle count={comingUp.length > 0 ? comingUp.length : undefined}>Coming up</SectionTitle>
                {comingUp.length > 0 ? (
                  <AgendaList bookings={comingUp} timezone={timezone} onOpen={openBooking} />
                ) : (
                  <div className="py-4 text-sm text-slate-600">
                    {next || needsYou.some((item) => item.kind !== "rate")
                      ? "Nothing else is coming up."
                      : "Nothing is coming up."}
                    <BookActions />
                  </div>
                )}
              </section>
            )}

            <section aria-label="Earlier" className="space-y-1">
              <h2 className="text-base font-semibold text-slate-900">
                <button
                  type="button"
                  aria-expanded={earlierOpen}
                  aria-controls="earlier-bookings"
                  onClick={() => setEarlierOpen((open) => !open)}
                  className="-mx-2 flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-left hover:text-tiba-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue"
                >
                  Earlier
                  <span className="font-normal text-slate-600">({earlierTotal})</span>
                  <span className="text-sm font-semibold text-tiba-blue">{earlierOpen ? "Hide" : "Show"}</span>
                </button>
              </h2>
              {earlierOpen && (
                <div id="earlier-bookings">
                  {earlierQuery.isError ? (
                    <WidgetError what="your earlier bookings" onRetry={() => void earlierQuery.refetch()} />
                  ) : earlierBookings.length === 0 ? (
                    <p className="py-4 text-sm text-slate-600">Finished and cancelled bookings appear here.</p>
                  ) : (
                    <>
                      <AgendaList
                        bookings={earlierBookings}
                        timezone={timezone}
                        showYear
                        onOpen={openBooking}
                        rateFor={(booking) => (ratable.has(booking.id) ? () => rate(booking) : undefined)}
                      />
                      {earlierBookings.length < earlierTotal && (
                        <button
                          type="button"
                          onClick={() => setEarlierLimit((limit) => limit + EARLIER_STEP)}
                          className="mt-2 min-h-[44px] rounded-xl border-2 border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:border-tiba-blue hover:text-tiba-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue"
                        >
                          Show more
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <BookingFeedbackDialog
        open={Boolean(feedbackPrompt)}
        bookingId={feedbackPrompt?.bookingId || null}
        targetName={feedbackPrompt?.providerName || ""}
        onClose={() => setFeedbackPrompt(null)}
      />
    </AppLayout>
  );
};

export default BookingsPage;
