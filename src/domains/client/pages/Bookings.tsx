import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import classNames from "classnames";
import CalendarTodayIcon from "@mui/icons-material/CalendarTodayOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTimeOutlined";
import { StarIcon } from "lucide-react";
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
    <div className="flex w-full animate-pulse-subtle flex-col gap-3 rounded-2xl border border-neutral-100 bg-white p-4">
        <div className="flex items-start justify-between">
            <div className="space-y-2">
                <div className="h-4 w-32 rounded-md bg-neutral-100" />
                <div className="h-3 w-48 rounded-md bg-neutral-100" />
            </div>
            <div className="h-5 w-20 rounded-full bg-neutral-100" />
        </div>
        <div className="h-3 w-3/4 rounded-md bg-neutral-100" />
        <div className="flex items-center gap-2 pt-2 border-t border-neutral-100">
            <div className="h-6 w-6 rounded-full bg-neutral-100" />
            <div className="h-3 w-24 rounded-md bg-neutral-100" />
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
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={onClick}
            onMouseEnter={() => prefetchBooking(booking.id)}
            className="flex w-full flex-col gap-3 rounded-2xl border border-neutral-100 bg-white/70 p-4 text-left shadow-card hover:shadow-elevated hover:-translate-y-1 cursor-pointer backdrop-blur-md ring-1 ring-white/50 transition-all duration-300"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-neutral-900 truncate">
                        {booking.service?.name || "Service"}
                    </p>
                    <p className="text-xs text-neutral-500 truncate mt-0.5">
                        {booking.addressText || "Location not specified"}
                    </p>
                </div>
                <span className={classNames("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", theme.className)}>
                    {theme.label}
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                <span className="flex items-center gap-1">
                    <CalendarTodayIcon className="h-3.5 w-3.5" />
                    {formatDate(booking.scheduledAt || booking.createdAt)}
                </span>
                <span className="flex items-center gap-1">
                    <AccessTimeIcon className="h-3.5 w-3.5" />
                    {formatTime(booking.scheduledAt || booking.createdAt)}
                </span>
                {booking.estimateDurationMinutes && (
                    <span className="text-neutral-400">
                        ~{booking.estimateDurationMinutes} min
                    </span>
                )}
            </div>

            {booking.provider && (
                <div className="flex items-center gap-2 pt-2 border-t border-neutral-100">
                    {booking.provider.avatarUrl ? (
                        <img
                            src={booking.provider.avatarUrl}
                            alt={booking.provider.fullName}
                            className="h-6 w-6 rounded-full object-cover"
                        />
                    ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">
                            {booking.provider.fullName?.charAt(0) || "P"}
                        </div>
                    )}
                    <span className="text-xs text-neutral-600">{booking.provider.fullName}</span>
                </div>
            )}

            {showRateButton && (
                <div className="pt-2 border-t border-neutral-100">
                    <Button
                        size="sm"
                        variant="secondary"
                        className="w-full h-9 rounded-xl text-[10px] uppercase tracking-widest font-bold"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRate?.();
                        }}
                    >
                        <StarIcon className="mr-2 h-3 w-3" />
                        Rate Experience
                    </Button>
                </div>
            )}
        </motion.div>
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => <BookingCardSkeleton key={i} />)}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col gap-1 px-1">
                <h1 className="text-lg font-bold text-slate-900 sm:text-xl text-neutral-900">My Bookings</h1>
                <p className="text-xs font-medium text-slate-500 text-neutral-500">Track and manage your service requests</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 overflow-x-auto rounded-xl bg-neutral-100 p-1">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={classNames(
                            "flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition",
                            activeTab === tab.key
                                ? "bg-white text-neutral-900 shadow-sm"
                                : "text-neutral-600 hover:text-neutral-900"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Bookings List */}
            {bookings.length === 0 ? (
                <Card className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
                        <CalendarTodayIcon className="h-8 w-8 text-neutral-400" />
                    </div>
                    <p className="text-lg font-semibold text-neutral-900">No bookings yet</p>
                    <p className="mt-1 text-sm text-neutral-500">
                        {activeTab === "all"
                            ? "Your service requests will appear here"
                            : `No ${activeTabConfig.label.toLowerCase()} bookings`}
                    </p>
                </Card>
            ) : (
                <motion.div
                    layout
                    className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                >
                    <AnimatePresence mode="popLayout">
                        {bookings.map((booking) => (
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
                </motion.div>
            )}

            <BookingFeedbackDialog
                open={Boolean(feedbackPrompt)}
                bookingId={feedbackPrompt?.bookingId || null}
                targetName={feedbackPrompt?.providerName || ""}
                onClose={() => setFeedbackPrompt(null)}
            />
        </div>
    );
};

export default BookingsPage;
