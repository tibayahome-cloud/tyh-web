import type { PropsWithChildren } from "react";
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import classNames from "classnames";
import { AppHeader } from "./AppHeader";

interface AppLayoutProps {
  fullWidth?: boolean;
  showHeader?: boolean;
  disablePadding?: boolean;
}

export const AppLayout = ({
  fullWidth = false,
  showHeader = true,
  disablePadding = false,
  children
}: PropsWithChildren<AppLayoutProps>) => {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const basePath = useMemo(() => {
    if (location.pathname.startsWith("/admin")) {
      return "/admin";
    }
    if (location.pathname.startsWith("/pro")) {
      return "/pro";
    }
    return "/app";
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      /* handled by auth context */
    }
  };

  const containerMaxWidth = fullWidth ? "max-w-7xl" : "max-w-6xl";
  const profilePath =
    basePath === "/admin" ? "/admin/users" : basePath === "/pro" ? "/pro/profile" : "/app/profile";
  const paymentsPath =
    basePath === "/admin" ? "/admin/finance/payments" : basePath === "/pro" ? "/pro/payments" : "/app/settings";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-tiba-blue/5 to-transparent" aria-hidden />
      {showHeader && (
        <AppHeader
          containerMaxWidth={containerMaxWidth}
          user={isAuthenticated ? user : null}
          onLogout={handleLogout}
          onNavigateProfile={() => navigate(profilePath)}
          onNavigatePayments={() => navigate(paymentsPath)}
        />
      )}
      <main className={classNames(
        "relative z-10 mx-auto w-full",
        containerMaxWidth,
        disablePadding ? "px-0 py-0" : "px-4 sm:px-6 py-10"
      )}>
        {children}
      </main>
    </div>
  );
};
