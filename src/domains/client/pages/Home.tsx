import { useEffect, useMemo, useState } from "react";
import Drawer from "@mui/material/Drawer";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import classNames from "classnames";
import { useNavigate } from "react-router-dom";
import ChatIcon from "@mui/icons-material/ChatBubbleOutline";
import PhoneIcon from "@mui/icons-material/PhoneOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutlined";

import { Card } from "../../../shared/components/Card";
import { Button } from "../../../shared/components/Button";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useBookingList, useConfirmBookingMutation, useCancelBookingMutation } from "../../../shared/hooks/useBookings";
import { BookingFeedbackDialog } from "../../../shared/components/BookingFeedbackDialog";
import { AppLayout } from "../../../shared/components/AppLayout";
import { BookingLiveMapCard } from "../../../shared/components/BookingLiveMapCard";
import { BookingRequestDialog } from "../components/BookingRequestDialog";
import { BookingSearchStatus } from "../components/BookingSearchStatus";
import { AIRecommendationsCard } from "../components/AIRecommendationsCard";
import { useToast } from "../../../shared/components/ToastProvider";
import { useSocket } from "../../../shared/hooks/useSocket";
import { Star as StarIcon, Info as InfoIcon, MapPin as MapPinIcon } from "lucide-react";
import { useLocationAccess } from "../../../shared/hooks/useLocationAccess";
import { LocationPermissionBanner } from "../../../shared/components/LocationPermissionBanner";
import { formatBookingStatus, getBookingStatusTheme } from "../../../shared/utils/bookingStatus";
import type { Booking } from "../../../shared/schemas/booking";
import ImmersiveBookingView from "../components/ImmersiveBookingView";
import { useWalletAccount } from "../../../shared/hooks/useWallet";
import { useNotificationBadge } from "../../../shared/hooks/useNotificationBadge";

const ACTIVE_STATUSES = [
  "accepted",
  "en_route",
  "nearby",
  "arrived",
  "in_service",
  "completed_by_provider"
];

const TRACKING_STATUSES = [
  "accepted",
  "en_route",
  "nearby",
  "arrived",
  "in_service"
];

const HISTORY_STATUSES = [
  "client_completed",
  "client_confirmed",
  "fully_completed",
  "paid",
  "cancelled_by_client",
  "cancelled_by_admin",
  "expired_no_accept",
  "disputed"
];
const CANCELABLE_STATUSES = ["requested", "broadcasting"];

// Status progression for the journey stepper
const STATUS_STEPS = [
  { key: "accepted", label: "Accepted" },
  { key: "en_route", label: "En Route" },
  { key: "arrived", label: "Arrived" },
  { key: "in_service", label: "In Service" },
  { key: "completed", label: "Complete" }
];

const COMPLETED_STATUS_SET = new Set([
  "completed_by_provider",
  "client_completed",
  "client_confirmed",
  "fully_completed",
  "paid"
]);

const getStepIndex = (status: string): number => {
  if (COMPLETED_STATUS_SET.has(status)) return 4;
  const index = STATUS_STEPS.findIndex((s) => s.key === status);
  return index >= 0 ? index : -1;
};

const getDestinationLabel = (booking?: Booking) => booking?.addressText || booking?.service?.name || "Destination";

const getEtaLabel = (booking?: Booking) => {
  if (!booking) {
    return "—";
  }
  if (booking.estimateDurationMinutes) {
    return `${booking.estimateDurationMinutes} mins`;
  }
  return booking.status === "completed_by_provider" ? "Awaiting confirmation" : "—";
};

const getTimerLabel = (booking?: Booking) => {
  if (!booking) {
    return "—";
  }
  const iso =
    booking.serviceStartedAt ?? booking.arrivedAt ?? booking.acceptedAt ?? booking.clientConfirmedAt ?? booking.createdAt;
  if (!iso) {
    return "—";
  }
  const diff = Date.now() - new Date(iso).getTime();
  if (diff <= 0) {
    return "—";
  }
  const minutes = Math.floor(diff / 60000);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }
  return `${minutes}m`;
};

const ClientHome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [bookingServiceId, setBookingServiceId] = useState<string | null>(null);
  const toast = useToast();
  const socket = useSocket();
  const locationAccess = useLocationAccess();
  const confirmCompletion = useConfirmBookingMutation("detail");
  const cancelBookingMutation = useCancelBookingMutation("detail");
  const [completionPrompt, setCompletionPrompt] = useState<{ bookingId: string } | null>(null);
  const [feedbackPrompt, setFeedbackPrompt] = useState<{ bookingId: string; providerName: string } | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [cancelPrompt, setCancelPrompt] = useState<{ bookingId: string } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [isTracking, setIsTracking] = useState(true);
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight : 800
  );

  const walletQuery = useWalletAccount({ enabled: Boolean(user?.id) });
  const notificationBadge = useNotificationBadge();

  const { data: activeList } = useBookingList(
    {
      statuses: ACTIVE_STATUSES,
      clientId: user?.id ?? undefined,
      pageSize: 1,
      preset: "detail"
    },
    { enabled: Boolean(user?.id) }
  ) as { data?: { bookings?: Booking[] } };
  const activeBooking = activeList?.bookings?.[0];

  const searchingQuery = useBookingList(
    {
      statuses: ["broadcasting"],
      clientId: user?.id ?? undefined,
      pageSize: 1,
      preset: "card"
    },
    { enabled: Boolean(user?.id) }
  ) as { data?: { bookings?: Booking[] } };
  const matchingBooking = searchingQuery.data?.bookings?.[0];

  const upcomingParams = useMemo(() => {
    // Snap to current minute to avoid infinite re-renders while keeping data relatively fresh
    const now = new Date();
    now.setSeconds(0, 0);
    return {
      statuses: ["requested", "accepted", "broadcasting"],
      clientId: user?.id ?? undefined,
      pageSize: 3,
      preset: "card" as const,
      scheduledFrom: now.toISOString()
    };
  }, [user?.id]);

  const upcomingQuery = useBookingList(
    upcomingParams,
    { enabled: Boolean(user?.id) }
  ) as { data?: { bookings?: Booking[] }, isLoading: boolean };
  const upcomingList = upcomingQuery.data;
  useEffect(() => {
    if (!activeBooking) {
      setSheetExpanded(false);
    }
    if (activeBooking?.status === "completed_by_provider") {
      setCompletionPrompt({ bookingId: activeBooking.id });
      setCompletionError(null);
    }
  }, [activeBooking?.id, activeBooking?.status]);

  const { data: historyList } = useBookingList(
    {
      statuses: HISTORY_STATUSES,
      clientId: user?.id ?? undefined,
      pageSize: 3,
      preset: "card"
    },
    { enabled: Boolean(user?.id) }
  ) as { data?: { bookings?: Booking[] } };

  const upcomingCount = Number(upcomingList?.bookings?.length ?? 0);
  const historyCount = Number(historyList?.bookings?.length ?? 0);

  const walletBalance = walletQuery.data ? `${walletQuery.data.currency} ${(walletQuery.data.balanceCents / 100).toLocaleString()}` : "—";
  const unreadAlerts = notificationBadge.unread > 0 ? String(notificationBadge.unread) : "0";

  const statsChips = [
    { label: "Wallet", value: walletBalance, highlight: true },
    { label: "Upcoming", value: String(upcomingCount) },
    { label: "Alerts", value: unreadAlerts, alert: notificationBadge.unread > 0 }
  ];
  const mapContainerHeight = viewportHeight;
  const collapsedSheetHeight = Math.max(viewportHeight * 0.12, 120);
  const expandedSheetHeight = Math.max(viewportHeight * 0.45, 300);
  const sheetHeight = sheetExpanded ? expandedSheetHeight : collapsedSheetHeight;
  const sheetTranslate = sheetExpanded ? expandedSheetHeight - collapsedSheetHeight : 0;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handler = () => setViewportHeight(window.innerHeight);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const openBookingDialog = (serviceId?: string) => {
    setBookingServiceId(serviceId ?? null);
    setBookingDialogOpen(true);
  };

  const handleBookingCreated = (bookingId: string) => {
    setBookingDialogOpen(false);
    setBookingServiceId(null);
    toast.showToast({
      title: "Booking requested",
      description: `We are matching you with a nearby provider (ref ${bookingId.slice(0, 6)}…).`,
      variant: "info"
    });
  };

  const closeCompletionPrompt = () => {
    setCompletionPrompt(null);
    setDeclineReason("");
    setCompletionError(null);
  };

  const closeCancelPrompt = () => {
    setCancelPrompt(null);
    setCancelReason("");
    setCancelError(null);
  };

  const handleConfirmCompletion = async () => {
    if (!completionPrompt) {
      return;
    }
    setCompletionError(null);
    try {
      await confirmCompletion.mutateAsync({
        bookingId: completionPrompt.bookingId,
        decision: "confirm"
      });
      toast.showToast({
        title: "Payment requested",
        description: "Please complete the STK push to finalize your booking.",
        variant: "success"
      });
      closeCompletionPrompt();
      setSheetExpanded(false);
    } catch (error) {
      setCompletionError(error instanceof Error ? error.message : "Unable to confirm completion. Try again.");
    }
  };

  const handleDeclineCompletion = async () => {
    if (!completionPrompt) {
      return;
    }
    if (!declineReason.trim()) {
      setCompletionError("Please share a short reason.");
      return;
    }
    setCompletionError(null);
    try {
      await confirmCompletion.mutateAsync({
        bookingId: completionPrompt.bookingId,
        decision: "decline",
        reason: declineReason.trim()
      });
      toast.showToast({
        title: "Thanks for the feedback",
        description: "Support has been notified about the issue.",
        variant: "info"
      });
      closeCompletionPrompt();
    } catch (err) {
      setCompletionError(err instanceof Error ? err.message : "Confirmation failed");
    }
  };


  const handleCancelBooking = async () => {
    if (!cancelPrompt) {
      return;
    }
    setCancelError(null);
    try {
      await cancelBookingMutation.mutateAsync({
        bookingId: cancelPrompt.bookingId,
        reason: cancelReason.trim() ? cancelReason.trim() : undefined
      });
      toast.showToast({
        title: "Booking cancelled",
        description: "Your request has been cancelled.",
        variant: "info"
      });
      closeCancelPrompt();
      setSheetExpanded(false);
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : "Unable to cancel booking. Try again.");
    }
  };

  useEffect(() => {
    if (!socket || !user?.id) {
      return;
    }
    const events = ["model.booking.accepted", "model.booking.status", "model.booking.completed"] as const;
    const subscriptions = events.map((eventName) => {
      const handler = (payload: Record<string, unknown>) => {
        const clientId = payload.client_id ?? payload.clientId;
        if (clientId && String(clientId) !== user.id) {
          return;
        }
        const bookingId = (payload.booking_id ?? payload.id) as string | undefined;
        const fallbackStatus = eventName === "model.booking.accepted" ? "accepted" : undefined;
        const statusRaw = (payload.status ?? payload.new_status ?? fallbackStatus) as string | undefined;
        if (!statusRaw) {
          return;
        }
        const label = formatBookingStatus(statusRaw);
        toast.showToast({
          title: label,
          description: `Booking${bookingId ? ` #${bookingId.slice(0, 6)}` : ""} updated.`,
          variant: statusRaw === "accepted" ? "success" : "info"
        });
        if (
          statusRaw === "completed_by_provider" &&
          bookingId &&
          (!activeBooking || bookingId === activeBooking.id)
        ) {
          setCompletionPrompt({ bookingId });
          setDeclineReason("");
          setCompletionError(null);
        }
      };
      socket.on(eventName, handler);
      return { eventName, handler };
    });
    return () => {
      subscriptions.forEach(({ eventName, handler }) => socket.off(eventName, handler));
    };
  }, [socket, toast, user?.id, activeBooking?.id]);

  const hasActiveBooking = Boolean(activeBooking);
  const firstName = user?.fullName?.split(" ")[0] || "there";

  return (
    <AppLayout fullWidth showHeader={false} disablePadding>
      {activeBooking && isTracking && (
        <ImmersiveBookingView
          booking={activeBooking}
          onClose={() => setIsTracking(false)}
          onOpenChat={() => navigate("/app/inbox")}
        />
      )}

      <div
        className={classNames(
          "flex flex-col",
          hasActiveBooking ? "gap-0 overflow-hidden pb-0" : "gap-4 sm:gap-8 pb-20"
        )}
        style={{ minHeight: hasActiveBooking ? "calc(100vh - 60px)" : undefined }}
      >
        {!hasActiveBooking && (
          <div className="px-4 pt-6 pb-2">
            <h1 className="text-2xl font-bold text-slate-900">
              Hello, <span className="text-brand-600">{firstName}</span>
            </h1>
            <p className="text-sm text-slate-500 font-medium">How can we help you today?</p>
          </div>
        )}
        <LocationPermissionBanner
          status={locationAccess.status}
          error={locationAccess.error}
          onRetry={locationAccess.requestAccess}
        />

        {matchingBooking && (
          <div className="px-0 sm:px-1">
            <BookingSearchStatus
              booking={matchingBooking}
              onView={() => navigate(`/app/bookings/${matchingBooking.id}`)}
              onCancel={() => setCancelPrompt({ bookingId: matchingBooking.id })}
            />
          </div>
        )}

        {activeBooking ? (
          <section className="fixed inset-0 z-0 h-[100dvh] w-screen">
            <div
              className="relative h-full w-full"
            >
              {TRACKING_STATUSES.includes(activeBooking.status) ? (
                <>
                  <BookingLiveMapCard
                    bookingId={activeBooking.id}
                    role="client"
                    variant="immersive"
                    mapOnly
                    hideOverlays
                    className="h-full w-full"
                    onOpenChat={() => navigate("/app/inbox")}
                  />
                  {/* Floating Info Button */}
                  <div className="absolute top-4 right-4 z-10">
                    <button
                      onClick={() => setSheetExpanded(true)}
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-900 shadow-xl ring-1 ring-black/5 transition-transform active:scale-95 hover:bg-slate-50"
                    >
                      <InfoIcon className="h-6 w-6" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-900/5 backdrop-blur-sm">
                  <div className="text-center p-6">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-4">
                      <CheckCircleIcon className="h-8 w-8" />
                    </div>
                    <p className="text-lg font-bold text-slate-900">Service Finished</p>
                    <p className="text-sm text-slate-500">Please confirm completion below</p>
                    <Button onClick={() => setCompletionPrompt({ bookingId: activeBooking.id })} className="mt-4">
                      Confirm
                    </Button>
                  </div>
                </div>
              )}

              {/* Side Pane (Drawer) */}
              <Drawer
                anchor="right"
                open={sheetExpanded}
                onClose={() => setSheetExpanded(false)}
                PaperProps={{
                  sx: { width: "100%", maxWidth: "400px", padding: 0 }
                }}
              >
                <div className="flex items-center justify-between border-b border-slate-100 p-4 bg-white/80 backdrop-blur-md sticky top-0 z-10">
                  <h2 className="text-lg font-bold text-slate-900">Current Booking</h2>
                  <button onClick={() => setSheetExpanded(false)} className="p-2 -mr-2 text-slate-400 hover:text-slate-600">
                    <span className="sr-only">Close</span>
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                <div className="p-4 space-y-6">
                  {/* Status Progress Stepper */}
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-4 border border-slate-100">
                    {STATUS_STEPS.map((step, index) => {
                      const currentIndex = getStepIndex(activeBooking.status);
                      const isCompleted = index < currentIndex;
                      const isCurrent = index === currentIndex;
                      const isPending = index > currentIndex;
                      return (
                        <div key={step.key} className="flex flex-1 flex-col items-center gap-1.5">
                          <div
                            className={classNames(
                              "flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-300",
                              {
                                "bg-slate-900 text-white shadow-lg scale-110": isCurrent,
                                "bg-emerald-500 text-white": isCompleted,
                                "bg-slate-200/50 text-slate-400": isPending
                              }
                            )}
                          >
                            {isCompleted ? <CheckCircleIcon className="h-4 w-4" /> : index + 1}
                          </div>
                          <span
                            className={classNames("text-[9px] font-bold uppercase tracking-wider", {
                              "text-slate-900": isCurrent,
                              "text-emerald-600": isCompleted,
                              "text-slate-400": isPending
                            })}
                          >
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Provider Card */}
                  <div className="flex items-center gap-4 p-4 rounded-3xl border border-slate-100 bg-white shadow-sm">
                    <div className="relative">
                      <div className="h-16 w-16 overflow-hidden rounded-2xl bg-slate-100 ring-2 ring-white shadow-md">
                        {activeBooking.provider?.avatarUrl ? (
                          <img
                            src={activeBooking.provider.avatarUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-brand-linear text-xl font-bold text-white uppercase">
                            {(activeBooking.provider?.fullName ?? "P").charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                        <CheckCircleIcon className="h-3.5 w-3.5 text-white" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xl font-bold text-slate-900 truncate">
                          {activeBooking.provider?.fullName ?? "Matching..."}
                        </p>
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-inset ring-amber-100">
                          PRO
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-500">
                        <StarIcon className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <span className="font-medium text-slate-900">4.9</span>
                        <span className="text-slate-300">•</span>
                        <span>500+ jobs</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/app/inbox`)}
                        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors"
                      >
                        <ChatIcon className="h-6 w-6" />
                      </button>
                    </div>
                  </div>

                  {/* Location Info */}
                  <div className="rounded-3xl bg-slate-50 p-5 space-y-4">
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-100">
                        <MapPinIcon className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Destination</p>
                        <p className="font-semibold text-slate-900 mt-0.5">{getDestinationLabel(activeBooking)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white p-4 border border-slate-100 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">ETA</p>
                      <p className="text-xl font-bold text-slate-900">{getEtaLabel(activeBooking)}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-4 border border-slate-100 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Status</p>
                      <p className="text-sm font-bold text-slate-900 truncate px-1">
                        {formatBookingStatus(activeBooking.status)}
                      </p>
                    </div>
                  </div>

                  {/* Main Action */}
                  <div className="pt-2">
                    <Button
                      variant="primary"
                      className="w-full h-14 rounded-2xl text-base font-bold shadow-xl shadow-slate-200"
                      onClick={() => navigate(`/app/bookings/${activeBooking.id}`)}
                    >
                      Management Dashboard
                    </Button>
                  </div>
                </div>
              </Drawer>
            </div>
          </section>
        ) : (
          <section className="flex flex-1 flex-col gap-4 sm:gap-8 px-0 sm:px-1">
            {/* Hero Stats */}
            <div className="grid grid-cols-3 gap-2 px-4 sm:px-0">
              {statsChips.map((chip, idx) => (
                <div key={chip.label} className={classNames(
                  "relative overflow-hidden rounded-2xl p-3 sm:p-4 transition-all duration-300 hover:scale-[1.02]",
                  idx === 0 ? "bg-slate-900 text-white shadow-lg" : "bg-white text-slate-900 shadow-sm border border-slate-100"
                )}>
                  <p className={classNames("text-[9px] sm:text-[10px] font-bold uppercase tracking-widest", idx === 0 ? "text-slate-400" : "text-slate-500")}>
                    {chip.label}
                  </p>
                  <p className="mt-1 text-sm sm:text-xl font-bold tracking-tight truncate">{chip.value}</p>
                  {(chip as any).alert && (
                    <div className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                  )}
                </div>
              ))}
            </div>


            {/* Quick Request */}
            <div className="px-4 sm:px-0">
              <div className="relative group">
                <div className="absolute -inset-0.5 rounded-[32px] bg-brand-linear opacity-10 blur group-hover:opacity-20 transition-opacity" />
                <Card className="relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-[28px] border-none bg-white p-6 text-center sm:p-12 shadow-md ring-1 ring-slate-100">
                  <div className="relative">
                    <div className="absolute inset-0 animate-ping rounded-full bg-brand-500/10" />
                    <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-brand-linear text-white shadow-inner">
                      <PlusIcon className="h-6 w-6" />
                    </div>
                  </div>

                  <div className="max-w-md">
                    <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Ready for a service?</h2>
                    <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed font-medium">
                      Instantly connect with the best rated home service providers in your neighborhood.
                    </p>
                  </div>

                  <div className="flex flex-row justify-center gap-2 w-full sm:w-auto mt-2">
                    <Button
                      className="flex-1 sm:flex-none sm:px-10 h-12 rounded-xl text-xs sm:text-base font-bold shadow-lg shadow-brand-100"
                      onClick={() => openBookingDialog()}
                    >
                      Request Provider
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 sm:flex-none sm:px-10 h-12 rounded-xl text-xs sm:text-base font-bold border-slate-200 text-slate-600 hover:bg-slate-50"
                      onClick={() => navigate("/app/services")}
                    >
                      Services
                    </Button>
                  </div>
                </Card>
              </div>
            </div>

            {/* Lists */}
            <div className="grid gap-6 lg:grid-cols-2 px-4 sm:px-0">
              {/* Upcoming */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Upcoming</h3>
                  <button onClick={() => navigate("/app/bookings")} className="text-[10px] font-bold text-brand-600 uppercase tracking-widest hover:underline">
                    View All
                  </button>
                </div>
                <div className="space-y-3">
                  {upcomingList?.bookings && upcomingList.bookings.length > 0 ? (
                    upcomingList.bookings.map((b) => (
                      <BookingCompactCard key={b.id} booking={b} onClick={() => navigate(`/app/bookings/${b.id}`)} />
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                      No upcoming bookings scheduled
                    </div>
                  )}
                </div>
              </div>

              {/* History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">History</h3>
                  <button onClick={() => navigate("/app/bookings")} className="text-[10px] font-bold text-brand-600 uppercase tracking-widest hover:underline">
                    Past orders
                  </button>
                </div>
                <div className="space-y-3">
                  {historyList?.bookings && historyList.bookings.length > 0 ? (
                    historyList.bookings.map((b) => (
                      <BookingCompactCard
                        key={b.id}
                        booking={b}
                        onClick={() => navigate(`/app/bookings/${b.id}`)}
                        onRate={() => b.status === "fully_completed" || b.status === "paid" || b.status === "client_completed" ? setFeedbackPrompt({ bookingId: b.id, providerName: b.provider?.fullName || "the provider" }) : undefined}
                      />
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                      No past bookings found
                    </div>
                  )}
                </div>
              </div>
            </div>

            <AIRecommendationsCard />
          </section>
        )
        }

        {/* Dialogs ... */}
        <Dialog
          open={Boolean(completionPrompt)}
          onClose={confirmCompletion.isPending ? undefined : closeCompletionPrompt}
          PaperProps={{ sx: { borderRadius: "24px", p: 1 } }}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle className="text-xl font-bold text-slate-900">Confirm Service</DialogTitle>
          <DialogContent>
            <p className="text-sm text-slate-500 leading-relaxed">
              Your provider marked the booking as complete. Please confirm if everything was handled to your satisfaction.
            </p>
            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Reason for decline (Optional)</span>
                <textarea
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:border-brand-500 focus:bg-white focus:outline-none transition-all"
                  rows={3}
                  value={declineReason}
                  onChange={(event) => setDeclineReason(event.target.value)}
                  placeholder="Tell us what went wrong..."
                  disabled={confirmCompletion.isPending}
                />
              </label>
            </div>
            {completionError && <p className="mt-3 text-xs font-semibold text-rose-500 px-1">{completionError}</p>}
          </DialogContent>
          <DialogActions className="p-4 gap-2">
            <Button
              variant="secondary"
              className="flex-1 rounded-xl h-12"
              onClick={handleDeclineCompletion}
              loading={confirmCompletion.isPending}
            >
              Decline
            </Button>
            <Button
              className="flex-1 rounded-xl h-12 shadow-lg shadow-brand-100"
              onClick={handleConfirmCompletion}
              loading={confirmCompletion.isPending}
            >
              Confirm & Pay
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={Boolean(cancelPrompt)}
          onClose={cancelBookingMutation.isPending ? undefined : closeCancelPrompt}
          PaperProps={{ sx: { borderRadius: "24px", p: 1 } }}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle className="text-xl font-bold text-rose-600">Cancel Booking?</DialogTitle>
          <DialogContent>
            <p className="text-sm text-slate-500 leading-relaxed">
              This will stop the current search. Are you sure you want to stop finding a provider?
            </p>
            <div className="mt-6">
              <label className="block">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Reason (Optional)</span>
                <textarea
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:border-brand-500 focus:bg-white focus:outline-none transition-all"
                  rows={3}
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  placeholder="Why are you cancelling?"
                  disabled={cancelBookingMutation.isPending}
                />
              </label>
            </div>
            {cancelError && <p className="mt-3 text-xs font-semibold text-rose-500 px-1">{cancelError}</p>}
          </DialogContent>
          <DialogActions className="p-4 gap-2">
            <Button variant="ghost" className="flex-1 rounded-xl h-12" onClick={closeCancelPrompt} disabled={cancelBookingMutation.isPending}>
              Keep it
            </Button>
            <Button
              variant="secondary"
              className="flex-1 rounded-xl h-12 bg-rose-50 text-rose-600 border-none hover:bg-rose-100"
              onClick={handleCancelBooking}
              loading={cancelBookingMutation.isPending}
            >
              Stop Search
            </Button>
          </DialogActions>
        </Dialog>

        <BookingRequestDialog
          open={bookingDialogOpen}
          serviceId={bookingServiceId ?? undefined}
          onClose={() => setBookingDialogOpen(false)}
          onCreated={handleBookingCreated}
        />

        <BookingFeedbackDialog
          open={Boolean(feedbackPrompt)}
          bookingId={feedbackPrompt?.bookingId || null}
          targetName={feedbackPrompt?.providerName || ""}
          onClose={() => setFeedbackPrompt(null)}
        />
      </div >
    </AppLayout >
  );
};

const BookingCompactCard = ({
  booking,
  onClick,
  onRate
}: {
  booking: Booking;
  onClick: () => void;
  onRate?: () => void;
}) => {
  const theme = getBookingStatusTheme(booking.status);
  const showRateButton = onRate && !booking.feedback?.length && (booking.status === "fully_completed" || booking.status === "paid" || booking.status === "client_completed");

  return (
    <div
      onClick={onClick}
      className="group flex flex-col gap-3 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm transition-all hover:shadow-md hover:border-slate-200 cursor-pointer"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
            <CalendarIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-slate-900 truncate">
              {booking.service?.name || "Booking Service"}
            </h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={classNames("text-[10px] font-bold uppercase tracking-wider", theme.className.replace(/bg-\w+-\d+/, ""))}>
                {formatBookingStatus(booking.status)}
              </span>
              <span className="text-[10px] text-slate-300">•</span>
              <span className="text-[10px] text-slate-400 font-medium">
                {booking.createdAt ? new Date(booking.createdAt).toLocaleDateString() : '—'}
              </span>
            </div>
          </div>
        </div>
        {!showRateButton && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover:bg-brand-600 group-hover:text-white transition-all transform group-hover:translate-x-1">
            <ArrowRightIcon className="h-4 w-4" />
          </div>
        )}
      </div>

      {showRateButton && (
        <div className="pt-2 border-t border-slate-50">
          <Button
            size="sm"
            variant="secondary"
            className="w-full h-9 rounded-xl text-[10px] uppercase tracking-widest font-bold group/btn"
            onClick={(e) => {
              e.stopPropagation();
              onRate?.();
            }}
          >
            <StarIcon className="mr-2 h-3 w-3 group-hover/btn:fill-current" />
            Rate Experience
          </Button>
        </div>
      )}
    </div>
  );
}

const InfoChip = ({ label, value }: { label: string; value: string | null }) => (
  <div className="rounded-xl border border-slate-100 bg-white/60 p-2 text-center shadow-sm">
    <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
    <p className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold text-slate-900">
      {value || "—"}
    </p>
  </div>
);

const PlusIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const CalendarIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const ArrowRightIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);



export default ClientHome;
