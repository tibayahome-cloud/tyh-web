import type { CSSProperties, PropsWithChildren } from "react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import classNames from "classnames";
import { AppHeader } from "./AppHeader";
import { AppSidebar, type NavItem } from "./AppSidebar";
import { AppBottomNav } from "./AppBottomNav";

interface AppLayoutProps {
  fullWidth?: boolean;
  showHeader?: boolean;
  disablePadding?: boolean;
  navItems?: NavItem[];
}

type AppLayoutStyle = CSSProperties & {
  "--app-sidebar-width"?: string;
  "--app-sidebar-expanded-width": string;
  "--app-sidebar-collapsed-width": string;
  "--app-header-height"?: string;
  "--app-bottom-nav-height"?: string;
};

export const resolveSidebarLayoutVars = (
  hasSidebar: boolean,
  collapsed: boolean,
  showHeader = false
): AppLayoutStyle => {
  const expandedWidth = "16rem";
  const collapsedWidth = "5rem";
  const style: AppLayoutStyle = {
    "--app-sidebar-expanded-width": expandedWidth,
    "--app-sidebar-collapsed-width": collapsedWidth
  };
  if (hasSidebar) {
    style["--app-sidebar-width"] = collapsed ? collapsedWidth : expandedWidth;
    style["--app-bottom-nav-height"] = "72px";
  }
  if (showHeader) {
    style["--app-header-height"] = "4rem";
  }
  return style;
};

export const resolveSettingsPath = (pathname: string, roles: string[] = []) => {
  if (pathname.startsWith("/admin")) {
    const roleSet = new Set(roles);
    const isFacilityAdmin = roleSet.has("admin.ops") && !roleSet.has("admin.super") && !roleSet.has("admin");
    return isFacilityAdmin ? "/admin/settings" : "/admin/system-settings";
  }
  if (pathname.startsWith("/pro")) return "/pro/settings";
  return "/app/settings";
};

export const AppLayout = ({
  fullWidth = false,
  showHeader = true,
  disablePadding = false,
  navItems = [],
  children
}: PropsWithChildren<AppLayoutProps>) => {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      /* handled by auth context */
    }
  };

  const containerMaxWidth = fullWidth ? "max-w-7xl" : "max-w-6xl";
  const hasSidebar = isAuthenticated && navItems.length > 0;
  const layoutStyle = resolveSidebarLayoutVars(hasSidebar, sidebarCollapsed, showHeader);

  const getProfilePath = () => {
    if (location.pathname.startsWith("/admin")) return "/admin/users";
    if (location.pathname.startsWith("/pro")) return "/pro/profile";
    return "/app/profile";
  };

  const getPaymentsPath = () => {
    if (location.pathname.startsWith("/admin")) return "/admin/finance/payments";
    if (location.pathname.startsWith("/pro")) return "/pro/payments";
    return "/app/settings";
  };

  const getSettingsPath = () => {
    return resolveSettingsPath(location.pathname, user?.roles ?? []);
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50" style={layoutStyle}>
      {/* Sidebar for Desktop */}
      {hasSidebar && (
        <AppSidebar
          items={navItems}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      )}

      <div className="flex flex-col flex-1 min-w-0">
        {/* Sticky Header */}
        {showHeader && (
          <AppHeader
            containerMaxWidth={containerMaxWidth}
            user={isAuthenticated ? user : null}
            onLogout={handleLogout}
            onNavigateProfile={() => navigate(getProfilePath())}
            onNavigatePayments={() => navigate(getPaymentsPath())}
            onNavigateSettings={() => navigate(getSettingsPath())}
          />
        )}

        {/* Main Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth">
          <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-tiba-blue/5 to-transparent pointer-events-none" aria-hidden />
          <main className={classNames(
            "relative z-10 mx-auto w-full min-h-full",
            containerMaxWidth,
            disablePadding ? "px-0 py-0" : "px-4 sm:px-6 py-8"
          )}>
            {children}
          </main>
        </div>

        {/* Bottom Navigation for Mobile */}
        {hasSidebar && (
          <>
            <div className="h-[72px] lg:hidden" /> {/* Spacer for sticky nav */}
            <AppBottomNav items={navItems} />
          </>
        )}
      </div>
    </div>
  );
};
