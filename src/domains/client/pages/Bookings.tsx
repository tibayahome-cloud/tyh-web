import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import classNames from "classnames";
import { motion, AnimatePresence } from "framer-motion";
import { prefetchBooking } from "../../../shared/libs/query";

import { Card } from "../../../shared/components/Card";
import { Loading } from "../../../shared/components/Loading";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useBookingList } from "../../../shared/hooks/useBookings";
import { getBookingStatusTheme } from "../../../shared/utils/bookingStatus";
import { BookingFeedbackDialog } from "../../../shared/components/BookingFeedbackDialog";
import { Button } from "../../../shared/components/Button";
import type { Booking } from "../../../shared/schemas/booking";
import { ClientPageHeader } from "../components/ClientPageHeader";
import { AppLayout } from "../../../shared/components/AppLayout";
import {
    Calendar as CalendarIcon,
    Clock as ClockIcon,
    MapPin,
    ChevronRight,
    Star
} from "lucide-react";

type TabKey = "all" | "pending" | "active" | "completed" | "cancelled";

const TABS: { key: TabKey; label: string; statuses: string[] }[] = [
    {
        key: "all",
        label: "All",
        statuses: []
    },
    {
        key: "pending",
        label: "Pending",
        statuses: ["requested", "broadcasting", "scheduled"]
    },
    {
        key: "active",
        label: "Active",
        statuses: ["accepted", "en_route", "nearby", "arrived", "in_service", "completed_by_provider"]
    },
    {
        key: "completed",
        label: "Completed",
        statuses: ["client_completed", "client_confirmed", "fully_completed", "paid"]
    },
    {
        key: "cancelled",
        label: "Cancelled",
        statuses: ["cancelled_by_client", "cancelled_by_admin", "expired_no_accept"]
    }
];

const formatDate = (iso?: string | null) => {
    if (!iso) return "";
    const date = new Date(iso);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const formatTime = (iso?: string | null) => {
    if (!iso) return "";
    const date = new Date(iso);
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

const BookingCardSkeleton = () => (
    <div className="flex w-full animate-pulse flex-col gap-2 rounded-lg bg-white p-2.5 ring-1 ring-slate-100">
        <div className="flex items-start justify-between">
            <div className="space-y-1.5">
                <div className="h-3 w-24 rounded bg-slate-100" />
                <div className="h-2.5 w-32 rounded bg-slate-50" />
            </div>
            <div className="h-4 w-14 rounded-full bg-slate-100" />
        </div>
        <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-50">
            <div className="h-5 w-5 rounded-lg bg-slate-100" />
            <div className="h-2.5 w-20 rounded bg-slate-50" />
        </div>
    </div>
);

const BookingCard = ({
    booking,
    onClick,
    onRate
}: {
    booking: Booking;
    onClick: () => void;
    onRate?: () => void
}) => {
    const theme = getBookingStatusTheme(booking.status);
    const showRateButton = onRate && !booking.feedback?.length && (booking.status === "fully_completed" || booking.status === "paid" || booking.status === "client_completed");

    return (
        <motion.article
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            onClick={onClick}
            onMouseEnter={() => prefetchBooking(booking.id)}
            className="group flex w-full flex-col gap-2 rounded-lg bg-white p-2.5 text-left ring-1 ring-slate-100 transition-all hover:ring-slate-200 cursor-pointer"
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-slate-900 truncate group-hover:text-brand-600 transition-colors">
                        {booking.service?.name || "Service Request"}
                    </h3>
                    <div className="flex items-center gap-0.5 mt-0.5 text-slate-400">
                        <MapPin size={8} />
                        <p className="text-[9px] truncate">
                            {booking.addressText || "Location not specified"}
                        </p>
                    </div>
                </div>
                <span className={classNames(
                    "shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold",
                    theme.className
                )}>
                    {theme.label}
                </span>
            </div>

            <div className="flex items-center gap-2 text-[9px] text-slate-500">
                <div className="flex items-center gap-0.5">
                    <CalendarIcon size={10} className="text-slate-400" />
                    <span>{formatDate(booking.scheduledAt || booking.createdAt)}</span>
                </div>
                <div className="flex items-center gap-0.5">
                    <ClockIcon size={10} className="text-slate-400" />
                    <span>{formatTime(booking.scheduledAt || booking.createdAt)}</span>
                </div>
            </div>

            <div className="flex items-center justify-between pt-1.5 border-t border-slate-50">
                {booking.provider ? (
                    <div className="flex items-center gap-1.5">
                        {booking.provider.avatarUrl ? (
                            <img
                                src={booking.provider.avatarUrl}
                                alt={booking.provider.fullName}
                                className="h-5 w-5 rounded-lg object-cover"
                            />
                        ) : (
                            <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-brand-100 text-brand-600 text-[8px] font-bold">
                                {booking.provider.fullName?.charAt(0) || "P"}
                            </div>
                        )}
                        <span className="text-[10px] font-medium text-slate-700 truncate">{booking.provider.fullName}</span>
                    </div>
                ) : (
                    <span className="text-[9px] text-slate-400 italic">Finding provider...</span>
                )}
                {showRateButton ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRate?.();
                        }}
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg bg-amber-50 text-amber-600 text-[8px] font-bold hover:bg-amber-100 transition-colors shrink-0"
                    >
                        <Star size={8} />
                        Rate
                    </button>
                ) : (
                    <ChevronRight size={12} className="text-slate-300 group-hover:text-brand-600 transition-colors flex-shrink-0" />
                )}
            </div>
        </motion.article>
    );
};

const BookingsPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<TabKey>("all");
    const [feedbackPrompt, setFeedbackPrompt] = useState<{ bookingId: string; providerName: string } | null>(null);

    const activeTabConfig = TABS.find((t) => t.key === activeTab)!;

    const { data, isLoading } = useBookingList(
        {
            clientId: user?.id ?? undefined,
            statuses: activeTabConfig.statuses.length > 0 ? activeTabConfig.statuses : undefined,
            pageSize: 50,
            preset: "card"
        },
        { enabled: Boolean(user?.id) }
    );

    const bookings = useMemo(() => {
        const result = data as { bookings?: Booking[] } | undefined;
        return result?.bookings ?? [];
    }, [data]);

    if (isLoading) {
        return (
            <AppLayout fullWidth showHeader={false} disablePadding>
                <div className="flex flex-col gap-3 pb-20">
                    <div className="px-4 sm:px-6 pt-4">
                        <h1 className="text-xl font-bold text-slate-900">My Bookings</h1>
                    </div>
                    <div className="grid gap-2 px-4 sm:px-6 sm:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3, 4, 5, 6].map((i) => <BookingCardSkeleton key={i} />)}
                    </div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout fullWidth showHeader={false} disablePadding>
            <div className="flex flex-col gap-3 pb-20">
                <div className="px-4 sm:px-6 pt-4">
                    <h1 className="text-xl font-bold text-slate-900">My Bookings</h1>
                </div>

                <div className="flex flex-col gap-3 px-4 sm:px-6">
                    {/* Tabs */}
                    <div className="flex gap-1 p-0.5 rounded-lg bg-slate-100 w-full overflow-x-auto no-scrollbar">
                        {TABS.map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setActiveTab(tab.key)}
                                className={classNames(
                                    "flex-1 min-w-[60px] rounded-lg py-1.5 text-[10px] font-bold transition-all",
                                    activeTab === tab.key
                                        ? "bg-white text-brand-600 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Bookings List */}
                    {bookings.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center bg-white rounded-lg ring-1 ring-slate-100">
                            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-300">
                                <CalendarIcon size={18} />
                            </div>
                            <h3 className="text-xs font-bold text-slate-900">No records found</h3>
                            <p className="mt-1 text-[11px] text-slate-500 max-w-[180px]">
                                {activeTab === "all"
                                    ? "Your history will appear here."
                                    : `No ${activeTabConfig.label.toLowerCase()} bookings.`}
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            <AnimatePresence mode="popLayout">
                                {bookings.map((booking: Booking) => (
                                    <BookingCard
                                        key={booking.id}
                                        booking={booking}
                                        onClick={() => navigate(`/app/bookings/${booking.id}`)}
                                        onRate={() => setFeedbackPrompt({
                                            bookingId: booking.id,
                                            providerName: booking.provider?.fullName || "the provider"
                                        })}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>
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
