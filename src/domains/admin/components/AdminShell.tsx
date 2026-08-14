import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import DashboardIcon from "@mui/icons-material/SpaceDashboardOutlined";
import GroupIcon from "@mui/icons-material/GroupsOutlined";
import AssignmentIcon from "@mui/icons-material/ChecklistOutlined";
import ViewListIcon from "@mui/icons-material/ViewKanbanOutlined";
import MapIcon from "@mui/icons-material/MapOutlined";
import WorkIcon from "@mui/icons-material/WorkOutlineOutlined";
import ForumIcon from "@mui/icons-material/ForumOutlined";
import SettingsApplicationsIcon from "@mui/icons-material/SettingsApplicationsOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/HealthAndSafetyOutlined";
import PaymentIcon from "@mui/icons-material/PaymentOutlined";
import BusinessIcon from "@mui/icons-material/BusinessOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";

import { useToast } from "../../../shared/components/ToastProvider";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useSocket } from "../../../shared/hooks/useSocket";
import { useConversationBadge } from "../../../shared/hooks/useConversationBadge";
import { AppLayout } from "../../../shared/components/AppLayout";
import type { NavItem } from "../../../shared/components/AppSidebar";
import { useRbac } from "../../../shared/hooks/useRbac";

type AdminNavInput = {
  roles: string[];
  conversationUnread: number;
};

/** Build admin navigation so facility admins land in their tenant workspace first. */
export const buildAdminNavItems = ({ roles, conversationUnread }: AdminNavInput): NavItem[] => {
  const roleSet = new Set(roles);
  const isFacilityAdmin = roleSet.has("admin.ops") && !roleSet.has("admin.super") && !roleSet.has("admin");

  if (isFacilityAdmin) {
    return [
      { label: "Overview", to: "/admin/facility/overview", icon: <DashboardIcon /> },
      { label: "Facility", to: "/admin/facility", icon: <BusinessIcon /> },
      { label: "Providers", to: "/admin/facility/providers", icon: <GroupIcon /> },
      { label: "Queue", to: "/admin/bookings", icon: <WorkIcon /> },
      { label: "Telemedicine", to: "/admin/telemedicine", icon: <VideocamOutlinedIcon /> },
      { label: "Payments", to: "/admin/finance/payments", icon: <PaymentIcon /> },
      { label: "Self Care", to: "/admin/selfcare", icon: <ShieldOutlinedIcon /> },
      { label: "Inbox", to: "/admin/conversations", icon: <ForumIcon />, badge: conversationUnread },
      { label: "Settings", to: "/admin/settings", icon: <SettingsApplicationsIcon /> }
    ];
  }

  return [
    { label: "Overview", to: "/admin/dashboard", icon: <DashboardIcon /> },
    { label: "Users", to: "/admin/users", icon: <GroupIcon /> },
    { label: "Pro Apps", to: "/admin/providers/applications", icon: <AssignmentIcon /> },
    { label: "Queue", to: "/admin/bookings", icon: <WorkIcon /> },
    { label: "Telemedicine", to: "/admin/telemedicine", icon: <VideocamOutlinedIcon /> },
    { label: "Telemedicine Health", to: "/admin/telemedicine/platform", icon: <VideocamOutlinedIcon /> },
    { label: "Self Care", to: "/admin/selfcare", icon: <ShieldOutlinedIcon /> },
    { label: "Services", to: "/admin/services", icon: <ViewListIcon /> },
    { label: "Facilities", to: "/admin/facilities", icon: <BusinessIcon /> },
    { label: "Map", to: "/admin/providers/directory", icon: <MapIcon /> },
    { label: "Payments", to: "/admin/finance/payments", icon: <PaymentIcon /> },
    { label: "Inbox", to: "/admin/conversations", icon: <ForumIcon />, badge: conversationUnread },
    { label: "Settings", to: "/admin/system-settings", icon: <SettingsApplicationsIcon /> }
  ];
};

export const AdminShell = () => {
  const { user } = useAuth();
  const { roles } = useRbac();
  const socket = useSocket();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { unreadCount: conversationUnread } = useConversationBadge();

  useEffect(() => {
    if (!socket) return;
    const handleBootstrap = (payload: { user_id?: string }) => {
      toast.showToast({
        title: "Provider onboarding started",
        description: payload?.user_id ? `Verification for ${payload.user_id}.` : "A new provider is ready.",
        variant: "info"
      });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    };
    socket.on("model.provider.onboarding.bootstrap", handleBootstrap);
    return () => {
      socket.off("model.provider.onboarding.bootstrap", handleBootstrap);
    };
  }, [socket, toast, queryClient]);

  useEffect(() => {
    if (!socket || !user?.id) return;
    const emitSession = () => {
      socket.emit?.("session.created", { userId: String(user.id), role: "admin", at: new Date().toISOString() });
    };
    if (socket.connected) emitSession();
    socket.on("connect", emitSession);
    return () => {
      socket.off("connect", emitSession);
    };
  }, [socket, user?.id]);

  const navItems = buildAdminNavItems({ roles, conversationUnread });

  return (
    <AppLayout navItems={navItems}>
      <Outlet />
    </AppLayout>
  );
};

export default AdminShell;
