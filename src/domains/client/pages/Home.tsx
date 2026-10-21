import { NeedsYourResponse } from "../../../shared/components/NeedsYourResponse";
import { useEffect, useMemo, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import classNames from "classnames";
import { useNavigate } from "react-router-dom";

import { Button } from "../../../shared/components/Button";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useOpenBookingChat } from "../../../shared/hooks/useOpenBookingChat";
import { useBookingList, useConfirmBookingMutation, useCancelBookingMutation } from "../../../shared/hooks/useBookings";
import { BookingFeedbackDialog } from "../../../shared/components/BookingFeedbackDialog";
import { AppLayout } from "../../../shared/components/AppLayout";
import { BookingLiveMapCard } from "../../../shared/components/BookingLiveMapCard";
import { BookingRequestDialog } from "../components/BookingRequestDialog";
import { BookingSearchStatus } from "../components/BookingSearchStatus";
import { PaymentReviewNotice } from "../components/PaymentReviewNotice";
import { findBookingUnderPaymentReview } from "../utils/paymentReview";
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
import { NextConsultationCard } from "../../../shared/components/NextConsultationCard";
import { useTelemedicinePolicy } from "../../../shared/hooks/useTelemedicine";
import { hasConsultationEnded } from "../../../shared/utils/telemedicine";
import { MpesaPaymentInstructions } from "../../../shared/components/MpesaPaymentInstructions";
import { WidgetError } from "../../../shared/components/WidgetError";
import { HomeCarePaymentActions } from "../components/HomeCarePaymentActions";
import { formatMsisdn } from "../utils/payerPhone";
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
  Calendar,
  House,
  Ambulance,
  Video
} from "lucide-react";
import { formatTelemedicineDateTime } from "../../../shared/utils/telemedicine";

const ACTIVE_STATUSES = [
  "accepted",
  "en_route",
  "nearby",
  "arrived",
  "in_service",
  "completed_by_provider"
];

// A remote consultation never passes through the in-person dispatch states above. It goes
// telemedicine_payment_pending -> telemedicine_paid_pending_assignment -> scheduled, so a
// list of dispatch states alone told a client holding a confirmed consultation that they
// had "No upcoming care scheduled".
const UPCOMING_STATUSES = [
  "requested",
  "accepted",
  "broadcasting",
  "scheduled",
  "telemedicine_payment_pending",
  "telemedicine_paid_pending_assignment"
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
  const { openBookingChat } = useOpenBookingChat("/app/inbox");
  const navigate = useNavigate();
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [bookingServiceId, setBookingServiceId] = useState<string | null>(null);
  const toast = useToast();
  const socket = useSocket();
  const locationAccess = useLocationAccess();
  const confirmCompletion = useConfirmBookingMutation("detail");
  const cancelBookingMutation = useCancelBookingMutation("detail");
  const [completionPrompt, setCompletionPrompt] = useState<Booking | null>(null);
  // The booking whose confirm-and-pay prompt the client put away. It is not opened again by itself; a reminder on the
  // page brings it back. Without this the prompt could not be closed, and reopened on every refresh.
  const [dismissedCompletionId, setDismissedCompletionId] = useState<string | null>(null);
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

  // The number the M-Pesa request went to, kept so the follow-up step can say where to look.
  const [chargedTo, setChargedTo] = useState<string | null>(null);
  const [paymentFailed, setPaymentFailed] = useState(false);

  const walletQuery = useWalletAccount({ enabled: Boolean(user?.id) });
  const checkinsQuery = useSelfCareCheckins(user?.id, { limit: 1 });
  const latestCheckin = checkinsQuery.data?.[0];
  // Show only readings that exist. The heart-rate chip used to read a field that is not on the record, so it
  // always said "-- bpm", and a check-in with no blood pressure showed "undefined/undefined".
  const checkinDate = latestCheckin?.checkinAt
    ? new Date(latestCheckin.checkinAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })
    : null;
  const hasHeartRate = typeof latestCheckin?.vitals?.heartRate === "number";
  const hasBloodPressure =
    typeof latestCheckin?.vitals?.bpSystolic === "number" && typeof latestCheckin?.vitals?.bpDiastolic === "number";

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
      // A remote consultation is booked into a fixed slot with a named provider, so nothing is
      // ever searching nearby providers for one. Filtering server-side rather than trimming the
      // result keeps the page counts honest.
      isTelemedicine: false,
      pageSize: 1,
      preset: "card"
    },
    { enabled: Boolean(user?.id) }
  ) as { data?: { bookings?: Booking[] } };
  // Belt and braces behind the server filter: this card announces that a search is underway,
  // and claiming that over a consultation the client has already booked is worse than showing
  // nothing at all.
  const matchingCandidate = searchingQuery.data?.bookings?.[0];
  const matchingBooking = matchingCandidate?.isTelemedicine ? undefined : matchingCandidate;


  const upcomingParams = useMemo(() => {
    // Snap to current minute to avoid infinite re-renders while keeping data relatively fresh
    const now = new Date();
    now.setSeconds(0, 0);
    return {
      statuses: UPCOMING_STATUSES,
      clientId: user?.id ?? undefined,
      pageSize: 3,
      preset: "card" as const,
      scheduledFrom: now.toISOString()
    };
  }, [user?.id]);

  const upcomingQuery = useBookingList(
    upcomingParams,
    { enabled: Boolean(user?.id) }
  ) as { data?: { bookings?: Booking[] }, isLoading: boolean, isError?: boolean, refetch: () => unknown };
  const upcomingList = upcomingQuery.data;
  const policyQuery = useTelemedicinePolicy();
  // The soonest booked video consultation that has not finished: it gets its own card with a Join button, and is
  // not repeated in the list under it.
  const nextConsultation = (upcomingList?.bookings ?? []).find(
    (b) => b.isTelemedicine && b.status === "scheduled" && !hasConsultationEnded(b.scheduledAt, b.estimateDurationMinutes)
  );
  const otherUpcoming = (upcomingList?.bookings ?? []).filter((b) => b.id !== nextConsultation?.id);

  // A payment that arrived for an appointment that could not be honoured. Surfaced above
  // everything else because the client has paid and, without this, has no way of knowing
  // anything is wrong until nobody joins the call. Declared after upcomingList because it
  // reads it.
  const underReview = findBookingUnderPaymentReview([
    activeBooking,
    matchingCandidate,
    ...(upcomingList?.bookings ?? [])
  ]);
  useEffect(() => {
    if (activeBooking?.status === "completed_by_provider" && activeBooking.id !== dismissedCompletionId) {
      setCompletionPrompt(activeBooking);
      setCompletionError(null);
    }
  }, [activeBooking, dismissedCompletionId]);

  const historyQuery = useBookingList(
    {
      statuses: HISTORY_STATUSES,
      clientId: user?.id ?? undefined,
      pageSize: 3,
      preset: "card"
    },
    { enabled: Boolean(user?.id) }
  ) as { data?: { bookings?: Booking[] }, isError?: boolean, refetch: () => unknown };
  const historyList = historyQuery.data;



  // "—" while loading, and a plain "unavailable" if the request failed, so a failure never looks like a balance.
  // A finished visit with no rating yet. Asked for here, not left inside a collapsed "Recent activity".
  const ratingDue = (historyList?.bookings ?? []).find(
    (b) => (b.status === "fully_completed" || b.status === "paid" || b.status === "client_completed") && !b.feedback?.length
  );

  const walletBalance = walletQuery.data
    ? `${walletQuery.data.currency} ${(walletQuery.data.balanceCents / 100).toLocaleString()}`
    : walletQuery.isError
      ? "Balance unavailable"
      : "—";




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
    setDismissedCompletionId(completionPrompt?.id ?? null);
    setCompletionPrompt(null);
    setCompletionError(null);
    setShowMpesaManual(false);
    setPaymentFailed(false);
    setChargedTo(null);
  };

  const closeCancelPrompt = () => {
    setCancelPrompt(null);
    setCancelReason("");
    setCancelError(null);
  };

  // `phone` arrives validated and normalised from the payment form; a different number is used for
  // this request only and is never saved to the client's profile.
  const handleConfirmCompletion = async (phone: string) => {
    if (!completionPrompt) return;

    setCompletionError(null);
    setPaymentFailed(false);

    try {
      await confirmCompletion.mutateAsync({
        bookingId: completionPrompt.id,
        decision: "confirm",
        phone
      });
      toast.showToast({
        title: "Payment requested",
        description: `Check ${formatMsisdn(phone)} to approve the M-Pesa payment.`,
        variant: "success"
      });
      setChargedTo(formatMsisdn(phone));
      setShowMpesaManual(true);
      setCompletionError(null);
    } catch (error) {
      setPaymentFailed(true);
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
          // The booking list is refreshed by the live-update service, and the effect on `activeBooking` opens
          // the prompt from it. Only a booking already loaded can be shown now; a bare id is not a booking.
          if (activeBooking) {
            setDismissedCompletionId(null);
            setCompletionPrompt(activeBooking);
          }
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
          onOpenChat={() => void openBookingChat(activeBooking.id)}
        />
      )}

      <div className="flex flex-col gap-4 pb-20">
        <ClientPageHeader
          showGreeting
          title=""
          hideInbox
          hideBackground
          className="pb-0 sm:pb-0 lg:pb-0"
        />

        <div className="flex flex-col gap-3 px-4 empty:hidden">
          <NeedsYourResponse bookingPath={(id) => `/app/bookings/${id}`} />
          {activeBooking?.status === "completed_by_provider" && !completionPrompt && (
            <section aria-label="Confirm your visit" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-slate-900">
                Your visit{activeBooking.provider?.fullName ? ` with ${activeBooking.provider.fullName}` : ""} is complete. Confirm it and pay.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  setDismissedCompletionId(null);
                  setCompletionPrompt(activeBooking);
                }}
              >
                Confirm and pay
              </Button>
            </section>
          )}
          {ratingDue && (
            <section aria-label="Rate your visit" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-slate-900">
                How was your visit{ratingDue.provider?.fullName ? ` with ${ratingDue.provider.fullName}` : ""}?
              </p>
              <Button
                size="sm"
                onClick={() =>
                  setFeedbackPrompt({ bookingId: ratingDue.id, providerName: ratingDue.provider?.fullName || "the provider" })
                }
              >
                Rate your visit
              </Button>
            </section>
          )}
        </div>

        {/* HEALTH PULSE CHIPS */}
        <section className="px-4 -mt-2 overflow-x-auto no-scrollbar">
          <div className="flex gap-2 min-w-max">
            {hasHeartRate || hasBloodPressure ? (
              <>
                {hasHeartRate && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold">
                    <Heart className="w-3 h-3" />
                    {latestCheckin?.vitals?.heartRate} bpm
                  </div>
                )}
                {hasBloodPressure && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 rounded-full text-xs font-semibold">
                    <Activity className="w-3 h-3" />
                    {latestCheckin?.vitals?.bpSystolic}/{latestCheckin?.vitals?.bpDiastolic} mmHg
                  </div>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => navigate("/app/selfcare/checkin")}
                className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/50"
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
                Log vitals
              </button>
            )}
            {checkinDate && (hasHeartRate || hasBloodPressure) && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-full text-xs font-semibold">
                Checked {checkinDate}
              </div>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-700 rounded-full text-xs font-semibold">
              <span>Wallet:</span>
              <span>{walletBalance}</span>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-4 px-4 sm:px-6">
          {underReview && (
            <PaymentReviewNotice
              onViewBooking={() => navigate(`/app/bookings/${underReview.id}`)}
            />
          )}

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
                      <p className="text-xs font-semibold text-emerald-300">Live</p>
                    </div>
                    <h2 className="mt-1 text-base font-bold text-white">
                      {activeBooking.provider?.fullName?.split(" ")[0] || "Provider"} · {formatBookingStatus(activeBooking.status)}
                    </h2>
                  </div>
                </div>
                <ChevronRight className="text-slate-500" size={20} />
              </button>
            ) : null}
          </section>

          {/* The first question a client has is "when is my next appointment?", so it comes before the
              ways to book a new one. */}
          {nextConsultation && (
            <NextConsultationCard
              booking={nextConsultation}
              withName={nextConsultation.provider?.fullName}
              joinTo={`/app/bookings/${nextConsultation.id}?join=1`}
              detailsTo={`/app/bookings/${nextConsultation.id}`}
              joinWindowBeforeMinutes={policyQuery.data?.joinWindowBeforeMinutes}
            />
          )}

          {(!nextConsultation || otherUpcoming.length > 0 || upcomingQuery.isError) && (
          <section aria-labelledby="upcoming-heading" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 id="upcoming-heading" className="text-base font-semibold text-slate-900">Your next appointments</h2>
              <button type="button" onClick={() => navigate("/app/bookings")} className="min-h-[44px] px-2 text-sm font-semibold text-tiba-blue">
                View all
              </button>
            </div>
            <div className="space-y-2">
              {upcomingQuery.isError && !upcomingList ? (
                <WidgetError what="your upcoming appointments" onRetry={() => void upcomingQuery.refetch()} />
              ) : otherUpcoming.length > 0 ? (
                otherUpcoming.slice(0, 3).map((b) => (
                  <BookingCompactCard key={b.id} booking={b} onClick={() => navigate(`/app/bookings/${b.id}`)} />
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-6 text-center">
                  <p className="text-sm text-slate-600">No upcoming care scheduled</p>
                </div>
              )}
            </div>
          </section>
          )}

          <section aria-label="Choose your care" className="border-y border-slate-200 py-4">
            <h2 className="mb-3 text-base font-semibold text-slate-900">How would you like to receive care?</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <button type="button" onClick={() => navigate("/app/telemedicine")}
                className="flex min-w-0 items-center gap-3 rounded-lg bg-tiba-blue p-4 text-left text-white transition hover:bg-tiba-blue/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tiba-blue">
                <Video className="h-6 w-6 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold">Talk to a Doctor Online</span>
                  <span className="mt-1 block text-sm text-white/90">A consultation by call or video. No home visit needed.</span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0" />
              </button>
              <div className="rounded-lg border border-tiba-gold bg-white p-4">
                <div className="mb-3 flex items-center gap-3">
                  <House className="h-6 w-6 shrink-0 text-tiba-gold" />
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Home-based care</h3>
                    <p className="mt-1 text-sm text-slate-600">Care and support at your location.</p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => openBookingDialog()}
                    className="flex min-w-0 items-center gap-2 rounded-md bg-amber-50 p-3 text-left text-slate-900 transition hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tiba-blue">
                    <House className="h-5 w-5 shrink-0 text-tiba-gold" />
                    <span className="min-w-0 flex-1 text-sm font-semibold">Book Home Care</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-tiba-gold" />
                  </button>
                  <button type="button" onClick={() => openBookingDialog()}
                    className="flex min-w-0 items-center gap-2 rounded-md bg-amber-50 p-3 text-left text-slate-900 transition hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tiba-blue">
                    <Ambulance className="h-5 w-5 shrink-0 text-tiba-gold" />
                    <span className="min-w-0 flex-1 text-sm font-semibold">Request an Ambulance</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-tiba-gold" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <LocationPermissionBanner
            status={locationAccess.status}
            error={locationAccess.error}
            onRetry={locationAccess.requestAccess}
          />

          {/* MAIN CONTENT GRID */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-3">
              {/* RECENT ACTIVITY - Collapsed by default */}
              <button
                type="button"
                onClick={() => setActivityExpanded(!activityExpanded)}
                aria-expanded={activityExpanded}
                aria-controls="recent-activity"
                className="group flex min-h-[44px] w-full items-center justify-between py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/50"
              >
                <h3 className="text-sm font-semibold text-slate-800">Recent activity</h3>
                {activityExpanded ? (
                  <ChevronUp className="h-4 w-4 text-slate-600" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-600" aria-hidden="true" />
                )}
              </button>
              {activityExpanded && (
                <div id="recent-activity" className="space-y-2">
                  {historyQuery.isError && !historyList ? (
                    <WidgetError what="your past activity" onRetry={() => void historyQuery.refetch()} />
                  ) : historyList?.bookings && historyList.bookings.length > 0 ? (
                    historyList.bookings.map((b) => (
                      <BookingCompactCard
                        key={b.id}
                        booking={b}
                        onClick={() => navigate(`/app/bookings/${b.id}`)}
                        onRate={() => b.status === "fully_completed" || b.status === "paid" || b.status === "client_completed" ? setFeedbackPrompt({ bookingId: b.id, providerName: b.provider?.fullName || "the provider" }) : undefined}
                      />
                    ))
                  ) : (
                    <p className="py-6 text-center text-sm text-slate-600">No past activity</p>
                  )}
                </div>
              )}
            </div>

            {/* SIDEBAR: QUICK ACTIONS */}
            <aside className="space-y-3">
              <button
                type="button"
                onClick={() => navigate("/app/selfcare")}
                className="flex w-full items-center gap-3 rounded-xl bg-white p-4 text-left ring-1 ring-slate-200 transition-all hover:ring-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Activity size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-600">Health Pulse</p>
                  <p className="text-sm font-bold text-slate-900">
                    {latestCheckin?.vitals?.bpSystolic
                      ? `${latestCheckin.vitals.bpSystolic}/${latestCheckin.vitals.bpDiastolic}`
                      : checkinsQuery.isError
                        ? "Unavailable"
                        : checkinsQuery.isLoading
                          ? "—"
                          : "No readings yet"}
                  </p>
                </div>
                <ChevronRight size={16} className="text-slate-500" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => navigate("/app/selfcare/checkin")}
                className="flex w-full items-center gap-3 rounded-xl bg-slate-900 p-4 text-left text-white transition-all hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-gold focus-visible:ring-offset-2"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-tiba-gold">
                  <Zap size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-300">Daily</p>
                  <p className="text-sm font-bold">Check-in</p>
                </div>
                <ChevronRight size={16} className="text-slate-300" aria-hidden="true" />
              </button>

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
        <DialogTitle className="flex items-start justify-between gap-3 text-xl font-bold text-slate-900">
          Confirm Service
          <button
            type="button"
            onClick={closeCompletionPrompt}
            disabled={confirmCompletion.isPending}
            aria-label="Close"
            className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue disabled:opacity-50"
          >
            <span aria-hidden="true" className="text-2xl leading-none">&times;</span>
          </button>
        </DialogTitle>
        <DialogContent>
          <p className="text-sm text-slate-500 leading-relaxed">
            Your provider marked the booking as complete. Please confirm if everything was handled to your satisfaction.
          </p>
          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Reason for declining (optional)</span>
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
                <p className="text-xs font-medium text-slate-500 text-center animate-pulse" role="status">
                  {chargedTo
                    ? `We sent the payment request to ${chargedTo}. If it does not appear, pay manually:`
                    : "Waiting for the M-Pesa request. If it does not appear, pay manually:"}
                </p>
                <MpesaPaymentInstructions
                  amountCents={completionPrompt?.priceCents ?? activeBooking?.priceCents ?? 0}
                  accountNumber={completionPrompt?.id.slice(0, 8).toUpperCase() ?? activeBooking?.id.slice(0, 8).toUpperCase() ?? "BOOKING"}
                />
                <Button
                  variant="ghost"
                  className="w-full text-sm font-semibold text-slate-600"
                  onClick={() => setShowMpesaManual(false)}
                >
                  Back to confirmation
                </Button>
              </div>
            ) : (
              <HomeCarePaymentActions
                savedPhone={user?.phone}
                amountCents={completionPrompt?.priceCents ?? activeBooking?.priceCents ?? 0}
                isPending={confirmCompletion.isPending}
                failed={paymentFailed}
                resetKey={completionPrompt?.id ?? null}
                onConfirm={handleConfirmCompletion}
                onDecline={handleDeclineCompletion}
              />
            )}
            <Button
              variant="ghost"
              className="mt-2 min-h-[44px] w-full text-sm font-semibold text-slate-600"
              onClick={closeCompletionPrompt}
              disabled={confirmCompletion.isPending}
            >
              {showMpesaManual ? "Close" : "Decide later"}
            </Button>
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
              <span className="text-sm font-medium text-slate-700">Reason (optional)</span>
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
  // Show when the appointment happens, not when it was requested -- on an upcoming list the
  // booking's creation date is the one date the client does not need. A remote consultation
  // is anchored to the facility's timezone; an in-person visit stays in the client's own,
  // since that is where they physically are.
  const when = booking.scheduledAt
    ? booking.isTelemedicine
      ? formatTelemedicineDateTime(booking.scheduledAt)
      : new Date(booking.scheduledAt).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : booking.createdAt
      ? new Date(booking.createdAt).toLocaleDateString()
      : "—";

  return (
    <div className="group flex items-center gap-2 rounded-xl bg-white ring-1 ring-slate-200 transition-all hover:ring-slate-300 focus-within:ring-2 focus-within:ring-tiba-blue/50">
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-3 text-left focus:outline-none"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-600 transition-colors group-hover:bg-brand-50 group-hover:text-brand-600">
          {booking.isTelemedicine ? <Video size={16} aria-hidden="true" /> : <Calendar size={16} aria-hidden="true" />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-slate-900">{booking.service?.name || "Booking"}</span>
          <span className="flex flex-wrap items-center gap-x-1.5 text-xs">
            <span className={classNames("font-semibold", theme.className.replace(/bg-\w+-\d+/, ""))}>
              {formatBookingStatus(booking.status)}
            </span>
            <span className="text-slate-500" aria-hidden="true">•</span>
            <span className="text-slate-600">{when}</span>
          </span>
        </span>
      </button>
      {showRateButton ? (
        <button
          type="button"
          className="mr-3 flex min-h-[44px] items-center gap-1 rounded-lg bg-amber-50 px-3 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/50"
          onClick={() => onRate?.()}
        >
          <StarIcon size={12} aria-hidden="true" />
          Rate
        </button>
      ) : (
        <ChevronRight size={16} className="mr-3 text-slate-500 transition-colors group-hover:text-brand-600" aria-hidden="true" />
      )}
    </div>
  );
};

export default ClientHome;
