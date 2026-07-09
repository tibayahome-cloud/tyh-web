import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";

import { LogoutGate } from "../auth/LogoutGate";
import { PhoneVerificationGate } from "../auth/PhoneVerificationGate";
import { RequirePerm, RequireRole } from "../shared/rbac/Can";
import { Loading } from "../shared/components/Loading";
import { ROLE_CLIENT, ROLE_PROVIDER, PERMISSION_ADMIN_ACCESS } from "../shared/rbac/roles";

// Retries a failed dynamic import once by reloading the page.
// This handles the case where a new deploy has replaced the old
// hashed chunk files (e.g. SessionExpired-xxxx.js no longer exists)
// while a user still has the old index.html/JS loaded in their tab.
const RELOAD_FLAG_KEY = "chunk-reload-attempted";

function lazyWithRetry<T extends { default: React.ComponentType<any> }>(
  importer: () => Promise<T>
) {
  return lazy(() =>
    importer().catch((error) => {
      const alreadyTried = sessionStorage.getItem(RELOAD_FLAG_KEY);
      if (!alreadyTried) {
        sessionStorage.setItem(RELOAD_FLAG_KEY, "1");
        window.location.reload();
        // Suspend forever; the page is about to hard-reload anyway.
        return new Promise<T>(() => {});
      }
      // We already tried reloading once and it still failed —
      // a genuine network/module error, not a stale chunk. Rethrow
      // so it surfaces normally (e.g. to an error boundary) instead
      // of reload-looping forever.
      throw error;
    })
  );
}

// Clear the retry flag once a lazy import succeeds, so a real future
// deploy-related failure can trigger a fresh reload again.
if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    sessionStorage.removeItem(RELOAD_FLAG_KEY);
  });
}

const ClientRoutes = lazyWithRetry(() => import("../domains/client/routes"));
const ProviderRoutes = lazyWithRetry(() => import("../domains/provider/routes"));
const AdminRoutes = lazyWithRetry(() => import("../domains/admin/routes"));

const ClientLoginPage = lazyWithRetry(() => import("../domains/client/pages/Login"));
const AdminLoginPage = lazyWithRetry(() => import("../domains/admin/pages/Login"));
const SessionExpiredPage = lazyWithRetry(() =>
  import("../auth/SessionExpired").then((mod) => ({ default: mod.SessionExpired }))
);
const TwoFactorPage = lazyWithRetry(() => import("../auth/TwoFactorPage"));
const ForgotPasswordPage = lazyWithRetry(() => import("../auth/ForgotPassword"));
const SignUpPage = lazyWithRetry(() => import("../auth/SignUp"));
const ResetPasswordPage = lazyWithRetry(() => import("../auth/ResetPassword"));

const SuspenseWrapper = ({ children }: { children: JSX.Element }) => (
  <Suspense fallback={<Loading fullHeight />}>{children}</Suspense>
);

const PublicLayout = () => (
  <Outlet />
);

import { websiteRoutes } from "../domains/website/routes";

// ... existing imports

export const router = createBrowserRouter(
  [
    ...websiteRoutes,
    {
      element: (
        <SuspenseWrapper>
          <PublicLayout />
        </SuspenseWrapper>
      ),
      children: [
        {
          path: "login",
          element: (
            <SuspenseWrapper>
              <ClientLoginPage />
            </SuspenseWrapper>
          )
        },
        {
          path: "two-factor",
          element: (
            <SuspenseWrapper>
              <TwoFactorPage />
            </SuspenseWrapper>
          )
        },
        {
          path: "admin/login",
          element: (
            <SuspenseWrapper>
              <AdminLoginPage />
            </SuspenseWrapper>
          )
        },
        {
          path: "session-expired",
          element: (
            <SuspenseWrapper>
              <SessionExpiredPage />
            </SuspenseWrapper>
          )
        },
        {
          path: "forgot-password",
          element: (
            <SuspenseWrapper>
              <ForgotPasswordPage />
            </SuspenseWrapper>
          )
        },
        {
          path: "signup",
          element: (
            <SuspenseWrapper>
              <SignUpPage />
            </SuspenseWrapper>
          )
        },
        {
          path: "reset-password",
          element: (
            <SuspenseWrapper>
              <ResetPasswordPage />
            </SuspenseWrapper>
          )
        }
      ]
    },
    {
      path: "/app/*",
      element: (
        <LogoutGate redirectTo="/login">
          <PhoneVerificationGate>
            <RequireRole role={ROLE_CLIENT}>
              <SuspenseWrapper>
                <ClientRoutes />
              </SuspenseWrapper>
            </RequireRole>
          </PhoneVerificationGate>
        </LogoutGate>
      )
    },
    {
      path: "/pro/*",
      element: (
        <LogoutGate redirectTo="/login">
          <PhoneVerificationGate>
            <RequireRole role={ROLE_PROVIDER}>
              <SuspenseWrapper>
                <ProviderRoutes />
              </SuspenseWrapper>
            </RequireRole>
          </PhoneVerificationGate>
        </LogoutGate>
      )
    },
    {
      path: "/admin/*",
      element: (
        <LogoutGate redirectTo="/admin/login">
          <RequirePerm perm={PERMISSION_ADMIN_ACCESS}>
            <SuspenseWrapper>
              <AdminRoutes />
            </SuspenseWrapper>
          </RequirePerm>
        </LogoutGate>
      )
    },
    { path: "*", element: <Navigate to="/login" replace /> }
  ],
  {
    future: {
      v7_relativeSplatPath: true
    }
  }
);
