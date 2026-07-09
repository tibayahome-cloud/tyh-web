import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import classNames from "classnames";
import CloseIcon from "@mui/icons-material/CloseOutlined";
import ChatIcon from "@mui/icons-material/ChatBubbleOutline";
import PhoneIcon from "@mui/icons-material/PhoneOutlined";
import NavigationIcon from "@mui/icons-material/NavigationOutlined";
import DirectionsIcon from "@mui/icons-material/DirectionsOutlined";

import { BookingLiveMapCard } from "../../../shared/components/BookingLiveMapCard";
import { Button } from "../../../shared/components/Button";
import type { Booking } from "../../../shared/schemas/booking";
import { getBookingStatusTheme } from "../../../shared/utils/bookingStatus";
import { useMarkBookingMutation } from "../../../shared/hooks/useBookings";

type ImmersiveProviderBookingViewProps = {
    booking: Booking;
    onClose?: () => void;
    onOpenChat?: () => void;
};

export const ImmersiveProviderBookingView = ({ booking, onClose, onOpenChat }: ImmersiveProviderBookingViewProps) => {
    const navigate = useNavigate();
    const markBooking = useMarkBookingMutation();
    const [sheetExpanded, setSheetExpanded] = useState(false);

    const statusTheme = getBookingStatusTheme(booking.status);

    const clientName = booking.client?.fullName || "Client";
    const clientInitials = clientName
        .split(/\s+/)
        .filter(Boolean)
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

    const handleCall = useCallback(() => {
        if (booking.client?.phone) {
            window.location.href = `tel:${booking.client.phone}`;
        }
    }, [booking.client?.phone]);

    const handleNavigate = useCallback(() => {
        if (booking.lat && booking.lng) {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${booking.lat},${booking.lng}`;
            window.open(url, "_blank");
        }
    }, [booking.lat, booking.lng]);

    const handleStatusUpdate = useCallback(
        (action: "en_route" | "nearby" | "arrived" | "start_service" | "complete" | "client_confirmed") => {
            markBooking.mutate({ bookingId: booking.id, action });
        },
        [booking.id, markBooking]
    );

    const getActionButton = () => {
        switch (booking.status) {
            case "accepted":
                return (
                    <Button onClick={() => handleStatusUpdate("en_route")} loading={markBooking.isPending} className="flex-1">
                        Start Heading There
                    </Button>
                );
            case "en_route":
            case "nearby":
                return (
                    <Button onClick={() => handleStatusUpdate("arrived")} loading={markBooking.isPending} className="flex-1">
                        I've Arrived
                    </Button>
                );
            case "arrived":
                return (
                    <Button onClick={() => handleStatusUpdate("start_service")} loading={markBooking.isPending} className="flex-1">
                        Start Service
                    </Button>
                );
            case "in_service":
                return (
                    <Button onClick={() => handleStatusUpdate("complete")} loading={markBooking.isPending} className="flex-1">
                        Complete Service
                    </Button>
                );
            case "completed_by_provider":
                return (
                    <Button onClick={() => handleStatusUpdate("client_confirmed")} loading={markBooking.isPending} className="flex-1">
                        Request Payment (Send STK Push)
                    </Button>
                );
            default:
                return (
                    <Button onClick={() => navigate(`/pro/bookings/${booking.id}`)} variant="outline" className="flex-1">
                        View Details
                    </Button>
                );
        }
    };

    // Swipe gesture for bottom sheet
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientY);
    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStart === null) return;
        const diff = touchStart - e.changedTouches[0].clientY;
        if (diff > 50) setSheetExpanded(true);
        else if (diff < -50) setSheetExpanded(false);
        setTouchStart(null);
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-neutral-900">
            <div className="relative flex-1">
                <BookingLiveMapCard
                    bookingId={booking.id}
                    role="provider"
                    variant="immersive"
                    mapOnly
                    className="h-full w-full"
                />

                {/* Top Controls */}
                <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-lg backdrop-blur"
                    >
                        <CloseIcon className="h-5 w-5 text-neutral-700" />
                    </button>

                    <Button onClick={handleNavigate} variant="primary" className="gap-2 shadow-lg backdrop-blur">
                        <NavigationIcon className="h-4 w-4" />
                        Navigate
                    </Button>
                </div>

                {/* Floating Status Card */}
                <div className="absolute left-4 right-4 top-20 z-10">
                    <div className="flex items-center justify-between rounded-2xl bg-white/95 p-3 shadow-lg backdrop-blur">
                        <div className="flex items-center gap-3">
                            <div className={classNames("flex h-10 w-10 items-center justify-center rounded-full", statusTheme.className)}>
                                <DirectionsIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-neutral-500">Current Status</p>
                                <p className="text-sm font-bold text-neutral-900">{statusTheme.label}</p>
                            </div>
                        </div>
                        {etaLabel && (
                            <div className="text-right">
                                <p className="text-[10px] uppercase tracking-wider text-neutral-500">ETA</p>
                                <p className="text-sm font-bold text-emerald-600">5 Mins</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Sheet */}
            <div
                className={classNames(
                    "relative rounded-t-3xl bg-white shadow-2xl transition-all duration-300",
                    sheetExpanded ? "h-[50vh]" : "h-auto"
                )}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <div className="flex justify-center py-3">
                    <div className="h-1 w-10 rounded-full bg-neutral-300" />
                </div>

                <div className="px-5 pb-5">
                    <div className="flex items-center gap-4">
                        {booking.client?.avatarUrl ? (
                            <img
                                src={booking.client.avatarUrl}
                                alt={clientName}
                                className="h-14 w-14 rounded-full object-cover shadow-lg"
                            />
                        ) : (
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-lg font-bold text-white shadow-lg">
                                {clientInitials}
                            </div>
                        )}

                        <div className="flex-1">
                            <p className="text-lg font-semibold text-neutral-900">{clientName}</p>
                            <p className="text-sm text-neutral-500 truncate">{booking.addressText || "Location"}</p>
                        </div>

                        <div className="flex gap-2">
                            {booking.client?.phone && (
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

                    <div className="mt-4 flex gap-3">
                        {getActionButton()}
                        <Button onClick={() => setSheetExpanded(!sheetExpanded)} variant="secondary" className="px-4">
                            {sheetExpanded ? "Less" : "Info"}
                        </Button>
                    </div>

                    {sheetExpanded && (
                        <div className="mt-6 space-y-4">
                            <div className="rounded-2xl bg-neutral-50 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Service Info</p>
                                <p className="mt-1 text-base font-semibold text-neutral-900">{booking.service?.name}</p>
                            </div>
                            <div className="rounded-2xl bg-neutral-50 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Client Address</p>
                                <p className="mt-1 text-base font-semibold text-neutral-900">{booking.addressText}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Placeholder for ETA or other labels
const etaLabel = true;

export default ImmersiveProviderBookingView;
