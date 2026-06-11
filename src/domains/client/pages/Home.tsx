import { useEffect, useMemo, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import classNames from "classnames";
import { useNavigate } from "react-router-dom";

import { Button } from "../../../shared/components/Button";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useBookingList, useConfirmBookingMutation, useCancelBookingMutation } from "../../../shared/hooks/useBookings";
import { BookingFeedbackDialog } from "../../../shared/components/BookingFeedbackDialog";
import { AppLayout } from "../../../shared/components/AppLayout";
import { BookingLiveMapCard } from "../../../shared/components/BookingLiveMapCard";
import { BookingRequestDialog } from "../components/BookingRequestDialog";
import { BookingSearchStatus } from "../components/BookingSearchStatus";
import { AIRecommendationsCard } from "../components/AIRecommendationsCard";
import { ClientPageHeader } from "../components/ClientPageHeader";
import { useToast } from "../../../shared/components/ToastProvider";
import { useSocket } from "../../../shared/hooks/useSocket";
import { Star as StarIcon, MapPin as MapPinIcon } from "lucide-react";
import { useLocationAccess } from "../../../shared/hooks/useLocationAccess";
import { LocationPermissionBanner } from "../../../shared/components/LocationPermissionBanner";
import { formatBookingStatus, getBookingStatusTheme } from "../../../shared/utils/bookingStatus";
import type { Booking } from "../../../shared/schemas/booking";
import ImmersiveBookingView from "../components/ImmersiveBookingView";
import { useWalletAccount } from "../../../shared/hooks/useWallet";
import { MpesaPaymentInstructions } from "../../../shared/components/MpesaPaymentInstructions";
import { useSelfCareCheckins } from "../../../shared/hooks/useSelfCare";
import {
  Plus,
  ArrowRight,
  Activity,
  Heart,
  Zap,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Minus,
  Calendar
} from "lucide-react";

const ACTIVE_STATUSES = [
  "accepted",
  "en_route",
  "nearby",
  "arrived",
  "in_service",
  "completed_by_provider"
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
  const [completionPrompt, setCompletionPrompt] = useState<Booking | null>(null);
  const [feedbackPrompt, setFeedbackPrompt] = useState<{ bookingId: string; providerName: string } | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [showMpesaManual, setShowMpesaManual] = useState(false);
  const [cancelPrompt, setCancelPrompt] = useState<{ bookingId: string } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);


  const [isTracking, setIsTracking] = useState(true);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [faqOpenIndex, setFaqOpenIndex] = useState<number | null>(null);

  const [stkPhone, setStkPhone] = useState(
    user?.phone ? user.phone.replace(/^\+254/, "0") : ""
  );

  const [stkPhoneError, setStkPhoneError] = useState("");

  const walletQuery = useWalletAccount({ enabled: Boolean(user?.id) });
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
    if (activeBooking?.status === "completed_by_provider") {
      setCompletionPrompt(activeBooking);
      setCompletionError(null);
      setStkPhone(user?.phone ? user.phone.replace(/^\+254/, "0") : "");
      setStkPhoneError("");
    }
  }, [activeBooking, user?.phone]);

  const { data: historyList } = useBookingList(
    {
      statuses: HISTORY_STATUSES,
      clientId: user?.id ?? undefined,
      pageSize: 3,
      preset: "card"
    },
    { enabled: Boolean(user?.id) }
  ) as { data?: { bookings?: Booking[] } };



  const walletBalance = walletQuery.data ? `${walletQuery.data.currency} ${(walletQuery.data.balanceCents / 100).toLocaleString()}` : "—";



  useEffect(() => {
    // Only access window height on client
    if (typeof window !== "undefined") {
      const handler = () => {
        // viewport height logic removed
      };
      window.addEventListener("resize", handler);
      return () => window.removeEventListener("resize", handler);
    }
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
        bookingId: completionPrompt.id,
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
        bookingId: completionPrompt.id,
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
  }, [socket, toast, user?.id, activeBooking]);

  return (
    <AppLayout fullWidth showHeader={false} disablePadding>
      {activeBooking && isTracking && (
        <ImmersiveBookingView
          booking={activeBooking}
          onClose={() => setIsTracking(false)}
          onOpenChat={() => navigate("/app/inbox")}
        />
      )}

      <div className="flex flex-col gap-4 pb-20">
        <LocationPermissionBanner
          status={locationAccess.status}
          error={locationAccess.error}
          onRetry={locationAccess.requestAccess}
        />

        <ClientPageHeader
          showGreeting
          title=""
          hideInbox
          hideBackground
          className="pb-0 sm:pb-0 lg:pb-0"
        />

        {/* HEALTH PULSE CHIPS */}
        <section className="px-4 -mt-2 overflow-x-auto no-scrollbar">
          <div className="flex gap-2 min-w-max">
            {latestCheckin?.vitals ? (
              <>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-[11px] font-bold">
                  <Heart className="w-3 h-3" />
                  {latestCheckin.vitals.pulseRate || "--"} bpm
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 rounded-full text-[11px] font-bold">
                  <Activity className="w-3 h-3" />
                  {latestCheckin.vitals.bpSystolic}/{latestCheckin.vitals.bpDiastolic}
                </div>
              </>
            ) : (
              <div onClick={() => navigate("/app/selfcare/checkin")} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-[11px] font-bold cursor-pointer">
                <Plus className="w-3 h-3" />
                Log Vitals
              </div>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-full text-[11px] font-bold">
              {walletBalance}
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-4 px-4 sm:px-6">
          {matchingBooking && (
            <BookingSearchStatus
              booking={matchingBooking}
              onView={() => navigate(`/app/bookings/${matchingBooking.id}`)}
              onCancel={() => setCancelPrompt({ bookingId: matchingBooking.id })}
            />
          )}

          {/* FOCUS CARD: THE PRIMARY ACTION */}
          <section>
            {activeBooking ? (
              <button
                onClick={() => setIsTracking(true)}
                className="group relative w-full flex items-center justify-between overflow-hidden rounded-2xl bg-slate-900 p-5 text-left text-white shadow-lg transition-all active:scale-[0.99]"
              >
                <div className="relative z-10 flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                    <MapPinIcon size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <p className="text-xs font-bold text-emerald-400 uppercase tracking-wide">Live</p>
                    </div>
                    <h2 className="mt-1 text-base font-bold text-white">
                      {activeBooking.provider?.fullName?.split(" ")[0] || "Provider"} · {formatBookingStatus(activeBooking.status)}
                    </h2>
                  </div>
                </div>
                <ChevronRight className="text-slate-500" size={20} />
              </button>
            ) : (
              <button
                onClick={() => openBookingDialog()}
                className="group relative w-full flex items-center justify-between overflow-hidden rounded-2xl bg-tiba-blue p-5 text-left text-white shadow-lg transition-all active:scale-[0.99]"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
                    <Heart size={24} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Request Care Now</h2>
                    <p className="text-sm text-white/70">Connect with medical professionals</p>
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-tiba-blue transition-transform group-hover:translate-x-1">
                  <ArrowRight size={20} />
                </div>
              </button>
            )}
          </section>

          {/* MAIN CONTENT GRID */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* UPCOMING BOOKINGS */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Upcoming</h3>
                <button onClick={() => navigate("/app/bookings")} className="text-xs font-bold text-tiba-blue">
                  View All
                </button>
              </div>
              <div className="space-y-2">
                {upcomingList?.bookings && upcomingList.bookings.length > 0 ? (
                  upcomingList.bookings.slice(0, 3).map((b) => (
                    <BookingCompactCard key={b.id} booking={b} onClick={() => navigate(`/app/bookings/${b.id}`)} />
                  ))
                ) : (
                  <div className="py-8 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center">
                    <p className="text-sm text-slate-400">No upcoming care scheduled</p>
                  </div>
                )}
              </div>

              {/* RECENT ACTIVITY - Collapsed by default */}
              <button
                onClick={() => setActivityExpanded(!activityExpanded)}
                className="w-full flex items-center justify-between py-2 group"
              >
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Recent Activity</h3>
                {activityExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {activityExpanded && (
                <div className="space-y-2">
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
                    <p className="text-center py-6 text-xs text-slate-400">No past activity</p>
                  )}
                </div>
              )}
            </div>

            {/* SIDEBAR: QUICK ACTIONS */}
            <aside className="space-y-3">
              <div
                onClick={() => navigate("/app/selfcare")}
                className="flex items-center gap-3 p-4 rounded-xl bg-white ring-1 ring-slate-100 cursor-pointer hover:ring-slate-200 transition-all"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Activity size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-400">Health Pulse</p>
                  <p className="text-sm font-bold text-slate-900">
                    {latestCheckin?.vitals?.bpSystolic ? `${latestCheckin.vitals.bpSystolic}/${latestCheckin.vitals.bpDiastolic}` : "Normal"}
                  </p>
                </div>
                <ChevronRight size={16} className="text-slate-300" />
              </div>

              <div
                onClick={() => navigate("/app/selfcare/checkin")}
                className="flex items-center gap-3 p-4 rounded-xl bg-slate-900 text-white cursor-pointer hover:bg-slate-800 transition-all"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-tiba-gold">
                  <Zap size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-400">Daily</p>
                  <p className="text-sm font-bold">Check-in</p>
                </div>
                <ChevronRight size={16} className="text-slate-600" />
              </div>

              <AIRecommendationsCard />
            </aside>
          </div>
        </div>
      </div>

      {/* Dialogs ... */}
      <Dialog
        disablePortal={false}
        container={() => document.body}
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
                  amountCents={completionPrompt?.priceCents ?? activeBooking?.priceCents ?? 0}
                  accountNumber={completionPrompt?.id.slice(0, 8).toUpperCase() ?? activeBooking?.id.slice(0, 8).toUpperCase() ?? "BOOKING"}
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
        disablePortal={false}
        container={() => document.body}
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
      className="group flex items-center justify-between gap-3 p-3 rounded-xl bg-white ring-1 ring-slate-100 transition-all hover:ring-slate-200 cursor-pointer"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
          <Calendar size={16} />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-slate-900 truncate">
            {booking.service?.name || "Booking"}
          </h4>
          <div className="flex items-center gap-1.5">
            <span className={classNames("text-[11px] font-bold", theme.className.replace(/bg-\w+-\d+/, ""))}>
              {formatBookingStatus(booking.status)}
            </span>
            <span className="text-slate-300 text-[10px]">•</span>
            <p className="text-[11px] text-slate-400">
              {booking.createdAt ? new Date(booking.createdAt).toLocaleDateString() : '—'}
            </p>
          </div>
        </div>
      </div>
      {showRateButton ? (
        <button
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-600 text-[10px] font-bold hover:bg-amber-100 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onRate?.();
          }}
        >
          <StarIcon size={12} />
          Rate
        </button>
      ) : (
        <ChevronRight size={16} className="text-slate-300 group-hover:text-brand-600 transition-colors" />
      )}
    </div>
  );
};







export default ClientHome;
