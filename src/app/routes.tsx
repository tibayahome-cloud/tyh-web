import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";

import { LogoutGate } from "../auth/LogoutGate";
import { PhoneVerificationGate } from "../auth/PhoneVerificationGate";
import { RequirePerm, RequireRole } from "../shared/rbac/Can";
import { Loading } from "../shared/components/Loading";
import { ROLE_CLIENT, ROLE_PROVIDER, PERMISSION_ADMIN_ACCESS } from "../shared/rbac/roles";

const ClientRoutes = lazy(() => import("../domains/client/routes"));
const ProviderRoutes = lazy(() => import("../domains/provider/routes"));
const AdminRoutes = lazy(() => import("../domains/admin/routes"));

const ClientLoginPage = lazy(() => import("../domains/client/pages/Login"));
const AdminLoginPage = lazy(() => import("../domains/admin/pages/Login"));
const SessionExpiredPage = lazy(() =>
  import("../auth/SessionExpired").then((mod) => ({ default: mod.SessionExpired }))
);
const TwoFactorPage = lazy(() => import("../auth/TwoFactorPage"));
const ForgotPasswordPage = lazy(() => import("../auth/ForgotPassword"));
const SignUpPage = lazy(() => import("../auth/SignUp"));
const ResetPasswordPage = lazy(() => import("../auth/ResetPassword"));

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
