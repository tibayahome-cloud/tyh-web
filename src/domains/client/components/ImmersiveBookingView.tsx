import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import classNames from "classnames";
import CloseIcon from "@mui/icons-material/CloseOutlined";
import ChatIcon from "@mui/icons-material/ChatBubbleOutline";
import PhoneIcon from "@mui/icons-material/PhoneOutlined";
import NavigationIcon from "@mui/icons-material/NavigationOutlined";
import PersonIcon from "@mui/icons-material/PersonOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutlined";

import { BookingLiveMapCard } from "../../../shared/components/BookingLiveMapCard";
import { Button } from "../../../shared/components/Button";
import type { Booking } from "../../../shared/schemas/booking";
import { getBookingStatusTheme } from "../../../shared/utils/bookingStatus";
import { PaymentRequestNotice } from "./PaymentRequestNotice";

// Status progression for the journey
const STATUS_STEPS = [
    { key: "accepted", label: "Accepted", icon: "✓" },
    { key: "en_route", label: "En Route", icon: "→" },
    { key: "arrived", label: "Arrived", icon: "📍" },
    { key: "in_service", label: "In Service", icon: "⚡" },
    { key: "completed", label: "Complete", icon: "✓" }
];

const COMPLETED_STATUSES = new Set([
    "completed_by_provider",
    "client_completed",
    "client_confirmed",
    "fully_completed",
    "paid"
]);

const getStepIndex = (status: string): number => {
    if (COMPLETED_STATUSES.has(status)) return 4;
    const index = STATUS_STEPS.findIndex((s) => s.key === status);
    return index >= 0 ? index : -1;
};

const TRACKING_STATUSES = new Set(["accepted", "en_route", "nearby", "arrived", "in_service"]);

type ImmersiveBookingViewProps = {
    booking: Booking;
    onClose?: () => void;
    onOpenChat?: () => void;
};

export const ImmersiveBookingView = ({ booking, onClose, onOpenChat }: ImmersiveBookingViewProps) => {
    const navigate = useNavigate();
    const [sheetExpanded, setSheetExpanded] = useState(false);
    const [showManual, setShowManual] = useState(false);

    const currentStepIndex = useMemo(() => getStepIndex(booking.status), [booking.status]);
    const statusTheme = getBookingStatusTheme(booking.status);

    const showMap = TRACKING_STATUSES.has(booking.status);

    const providerName = booking.provider?.fullName || "Provider";
    const providerInitials = providerName
        .split(/\s+/)
        .filter(Boolean)
        .map((p: string) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

    const handleCall = useCallback(() => {
        if (booking.provider?.phone) {
            window.location.href = `tel:${booking.provider.phone}`;
        }
    }, [booking.provider?.phone]);

    const handleViewDetails = useCallback(() => {
        navigate(`/app/bookings/${booking.id}`);
    }, [navigate, booking.id]);

    // Swipe gesture for bottom sheet
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStart(e.touches[0].clientY);
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStart === null) return;
        const diff = touchStart - e.changedTouches[0].clientY;
        if (diff > 50) {
            setSheetExpanded(true);
        } else if (diff < -50) {
            setSheetExpanded(false);
        }
        setTouchStart(null);
    };

    // In its own layer above the app bar and the bottom menu, so nothing of the page sits over the sheet or the close button.
    return createPortal(
        <div role="dialog" aria-modal="true" aria-label="Your booking" className="fixed inset-0 z-[1200] flex flex-col bg-neutral-900">
            {/* Full-Screen Map or Completion View */}
            <div className="relative flex-1">
                {showMap ? (
                    <BookingLiveMapCard
                        bookingId={booking.id}
                        role="client"
                        variant="immersive"
                        mapOnly
                        className="h-full w-full"
                    />
                ) : (
                    <div className="flex h-full w-full flex-col items-center overflow-y-auto bg-white px-5 pb-6 pt-44 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shadow-sm">
                            <CheckCircleIcon className="h-8 w-8" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900">Service finished</h2>
                        <p className="mt-1 text-sm text-slate-700">{providerName} has completed your visit.</p>
                        <div className="mt-5 w-full max-w-sm text-left">
                            <PaymentRequestNotice
                                bookingId={booking.id}
                                providerName={booking.provider?.fullName ?? null}
                                showManual={showManual}
                                onToggleManual={() => setShowManual((value) => !value)}
                            />
                        </div>
                    </div>
                )}

                {/* Top Bar */}
                <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-4 pt-[max(16px,env(safe-area-inset-top))]">
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close and go back to the home page"
                        className="flex h-11 items-center gap-1.5 rounded-full bg-white/95 pl-3 pr-4 text-sm font-semibold text-neutral-800 shadow-lg backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue"
                    >
                        <CloseIcon className="h-5 w-5" />
                        Close
                    </button>

                    {/* Status Badge */}
                    <div className={classNames("rounded-full px-4 py-2 shadow-lg backdrop-blur", statusTheme.className)}>
                        <span className="text-sm font-semibold">{statusTheme.label}</span>
                    </div>
                </div>

                {/* Status Progress Steps */}
                <div className="absolute left-4 right-4 top-[calc(4.5rem+env(safe-area-inset-top))] z-10">
                    <div className="rounded-2xl bg-white/95 p-3 shadow-lg backdrop-blur">
                        <div className="flex items-center justify-between">
                            {STATUS_STEPS.map((step, index) => {
                                const isCompleted = index < currentStepIndex;
                                const isCurrent = index === currentStepIndex;
                                const isPending = index > currentStepIndex;

                                return (
                                    <div key={step.key} className="flex flex-1 flex-col items-center">
                                        {/* Step Icon */}
                                        <div
                                            className={classNames(
                                                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all",
                                                {
                                                    "bg-brand-600 text-white": isCurrent,
                                                    "bg-emerald-500 text-white": isCompleted,
                                                    "bg-neutral-200 text-neutral-400": isPending
                                                }
                                            )}
                                        >
                                            {isCompleted ? <CheckCircleIcon className="h-4 w-4" /> : step.icon}
                                        </div>
                                        {/* Step Label */}
                                        <span
                                            className={classNames("mt-1 text-xs font-semibold", {
                                                "text-brand-600": isCurrent,
                                                "text-emerald-600": isCompleted,
                                                "text-neutral-400": isPending
                                            })}
                                        >
                                            {step.label}
                                        </span>
                                        {/* Progress Line */}
                                        {index < STATUS_STEPS.length - 1 && (
                                            <div
                                                className={classNames(
                                                    "absolute mt-4 h-0.5 w-[calc(20%-16px)]",
                                                    isCompleted ? "bg-emerald-500" : "bg-neutral-200"
                                                )}
                                                style={{ left: `calc(${(index + 0.5) * 20}% + 8px)` }}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Sheet */}
            <div
                className={classNames(
                    "relative max-h-[75dvh] overflow-y-auto rounded-t-3xl bg-white pb-[max(12px,env(safe-area-inset-bottom))] shadow-2xl transition-all duration-300 motion-reduce:transition-none",
                    sheetExpanded ? "h-[55dvh]" : "h-auto"
                )}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                {/* Drag Handle */}
                <button
                    type="button"
                    onClick={() => setSheetExpanded((open) => !open)}
                    aria-expanded={sheetExpanded}
                    aria-label={sheetExpanded ? "Show less" : "Show more about this booking"}
                    className="flex min-h-[44px] w-full items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue"
                >
                    <span className="h-1 w-10 rounded-full bg-neutral-300" />
                </button>

                {/* Provider Info */}
                <div className="px-5 pb-5">
                    <div className="flex items-center gap-4">
                        {/* Avatar */}
                        {booking.provider?.avatarUrl ? (
                            <img
                                src={booking.provider.avatarUrl}
                                alt={providerName}
                                className="h-14 w-14 rounded-full object-cover ring-2 ring-white shadow-lg"
                            />
                        ) : (
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white shadow-lg">
                                {providerInitials}
                            </div>
                        )}

                        {/* Details */}
                        <div className="flex-1">
                            <p className="text-lg font-semibold text-neutral-900">{providerName}</p>
                            <p className="text-sm text-neutral-500">
                                {booking.service?.name} • {booking.addressText || "Location"}
                            </p>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex gap-2">
                            {booking.provider?.phone && (
                                <button
                                    type="button"
                                    onClick={handleCall}
                                    className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"
                                >
                                    <PhoneIcon className="h-5 w-5" />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={onOpenChat}
                                className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600"
                            >
                                <ChatIcon className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {/* Expanded Content */}
                    {sheetExpanded && (
                        <div className="mt-6 space-y-4">
                            {/* Service Details */}
                            <div className="rounded-2xl bg-neutral-50 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Service</p>
                                <p className="mt-1 text-base font-semibold text-neutral-900">{booking.service?.name || "Service"}</p>
                                {booking.estimateDurationMinutes && (
                                    <p className="text-sm text-neutral-500">
                                        Estimated duration: {booking.estimateDurationMinutes} minutes
                                    </p>
                                )}
                            </div>

                            {/* Location */}
                            <div className="rounded-2xl bg-neutral-50 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Location</p>
                                <p className="mt-1 text-base font-semibold text-neutral-900">{booking.addressText || "No address"}</p>
                            </div>

                            {/* View Full Details Button */}
                            <Button onClick={handleViewDetails} variant="outline" className="w-full">
                                View Full Details
                            </Button>
                        </div>
                    )}

                    {/* Mini Action Row (collapsed state) */}
                    {!sheetExpanded && (
                        <div className="mt-4 flex gap-3">
                            <Button onClick={onOpenChat} variant="primary" className="flex-1 gap-2">
                                <ChatIcon className="h-4 w-4" />
                                Message
                            </Button>
                            <Button onClick={handleViewDetails} variant="outline" className="flex-1">
                                Details
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ImmersiveBookingView;
