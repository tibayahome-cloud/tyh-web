import { Suspense } from "react";
import type { RouteObject } from "react-router-dom";
import { Navigate, useRoutes } from "react-router-dom";

import { Loading } from "../../shared/components/Loading";
import { AdminShell } from "./components/AdminShell";
import { PlatformAdminGuard } from "./guards";
import { lazyWithRetry } from "../../shared/utils/lazyWithRetry";

const AdminDashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const UserManagementPage = lazyWithRetry(() => import("./pages/UserManagement"));
const UserDetailPage = lazyWithRetry(() => import("./pages/UserDetail"));
const ProviderApplicationsPage = lazyWithRetry(() => import("./pages/providers/ApplicationsPage"));
const ProviderApplicationReviewPage = lazyWithRetry(() => import("./pages/providers/ApplicationReviewPage"));
const ProviderDirectoryPage = lazyWithRetry(() => import("./pages/providers/DirectoryPage"));
const ProviderDetailPage = lazyWithRetry(() => import("./pages/providers/ProviderDetailPage"));
const ProviderOnboardingWizardPage = lazyWithRetry(() => import("./pages/providers/OnboardingWizardPage"));
const ProviderZonesPage = lazyWithRetry(() => import("./pages/providers/ProviderZonesPage"));
const ServiceManagementPage = lazyWithRetry(() => import("./pages/services/ServiceManagementPage"));
const FacilityHomePage = lazyWithRetry(() => import("./pages/facilities/FacilityHomePage"));
const FacilityOverviewPage = lazyWithRetry(() => import("./pages/facilities/FacilityOverviewPage"));
const FacilityProvidersPage = lazyWithRetry(() => import("./pages/facilities/FacilityProvidersPage"));
const FacilityManagementPage = lazyWithRetry(() => import("./pages/facilities/FacilityManagementPage"));
const FacilityWorkspacePage = lazyWithRetry(() => import("./pages/facilities/FacilityWorkspacePage"));
const AdminNotificationsPage = lazyWithRetry(() => import("./pages/notifications/AdminNotificationsPage"));
const AdminNotificationPreferencesPage = lazyWithRetry(() => import("./pages/notifications/NotificationPreferencesPage"));
const BookingMonitoringPage = lazyWithRetry(() => import("./pages/bookings/MonitoringPage"));
const AdminBookingDetailPage = lazyWithRetry(() => import("./pages/bookings/BookingDetailPage"));
const AdminBookingQueuePage = lazyWithRetry(() => import("./pages/bookings/QueuePage"));
const TelemedicineAssignmentQueuePage = lazyWithRetry(() => import("./pages/telemedicine/AssignmentQueuePage"));
const TelemedicinePlatformPage = lazyWithRetry(() => import("./pages/telemedicine/PlatformPage"));
const AdminConversationsPage = lazyWithRetry(() => import("./pages/ConversationsPage"));
const FinanceOverviewPage = lazyWithRetry(() => import("./pages/finance/OverviewPage"));
const FinancePaymentsPage = lazyWithRetry(() => import("./pages/finance/PaymentsPage"));
const FinanceWithdrawalsPage = lazyWithRetry(() => import("./pages/finance/WithdrawalsPage"));
const ReviewQueuePage = lazyWithRetry(() => import("./pages/finance/ReviewQueuePage"));
const AdminAccountSettingsPage = lazyWithRetry(() => import("./pages/system/AdminAccountSettingsPage"));
const SystemSettingsPage = lazyWithRetry(() => import("./pages/system/SystemSettingsPage"));
const AdminSelfCareAlertsPage = lazyWithRetry(() => import("./pages/selfcare/AlertsPage"));

const platformAdmin = (element: JSX.Element) => (
  <PlatformAdminGuard>{element}</PlatformAdminGuard>
);

const buildRoutes = (): RouteObject[] => [
  {
    element: <AdminShell />,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      {
        path: "dashboard",
        element: platformAdmin(
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
        path: "telemedicine",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <TelemedicineAssignmentQueuePage />
          </Suspense>
        )
      },
      {
        path: "telemedicine/platform",
        element: platformAdmin(
          <Suspense fallback={<Loading fullHeight />}>
            <TelemedicinePlatformPage />
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
        path: "finance/reviews",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <ReviewQueuePage />
          </Suspense>
        )
      },
      {
        path: "users",
        element: platformAdmin(
          <Suspense fallback={<Loading fullHeight />}>
            <UserManagementPage />
          </Suspense>
        )
      },
      {
        path: "users/:userId",
        element: platformAdmin(
          <Suspense fallback={<Loading fullHeight />}>
            <UserDetailPage />
          </Suspense>
        )
      },
      {
        path: "providers/applications",
        element: platformAdmin(
          <Suspense fallback={<Loading fullHeight />}>
            <ProviderApplicationsPage />
          </Suspense>
        )
      },
      {
        path: "providers/applications/:applicationId",
        element: platformAdmin(
          <Suspense fallback={<Loading fullHeight />}>
            <ProviderApplicationReviewPage />
          </Suspense>
        )
      },
      {
        path: "providers/requirements",
        element: platformAdmin(<Navigate to="/admin/providers/applications?tab=requirements" replace />)
      },
      {
        path: "providers/directory",
        element: platformAdmin(
          <Suspense fallback={<Loading fullHeight />}>
            <ProviderDirectoryPage />
          </Suspense>
        )
      },
      {
        path: "providers/onboarding",
        element: platformAdmin(
          <Suspense fallback={<Loading fullHeight />}>
            <ProviderOnboardingWizardPage />
          </Suspense>
        )
      },
      {
        path: "providers/zones",
        element: platformAdmin(
          <Suspense fallback={<Loading fullHeight />}>
            <ProviderZonesPage />
          </Suspense>
        )
      },
      {
        path: "providers/:userId",
        element: platformAdmin(
          <Suspense fallback={<Loading fullHeight />}>
            <ProviderDetailPage />
          </Suspense>
        )
      },
      {
        path: "services",
        element: platformAdmin(
          <Suspense fallback={<Loading fullHeight />}>
            <ServiceManagementPage />
          </Suspense>
        )
      },
      {
        path: "facility/overview",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <FacilityOverviewPage />
          </Suspense>
        )
      },
      {
        path: "facility/providers",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <FacilityProvidersPage />
          </Suspense>
        )
      },
      {
        path: "facility",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <FacilityHomePage />
          </Suspense>
        )
      },
      {
        path: "facilities",
        element: platformAdmin(
          <Suspense fallback={<Loading fullHeight />}>
            <FacilityManagementPage />
          </Suspense>
        )
      },
      {
        path: "facilities/:facilityId",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <FacilityWorkspacePage showOperationalSections={false} />
          </Suspense>
        )
      },
      {
        path: "services/catalog",
        element: platformAdmin(<Navigate to="/admin/services" replace />)
      },
      {
        path: "services/list",
        element: platformAdmin(<Navigate to="/admin/services" replace />)
      },
      {
        path: "services/localization",
        element: platformAdmin(<Navigate to="/admin/services" replace />)
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
        path: "settings",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <AdminAccountSettingsPage />
          </Suspense>
        )
      },
      {
        path: "system-settings",
        element: platformAdmin(
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
        element: platformAdmin(
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
