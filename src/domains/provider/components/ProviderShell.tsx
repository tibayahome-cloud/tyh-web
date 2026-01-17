import classNames from "classnames";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import HomeIcon from "@mui/icons-material/HomeOutlined";
import EventAvailableIcon from "@mui/icons-material/EventAvailableOutlined";
import MiscServicesIcon from "@mui/icons-material/DesignServicesOutlined";
import PaymentsIcon from "@mui/icons-material/PaymentsOutlined";
import ForumIcon from "@mui/icons-material/ForumOutlined";
import SettingsIcon from "@mui/icons-material/SettingsOutlined";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorderOutlined";

import { useAuth } from "../../../shared/hooks/useAuth";
import { useProviderProfile, useUpdateProviderHomeLocation } from "../hooks/useProviderProfile";
import { useConversationBadge } from "../../../shared/hooks/useConversationBadge";
import { useBookingStore } from "../../../shared/stores/useBookingStore";
import { useBroadcastQueue } from "../hooks/useBroadcastQueue";
import { BroadcastOfferDialog } from "./BroadcastOfferDialog";
import { Button } from "../../../shared/components/Button";
import { useToast } from "../../../shared/components/ToastProvider";
import { bookingKeys, useAcceptBookingMutation } from "../../../shared/hooks/useBookings";
import { BroadcastQueueProvider } from "../contexts/BroadcastQueueContext";
import { AppHeader } from "../../../shared/components/AppHeader";
import { useProviderLocationTracker } from "../../../shared/hooks/useProviderLocationTracker";

type NavItem = {
  label: string;
  to: string;
  icon: ReactNode;
};

const DESKTOP_NAV: NavItem[] = [
  { label: "Home", to: "/pro/home", icon: <HomeIcon fontSize="small" /> },
  { label: "Bookings", to: "/pro/bookings", icon: <EventAvailableIcon fontSize="small" /> },
  { label: "Services", to: "/pro/services", icon: <MiscServicesIcon fontSize="small" /> },
  { label: "Self care", to: "/pro/selfcare", icon: <FavoriteBorderIcon fontSize="small" /> },
  { label: "Payments", to: "/pro/payments", icon: <PaymentsIcon fontSize="small" /> },
  { label: "Inbox", to: "/pro/inbox", icon: <ForumIcon fontSize="small" /> },
  { label: "Settings", to: "/pro/settings", icon: <SettingsIcon fontSize="small" /> }
];

const MOBILE_NAV: NavItem[] = [
  { label: "Home", to: "/pro/home", icon: <HomeIcon fontSize="small" /> },
  { label: "Bookings", to: "/pro/bookings", icon: <EventAvailableIcon fontSize="small" /> },
  { label: "Services", to: "/pro/services", icon: <MiscServicesIcon fontSize="small" /> },
  { label: "Care", to: "/pro/selfcare", icon: <FavoriteBorderIcon fontSize="small" /> },
  { label: "Convos", to: "/pro/inbox", icon: <ForumIcon fontSize="small" /> }
];

export const ProviderShell = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useProviderProfile(user?.id);
  const updateHomeLocation = useUpdateProviderHomeLocation(user?.id);
  const toast = useToast();
  const [homeLocationError, setHomeLocationError] = useState<string | null>(null);
  const [homeLocationLoading, setHomeLocationLoading] = useState(false);
  const { unreadCount: conversationUnread } = useConversationBadge();
  const activeBookingCount = useBookingStore((state) => Object.keys(state.active).length);
  const { queue: broadcastQueue, dismiss: dismissBroadcast, clear: clearBroadcastQueue } = useBroadcastQueue(
    user?.id,
    profile?.id
  );
  const activeBroadcast = broadcastQueue[0] ?? null;
  const acceptBookingMutation = useAcceptBookingMutation("detail");

  useProviderLocationTracker(Boolean(profile?.is_available));

  const formatBadgeValue = (value: number) => {
    if (value > 99) {
      return "99+";
    }
    return String(value);
  };

  const navBadge = (path: string): number => {
    if (path === "/pro/bookings") {
      return activeBookingCount;
    }
    if (path === "/pro/inbox") {
      return conversationUnread;
    }
    return 0;
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleViewBroadcast = (bookingId: string) => {
    dismissBroadcast(bookingId);
    navigate(`/pro/bookings/${bookingId}`);
  };

  const handleAcceptBroadcast = async (bookingId: string) => {
    try {
      await acceptBookingMutation.mutateAsync(bookingId);
      dismissBroadcast(bookingId);
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists(), exact: false }).catch(() => undefined);
      toast.showToast({
        title: "Booking accepted",
        description: "Head to the booking timeline for next steps.",
        variant: "success"
      });
      navigate(`/pro/bookings/${bookingId}`);
    } catch (error) {
      toast.showToast({
        title: "Unable to accept booking",
        description: error instanceof Error ? error.message : "Try again or view the booking details.",
        variant: "error"
      });
    }
  };

  const handleSkipBroadcast = (bookingId: string) => {
    dismissBroadcast(bookingId);
  };

  useEffect(() => {
    if (!activeBroadcast) {
      return;
    }
    toast.showToast({
      title: "New booking invite",
      description: activeBroadcast.booking.service?.name ?? "A client request is waiting.",
      variant: "info"
    });
  }, [activeBroadcast, toast]);

  const handleSetHomeBase = () => {
    if (homeLocationLoading || updateHomeLocation.isPending) {
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      const message = "Geolocation is not supported on this device.";
      setHomeLocationError(message);
      toast.showToast({
        title: "Location unavailable",
        description: message,
        variant: "error"
      });
      return;
    }
    setHomeLocationError(null);
    setHomeLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6))
        };
        updateHomeLocation.mutate(coords, {
          onSuccess: () => {
            toast.showToast({
              title: "Home base updated",
              description: "We will use this location to route nearby bookings.",
              variant: "success"
            });
          },
          onError: (error) => {
            const message = error instanceof Error ? error.message : "Unable to save home location.";
            setHomeLocationError(message);
            toast.showToast({
              title: "Save failed",
              description: message,
              variant: "error"
            });
          },
          onSettled: () => {
            setHomeLocationLoading(false);
          }
        });
      },
      (geoError) => {
        const message = geoError?.message ?? "We could not read your current location.";
        setHomeLocationError(message);
        toast.showToast({
          title: "Location unavailable",
          description: message,
          variant: "error"
        });
        setHomeLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000
      }
    );
  };

  return (
    <BroadcastQueueProvider value={{ queue: broadcastQueue, dismiss: dismissBroadcast, clear: clearBroadcastQueue }}>
      <div className="relative flex min-h-screen bg-neutral-50 text-neutral-900">
        <div className="pointer-events-none fixed inset-0 z-0 bg-brand-radial" aria-hidden />
        <aside className="relative z-10 hidden w-72 flex-col border-r border-white/30 bg-white/80 backdrop-blur-xl lg:flex">
          <div className="flex h-full flex-col overflow-y-auto px-5 py-8">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-500">Provider</p>
              <h1 className="mt-3 text-3xl font-semibold text-neutral-900">Workspace</h1>
              <p className="mt-2 text-sm text-neutral-500">Stay on top of bookings, availability, and payouts.</p>
            </div>
            <nav className="space-y-2">
              {DESKTOP_NAV.map((item) => {
                const badgeCount = navBadge(item.to);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      classNames(
                        "group flex items-center gap-3 rounded-2xl px-4 py-2 text-sm font-semibold transition duration-150",
                        isActive ? "bg-brand-600 text-white shadow-card" : "text-neutral-600 hover:bg-neutral-100"
                      )
                    }
                  >
                    <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 text-brand-600 shadow-inner">
                      {item.icon}
                      {badgeCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[1.1rem] rounded-full bg-danger-500 px-1 text-[10px] font-bold leading-4 text-white">
                          {formatBadgeValue(badgeCount)}
                        </span>
                      )}
                    </span>
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
            <div className="mt-auto rounded-2xl border border-white/70 bg-white/80 p-5 text-sm text-neutral-600 shadow-card">
              <p className="text-xs uppercase tracking-wide text-brand-500">Daily tip</p>
              <p className="mt-1 leading-relaxed">
                Keep your profile updated so clients always see the latest qualifications and availability.
              </p>
            </div>
          </div>
        </aside>

        <div className="relative z-10 flex min-h-screen flex-1 flex-col">
          <AppHeader
            containerMaxWidth="max-w-6xl"
            user={user ?? null}
            onLogout={handleLogout}
            onNavigateProfile={() => navigate("/pro/profile")}
            onNavigatePayments={() => navigate("/pro/payments")}
          />

          <main className="flex-1 overflow-y-auto px-4 pb-28 pt-8 sm:px-10 lg:pb-12">
            {(!profile?.home_lat || !profile?.home_lng) && (
              <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-600">Home base needed</p>
                    <p className="text-sm text-amber-900">
                      Save your current location so we can prioritize broadcasts near you.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleSetHomeBase}
                    loading={homeLocationLoading || updateHomeLocation.isPending}
                  >
                    Use current location
                  </Button>
                </div>
                {homeLocationError && <p className="mt-2 text-xs text-amber-800">{homeLocationError}</p>}
              </div>
            )}
            <Outlet />
          </main>
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/40 bg-white/95 shadow-2xl lg:hidden">
          <div className="grid grid-cols-5">
            {MOBILE_NAV.map((item) => {
              const badgeCount = navBadge(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    classNames(
                      "flex flex-col items-center gap-1 py-2 text-xs font-semibold",
                      isActive ? "text-brand-600" : "text-neutral-500"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={classNames(
                          "relative flex h-10 w-10 items-center justify-center rounded-2xl transition",
                          isActive ? "bg-brand-50 text-brand-600" : "bg-transparent"
                        )}
                      >
                        {item.icon}
                        {badgeCount > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-[1.1rem] rounded-full bg-danger-500 px-1 text-[9px] font-bold leading-4 text-white">
                            {formatBadgeValue(badgeCount)}
                          </span>
                        )}
                      </span>
                      {item.label}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {activeBroadcast && (
          <BroadcastOfferDialog
            offer={activeBroadcast}
            onDismiss={handleSkipBroadcast}
            onView={handleViewBroadcast}
            onAccept={handleAcceptBroadcast}
            accepting={acceptBookingMutation.isPending}
          />
        )}
      </div>
    </BroadcastQueueProvider>
  );
};

export default ProviderShell;
