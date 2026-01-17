import { useMemo, useState } from "react";
import SettingsIcon from "@mui/icons-material/SettingsOutlined";
import PersonIcon from "@mui/icons-material/PersonOutlined";
import PaymentIcon from "@mui/icons-material/PaymentOutlined";
import LogoutIcon from "@mui/icons-material/LogoutOutlined";

import type { AuthUser } from "../schemas/user";
import { NotificationCenter } from "./NotificationCenter";

type AppHeaderProps = {
  containerMaxWidth?: string;
  user: AuthUser | null;
  onLogout: () => Promise<void> | void;
  onNavigateProfile?: () => void;
  onNavigatePayments?: () => void;
  onNavigateSettings?: () => void;
};

export const AppHeader = ({
  containerMaxWidth = "max-w-6xl",
  user,
  onLogout,
  onNavigateProfile,
  onNavigatePayments,
  onNavigateSettings
}: AppHeaderProps) => {
  const [open, setOpen] = useState(false);
  const initials = useMemo(() => {
    const source = user?.fullName || user?.email || "TYH";
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
  }, [user?.fullName, user?.email]);

  const handleProfile = () => {
    onNavigateProfile?.();
    setOpen(false);
  };

  const handlePayments = () => {
    onNavigatePayments?.();
    setOpen(false);
  };

  const handleSettings = () => {
    onNavigateSettings?.();
    setOpen(false);
  };

  const handleLogout = async () => {
    await onLogout();
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-white/90 backdrop-blur-xl shadow-sm">
      <div className={`mx-auto flex w-full ${containerMaxWidth} items-center justify-between px-4 py-3 sm:px-6 sm:py-4`}>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-sm">
            T
          </div>
          <span className="hidden text-lg font-semibold text-neutral-900 sm:block">Tiba Ya Home</span>
        </div>
        {user ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationCenter />
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="flex items-center gap-2 rounded-full border border-white/70 bg-white/85 px-2 py-1 text-left text-sm font-medium text-neutral-700 shadow-sm transition hover:shadow-md sm:gap-3 sm:px-3"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.fullName || "Avatar"}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-xs font-semibold text-white">
                    {initials}
                  </span>
                )}
                <span className="hidden max-w-[120px] truncate sm:inline-block">{user.fullName || user.email}</span>
              </button>
              {open && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                  <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-neutral-100 bg-white text-neutral-700 shadow-xl">
                    <div className="border-b border-neutral-100 px-4 py-3">
                      <p className="text-sm font-semibold text-neutral-900">{user.fullName || "Account"}</p>
                      <p className="text-xs text-neutral-500 truncate">{user.email}</p>
                    </div>
                    <nav className="flex flex-col py-1 text-sm">
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-neutral-700 transition hover:bg-neutral-50"
                        onClick={handleProfile}
                      >
                        <PersonIcon className="h-4 w-4 text-neutral-400" />
                        Profile
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-neutral-700 transition hover:bg-neutral-50"
                        onClick={handlePayments}
                      >
                        <PaymentIcon className="h-4 w-4 text-neutral-400" />
                        Payments
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-neutral-700 transition hover:bg-neutral-50"
                        onClick={handleSettings}
                      >
                        <SettingsIcon className="h-4 w-4 text-neutral-400" />
                        Settings
                      </button>
                      <div className="my-1 border-t border-neutral-100" />
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-danger-600 transition hover:bg-danger-50"
                        onClick={handleLogout}
                      >
                        <LogoutIcon className="h-4 w-4" />
                        Sign out
                      </button>
                    </nav>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm font-semibold text-neutral-500">TYH Care</div>
        )}
      </div>
    </header>
  );
};

