import classNames from "classnames";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import DashboardIcon from "@mui/icons-material/SpaceDashboardOutlined";
import GroupIcon from "@mui/icons-material/GroupsOutlined";
import AssignmentIcon from "@mui/icons-material/ChecklistOutlined";
import ViewListIcon from "@mui/icons-material/ViewKanbanOutlined";
import MapIcon from "@mui/icons-material/MapOutlined";
import LogoutIcon from "@mui/icons-material/LogoutOutlined";
import WorkIcon from "@mui/icons-material/WorkOutlineOutlined";
import ViewSidebarIcon from "@mui/icons-material/ViewSidebarOutlined";
import ChatBubbleIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import TuneIcon from "@mui/icons-material/TuneOutlined";
import CloseIcon from "@mui/icons-material/CloseOutlined";
import AccountBalanceIcon from "@mui/icons-material/AccountBalanceOutlined";
import PaymentsIcon from "@mui/icons-material/PaymentsOutlined";
import SavingsIcon from "@mui/icons-material/SavingsOutlined";
import SettingsApplicationsIcon from "@mui/icons-material/SettingsApplicationsOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/HealthAndSafetyOutlined";
import PublicIcon from "@mui/icons-material/PublicOutlined";

import { Button } from "../../../shared/components/Button";
import { useToast } from "../../../shared/components/ToastProvider";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useSocket } from "../../../shared/hooks/useSocket";
import { useConversationBadge } from "../../../shared/hooks/useConversationBadge";
import { ConversationsPanel } from "../pages/ConversationsPage";
import { AppHeader } from "../../../shared/components/AppHeader";

type NavItem = {
  label: string;
  to: string;
  icon: ReactNode;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", to: "/admin/dashboard", icon: <DashboardIcon fontSize="small" /> }]
  },
  {
    label: "User Management",
    items: [{ label: "Users", to: "/admin/users", icon: <GroupIcon fontSize="small" /> }]
  },
  {
    label: "Care Ops",
    items: [{ label: "Self-care alerts", to: "/admin/selfcare", icon: <ShieldOutlinedIcon fontSize="small" /> }]
  },
  {
    label: "Provider Management",
    items: [
      { label: "Directory", to: "/admin/providers/directory", icon: <MapIcon fontSize="small" /> },
      { label: "Applications", to: "/admin/providers/applications", icon: <AssignmentIcon fontSize="small" /> },
      { label: "Geographic zones", to: "/admin/providers/zones", icon: <PublicIcon fontSize="small" /> }
    ]
  },
  {
    label: "Bookings",
    items: [
      { label: "Booking queue", to: "/admin/bookings", icon: <WorkIcon fontSize="small" /> },
      { label: "Live monitor", to: "/admin/bookings/monitoring", icon: <ViewSidebarIcon fontSize="small" /> }
    ]
  },
  {
    label: "Finance",
    items: [
      { label: "Overview", to: "/admin/finance/overview", icon: <AccountBalanceIcon fontSize="small" /> },
      { label: "Payments", to: "/admin/finance/payments", icon: <PaymentsIcon fontSize="small" /> },
      { label: "Withdrawals", to: "/admin/finance/withdrawals", icon: <SavingsIcon fontSize="small" /> }
    ]
  },
  {
    label: "Services",
    items: [{ label: "Workspace", to: "/admin/services", icon: <ViewListIcon fontSize="small" /> }]
  },
  {
    label: "System",
    items: [
      { label: "Notification preferences", to: "/admin/notifications/preferences", icon: <TuneIcon fontSize="small" /> },
      { label: "System settings", to: "/admin/system-settings", icon: <SettingsApplicationsIcon fontSize="small" /> }
    ]
  }
];


const navItemClasses = (active: boolean, collapsed: boolean) =>
  classNames(
    "relative flex items-center rounded-2xl px-3 py-2 text-sm font-semibold transition",
    collapsed ? "justify-center" : "gap-3",
    active ? "bg-brand-600 text-white shadow-card" : "text-white/70 hover:bg-white/15 hover:text-white"
  );

type AdminShellProps = {
  children?: ReactNode;
};

export const AdminShell = ({ children }: AdminShellProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const socket = useSocket();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sections = useMemo(() => NAV_SECTIONS, []);
  const { unreadCount: conversationUnread } = useConversationBadge();
  const [conversationDrawerOpen, setConversationDrawerOpen] = useState(false);
  const [drawerBookingId, setDrawerBookingId] = useState<string | undefined>(undefined);


  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleBootstrap = (payload: { user_id?: string; application_id?: string }) => {
      toast.showToast({
        title: "Provider onboarding started",
        description: payload?.user_id
          ? `Kick off verification for provider ${payload.user_id}.`
          : "A new provider is ready for onboarding.",
        variant: "info"
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "provider-applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "providers", "list"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "providers", "metrics"] });
    };

    socket.on("model.provider.onboarding.bootstrap", handleBootstrap);

    return () => {
      socket.off("model.provider.onboarding.bootstrap", handleBootstrap);
    };
  }, [socket, toast, queryClient]);

  useEffect(() => {
    if (!socket || !user?.id) {
      return;
    }
    const emitSession = () => {
      const payload = { userId: String(user.id), role: "admin", at: new Date().toISOString(), socketId: socket.id };
      socket.emit?.("session.created", payload);
    };
    const emitInitialSession = () => {
      emitSession();
    };
    if (socket.connected) {
      emitInitialSession();
    }
    socket.on("connect", emitSession);
    return () => {
      socket.off("connect", emitSession);
      socket.off("session:ack");
    };
  }, [socket, user?.id]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (detail?.bookingId) {
        setDrawerBookingId(String(detail.bookingId));
      }
      setConversationDrawerOpen(true);
    };
    window.addEventListener("chat:open", handler);
    return () => {
      window.removeEventListener("chat:open", handler);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // ignore
    }
  };

  const closeConversationDrawer = () => {
    setConversationDrawerOpen(false);
    setDrawerBookingId(undefined);
  };

  const handleOpenConversations = () => {
    setDrawerBookingId(undefined);
    setConversationDrawerOpen(true);
  };

  const formattedConversationUnread = conversationUnread > 99 ? "99+" : String(conversationUnread);

  const renderNav = (isCollapsed: boolean, close?: () => void) => (
    <div className="flex h-full flex-col bg-gradient-to-b from-neutral-950 via-brand-950 to-neutral-900 text-white">
      <div className="group flex items-center justify-between px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold text-white shadow-inner">
              AX
            </span>
            {isCollapsed && (
              <button
                type="button"
                className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl border border-white/30 bg-transparent text-white opacity-0 transition duration-200 focus-visible:pointer-events-auto focus-visible:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
                onClick={() => setCollapsed(false)}
                aria-label="Expand navigation"
              >
                <ViewSidebarIcon className="h-5 w-5" />
              </button>
            )}
          </div>
          {!isCollapsed && (
            <div>
              <p className="text-sm font-semibold text-white">Admin Console</p>
              <p className="text-xs text-white/60">Control center</p>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/25 text-white/80 transition duration-200 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse navigation"
          >
            <ViewSidebarIcon className="h-5 w-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-8 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.label}>
              {!isCollapsed && (
                <p className="px-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/50">{section.label}</p>
              )}
              <ul className="mt-3 space-y-1">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={() => close?.()}
                      className={({ isActive }) => navItemClasses(isActive, isCollapsed)}
                    >
                      {isCollapsed ? (
                        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10 text-white">
                          {item.icon}
                        </span>
                      ) : (
                        <>
                          <span className="text-white">{item.icon}</span>
                          <span className="truncate">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>
      <div className="border-t border-white/15 px-5 py-5 text-white/80">
        {!isCollapsed && (
          <div className="mb-3">
            <p className="text-sm font-semibold text-white">{user?.fullName ?? "Admin"}</p>
            <p className="text-xs text-white/60">{user?.email ?? ""}</p>
          </div>
        )}
        <Button
          variant="secondary"
          onClick={handleLogout}
          className={classNames(
            "items-center gap-2 border-white/40 bg-white/10 text-white hover:bg-white/20",
            isCollapsed ? "h-11 w-11 justify-center rounded-full px-0 py-0" : "w-full justify-center"
          )}
        >
          <LogoutIcon fontSize="small" />
          {!isCollapsed && <span>Sign out</span>}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="relative flex min-h-screen bg-neutral-50 text-neutral-900">
      <div className="pointer-events-none fixed inset-0 z-0 bg-brand-radial" aria-hidden />
      <aside
        className={classNames(
          "relative z-10 hidden border-r border-white/25 bg-white/5 backdrop-blur-xl lg:flex lg:flex-col lg:shadow-[0_35px_80px_-40px_rgba(15,23,42,0.8)]",
          collapsed ? "lg:w-24" : "lg:w-72",
          "lg:sticky lg:top-0 lg:h-screen lg:overflow-hidden"
        )}
      >
        {renderNav(collapsed)}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full w-72 max-w-[85vw] bg-gradient-to-b from-neutral-950 via-brand-950 to-neutral-900 shadow-2xl">
            {renderNav(false, () => setMobileOpen(false))}
          </div>
        </div>
      )}

      <div className="relative z-10 flex min-h-screen flex-1 flex-col">
        <AppHeader
          containerMaxWidth="max-w-7xl"
          user={user ?? null}
          onLogout={handleLogout}
          onNavigateProfile={() => navigate("/admin/users")}
          onNavigatePayments={() => navigate("/admin/finance/payments")}
        />
        <div className="border-b border-white/40 bg-white/80 px-4 py-3 lg:hidden">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/60 px-3 py-2 text-sm font-semibold text-neutral-600 shadow-card"
              onClick={() => setMobileOpen(true)}
            >
              <ViewSidebarIcon className="h-5 w-5" />
              Menu
            </button>
            <button
              type="button"
              onClick={handleOpenConversations}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/60 px-3 py-2 text-sm font-semibold text-brand-700 shadow-card"
            >
              <ChatBubbleIcon fontSize="small" />
              Inbox
              {conversationUnread > 0 && (
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                  {formattedConversationUnread}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 bg-transparent">
          <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
            <div className="space-y-8">{children ?? <Outlet />}</div>
          </main>
        </div>

        <button
          type="button"
          onClick={handleOpenConversations}
          className="fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-elevated transition hover:bg-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 md:hidden"
          aria-label="Open conversations"
        >
          <ChatBubbleIcon />
          {conversationUnread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-brand-600">
              {conversationUnread > 99 ? "99+" : conversationUnread}
            </span>
          )}
        </button>
      </div>

      {conversationDrawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-neutral-900/40 backdrop-blur-sm" onClick={closeConversationDrawer} />
          <aside className="fixed top-0 right-0 z-50 h-full w-full bg-white/95 shadow-2xl backdrop-blur sm:w-[75vw] lg:w-[480px] xl:w-[25vw]">
            <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
              <div>
                <p className="text-base font-semibold text-neutral-900">Conversations</p>
                {drawerBookingId && (
                  <p className="text-xs text-neutral-500">Focused on booking {drawerBookingId}</p>
                )}
              </div>
              <button
                type="button"
                onClick={closeConversationDrawer}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                aria-label="Close conversations"
              >
                <CloseIcon fontSize="small" />
              </button>
            </div>
            <div className="h-[calc(100%-64px)] overflow-y-auto px-6 py-4">
              <ConversationsPanel bookingId={drawerBookingId} />
            </div>
          </aside>
        </>
      )}
    </div>
  );
};

export default AdminShell;
