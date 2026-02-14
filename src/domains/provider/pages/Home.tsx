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

      <div className="space-y-10 pb-20">

        {/* Intelligence Layer */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <RevenueSnapshot />
          </div>
          <div className="lg:col-span-8">
            <PerformanceStats />
          </div>
        </div>

        {/* Live Operations */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {activeBooking ? (
              <Card
                className="overflow-hidden border-none shadow-2xl ring-1 ring-black/5"
                title="Active Booking"
                description={activeBooking.service?.name}
                badge={<span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600 ring-1 ring-emerald-500/20">Live Intelligence</span>}
              >
                <div className="mb-8 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white font-black">
                      {activeBooking.client?.fullName?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Client Contact</p>
                      <p className="text-sm font-bold text-slate-900">{activeBooking.client?.fullName}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      className="h-11 rounded-xl px-6"
                      onClick={() => setIsTracking(true)}
                    >
                      <Activity className="mr-2 h-4 w-4" />
                      Expand Link
                    </Button>
                    <Button
                      variant="secondary"
                      className="h-11 w-11 rounded-xl p-0"
                      onClick={() => dispatchChat(activeBooking.id)}
                    >
                      <MessageCircle className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                <BookingLiveMapCard
                  bookingId={activeBooking.id}
                  role="provider"
                  onOpenChat={dispatchChat}
                  className="rounded-3xl border border-slate-100 overflow-hidden shadow-inner aspect-video"
                />
              </Card>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center rounded-[48px] border border-dashed border-slate-200 bg-slate-50/50">
                <div className="flex h-20 w-20 items-center justify-center rounded-[32px] bg-white text-slate-300 shadow-xl ring-1 ring-black/5 mb-8">
                  <Rocket className="h-10 w-10" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">No Active Booking</h2>
                <p className="mt-2 text-sm font-bold text-slate-500 uppercase tracking-widest">Awaiting ...</p>
              </div>
            )}
          </div>

          <div className="space-y-8">
            <Card className="border-none bg-slate-900 p-8 shadow-2xl transition-all">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={classNames(
                    "flex h-10 w-10 items-center justify-center rounded-2xl border-2 transition-colors",
                    profile?.is_available ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" : "bg-slate-500/10 border-slate-500 text-slate-500"
                  )}>
                    <Power className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest">Standby Mode</h3>
                    <p className={classNames(
                      "text-[10px] font-bold uppercase tracking-widest",
                      profile?.is_available ? "text-emerald-400" : "text-slate-400"
                    )}>
                      {profile?.is_available ? "Broadcasting Live" : "Offline"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={toggleStatus}
                  disabled={updateStatusMutation.isPending}
                  className={classNames(
                    "relative h-6 w-12 rounded-full transition-colors focus:outline-none ring-2 ring-white/10",
                    profile?.is_available ? "bg-emerald-500" : "bg-slate-700"
                  )}
                >
                  <div className={classNames(
                    "absolute top-1 h-4 w-4 rounded-full bg-white transition-transform shadow-lg",
                    profile?.is_available ? "left-7" : "left-1"
                  )} />
                </button>
              </div>
              <p className="text-xs font-bold leading-relaxed uppercase tracking-widest mb-6">
                {profile?.is_available
                  ? "Your unit is visible to booking controllers. Standby for incoming broadcasts."
                  : "Booking visibility disabled. Activate to receive field invitations."}
              </p>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                <div className={classNames(
                  "h-1.5 w-1.5 rounded-full animate-pulse",
                  profile?.is_available ? "bg-emerald-500" : "bg-slate-500"
                )} />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Signal Strength: Optimal</span>
              </div>
            </Card>

            <Card className="border border-white/80 bg-white/40 p-8 shadow-2xl backdrop-blur-xl ring-1 ring-black/5">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-tiba-blue text-white shadow-xl">
                  <ExternalLink className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Quick Links</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Inbox", icon: <MessageCircle className="h-4 w-4" />, to: "/pro/inbox", color: "bg-blue-50 text-blue-600" },
                  { label: "Bookings", icon: <Calendar className="h-4 w-4" />, to: "/pro/bookings", color: "bg-emerald-50 text-emerald-600" },
                  { label: "Payments", icon: <CreditCard className="h-4 w-4" />, to: "/pro/payments", color: "bg-amber-50 text-amber-600" },
                  { label: "Settings", icon: <Settings className="h-4 w-4" />, to: "/pro/settings", color: "bg-slate-100 text-slate-600" }
                ].map((link) => (
                  <button
                    key={link.label}
                    onClick={() => navigate(link.to)}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <div className={classNames("flex h-8 w-8 items-center justify-center rounded-xl", link.color)}>
                      {link.icon}
                    </div>
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-widest leading-none">{link.label}</span>
                  </button>
                ))}
              </div>
            </Card>

            <ClientHealthAlertsCard />

            {pendingInvites.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-xl shadow-amber-100">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Live Broadcast</h3>
                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Immediate Response</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {pendingInvites.map((offer) => (
                    <article
                      key={offer.booking.id}
                      className="group relative flex flex-col gap-5 rounded-[32px] border border-white/60 bg-white/60 p-6 shadow-xl backdrop-blur-md transition-all hover:bg-white"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-lg font-black text-slate-900">{offer.booking.service?.name}</p>
                          <p className="mt-1 text-[11px] font-bold text-slate-500">
                            {offer.distanceM ? `${(offer.distanceM / 1000).toFixed(1)} km away` : "Unknown Vector"} • Radius {offer.radiusM}m
                          </p>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-500/10 animate-pulse">
                          <Clock className="h-4 w-4" />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Button
                          className="flex-1 h-11 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-tiba-blue/20"
                          onClick={() => handleAcceptInvite(offer.booking.id)}
                          loading={acceptBookingMutation.isPending}
                        >
                          Accept Booking
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-11 rounded-xl text-xs font-black uppercase tracking-widest text-slate-400 hover:text-rose-600 hover:bg-rose-50"
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
        <div className="grid gap-8 lg:grid-cols-2">
          <Card
            title="Flight Schedule"
            description="Your next confirmed visitations."
            className="border-none bg-white p-8 shadow-2xl ring-1 ring-black/5"
          >
            {upcomingFetching && !upcomingBookings.length ? (
              <Loading />
            ) : upcomingBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-slate-50 text-slate-300">
                  <Calendar className="h-8 w-8" />
                </div>
                <p className="mt-6 text-base font-black text-slate-900">Operational Queue Empty</p>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Standby for next broadcast</p>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingBookings.map((booking) => {
                  const theme = getBookingStatusTheme(booking.status);
                  return (
                    <article
                      key={booking.id}
                      className="group flex flex-col gap-4 rounded-3xl border border-slate-100 bg-slate-50/30 p-5 transition-all hover:bg-white hover:shadow-xl sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-lg shadow-black/5 ring-1 ring-black/5 text-brand-600">
                          <Activity className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900">{booking.service?.name}</p>
                          <p className="text-[11px] font-bold text-slate-500">
                            {booking.client?.fullName} • {formatTimestamp(booking.acceptedAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={classNames("rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest", theme.className)}>
                          {theme.label}
                        </span>
                        <span className="text-sm font-black text-slate-900">{formatPrice(booking.priceCents, booking.currency)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 rounded-xl"
                          onClick={() => navigate(`/pro/bookings/${booking.id}`)}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </Card>

          <Card
            title="Booking Logs"
            description="Archive of historical operations."
            className="border-none bg-white p-8 shadow-2xl ring-1 ring-black/5"
          >
            {historyFetching && !historyBookings.length ? (
              <Loading />
            ) : historyBookings.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {historyBookings.slice(0, 5).map((booking) => {
                  const theme = getBookingStatusTheme(booking.status);
                  return (
                    <li key={booking.id} className="group flex items-center justify-between gap-4 py-5 transition-all hover:px-2">
                      <div className="flex flex-col">
                        <p className="text-sm font-black text-slate-900 group-hover:text-brand-600 transition-colors">
                          {booking.service?.name}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                          {formatRelativeTime(booking.clientConfirmedAt ?? booking.paidAt ?? booking.serviceCompletedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-black text-slate-900">
                            {formatPrice(booking.priceCents, booking.currency)}
                          </span>
                          <span className={classNames("text-[9px] font-black uppercase tracking-[0.2em]", theme.className.replace(/bg-[\w-]+|ring-[\w-]+/g, ""))}>
                            {theme.label}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          className="h-9 w-9 p-0 rounded-xl"
                          onClick={() => navigate(`/pro/bookings/${booking.id}`)}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                <Activity className="h-8 w-8 opacity-20" />
                <p className="mt-4 text-sm font-bold uppercase tracking-widest">No logs found</p>
              </div>
            )}
          </Card>
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
