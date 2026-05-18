import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import classNames from "classnames";

import { Card } from "../../../shared/components/Card";
import { Button } from "../../../shared/components/Button";
import { Loading } from "../../../shared/components/Loading";
import { useToast } from "../../../shared/components/ToastProvider";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useSocket } from "../../../shared/hooks/useSocket";
import { useLocationAccess } from "../../../shared/hooks/useLocationAccess";
import { useProviderProfile } from "../hooks/useProviderProfile";
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
  Power,
  Activity,
  TrendingUp,
  Rocket,
  MessageCircle,
  ArrowRight,
  Clock,
  Calendar,
  ExternalLink,
  CreditCard,
  Settings
} from "lucide-react";

import { Booking } from "../../../shared/schemas/booking";

const ACTIVE_BOOKING_STATUSES = ["accepted", "en_route", "nearby", "arrived", "in_service", "completed_by_provider"] as const;
const ACTIVE_STATUS_PRIORITY: Record<string, number> = {
  accepted: 0,
  en_route: 1,
  nearby: 2,
  arrived: 3,
  in_service: 4,
  completed_by_provider: 5
};

const UPCOMING_STATUSES = ["accepted", "en_route", "nearby", "arrived", "in_service"] as const;

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

const formatPrice = (amountCents?: number, currency = "KES") => {
  const value = typeof amountCents === "number" ? amountCents / 100 : 0;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
};

const ProviderHome = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const { data: profile, isLoading: loadingProfile } = useProviderProfile(user?.id);
  const { queue: broadcastQueue, dismiss: dismissBroadcast } = useBroadcastQueueContext();
  const updateStatusMutation = useUpdateProviderStatus(user?.id);
  const acceptBookingMutation = useAcceptBookingMutation("detail");
  const [isTracking, setIsTracking] = useState(true);
  const [feedbackPrompt, setFeedbackPrompt] = useState<{ bookingId: string; clientName: string } | null>(null);

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

  const { data: upcomingList, isFetching: upcomingFetching } = useBookingList(
    {
      statuses: [...UPCOMING_STATUSES],
      providerId: user?.id ?? undefined,
      pageSize: 3,
      preset: "card"
    },
    { enabled: Boolean(user?.id) }
  ) as { data?: { bookings?: Booking[] }, isFetching: boolean };

  const { data: historyList, isFetching: historyFetching } = useBookingList(
    {
      statuses: [...HISTORY_STATUSES],
      providerId: user?.id ?? undefined,
      pageSize: 5,
      preset: "card"
    },
    { enabled: Boolean(user?.id) }
  ) as { data?: { bookings?: Booking[] }, isFetching: boolean };

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
          title: next ? "System Online" : "System Offline",
          description: next ? "You are now visible for nearby bookings." : "Standby mode activated.",
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
          description: `Booking #${booking.id.slice(0, 6)} is now active.`,
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

  const historyBookings = historyList?.bookings ?? [];

  if (loadingProfile) return <Loading fullHeight />;

  const dispatchChat = (bookingId: string) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("chat:open", { detail: { bookingId, role: "provider" } }));
    }
  };

  return (
    <>
      {activeBooking && isTracking && (
        <ImmersiveProviderBookingView
          booking={activeBooking}
          onClose={() => setIsTracking(false)}
          onOpenChat={() => dispatchChat(activeBooking.id)}
        />
      )}

      <div className="space-y-5 pb-20">

        {/* Intelligence Layer */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <RevenueSnapshot />
          </div>
          <div className="lg:col-span-8">
            <PerformanceStats />
          </div>
        </div>

        {/* Live Operations */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {activeBooking ? (
              <Card
                className="overflow-hidden border-none shadow-lg ring-1 ring-black/5 p-4"
                title="Active Booking"
                description={activeBooking.service?.name}
                badge={<span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">Live</span>}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white text-sm font-bold">
                      {activeBooking.client?.fullName?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">Client</p>
                      <p className="text-sm font-semibold text-slate-900">{activeBooking.client?.fullName}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      className="h-9 rounded-lg px-4 text-xs"
                      onClick={() => setIsTracking(true)}
                    >
                      <Activity className="mr-1.5 h-3.5 w-3.5" />
                      Expand
                    </Button>
                    <Button
                      variant="secondary"
                      className="h-9 w-9 rounded-lg p-0"
                      onClick={() => dispatchChat(activeBooking.id)}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <BookingLiveMapCard
                  bookingId={activeBooking.id}
                  role="provider"
                  onOpenChat={dispatchChat}
                  className="rounded-xl border border-slate-100 overflow-hidden aspect-video"
                />
              </Card>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-300 shadow-md mb-4">
                  <Rocket className="h-6 w-6" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">No Active Booking</h2>
                <p className="mt-1 text-[11px] text-slate-500">Awaiting requests...</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-slate-900 p-4 rounded-xl shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={classNames(
                    "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
                    profile?.is_available ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" : "bg-slate-500/10 border-slate-500 text-slate-500"
                  )}>
                    <Power className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Status</h3>
                    <p className={classNames(
                      "text-[10px] font-bold",
                      profile?.is_available ? "text-emerald-400" : "text-slate-400"
                    )}>
                      {profile?.is_available ? "Online" : "Offline"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={toggleStatus}
                  disabled={updateStatusMutation.isPending}
                  className={classNames(
                    "relative h-5 w-10 rounded-full transition-colors focus:outline-none",
                    profile?.is_available ? "bg-emerald-500" : "bg-slate-700"
                  )}
                >
                  <div className={classNames(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform shadow",
                    profile?.is_available ? "left-5" : "left-0.5"
                  )} />
                </button>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {profile?.is_available
                  ? "Visible for bookings"
                  : "Activate to receive invitations"}
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl ring-1 ring-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-tiba-blue text-white">
                  <ExternalLink className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wide">Quick Links</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Inbox", icon: <MessageCircle className="h-3.5 w-3.5" />, to: "/pro/inbox", color: "bg-blue-50 text-blue-600" },
                  { label: "Bookings", icon: <Calendar className="h-3.5 w-3.5" />, to: "/pro/bookings", color: "bg-emerald-50 text-emerald-600" },
                  { label: "Payments", icon: <CreditCard className="h-3.5 w-3.5" />, to: "/pro/payments", color: "bg-amber-50 text-amber-600" },
                  { label: "Settings", icon: <Settings className="h-3.5 w-3.5" />, to: "/pro/settings", color: "bg-slate-100 text-slate-600" }
                ].map((link) => (
                  <button
                    key={link.label}
                    onClick={() => navigate(link.to)}
                    className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 transition-all hover:bg-slate-100"
                  >
                    <div className={classNames("flex h-6 w-6 items-center justify-center rounded-md", link.color)}>
                      {link.icon}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-700">{link.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <ClientHealthAlertsCard />

            {pendingInvites.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-white">
                    <Activity className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Live Broadcasts</h3>
                    <p className="text-[10px] text-amber-600 font-bold">Respond now</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {pendingInvites.map((offer) => (
                    <article
                      key={offer.booking.id}
                      className="flex flex-col gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-100"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{offer.booking.service?.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {offer.distanceM ? `${(offer.distanceM / 1000).toFixed(1)} km` : "—"} • {offer.radiusM}m radius
                          </p>
                        </div>
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 text-amber-500 animate-pulse">
                          <Clock className="h-3 w-3" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 h-8 rounded-lg text-[11px] font-bold"
                          onClick={() => handleAcceptInvite(offer.booking.id)}
                          loading={acceptBookingMutation.isPending}
                        >
                          Accept
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-8 rounded-lg text-[11px] text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          onClick={() => dismissBroadcast(offer.booking.id)}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Secondary Intelligence */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="bg-white p-4 rounded-xl ring-1 ring-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Upcoming</h3>
              <span className="text-[10px] text-slate-400">{upcomingBookings.length} scheduled</span>
            </div>
            {upcomingFetching && !upcomingBookings.length ? (
              <Loading />
            ) : upcomingBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="h-6 w-6 text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-500">No upcoming bookings</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingBookings.map((booking) => {
                  const theme = getBookingStatusTheme(booking.status);
                  return (
                    <article
                      key={booking.id}
                      onClick={() => navigate(`/pro/bookings/${booking.id}`)}
                      className="group flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-brand-600 ring-1 ring-slate-100">
                          <Activity className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{booking.service?.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {booking.client?.fullName} • {formatTimestamp(booking.acceptedAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={classNames("rounded-full px-2 py-0.5 text-[10px] font-bold", theme.className)}>
                          {theme.label}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white p-4 rounded-xl ring-1 ring-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">History</h3>
              <button onClick={() => navigate('/pro/bookings')} className="text-[10px] text-tiba-blue font-bold">View All</button>
            </div>
            {historyFetching && !historyBookings.length ? (
              <Loading />
            ) : historyBookings.length > 0 ? (
              <div className="space-y-1">
                {historyBookings.slice(0, 5).map((booking) => {
                  const theme = getBookingStatusTheme(booking.status);
                  return (
                    <div
                      key={booking.id}
                      onClick={() => navigate(`/pro/bookings/${booking.id}`)}
                      className="group flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate group-hover:text-brand-600">
                          {booking.service?.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {formatRelativeTime(booking.clientConfirmedAt ?? booking.paidAt ?? booking.serviceCompletedAt)}
                        </p>
                      </div>
                      <span className={classNames("text-[10px] font-bold shrink-0", theme.className.replace(/bg-[\w-]+|ring-[\w-]+/g, ""))}>
                        {theme.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="h-5 w-5 text-slate-300 mb-2" />
                <p className="text-xs text-slate-400">No history yet</p>
              </div>
            )}
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
