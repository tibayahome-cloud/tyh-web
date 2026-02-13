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
import { MpesaPaymentInstructions } from "../../../shared/components/MpesaPaymentInstructions";
import { useNotificationBadge } from "../../../shared/hooks/useNotificationBadge";
import { useSelfCareCheckins } from "../../../shared/hooks/useSelfCare";
import {
  Plus,
  ArrowRight,
  Activity as VitalsIcon,
  Heart,
  Zap,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Clock as RecentIcon,
  CalendarDays
} from "lucide-react";

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
  const [showMpesaManual, setShowMpesaManual] = useState(false);
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
  const checkinsQuery = useSelfCareCheckins(user?.id, { limit: 1 });
  const latestCheckin = checkinsQuery.data?.[0];

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
  }, [activeBooking]);

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

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  }, []);

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
    setCompletionError(null);
    setShowMpesaManual(false);
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
      setShowMpesaManual(true);
      setCompletionError(null);
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

      <div className="flex flex-col gap-4 sm:gap-8 pb-20">
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

        <div className="flex flex-col gap-8 pb-10">
          {/* IMMERSIVE HERO */}
          <section className="relative -mx-4 -mt-12 overflow-hidden px-4 pb-12 pt-16 sm:-mx-8 sm:px-8">
            <div className="absolute inset-0 bg-brand-linear opacity-90" />
            <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-2xl" />

            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-black uppercase tracking-widest text-white/60">{greeting}</p>
                  <h1 className="text-3xl font-black text-white">
                    Hello, <span className="text-white/80">{firstName}</span>
                  </h1>
                </div>
                <button
                  onClick={() => navigate("/app/inbox")}
                  className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur-xl ring-1 ring-white/20 transition-all active:scale-95"
                >
                  <ChatIcon />
                  {notificationBadge.unread > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-lg">
                      {notificationBadge.unread}
                    </span>
                  )}
                </button>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
                <div className="flex shrink-0 items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-white backdrop-blur-xl ring-1 ring-white/10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Wallet</p>
                  <p className="text-base font-black">{walletBalance}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-white backdrop-blur-xl ring-1 ring-white/10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Upcoming</p>
                  <p className="text-base font-black">{upcomingCount}</p>
                </div>
              </div>
            </div>
          </section>

          {/* BENTO ACTION HUB */}
          <section className="grid grid-cols-2 gap-4">
            {activeBooking ? (
              /* LIVE TRACKER CARD */
              <button
                onClick={() => setIsTracking(true)}
                className="group relative col-span-2 flex items-center justify-between overflow-hidden rounded-[32px] bg-slate-900 p-8 text-left text-white shadow-2xl transition-all active:scale-[0.98]"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent)]" />
                <div className="relative z-10 max-w-[65%]">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Live Booking</p>
                  </div>
                  <h2 className="mt-2 text-2xl font-black leading-tight">
                    {activeBooking.provider?.fullName?.split(" ")[0] || "Matching"} is {formatBookingStatus(activeBooking.status).toLowerCase()}
                  </h2>
                  <div className="mt-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-xl text-white">
                      <MapPinIcon className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-bold opacity-80">Tap to track arrival</p>
                  </div>
                </div>
                <div className="relative z-10 hidden sm:flex h-32 w-32 items-center justify-center rounded-[40px] bg-white/5 backdrop-blur-2xl ring-1 ring-white/10 overflow-hidden">
                  <BookingLiveMapCard
                    bookingId={activeBooking.id}
                    role="client"
                    variant="immersive"
                    mapOnly
                    hideOverlays
                    className="h-full w-full opacity-50 grayscale contrast-125"
                  />
                </div>
              </button>
            ) : (
              /* BOOK CARE - LARGE SPAN */
              <button
                onClick={() => openBookingDialog()}
                className="group relative col-span-2 flex items-center justify-between overflow-hidden rounded-[32px] bg-brand-linear p-8 text-left text-white shadow-2xl transition-all active:scale-[0.98]"
              >
                <div className="relative z-10 max-w-[60%]">
                  <h2 className="text-2xl font-black leading-tight">Request Care Now</h2>
                  <p className="mt-2 text-sm font-medium text-white/80">Connect with expert providers instantly.</p>
                  <div className="mt-6 flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-600 shadow-xl transition-transform group-hover:translate-x-2">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                </div>
                <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-[32px] bg-white/10 backdrop-blur-2xl ring-1 ring-white/20">
                  <Heart className="h-12 w-12 text-white animate-pulse" />
                </div>
                <div className="absolute -bottom-8 -right-8 h-48 w-48 rounded-full bg-white/5" />
              </button>
            )}

            {/* HEALTH PULSE */}
            <div
              onClick={() => navigate("/app/selfcare")}
              className="group flex flex-col justify-between rounded-[32px] bg-white p-6 shadow-card ring-1 ring-black/5 active:scale-95 transition-transform cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <VitalsIcon className="h-5 w-5" />
                </div>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Health Pulse</p>
                <h3 className="mt-1 text-xl font-black text-slate-900">
                  {latestCheckin?.vitals?.bpSystolic ? `${latestCheckin.vitals.bpSystolic}/${latestCheckin.vitals.bpDiastolic}` : "Norm"}
                  <span className="ml-1 text-[10px] text-slate-400">mmHg</span>
                </h3>
              </div>
            </div>

            {/* DAILY CHECKIN */}
            <div
              onClick={() => navigate("/app/selfcare/checkin")}
              className="group flex flex-col justify-between rounded-[32px] bg-slate-900 p-6 text-white shadow-card active:scale-95 transition-transform cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-brand-400">
                  <Zap className="h-5 w-5 fill-current" />
                </div>
                <ChevronRight className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Self Care</p>
                <h3 className="mt-1 text-xl font-black">Daily Check-in</h3>
              </div>
            </div>
          </section>

          {/* LISTS SECTION */}
          <div className="space-y-10">
            {/* UPCOMING */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-indigo-500" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Upcoming Care</h3>
                </div>
                <button onClick={() => navigate("/app/bookings")} className="text-[10px] font-black uppercase tracking-widest text-brand-600 hover:text-brand-700">View Schedule</button>
              </div>
              <div className="space-y-4">
                {upcomingList?.bookings && upcomingList.bookings.length > 0 ? (
                  upcomingList.bookings.map((b) => (
                    <BookingCompactCard key={b.id} booking={b} onClick={() => navigate(`/app/bookings/${b.id}`)} />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-slate-100 p-10 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] bg-slate-50 text-slate-300">
                      <RecentIcon className="h-8 w-8" />
                    </div>
                    <p className="text-sm font-bold text-slate-400">Your calendar is currently clear</p>
                  </div>
                )}
              </div>
            </section>

            {/* ARTIFICIAL INTELLIGENCE */}
            <AIRecommendationsCard />

            {/* RECENT HISTORY */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RecentIcon className="h-5 w-5 text-slate-400" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Recent History</h3>
                </div>
                <button onClick={() => navigate("/app/bookings")} className="text-[10px] font-black uppercase tracking-widest text-slate-500">Full History</button>
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
                  <p className="text-center py-4 text-xs font-bold text-slate-300 italic uppercase tracking-widest">No past bookings yet</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

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
        <DialogActions className="p-4 flex-col">
          <div className="w-full">
            {showMpesaManual ? (
              <div className="space-y-4">
                <p className="text-xs font-medium text-slate-500 text-center animate-pulse">
                  Waiting for STK Push... If it doesn't appear, use manual payment:
                </p>
                <MpesaPaymentInstructions
                  amountCents={activeBooking?.priceCents ?? 0}
                  accountNumber={activeBooking?.id.slice(0, 8).toUpperCase() ?? "BOOKING"}
                />
                <Button
                  variant="ghost"
                  className="w-full text-xs font-bold text-slate-400"
                  onClick={() => setShowMpesaManual(false)}
                >
                  Back to confirmation
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
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
              </div>
            )}
          </div>
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
    </AppLayout>
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
};

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
