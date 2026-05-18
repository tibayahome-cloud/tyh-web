import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "../../../shared/components/Button";
import { Loading } from "../../../shared/components/Loading";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useSocket } from "../../../shared/hooks/useSocket";
import { useMediaQuery } from "../../../shared/hooks/useMediaQuery";
import { bookingKeys, useBookingList } from "../../../shared/hooks/useBookings";
import { getBookingStatusTheme } from "../../../shared/utils/bookingStatus";
import { BookingFeedbackDialog } from "../../../shared/components/BookingFeedbackDialog";
import { StarIcon } from "lucide-react";

const ACTIVE_STATUSES = [
    "broadcasting",
    "accepted",
    "en_route",
    "nearby",
    "arrived",
    "in_service",
    "completed_by_provider",
    "client_completed",
    "client_confirmed"
] as const;

const STATUS_FILTERS: Array<{ value: string; label: string; statuses?: string[] }> = [
    { value: "all", label: "All bookings" },
    { value: "active", label: "Active & in-progress", statuses: ["accepted", "en_route", "nearby", "arrived", "in_service"] },
    { value: "upcoming", label: "Upcoming", statuses: ["accepted", "en_route", "nearby", "arrived"] },
    {
        value: "awaiting_client",
        label: "Awaiting client confirmation",
        statuses: ["completed_by_provider", "client_completed", "client_confirmed"]
    },
    { value: "completed", label: "Fully completed", statuses: ["fully_completed", "paid"] },
    {
        value: "cancelled",
        label: "Cancelled",
        statuses: ["cancelled_by_client", "cancelled_by_admin", "expired_no_accept", "reassigned"]
    },
    { value: "disputed", label: "Disputed", statuses: ["disputed"] }
];

const DATE_FILTERS = [
    { value: "all", label: "Any time" },
    { value: "today", label: "Today" },
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" }
] as const;

const pageSize = 10;

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

const formatTimestamp = (iso?: string | null) => {
    if (!iso) {
        return "—";
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return "—";
    }
    return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
};

const formatRelativeTime = (iso?: string | null) => {
    if (!iso) {
        return "—";
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return "—";
    }
    const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
    const steps: Array<[number, Intl.RelativeTimeFormatUnit]> = [
        [60, "second"],
        [60, "minute"],
        [24, "hour"],
        [7, "day"],
        [4.34524, "week"],
        [12, "month"],
        [Number.POSITIVE_INFINITY, "year"]
    ];
    let unit: Intl.RelativeTimeFormatUnit = "second";
    let value = diffSeconds;
    for (const [amount, nextUnit] of steps) {
        if (Math.abs(value) < amount || nextUnit === "year") {
            unit = nextUnit;
            break;
        }
        value /= amount;
        unit = nextUnit;
    }
    return rtf.format(Math.round(value), unit);
};

const computeDateRange = (value: string) => {
    const now = new Date();
    if (value === "today") {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        return { from: start.toISOString(), to: end.toISOString() };
    }
    if (value === "7d") {
        const from = new Date(now);
        from.setDate(from.getDate() - 7);
        return { from: from.toISOString(), to: now.toISOString() };
    }
    if (value === "30d") {
        const from = new Date(now);
        from.setDate(from.getDate() - 30);
        return { from: from.toISOString(), to: now.toISOString() };
    }
    return null;
};

const formatCurrency = (amountCents?: number, currency = "KES") => {
    const value = typeof amountCents === "number" ? amountCents / 100 : 0;
    try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
    } catch {
        return `${currency} ${value.toFixed(2)}`;
    }
};

const ProviderBookings = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const filterMenuRef = useRef<HTMLDivElement>(null);
    const isMobileFilter = useMediaQuery("(max-width: 640px)");
    const { user } = useAuth();
    const socket = useSocket();

    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState("active");
    const [dateFilter, setDateFilter] = useState("7d");
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [draftStatus, setDraftStatus] = useState(statusFilter);
    const [draftDate, setDraftDate] = useState(dateFilter);
    const [feedbackPrompt, setFeedbackPrompt] = useState<{ bookingId: string; clientName: string } | null>(null);

    const statusConfig = STATUS_FILTERS.find((option) => option.value === statusFilter);
    const dateRange = useMemo(() => computeDateRange(dateFilter), [dateFilter]);

    const { data: bookingsData, isLoading, isFetching } = useBookingList(
        {
            page,
            pageSize,
            statuses: statusConfig?.statuses,
            providerId: user?.id ?? undefined,
            from: dateRange?.from,
            to: dateRange?.to,
            preset: "card"
        },
        { enabled: Boolean(user?.id) }
    );

    useEffect(() => {
        setPage(1);
    }, [statusFilter, dateFilter]);

    useEffect(() => {
        if (!filtersOpen || isMobileFilter) {
            return;
        }
        const handleClickAway = (event: MouseEvent) => {
            if (!filterMenuRef.current) {
                return;
            }
            if (!filterMenuRef.current.contains(event.target as Node)) {
                setFiltersOpen(false);
            }
        };
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setFiltersOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickAway);
        document.addEventListener("keydown", handleKey);
        return () => {
            document.removeEventListener("mousedown", handleClickAway);
            document.removeEventListener("keydown", handleKey);
        };
    }, [filtersOpen, isMobileFilter]);

    useEffect(() => {
        if (!socket || !user?.id) {
            return;
        }
        const bookingEvents = [
            "model.booking.status",
            "model.booking.location",
            "model.booking.reassigned",
            "model.booking.accepted",
            "model.booking.cancelled",
            "model.booking.completed",
            "model.booking.confirmed",
            "model.booking.paid"
        ];
        const invalidate = () => {
            queryClient.invalidateQueries({ queryKey: bookingKeys.lists(), exact: false }).catch(() => undefined);
        };
        bookingEvents.forEach((event) => socket.on(event, invalidate));
        return () => {
            bookingEvents.forEach((event) => socket.off(event, invalidate));
        };
    }, [socket, user?.id, queryClient]);

    const bookings = bookingsData?.bookings ?? [];
    const pageInfo = bookingsData?.meta?.page;
    const hasNext = pageInfo ? pageInfo.number < pageInfo.totalPages : bookings.length === pageSize;
    const hasPrev = pageInfo ? pageInfo.number > 1 : page > 1;

    const hasActiveFilters = statusFilter !== "all" || dateFilter !== "all";

    const toggleFilters = () => {
        if (!filtersOpen) {
            setDraftStatus(statusFilter);
            setDraftDate(dateFilter);
        }
        setFiltersOpen((value) => !value);
    };

    const applyFilters = () => {
        setStatusFilter(draftStatus);
        setDateFilter(draftDate);
        setFiltersOpen(false);
    };

    const clearFilters = () => {
        setDraftStatus("all");
        setDraftDate("all");
        setStatusFilter("all");
        setDateFilter("all");
        setFiltersOpen(false);
    };

    const dispatchChat = (bookingId: string) => {
        if (typeof window === "undefined") {
            return;
        }
        window.dispatchEvent(
            new CustomEvent("chat:open", {
                detail: { bookingId, role: "provider" }
            })
        );
    };

    const filterPanel = (
        <div className="space-y-4 text-left">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                <span>Status</span>
                <select
                    value={draftStatus}
                    onChange={(event) => setDraftStatus(event.target.value)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                >
                    {STATUS_FILTERS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                <span>Date range</span>
                <select
                    value={draftDate}
                    onChange={(event) => setDraftDate(event.target.value)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                >
                    {DATE_FILTERS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </label>
            <div className="flex items-center justify-between gap-3 pt-2">
                <Button variant="ghost" onClick={clearFilters}>
                    Clear
                </Button>
                <Button onClick={applyFilters}>Apply</Button>
            </div>
        </div>
    );

    const handlePrevPage = useCallback(() => {
        setPage((current) => Math.max(1, current - 1));
    }, []);

    const handleNextPage = useCallback(() => {
        setPage((current) => current + 1);
    }, []);

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Bookings</p>
                    <h1 className="text-2xl font-semibold text-slate-900">Manage every request</h1>
                    <p className="text-sm text-slate-500">Track history and payouts in one place.</p>
                </div>
                <div ref={filterMenuRef} className="relative inline-flex">
                    <Button variant={hasActiveFilters ? "primary" : "secondary"} onClick={toggleFilters} className="inline-flex items-center gap-2">
                        Filters
                        {hasActiveFilters && (
                            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
                                {statusConfig?.label ?? "Custom"}
                            </span>
                        )}
                    </Button>
                    {filtersOpen &&
                        (isMobileFilter ? (
                            <>
                                <div className="fixed inset-0 z-40 bg-slate-900/40" onClick={() => setFiltersOpen(false)} />
                                <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-white p-5 shadow-2xl">
                                    <div className="mb-3 flex items-center justify-between">
                                        <p className="text-base font-semibold text-slate-900">Filters</p>
                                        <button type="button" onClick={() => setFiltersOpen(false)} className="text-sm font-medium text-slate-500">
                                            Close
                                        </button>
                                    </div>
                                    {filterPanel}
                                </div>
                            </>
                        ) : (
                            <div className="absolute right-0 z-[60] mt-2 w-80 max-w-[90vw] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
                                {filterPanel}
                            </div>
                        ))}
                </div>
            </header>

            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="rounded-full bg-slate-200 px-3 py-1">
                    Status: {statusConfig?.label ?? "All bookings"}
                </span>
                <span className="rounded-full bg-slate-200 px-3 py-1">
                    Date: {DATE_FILTERS.find((option) => option.value === dateFilter)?.label ?? "Any time"}
                </span>
                {!hasActiveFilters && <span className="text-slate-400">All filters</span>}
            </div>

            <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-2 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-base font-semibold text-slate-900">Bookings list</p>
                        <p className="text-xs text-slate-500">
                            Page {pageInfo?.number ?? page} of {pageInfo?.totalPages ?? 1} • Showing {bookings.length} results
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" className="px-3 py-1 text-xs" onClick={handlePrevPage} disabled={!hasPrev}>
                            Previous
                        </Button>
                        <Button variant="ghost" className="px-3 py-1 text-xs" onClick={handleNextPage} disabled={!hasNext}>
                            Next
                        </Button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="py-16 text-center">
                        <Loading label="Loading bookings" />
                    </div>
                ) : bookings.length === 0 ? (
                    <div className="py-16 text-center text-sm text-slate-500">No bookings match the selected filters.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                <tr>
                                    <th className="px-6 py-3">Service</th>
                                    <th className="px-6 py-3">Client</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3">Scheduled / Updated</th>
                                    <th className="px-6 py-3">Payout</th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {bookings.map((booking) => {
                                    const theme = getBookingStatusTheme(booking.status);
                                    const scheduledMetaRaw = booking.meta?.scheduled_for;
                                    const scheduledMeta = typeof scheduledMetaRaw === "string" ? scheduledMetaRaw : undefined;
                                    const scheduledFor =
                                        scheduledMeta ??
                                        booking.acceptedAt ??
                                        booking.arrivedAt ??
                                        booking.serviceStartedAt;
                                    const lastUpdate =
                                        booking.paidAt ??
                                        booking.clientConfirmedAt ??
                                        booking.serviceCompletedAt ??
                                        booking.serviceStartedAt ??
                                        booking.arrivedAt ??
                                        booking.acceptedAt;
                                    return (
                                        <tr key={booking.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4">
                                                <p className="font-semibold text-slate-900">{booking.service?.name ?? "Service"}</p>
                                                <p className="text-xs text-slate-500">{booking.id.slice(0, 8)}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="font-medium text-slate-900">{booking.client?.fullName ?? "—"}</p>
                                                <p className="text-xs text-slate-500">{booking.addressText ?? "Address hidden"}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${theme.className}`}>{theme.label}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="font-medium text-slate-900">{formatTimestamp(scheduledFor)}</p>
                                                <p className="text-xs text-slate-500">{formatRelativeTime(lastUpdate)}</p>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {booking.estimateDurationMinutes ? `${booking.estimateDurationMinutes} min` : "—"}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" className="px-3 py-1 text-xs" onClick={() => dispatchChat(booking.id)}>
                                                        Chat
                                                    </Button>
                                                    <Button className="px-3 py-1 text-xs" onClick={() => navigate(`/pro/bookings/${booking.id}`)}>
                                                        View
                                                    </Button>
                                                    {!booking.feedback?.some(f => f.rater?.id === user?.id) && (booking.status === "fully_completed" || booking.status === "paid" || booking.status === "client_completed") && (
                                                        <Button
                                                            variant="secondary"
                                                            className="px-3 py-1 text-xs bg-brand-50 text-brand-700 border-none group"
                                                            onClick={() => setFeedbackPrompt({ bookingId: booking.id, clientName: booking.client?.fullName || "the client" })}
                                                        >
                                                            <StarIcon size={12} className="mr-1 group-hover:fill-current" />
                                                            Rate
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                {isFetching && (
                    <p className="px-6 pb-4 text-xs text-slate-400">
                        Refreshing…
                    </p>
                )}
            </section>

            <BookingFeedbackDialog
                open={Boolean(feedbackPrompt)}
                bookingId={feedbackPrompt?.bookingId || null}
                targetName={feedbackPrompt?.clientName || ""}
                onClose={() => setFeedbackPrompt(null)}
            />
        </div>
    );
};

export default ProviderBookings;
