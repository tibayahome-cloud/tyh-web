import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { AgendaBookingRow } from "../../../shared/components/AgendaBookingRow";
import { AppLayout } from "../../../shared/components/AppLayout";
import { BookingFeedbackDialog } from "../../../shared/components/BookingFeedbackDialog";
import { NeedsYourResponse } from "../../../shared/components/NeedsYourResponse";
import { NextConsultationCard } from "../../../shared/components/NextConsultationCard";
import { WidgetError } from "../../../shared/components/WidgetError";
import { useAuth } from "../../../shared/hooks/useAuth";
import { bookingKeys, useBookingList } from "../../../shared/hooks/useBookings";
import { useNow } from "../../../shared/hooks/useNow";
import { useSocket } from "../../../shared/hooks/useSocket";
import { useTelemedicinePolicy } from "../../../shared/hooks/useTelemedicine";
import type { Booking } from "../../../shared/schemas/booking";
import { agendaDay } from "../../../shared/utils/agendaDates";
import { pickNowConsultation, sortEarlier, sortOpen } from "../utils/consultationGroups";
import {
  EARLIER_PROVIDER_BOOKING_STATUSES,
  OPEN_PROVIDER_BOOKING_STATUSES,
  isVisitUnderWay,
  needsRatingFromProvider,
  needsYouForOpenBooking,
  type ProviderBookingNeeds
} from "../utils/bookingGroups";

const OPEN_PAGE_SIZE = 50;
const EARLIER_STEP = 10;

const BOOKING_EVENTS = [
  "model.booking.status",
  "model.booking.location",
  "model.booking.reassigned",
  "model.booking.accepted",
  "model.booking.cancelled",
  "model.booking.completed",
  "model.booking.confirmed",
  "model.booking.paid"
];

type AgendaListProps = {
  bookings: Booking[];
  timezone: string | undefined;
  showYear?: boolean;
  onOpen: (booking: Booking) => void;
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
          party={booking.client}
          missingPartyText="Waiting for a client"
          day={day}
          showDate={!previous || previous.key !== day.key}
          showYear={showYear}
          onOpen={() => onOpen(booking)}
          onRate={rateFor?.(booking)}
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

// The provider's Bookings, home visits and telemedicine together, sorted by what needs doing: the call to join, what
// is waiting on them, a visit under way, what is coming up, and everything earlier behind one button. It replaces a
// table with a filter pop-up, status pills and a date range, which hid the one thing a provider opens it for.
const ProviderBookings = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const socket = useSocket();
  const policyQuery = useTelemedicinePolicy();
  const now = useNow(60_000);
  const [earlierOpen, setEarlierOpen] = useState(false);
  const [earlierLimit, setEarlierLimit] = useState(EARLIER_STEP);
  const [feedbackPrompt, setFeedbackPrompt] = useState<{ bookingId: string; clientName: string } | null>(null);

  const enabled = { enabled: Boolean(user?.id) };
  const openQuery = useBookingList(
    { providerId: user?.id ?? undefined, statuses: [...OPEN_PROVIDER_BOOKING_STATUSES], pageSize: OPEN_PAGE_SIZE, preset: "card" },
    enabled
  );
  // Fetched even while the list is closed: a recent finished visit with no rating of the client is asked about up top.
  const earlierQuery = useBookingList(
    { providerId: user?.id ?? undefined, statuses: [...EARLIER_PROVIDER_BOOKING_STATUSES], pageSize: earlierLimit, preset: "card" },
    enabled
  );

  // A booking changing state elsewhere (accepted, completed, paid) refreshes the lists.
  useEffect(() => {
    if (!socket || !user?.id) return;
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists(), exact: false }).catch(() => undefined);
    };
    BOOKING_EVENTS.forEach((event) => socket.on(event, invalidate));
    return () => {
      BOOKING_EVENTS.forEach((event) => socket.off(event, invalidate));
    };
  }, [socket, user?.id, queryClient]);

  const timezone = policyQuery.data?.defaultTimezone;
  const openBookings = useMemo(() => sortOpen((openQuery.data as { bookings?: Booking[] } | undefined)?.bookings ?? []), [openQuery.data]);
  const earlierBookings = useMemo(() => sortEarlier((earlierQuery.data as { bookings?: Booking[] } | undefined)?.bookings ?? []), [earlierQuery.data]);
  const earlierTotal = (earlierQuery.data as { meta?: { page?: { total?: number } } } | undefined)?.meta?.page?.total ?? earlierBookings.length;

  const next = useMemo(() => pickNowConsultation(openBookings, now), [openBookings, now]);
  const needsYou = useMemo<ProviderBookingNeeds[]>(() => {
    const open = openBookings.map(needsYouForOpenBooking).filter((item): item is ProviderBookingNeeds => item !== null);
    const rate = earlierBookings.map((booking) => needsRatingFromProvider(booking, user?.id, now)).filter((item): item is ProviderBookingNeeds => item !== null);
    return [...open, ...rate];
  }, [openBookings, earlierBookings, user?.id, now]);
  const underWay = useMemo(() => openBookings.filter(isVisitUnderWay), [openBookings]);
  // Whatever is featured or listed above is not repeated under "Coming up".
  const comingUp = useMemo(() => {
    const shown = new Set<string>([
      ...needsYou.filter((item) => item.kind !== "rate").map((item) => item.booking.id),
      ...underWay.map((booking) => booking.id),
      ...(next ? [next.id] : [])
    ]);
    return openBookings.filter((booking) => !shown.has(booking.id));
  }, [openBookings, needsYou, underWay, next]);

  const openBooking = (booking: Booking) => navigate(`/pro/bookings/${booking.id}`);
  const rate = (booking: Booking) => setFeedbackPrompt({ bookingId: booking.id, clientName: booking.client?.fullName || "the client" });
  const ratable = new Set(needsYou.filter((item) => item.kind === "rate").map((item) => item.booking.id));

  const loading = openQuery.isLoading || earlierQuery.isLoading;
  const nothingAtAll = !loading && !openQuery.isError && !earlierQuery.isError && openBookings.length === 0 && earlierBookings.length === 0;

  return (
    <AppLayout fullWidth showHeader={false} disablePadding>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pb-24 pt-4 sm:px-6">
        <h1 className="text-xl font-bold text-slate-900">Bookings</h1>

        {loading ? (
          <AgendaSkeleton />
        ) : nothingAtAll ? (
          <div className="rounded-2xl bg-white px-6 py-12 text-center ring-1 ring-slate-100">
            <h2 className="text-base font-bold text-slate-900">No bookings yet</h2>
            <p className="mx-auto mt-1 max-w-xs text-sm text-slate-600">
              Visits you accept and consultations your facility assigns to you appear here. Clients can only book you during the hours you set.
            </p>
            <Link
              to="/pro/availability"
              className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl border-2 border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:border-tiba-blue hover:text-tiba-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue"
            >
              Set your hours
            </Link>
          </div>
        ) : (
          <>
            {openQuery.isError && <WidgetError what="your bookings" onRetry={() => void openQuery.refetch()} />}

            {next && (
              <NextConsultationCard
                booking={next}
                withName={next.client?.fullName}
                joinTo={`/pro/bookings/${next.id}?join=1`}
                detailsTo={`/pro/bookings/${next.id}`}
                joinWindowBeforeMinutes={policyQuery.data?.joinWindowBeforeMinutes}
              />
            )}

            <NeedsYourResponse bookingPath={(id) => `/pro/bookings/${id}`} />

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

            {underWay.length > 0 && (
              <section aria-label="In progress" className="space-y-1">
                <SectionTitle count={underWay.length}>In progress</SectionTitle>
                <AgendaList bookings={underWay} timezone={timezone} onOpen={openBooking} />
              </section>
            )}

            {!openQuery.isError && (
              <section aria-label="Coming up" className="space-y-1">
                <SectionTitle count={comingUp.length > 0 ? comingUp.length : undefined}>Coming up</SectionTitle>
                {comingUp.length > 0 ? (
                  <AgendaList bookings={comingUp} timezone={timezone} onOpen={openBooking} />
                ) : (
                  <p className="py-4 text-sm text-slate-600">
                    {next || underWay.length > 0 || needsYou.some((item) => item.kind !== "rate") ? "Nothing else is coming up." : "Nothing is coming up."}
                  </p>
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
        targetName={feedbackPrompt?.clientName || ""}
        onClose={() => setFeedbackPrompt(null)}
      />
    </AppLayout>
  );
};

export default ProviderBookings;
