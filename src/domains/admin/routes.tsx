import { lazy, Suspense } from "react";
import type { RouteObject } from "react-router-dom";
import { Navigate, useRoutes } from "react-router-dom";

import { Loading } from "../../shared/components/Loading";
import { AdminShell } from "./components/AdminShell";
import { PlatformAdminGuard } from "./guards";

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
const FacilityHomePage = lazy(() => import("./pages/facilities/FacilityHomePage"));
const FacilityOverviewPage = lazy(() => import("./pages/facilities/FacilityOverviewPage"));
const FacilityProvidersPage = lazy(() => import("./pages/facilities/FacilityProvidersPage"));
const FacilityManagementPage = lazy(() => import("./pages/facilities/FacilityManagementPage"));
const FacilityWorkspacePage = lazy(() => import("./pages/facilities/FacilityWorkspacePage"));
const AdminNotificationsPage = lazy(() => import("./pages/notifications/AdminNotificationsPage"));
const AdminNotificationPreferencesPage = lazy(() => import("./pages/notifications/NotificationPreferencesPage"));
const BookingMonitoringPage = lazy(() => import("./pages/bookings/MonitoringPage"));
const AdminBookingDetailPage = lazy(() => import("./pages/bookings/BookingDetailPage"));
const AdminBookingQueuePage = lazy(() => import("./pages/bookings/QueuePage"));
const TelemedicineAssignmentQueuePage = lazy(() => import("./pages/telemedicine/AssignmentQueuePage"));
const AdminConversationsPage = lazy(() => import("./pages/ConversationsPage"));
const FinanceOverviewPage = lazy(() => import("./pages/finance/OverviewPage"));
const FinancePaymentsPage = lazy(() => import("./pages/finance/PaymentsPage"));
const FinanceWithdrawalsPage = lazy(() => import("./pages/finance/WithdrawalsPage"));
const SystemSettingsPage = lazy(() => import("./pages/system/SystemSettingsPage"));
const AdminSelfCareAlertsPage = lazy(() => import("./pages/selfcare/AlertsPage"));

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
