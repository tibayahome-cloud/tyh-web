import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import HomeIcon from "@mui/icons-material/HomeOutlined";
import MedicalServicesIcon from "@mui/icons-material/MedicalServicesOutlined";
import ForumIcon from "@mui/icons-material/ForumOutlined";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonthOutlined";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorderOutlined";

import { useConversationBadge } from "../../../shared/hooks/useConversationBadge";
import { AppLayout } from "../../../shared/components/AppLayout";
import { BookingRequestDialog } from "./BookingRequestDialog";
import type { NavItem } from "../../../shared/components/AppSidebar";

export const ClientShell = () => {
  const navigate = useNavigate();
  const { unreadCount: conversationUnread } = useConversationBadge();
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);

  const handleBookingCreated = (bookingId: string) => {
    setBookingDialogOpen(false);
    navigate(`/app/bookings/${bookingId}`);
  };

  const navItems: NavItem[] = [
    { label: "Home", to: "/app/home", icon: <HomeIcon /> },
    { label: "Services", to: "/app/services", icon: <MedicalServicesIcon /> },
    { label: "Care", to: "/app/selfcare", icon: <FavoriteBorderIcon /> },
    { label: "Bookings", to: "/app/bookings", icon: <CalendarMonthIcon /> },
    { label: "Inbox", to: "/app/inbox", icon: <ForumIcon />, badge: conversationUnread }
  ];

  return (
    <AppLayout navItems={navItems}>
      <Outlet />

      <BookingRequestDialog
        open={bookingDialogOpen}
        onClose={() => setBookingDialogOpen(false)}
        onCreated={handleBookingCreated}
      />
    </AppLayout>
  );
};

export default ClientShell;
