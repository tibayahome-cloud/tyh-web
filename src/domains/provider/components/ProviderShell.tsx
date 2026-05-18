import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import HomeIcon from "@mui/icons-material/HomeOutlined";
import EventAvailableIcon from "@mui/icons-material/EventAvailableOutlined";
import MiscServicesIcon from "@mui/icons-material/DesignServicesOutlined";
import ForumIcon from "@mui/icons-material/ForumOutlined";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorderOutlined";

import { useAuth } from "../../../shared/hooks/useAuth";
import { useProviderProfile } from "../hooks/useProviderProfile";
import { useConversationBadge } from "../../../shared/hooks/useConversationBadge";
import { useBookingStore } from "../../../shared/stores/useBookingStore";
import { useBroadcastQueue } from "../hooks/useBroadcastQueue";
import { BroadcastOfferDialog } from "./BroadcastOfferDialog";
import { useToast } from "../../../shared/components/ToastProvider";
import { bookingKeys, useAcceptBookingMutation } from "../../../shared/hooks/useBookings";
import { BroadcastQueueProvider } from "../contexts/BroadcastQueueContext";
import { AppLayout } from "../../../shared/components/AppLayout";
import { useProviderLocationTracker } from "../../../shared/hooks/useProviderLocationTracker";
import type { NavItem } from "../../../shared/components/AppSidebar";

export const ProviderShell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useProviderProfile(user?.id);
  const toast = useToast();
  const { unreadCount: conversationUnread } = useConversationBadge();
  const activeBookingCount = useBookingStore((state: { active: Record<string, any> }) => Object.keys(state.active).length);
  const { queue: broadcastQueue, dismiss: dismissBroadcast, clear: clearBroadcastQueue } = useBroadcastQueue(
    user?.id,
    profile?.id
  );
  const activeBroadcast = broadcastQueue[0] ?? null;
  const acceptBookingMutation = useAcceptBookingMutation("detail");

  useProviderLocationTracker(Boolean(profile?.is_available));

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
    if (!activeBroadcast) return;
    toast.showToast({
      title: "New booking invite",
      description: activeBroadcast.booking.service?.name ?? "A client request is waiting.",
      variant: "info"
    });
  }, [activeBroadcast, toast]);

  const navItems: NavItem[] = [
    { label: "Home", to: "/pro/home", icon: <HomeIcon /> },
    { label: "Bookings", to: "/pro/bookings", icon: <EventAvailableIcon />, badge: activeBookingCount },
    { label: "Services", to: "/pro/services", icon: <MiscServicesIcon /> },
    { label: "Care", to: "/pro/selfcare", icon: <FavoriteBorderIcon /> },
    { label: "Inbox", to: "/pro/inbox", icon: <ForumIcon />, badge: conversationUnread }
  ];

  return (
    <BroadcastQueueProvider value={{ queue: broadcastQueue, dismiss: dismissBroadcast, clear: clearBroadcastQueue }}>
      <AppLayout navItems={navItems}>
        <Outlet />

        {activeBroadcast && (
          <BroadcastOfferDialog
            offer={activeBroadcast}
            onDismiss={handleSkipBroadcast}
            onView={handleViewBroadcast}
            onAccept={handleAcceptBroadcast}
            accepting={acceptBookingMutation.isPending}
          />
        )}
      </AppLayout>
    </BroadcastQueueProvider>
  );
};

export default ProviderShell;
