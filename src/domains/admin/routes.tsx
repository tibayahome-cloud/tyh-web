import { lazy, Suspense } from "react";
import type { RouteObject } from "react-router-dom";
import { Navigate, useRoutes } from "react-router-dom";

import { Loading } from "../../shared/components/Loading";
import { AdminShell } from "./components/AdminShell";

const AdminDashboard = lazy(() => import("./pages/Dashboard"));
const UserManagementPage = lazy(() => import("./pages/UserManagement"));
const UserDetailPage = lazy(() => import("./pages/UserDetail"));
const ProviderApplicationsPage = lazy(() => import("./pages/providers/ApplicationsPage"));
const ProviderApplicationReviewPage = lazy(() => import("./pages/providers/ApplicationReviewPage"));
const ProviderDirectoryPage = lazy(() => import("./pages/providers/DirectoryPage"));
const ProviderDetailPage = lazy(() => import("./pages/providers/ProviderDetailPage"));
const ProviderOnboardingWizardPage = lazy(() => import("./pages/providers/OnboardingWizardPage"));
const ProviderZonesPage = lazy(() => import("./pages/providers/ProviderZonesPage"));
const ServiceManagementPage = lazy(() => import("./pages/services/ServiceManagementPage"));
const AdminNotificationsPage = lazy(() => import("./pages/notifications/AdminNotificationsPage"));
const AdminNotificationPreferencesPage = lazy(() => import("./pages/notifications/NotificationPreferencesPage"));
const BookingMonitoringPage = lazy(() => import("./pages/bookings/MonitoringPage"));
const AdminBookingDetailPage = lazy(() => import("./pages/bookings/BookingDetailPage"));
const AdminBookingQueuePage = lazy(() => import("./pages/bookings/QueuePage"));
const AdminConversationsPage = lazy(() => import("./pages/ConversationsPage"));
const FinanceOverviewPage = lazy(() => import("./pages/finance/OverviewPage"));
const FinancePaymentsPage = lazy(() => import("./pages/finance/PaymentsPage"));
const FinanceWithdrawalsPage = lazy(() => import("./pages/finance/WithdrawalsPage"));
const SystemSettingsPage = lazy(() => import("./pages/system/SystemSettingsPage"));
const AdminSelfCareAlertsPage = lazy(() => import("./pages/selfcare/AlertsPage"));

const buildRoutes = (): RouteObject[] => [
  {
    element: <AdminShell />,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      {
        path: "dashboard",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <AdminDashboard />
          </Suspense>
        )
      },
      {
        path: "bookings",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <AdminBookingQueuePage />
          </Suspense>
        )
      },
      {
        path: "selfcare",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <AdminSelfCareAlertsPage />
          </Suspense>
        )
      },
      {
        path: "finance",
        element: <Navigate to="/admin/finance/overview" replace />
      },
      {
        path: "finance/overview",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <FinanceOverviewPage />
          </Suspense>
        )
      },
      {
        path: "finance/payments",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <FinancePaymentsPage />
          </Suspense>
        )
      },
      {
        path: "finance/withdrawals",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <FinanceWithdrawalsPage />
          </Suspense>
        )
      },
      {
        path: "users",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <UserManagementPage />
          </Suspense>
        )
      },
      {
        path: "users/:userId",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <UserDetailPage />
          </Suspense>
        )
      },
      {
        path: "providers/applications",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <ProviderApplicationsPage />
          </Suspense>
        )
      },
      {
        path: "providers/applications/:applicationId",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <ProviderApplicationReviewPage />
          </Suspense>
        )
      },
      {
        path: "providers/requirements",
        element: <Navigate to="/admin/providers/applications?tab=requirements" replace />
      },
      {
        path: "providers/directory",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <ProviderDirectoryPage />
          </Suspense>
        )
      },
      {
        path: "providers/onboarding",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <ProviderOnboardingWizardPage />
          </Suspense>
        )
      },
      {
        path: "providers/zones",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <ProviderZonesPage />
          </Suspense>
        )
      },
      {
        path: "providers/:userId",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <ProviderDetailPage />
          </Suspense>
        )
      },
      {
        path: "services",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <ServiceManagementPage />
          </Suspense>
        )
      },
      {
        path: "services/catalog",
        element: <Navigate to="/admin/services" replace />
      },
      {
        path: "services/list",
        element: <Navigate to="/admin/services" replace />
      },
      {
        path: "services/localization",
        element: <Navigate to="/admin/services" replace />
      },
      {
        path: "notifications",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <AdminNotificationsPage />
          </Suspense>
        )
      },
      {
        path: "notifications/preferences",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <AdminNotificationPreferencesPage />
          </Suspense>
        )
      },
      {
        path: "system-settings",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <SystemSettingsPage />
          </Suspense>
        )
      },
      {
        path: "messages",
        element: <Navigate to="/admin/conversations" replace />
      },
      {
        path: "conversations/:threadId?",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <AdminConversationsPage />
          </Suspense>
        )
      },
      {
        path: "bookings/monitoring",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <BookingMonitoringPage />
          </Suspense>
        )
      },
      {
        path: "bookings/:bookingId",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <AdminBookingDetailPage />
          </Suspense>
        )
      }
    ]
  }
];

const AdminRoutes = () => {
  const element = useRoutes(buildRoutes());
  return element;
};

export default AdminRoutes;
