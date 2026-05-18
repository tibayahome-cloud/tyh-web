import type { PropsWithChildren } from "react";
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

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      {/* Sidebar for Desktop */}
      {isAuthenticated && navItems.length > 0 && (
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
        {isAuthenticated && navItems.length > 0 && (
          <>
            <div className="h-[72px] lg:hidden" /> {/* Spacer for sticky nav */}
            <AppBottomNav items={navItems} />
          </>
        )}
      </div>
    </div>
  );
};
