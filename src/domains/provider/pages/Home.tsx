import { NeedsYourResponse } from "../../../shared/components/NeedsYourResponse";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import classNames from "classnames";
import { PROVIDER_UPCOMING_STATUSES } from "../../../shared/utils/providerBookingStatuses";
import { formatTelemedicineDateTime } from "../../../shared/utils/telemedicine";
import { ProviderSetupCard } from "../components/ProviderSetupCard";
import { DocumentsDueCard } from "../components/DocumentsDueCard";
import { LiveStatusCard, type LiveFix } from "../../../shared/components/LiveStatusCard";
import { useProviderLiveStatus } from "../../../shared/hooks/useLiveStatus";
import type { LiveBlocker } from "../../../shared/libs/liveStatus";
import { WidgetError } from "../../../shared/components/WidgetError";
import { NextConsultationCard } from "../../../shared/components/NextConsultationCard";
import { useTelemedicinePolicy } from "../../../shared/hooks/useTelemedicine";
import { hasConsultationEnded } from "../../../shared/utils/telemedicine";
import { ProviderFacilityAffiliation } from "../components/ProviderFacilityAffiliation";

import { Card } from "../../../shared/components/Card";
import { Button } from "../../../shared/components/Button";
import { Loading } from "../../../shared/components/Loading";
import { useToast } from "../../../shared/components/ToastProvider";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useOpenBookingChat } from "../../../shared/hooks/useOpenBookingChat";
import { useSocket } from "../../../shared/hooks/useSocket";
import { useLocationAccess } from "../../../shared/hooks/useLocationAccess";
import { providerFinancialsAreVisible, useProviderProfile } from "../hooks/useProviderProfile";
import { bookingKeys, useBookingList, useAcceptBookingMutation } from "../../../shared/hooks/useBookings";
import { BookingLiveMapCard } from "../../../shared/components/BookingLiveMapCard";
import { getBookingStatusTheme } from "../../../shared/utils/bookingStatus";
import { useLiveLocationPublisher } from "../../../shared/hooks/useLiveLocationPublisher";
import { useBroadcastQueueContext } from "../contexts/BroadcastQueueContext";
import ImmersiveProviderBookingView from "../components/ImmersiveProviderBookingView";
import { ClientHealthAlertsCard } from "../components/ClientHealthAlertsCard";
import { BookingFeedbackDialog } from "../../../shared/components/BookingFeedbackDialog";
import { RevenueSnapshot } from "../components/RevenueSnapshot";
import { PerformanceStats } from "../components/PerformanceStats";
import { useUpdateProviderStatus } from "../hooks/useProviderProfile";

import {
  Activity,
  Rocket,
  MessageCircle,
  ArrowRight,
  Calendar
} from "lucide-react";

import type { Booking } from "../../../shared/schemas/booking";

const ACTIVE_BOOKING_STATUSES = ["accepted", "en_route", "nearby", "arrived", "in_service", "completed_by_provider"] as const;
const ACTIVE_STATUS_PRIORITY: Record<string, number> = {
  accepted: 0,
  en_route: 1,
  nearby: 2,
  arrived: 3,
  in_service: 4,
  completed_by_provider: 5
};


const HISTORY_STATUSES = [
  "client_completed",
  "completed_by_provider",
  "fully_completed",
  "client_confirmed",
  "paid",
  "cancelled_by_client",
  "cancelled_by_admin",
  "expired_no_accept",
  "disputed"
] as const;

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

const formatRelativeTime = (iso?: string | null) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
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

const formatTimestamp = (iso?: string | null) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

// The time the appointment happens, not when the provider accepted it. A remote consultation is anchored
// to the facility's timezone, so it is formatted there rather than in the provider's own.
const formatAppointmentTime = (booking: Booking) => {
  if (booking.scheduledAt) {
    return booking.isTelemedicine
      ? formatTelemedicineDateTime(booking.scheduledAt)
      : formatTimestamp(booking.scheduledAt);
  }
  return formatTimestamp(booking.acceptedAt);
};

// A provider can set their own hours; every other blocker (verification, specialties, telemedicine on) is
// set by their facility, so they are told that instead of being sent somewhere they cannot act.
const resolveProviderLiveFix = (blocker: LiveBlocker): LiveFix =>
  blocker.fix === "provider_availability"
    ? { label: "Set your hours", to: "/pro/availability" }
    : { hint: "Your facility admin sets this up." };

const ProviderHome = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const { data: profile, isLoading: loadingProfile } = useProviderProfile(user?.id);
  const { queue: broadcastQueue, dismiss: dismissBroadcast } = useBroadcastQueueContext();
  const updateStatusMutation = useUpdateProviderStatus(user?.id);
  const { openBookingChat } = useOpenBookingChat("/pro/inbox");
  const providerLive = useProviderLiveStatus(user?.id);
  const acceptBookingMutation = useAcceptBookingMutation("detail");
  const location = useLocation();
  const isOnHomePage = location.pathname === "/pro/home" || location.pathname === "/pro";
  const [isTracking, setIsTracking] = useState(() => {
    // Default to true if not explicitly closed in this session
    return sessionStorage.getItem("pro_is_tracking") !== "false";
  });
  const [feedbackPrompt, setFeedbackPrompt] = useState<{ bookingId: string; clientName: string } | null>(null);

  // Sync session storage on change
  const handleSetIsTracking = (value: boolean) => {
    setIsTracking(value);
    sessionStorage.setItem("pro_is_tracking", String(value));
  };

  // Auto-hide the immersive overlay when user navigates away from home
  // The portal renders to document.body, so it would block all tab navigation
  // if left mounted while on a different route.
  useEffect(() => {
    if (!isOnHomePage) {
      setIsTracking(false);
    } else if (isOnHomePage && sessionStorage.getItem("pro_is_tracking") !== "false") {
      // Restore tracking state when returning to home
      setIsTracking(true);
    }
  }, [isOnHomePage]);

  const { data: activeList } = useBookingList(
    {
      statuses: [...ACTIVE_BOOKING_STATUSES],
      providerId: user?.id ?? undefined,
      pageSize: 10,
      preset: "detail"
    },
    { enabled: Boolean(user?.id) }
  ) as { data?: { bookings?: Booking[] } };

  const activeBooking = useMemo(() => {
    const candidates = activeList?.bookings ?? [];
    if (!candidates.length) return null;
    return [...candidates].sort((a, b) => {
      const orderA = ACTIVE_STATUS_PRIORITY[a.status] ?? Number.MAX_SAFE_INTEGER;
      const orderB = ACTIVE_STATUS_PRIORITY[b.status] ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      const timeA = a.updatedAt ?? a.acceptedAt ?? a.createdAt ?? "";
      const timeB = b.updatedAt ?? b.acceptedAt ?? b.createdAt ?? "";
      return (timeB ? new Date(timeB).getTime() : 0) - (timeA ? new Date(timeA).getTime() : 0);
    })[0] ?? null;
  }, [activeList?.bookings]);

  useEffect(() => {
    if (!activeBooking) {
      sessionStorage.removeItem("pro_is_tracking");
      setIsTracking(true); // Default next booking to expand
    }
  }, [activeBooking]);

  const { data: upcomingList, isFetching: upcomingFetching, isError: upcomingError, refetch: refetchUpcoming } = useBookingList(
    {
      statuses: [...PROVIDER_UPCOMING_STATUSES],
      providerId: user?.id ?? undefined,
      pageSize: 3,
      preset: "card"
    },
    { enabled: Boolean(user?.id) }
  ) as {
    data?: { bookings?: Booking[]; meta?: { page?: { total?: number } } };
    isFetching: boolean;
    isError?: boolean;
    refetch: () => unknown;
  };

  const { data: historyList, isFetching: historyFetching, isError: historyError, refetch: refetchHistory } = useBookingList(
    {
      statuses: [...HISTORY_STATUSES],
      providerId: user?.id ?? undefined,
      pageSize: 5,
      preset: "card"
    },
    { enabled: Boolean(user?.id) }
  ) as { data?: { bookings?: Booking[] }, isFetching: boolean, isError?: boolean, refetch: () => unknown };

  const socket = useSocket();
  const locationAccess = useLocationAccess();
  const activeBookingId = activeBooking?.id ?? null;
  const pendingInvites = broadcastQueue;

  useLiveLocationPublisher(activeBookingId, Boolean(activeBookingId) && locationAccess.isGranted);

  const toggleStatus = () => {
    if (!profile) return;
    const next = !profile.is_available;
    updateStatusMutation.mutate(next, {
      onSuccess: () => {
        toast.showToast({
          title: next ? "You are online" : "You are offline",
          description: next ? "Clients can now request you." : "You will not receive new requests.",
          variant: "success"
        });
      }
    });
  };


  const handleAcceptInvite = (bookingId: string) => {
    acceptBookingMutation.mutate(bookingId, {
      onSuccess: (booking) => {
        dismissBroadcast(bookingId);
        toast.showToast({
          title: "Booking Accepted",
          description: "Your booking is now active.",
          variant: "success"
        });
        navigate(`/pro/bookings/${booking.id}`);
      }
    });
  };

  useEffect(() => {
    if (!socket || !user?.id) return;
    const bookingEvents = [
      "model.booking.status", "model.booking.location",
      "model.booking.reassigned", "model.booking.accepted",
      "model.booking.cancelled", "model.booking.completed",
      "model.booking.confirmed", "model.booking.paid"
    ];
    const invalidateBookings = () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists(), exact: false }).catch(() => undefined);
    };
    bookingEvents.forEach((event) => socket.on(event, invalidateBookings));
    return () => bookingEvents.forEach((event) => socket.off(event, invalidateBookings));
  }, [socket, user?.id, queryClient]);

  const upcomingBookings = useMemo(() => {
    const items = upcomingList?.bookings ?? [];
    return activeBooking ? items.filter((b) => b.id !== activeBooking.id) : items;
  }, [upcomingList?.bookings, activeBooking]);

  // The list is one page of three, so its length is not the total. Use the server's count, less the active booking
  // when that one was filtered out of the page.
  const upcomingListed = upcomingList?.bookings ?? [];
  const upcomingTotal = Math.max(
    upcomingBookings.length,
    (upcomingList?.meta?.page?.total ?? upcomingListed.length) - (upcomingListed.length - upcomingBookings.length)
  );

  const policyQuery = useTelemedicinePolicy();
  const nextConsultation = upcomingBookings.find(
    (b) => b.isTelemedicine && b.status === "scheduled" && !hasConsultationEnded(b.scheduledAt, b.estimateDurationMinutes)
  );

  const historyBookings = historyList?.bookings ?? [];
  const financialsVisible = providerFinancialsAreVisible(profile);

  if (loadingProfile) return <Loading fullHeight />;

  const dispatchChat = (bookingId: string) => void openBookingChat(bookingId);

  return (
    <>
      {activeBooking && isTracking && isOnHomePage && (
        <ImmersiveProviderBookingView
          booking={activeBooking}
          onClose={() => handleSetIsTracking(false)}
          onOpenChat={() => dispatchChat(activeBooking.id)}
        />
      )}

      <div className="space-y-5 pb-20">
        {/* Non-blocking: every provider predates these fields, and a required answer would
            lock them out of their own dashboard until they filled them in. */}
        <ProviderSetupCard />

        <DocumentsDueCard />

        {/* Shown only while clients cannot book this provider, so a working provider sees no extra card. */}
        {providerLive.data && !providerLive.data.live && (
          <LiveStatusCard
            title="Clients cannot book you yet"
            subject="provider"
            status={providerLive.data}
            isLoading={false}
            isError={false}
            onRetry={() => void providerLive.refetch()}
            resolveFix={resolveProviderLiveFix}
          />
        )}

        <NeedsYourResponse bookingPath={(id) => `/pro/bookings/${id}`} />

        {pendingInvites.length > 0 && (
          <section aria-labelledby="new-requests-heading" className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500" aria-hidden="true" />
              <h2 id="new-requests-heading" className="text-sm font-bold text-slate-900">
                New requests ({pendingInvites.length})
              </h2>
            </div>
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {pendingInvites.map((offer) => (
                <li key={offer.booking.id} className="flex flex-col gap-3 rounded-xl bg-white p-3 ring-1 ring-amber-100">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{offer.booking.service?.name}</p>
                    <p className="text-sm text-slate-600">
                      {offer.distanceM ? `${(offer.distanceM / 1000).toFixed(1)} km away` : "Distance not known"}
                      {" · "}
                      received {formatRelativeTime(offer.receivedAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="min-h-[44px] flex-1 text-sm font-semibold"
                      onClick={() => handleAcceptInvite(offer.booking.id)}
                      loading={acceptBookingMutation.isPending}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="ghost"
                      className="min-h-[44px] text-sm text-slate-600 hover:bg-rose-50 hover:text-rose-700"
                      onClick={() => dismissBroadcast(offer.booking.id)}
                    >
                      Dismiss
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {nextConsultation && (
          <NextConsultationCard
            booking={nextConsultation}
            withName={nextConsultation.client?.fullName}
            joinTo={`/pro/telemedicine?join=${nextConsultation.id}`}
            detailsTo={`/pro/bookings/${nextConsultation.id}`}
            joinWindowBeforeMinutes={policyQuery.data?.joinWindowBeforeMinutes}
          />
        )}

        {/* Live Operations */}
        <div className={classNames(
          "grid grid-cols-1 gap-4",
          activeBooking ? "lg:grid-cols-3" : "lg:grid-cols-1"
        )}>
          <div className={activeBooking ? "lg:col-span-2" : undefined}>
            {activeBooking ? (
              <Card
                className="overflow-hidden border-none shadow-lg ring-1 ring-black/5 p-4"
                title="Active Booking"
                description={activeBooking.service?.name}
                badge={<span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-800">Live</span>}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white text-sm font-bold">
                      {activeBooking.client?.fullName?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">Client</p>
                      <p className="text-sm font-semibold text-slate-900">{activeBooking.client?.fullName}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      className="min-h-[44px] rounded-lg px-4 text-sm"
                      onClick={() => handleSetIsTracking(true)}
                    >
                      <Activity className="mr-1.5 h-3.5 w-3.5" />
                      Expand
                    </Button>
                    <Button
                      variant="secondary"
                      className="min-h-[44px] min-w-[44px] rounded-lg p-0"
                      aria-label="Open chat with the client"
                      onClick={() => dispatchChat(activeBooking.id)}
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <BookingLiveMapCard
                  bookingId={activeBooking.id}
                  role="provider"
                  height={240}
                  hideOverlays
                  onOpenChat={dispatchChat}
                  className="rounded-xl border border-slate-100 overflow-hidden"
                />
              </Card>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-300 shadow-md mb-4">
                  <Rocket className="h-6 w-6" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">Nothing in progress right now</h2>
                <p className="mt-1 text-sm text-slate-600">New requests appear at the top of this page as they arrive.</p>
              </div>
            )}
          </div>

          <div className={classNames(
            activeBooking ? "space-y-4" : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          )}>
            <section aria-labelledby="availability-heading" className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 id="availability-heading" className="text-sm font-bold text-slate-900">Availability</h3>
                  <p className="mt-1 text-sm text-slate-700">
                    {profile?.is_available
                      ? "You are online. Clients can request you."
                      : "You are offline. Turn this on to receive requests."}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(profile?.is_available)}
                  aria-labelledby="availability-heading"
                  onClick={toggleStatus}
                  disabled={updateStatusMutation.isPending}
                  className={classNames(
                    "relative h-8 w-14 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/50 focus-visible:ring-offset-2 disabled:opacity-60",
                    profile?.is_available ? "bg-emerald-600" : "bg-slate-400"
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={classNames(
                      "absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform",
                      profile?.is_available ? "left-7" : "left-1"
                    )}
                  />
                </button>
              </div>
            </section>

            <ProviderFacilityAffiliation facility={profile?.facility} />

            <ClientHealthAlertsCard />

          </div>
        </div>

        {/* Secondary Intelligence */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="bg-white p-4 rounded-xl ring-1 ring-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900">Upcoming</h3>
              <span className="text-xs text-slate-600">{upcomingTotal} upcoming</span>
            </div>
            {upcomingError && !upcomingList ? (
              <WidgetError what="your upcoming bookings" onRetry={() => void refetchUpcoming()} />
            ) : upcomingFetching && !upcomingBookings.length ? (
              <Loading />
            ) : upcomingBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="mb-2 h-6 w-6 text-slate-400" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-600">No upcoming bookings</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingBookings.map((booking) => {
                  const theme = getBookingStatusTheme(booking.status);
                  return (
                    <article key={booking.id} className="rounded-lg bg-slate-50 transition-colors hover:bg-slate-100">
                      <button
                        type="button"
                        onClick={() => navigate(`/pro/bookings/${booking.id}`)}
                        className="group flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg p-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/50"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 ring-1 ring-slate-200">
                            <Activity className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-slate-900">{booking.service?.name}</span>
                            <span className="block text-xs text-slate-600">
                              {booking.client?.fullName} • {formatAppointmentTime(booking)}
                            </span>
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className={classNames("rounded-full px-2 py-0.5 text-xs font-semibold", theme.className)}>
                            {theme.label}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-700" aria-hidden="true" />
                        </span>
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white p-4 rounded-xl ring-1 ring-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900">History</h3>
              <button
                type="button"
                onClick={() => navigate("/pro/bookings")}
                className="min-h-[44px] px-2 text-sm font-semibold text-tiba-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/50"
              >
                View all
              </button>
            </div>
            {historyError && !historyList ? (
              <WidgetError what="your history" onRetry={() => void refetchHistory()} />
            ) : historyFetching && !historyBookings.length ? (
              <Loading />
            ) : historyBookings.length > 0 ? (
              <div className="space-y-1">
                {historyBookings.slice(0, 5).map((booking) => {
                  const theme = getBookingStatusTheme(booking.status);
                  return (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={() => navigate(`/pro/bookings/${booking.id}`)}
                      className="group flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg p-2 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-tiba-blue/50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-900 group-hover:text-brand-600">
                          {booking.service?.name}
                        </span>
                        <span className="block text-xs text-slate-600">
                          {formatRelativeTime(booking.clientConfirmedAt ?? booking.paidAt ?? booking.serviceCompletedAt)}
                        </span>
                      </span>
                      <span className={classNames("shrink-0 text-xs font-semibold", theme.className.replace(/bg-[\w-]+|ring-[\w-]+/g, ""))}>
                        {theme.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="mb-2 h-5 w-5 text-slate-400" aria-hidden="true" />
                <p className="text-sm text-slate-600">No history yet</p>
              </div>
            )}
          </div>
        </div>
        {/* What the provider has earned and how they are doing: useful, but not what they open the app to do. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {financialsVisible && (
            <div className="lg:col-span-4">
              <RevenueSnapshot financialsVisible={financialsVisible} />
            </div>
          )}
          <div className={financialsVisible ? "lg:col-span-8" : "lg:col-span-12"}>
            <PerformanceStats />
          </div>
        </div>
      </div>

      <BookingFeedbackDialog
        open={Boolean(feedbackPrompt)}
        bookingId={feedbackPrompt?.bookingId || null}
        targetName={feedbackPrompt?.clientName || ""}
        onClose={() => setFeedbackPrompt(null)}
      />
    </>
  );
};

export default ProviderHome;
