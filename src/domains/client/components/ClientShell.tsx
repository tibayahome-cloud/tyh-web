import classNames from "classnames";
import { useState, type ReactNode } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import HomeIcon from "@mui/icons-material/HomeOutlined";
import MedicalServicesIcon from "@mui/icons-material/MedicalServicesOutlined";
import ForumIcon from "@mui/icons-material/ForumOutlined";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonthOutlined";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorderOutlined";
import AddIcon from "@mui/icons-material/Add";

import { useAuth } from "../../../shared/hooks/useAuth";
import { useConversationBadge } from "../../../shared/hooks/useConversationBadge";
import { AppHeader } from "../../../shared/components/AppHeader";
import { BookingRequestDialog } from "./BookingRequestDialog";

type NavItem = {
  label: string;
  to: string;
  icon: ReactNode;
};

const DESKTOP_NAV: NavItem[] = [
  { label: "Home", to: "/app/home", icon: <HomeIcon fontSize="small" /> },
  { label: "Services", to: "/app/services", icon: <MedicalServicesIcon fontSize="small" /> },
  { label: "Self care", to: "/app/selfcare", icon: <FavoriteBorderIcon fontSize="small" /> },
  { label: "Bookings", to: "/app/bookings", icon: <CalendarMonthIcon fontSize="small" /> },
  { label: "Inbox", to: "/app/inbox", icon: <ForumIcon fontSize="small" /> }
];

const MOBILE_NAV: NavItem[] = [
  { label: "Home", to: "/app/home", icon: <HomeIcon fontSize="small" /> },
  { label: "Services", to: "/app/services", icon: <MedicalServicesIcon fontSize="small" /> },
  { label: "Bookings", to: "/app/bookings", icon: <CalendarMonthIcon fontSize="small" /> },
  { label: "Care", to: "/app/selfcare", icon: <FavoriteBorderIcon fontSize="small" /> },
  { label: "Inbox", to: "/app/inbox", icon: <ForumIcon fontSize="small" /> }
];

export const ClientShell = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount: conversationUnread } = useConversationBadge();
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);

  const formatBadgeValue = (value: number) => {
    if (value > 99) {
      return "99+";
    }
    return String(value);
  };

  const navBadge = (path: string): number => {
    if (path === "/app/inbox") {
      return conversationUnread;
    }
    return 0;
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleBookingCreated = (bookingId: string) => {
    setBookingDialogOpen(false);
    navigate(`/app/bookings/${bookingId}`);
  };

  const renderNavItem = (item: NavItem, isActive: boolean) => {
    const badgeCount = navBadge(item.to);
    return (
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
        <span className="text-[10px]">{item.label}</span>
      </>
    );
  };

  return (
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900">
      <div className="pointer-events-none fixed inset-0 z-0 bg-brand-radial" aria-hidden />

      {/* Desktop Sidebar */}
      <aside className="relative z-10 hidden w-72 flex-col border-r border-white/20 bg-white/70 backdrop-blur-xl lg:flex">
        <div className="flex h-full flex-col overflow-y-auto px-5 py-8">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-600">Tiba Ya Home</p>
            <h1 className="mt-3 text-3xl font-semibold text-neutral-900">Client space</h1>
            <p className="mt-2 text-sm text-neutral-500">
              Browse services, manage bookings, and keep your providers in sync.
            </p>
          </div>
          <nav className="space-y-2">
            {MOBILE_NAV.map((item) => {
              const badgeCount = navBadge(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    classNames(
                      "flex items-center gap-3 rounded-2xl px-4 py-2 text-sm font-semibold transition duration-150",
                      isActive ? "bg-brand-600 text-white shadow-card" : "text-neutral-600 hover:bg-neutral-100"
                    )
                  }
                >
                  <span className="relative flex h-9 w-9 items-center justify-center rounded-2xl bg-white/40 text-brand-600">
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
          <div className="mt-auto rounded-2xl border border-white/60 bg-white/70 p-5 text-sm text-neutral-600 shadow-card">
            <p className="text-xs uppercase tracking-wide text-brand-600">Daily tip</p>
            <p className="mt-1 leading-relaxed">
              Keep your profile updated so providers can tailor the perfect care experience.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="relative z-10 flex min-h-screen flex-1 flex-col">
        <AppHeader
          containerMaxWidth="max-w-6xl"
          user={user ?? null}
          onLogout={handleLogout}
          onNavigateProfile={() => navigate("/app/profile")}
          onNavigatePayments={() => navigate("/app/settings")}
          onNavigateSettings={() => navigate("/app/settings")}
        />

        <main className={classNames(
          "flex-1 overflow-y-auto",
          location.pathname.includes("/home") || location.pathname.includes("/bookings/")
            ? "px-0 pb-28 pt-0"
            : "px-3 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-8"
        )}>
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 lg:hidden">
        <div className="border-t border-white/60 bg-white/95 shadow-2xl backdrop-blur-sm">
          <div className="grid grid-cols-5">
            {MOBILE_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  classNames(
                    "flex flex-col items-center gap-0.5 py-2 font-semibold",
                    isActive ? "text-brand-600" : "text-neutral-500"
                  )
                }
              >
                {({ isActive }) => renderNavItem(item, isActive)}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* Booking Dialog */}
      <BookingRequestDialog
        open={bookingDialogOpen}
        onClose={() => setBookingDialogOpen(false)}
        onCreated={handleBookingCreated}
      />
    </div>
  );
};

export default ClientShell;
