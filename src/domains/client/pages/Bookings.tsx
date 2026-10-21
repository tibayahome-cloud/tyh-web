import { forwardRef, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import classNames from "classnames";
import { motion, AnimatePresence } from "framer-motion";
import { prefetchBooking } from "../../../shared/libs/query";

import { useAuth } from "../../../shared/hooks/useAuth";
import { useBookingList } from "../../../shared/hooks/useBookings";
import { useTelemedicinePolicy } from "../../../shared/hooks/useTelemedicine";
import { getBookingStatusTheme } from "../../../shared/utils/bookingStatus";
import { formatTelemedicineDateTime } from "../../../shared/utils/telemedicine";
import { BookingFeedbackDialog } from "../../../shared/components/BookingFeedbackDialog";
import { BookingKindBadge } from "../../../shared/components/BookingKindBadge";
import { BookingListFilters } from "../../../shared/components/BookingListFilters";
import { WidgetError } from "../../../shared/components/WidgetError";
import type { Booking } from "../../../shared/schemas/booking";
import { AppLayout } from "../../../shared/components/AppLayout";
import { CLIENT_BOOKING_TABS, type ClientBookingTabKey } from "../utils/bookingTabs";
import { Calendar as CalendarIcon, Clock as ClockIcon, MapPin, ChevronRight, Star } from "lucide-react";

const PAGE_SIZE = 50;

// When a booking happens, in the words for its kind. A video consultation is anchored to the facility's
// timezone; a home visit happens wherever the client is, so the device's own time is right for it. A booking with
// no appointment yet says when it was requested instead of showing a date that is not the appointment.
const describeWhen = (booking: Booking, timezone: string | undefined): { label: string; requested: boolean } => {
    const options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };
    if (booking.scheduledAt) {
        return {
            requested: false,
            label: booking.isTelemedicine
                ? formatTelemedicineDateTime(booking.scheduledAt, timezone, options)
                : new Date(booking.scheduledAt).toLocaleString(undefined, options)
        };
    }
    return {
        requested: true,
        label: booking.createdAt ? new Date(booking.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : ""
    };
};

const BookingCardSkeleton = () => (
    <div className="flex w-full animate-pulse flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-100">
        <div className="flex items-start justify-between">
            <div className="h-5 w-16 rounded-full bg-slate-100" />
            <div className="h-5 w-20 rounded-full bg-slate-100" />
        </div>
        <div className="h-4 w-40 rounded bg-slate-100" />
        <div className="h-3 w-32 rounded bg-slate-50" />
        <div className="flex items-center gap-2 border-t border-slate-50 pt-3">
            <div className="h-7 w-7 rounded-lg bg-slate-100" />
            <div className="h-3 w-24 rounded bg-slate-50" />
        </div>
    </div>
);

// AnimatePresence (popLayout) hands each direct child a ref to measure it, so the card must forward it.
const BookingCard = forwardRef<
    HTMLElement,
    {
        booking: Booking;
        timezone: string | undefined;
        onClick: () => void;
        onRate?: () => void;
    }
>(function BookingCard({ booking, timezone, onClick, onRate }, ref) {
    const theme = getBookingStatusTheme(booking.status);
    const when = describeWhen(booking, timezone);
    const showRateButton =
        onRate && !booking.feedback?.length && (booking.status === "fully_completed" || booking.status === "paid" || booking.status === "client_completed");
    // A home visit has a place; a video consultation does not, so it never shows one (or a "not specified" line).
    const place = booking.isTelemedicine ? null : booking.addressText;

    return (
        <motion.article
            ref={ref}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="group relative flex w-full flex-col gap-3 rounded-2xl bg-white p-4 text-left ring-1 ring-slate-200 transition-all hover:ring-slate-300"
            onMouseEnter={() => prefetchBooking(booking.id)}
        >
            <div className="flex items-center justify-between gap-2">
                <BookingKindBadge isTelemedicine={booking.isTelemedicine} />
                <span className={classNames("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", theme.className)}>{theme.label}</span>
            </div>

            <div className="min-w-0">
                {/* The whole card opens the booking; the link keeps it reachable by keyboard and screen reader. */}
                <h3 className="truncate text-base font-bold text-slate-900">
                    <button type="button" onClick={onClick} className="static text-left after:absolute after:inset-0 after:rounded-2xl focus:outline-none focus-visible:after:ring-2 focus-visible:after:ring-tiba-blue">
                        {booking.service?.name || "Service request"}
                    </button>
                </h3>
                {place && (
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-600">
                        <MapPin size={14} className="shrink-0 text-slate-500" aria-hidden="true" />
                        <span className="truncate">{place}</span>
                    </p>
                )}
            </div>

            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-700">
                {when.requested ? (
                    <span className="text-slate-600">Requested {when.label}</span>
                ) : (
                    <span className="flex items-center gap-1.5">
                        <CalendarIcon size={14} className="text-slate-500" aria-hidden="true" />
                        {when.label}
                    </span>
                )}
                {booking.estimateDurationMinutes ? (
                    <span className="flex items-center gap-1.5 text-slate-600">
                        <ClockIcon size={14} className="text-slate-500" aria-hidden="true" />
                        {booking.estimateDurationMinutes} min
                    </span>
                ) : null}
            </p>

            <div className="relative z-10 flex items-center justify-between border-t border-slate-100 pt-3">
                {booking.provider ? (
                    <div className="flex min-w-0 items-center gap-2">
                        {booking.provider.avatarUrl ? (
                            <img src={booking.provider.avatarUrl} alt="" className="h-7 w-7 rounded-lg object-cover" />
                        ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-xs font-bold text-brand-600">
                                {booking.provider.fullName?.charAt(0) || "D"}
                            </div>
                        )}
                        <span className="truncate text-sm font-medium text-slate-800">{booking.provider.fullName}</span>
                    </div>
                ) : (
                    <span className="text-sm italic text-slate-600">{booking.isTelemedicine ? "Finding a doctor..." : "Finding a provider..."}</span>
                )}
                {showRateButton ? (
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onRate?.();
                        }}
                        className="flex min-h-[36px] shrink-0 items-center gap-1 rounded-lg bg-amber-50 px-3 text-sm font-semibold text-amber-800 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue"
                    >
                        <Star size={14} aria-hidden="true" />
                        Rate
                    </button>
                ) : (
                    <ChevronRight size={16} className="shrink-0 text-slate-400 group-hover:text-tiba-blue" aria-hidden="true" />
                )}
            </div>
        </motion.article>
    );
});

const BookingsPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const policyQuery = useTelemedicinePolicy();
    const [activeTab, setActiveTab] = useState<ClientBookingTabKey>("all");
    const [feedbackPrompt, setFeedbackPrompt] = useState<{ bookingId: string; providerName: string } | null>(null);

    const activeTabConfig = CLIENT_BOOKING_TABS.find((tab) => tab.key === activeTab)!;
    const resetFilters = () => setActiveTab("all");

    const { data, isLoading, isError, refetch } = useBookingList(
        {
            clientId: user?.id ?? undefined,
            statuses: activeTabConfig.statuses.length > 0 ? [...activeTabConfig.statuses] : undefined,
            pageSize: PAGE_SIZE,
            preset: "card"
        },
        { enabled: Boolean(user?.id) }
    );

    const bookings = useMemo(() => {
        const result = data as { bookings?: Booking[] } | undefined;
        return result?.bookings ?? [];
    }, [data]);

    const filtered = activeTab !== "all";
    const emptyMessage = filtered
        ? `No ${activeTabConfig.label.toLowerCase()} bookings. This tab shows bookings ${activeTabConfig.meaning}.`
        : "Your bookings will appear here once you book.";

    return (
        <AppLayout fullWidth showHeader={false} disablePadding>
            <div className="flex flex-col gap-4 pb-20">
                <div className="px-4 pt-4 sm:px-6">
                    <h1 className="text-xl font-bold text-slate-900">My bookings</h1>
                </div>

                <div className="flex flex-col gap-4 px-4 sm:px-6">
                    <BookingListFilters
                        statusTabs={CLIENT_BOOKING_TABS}
                        status={activeTab}
                        onStatusChange={setActiveTab}
                        onReset={resetFilters}
                        defaultStatus="all"
                    />

                    {isLoading ? (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <BookingCardSkeleton key={i} />
                            ))}
                        </div>
                    ) : isError ? (
                        <WidgetError what="your bookings" onRetry={() => void refetch()} />
                    ) : bookings.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-12 text-center ring-1 ring-slate-100">
                            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                                <CalendarIcon size={20} aria-hidden="true" />
                            </div>
                            <h2 className="text-base font-bold text-slate-900">Nothing here</h2>
                            <p className="mt-1 max-w-xs text-sm text-slate-600">{emptyMessage}</p>
                            {filtered && (
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="mt-3 min-h-[44px] px-3 text-sm font-semibold text-tiba-blue hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue"
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            <p className="text-sm text-slate-600" role="status">
                                {bookings.length >= PAGE_SIZE
                                    ? `Showing the latest ${PAGE_SIZE}. Use the filters to narrow the list.`
                                    : `${bookings.length} ${bookings.length === 1 ? "booking" : "bookings"}`}
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                <AnimatePresence mode="popLayout">
                                    {bookings.map((booking: Booking) => (
                                        <BookingCard
                                            key={booking.id}
                                            booking={booking}
                                            timezone={policyQuery.data?.defaultTimezone}
                                            onClick={() => navigate(`/app/bookings/${booking.id}`)}
                                            onRate={() =>
                                                setFeedbackPrompt({
                                                    bookingId: booking.id,
                                                    providerName: booking.provider?.fullName || "the provider"
                                                })
                                            }
                                        />
                                    ))}
                                </AnimatePresence>
                            </div>
                        </>
                    )}
                </div>
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
