import { lazy, Suspense } from "react";
import type { RouteObject } from "react-router-dom";
import { Navigate, useRoutes } from "react-router-dom";

import { Loading } from "../../shared/components/Loading";
import { ProviderShell } from "./components/ProviderShell";

const ProviderHome = lazy(() => import("./pages/Home"));
const ProviderBookings = lazy(() => import("./pages/Bookings"));
const ProviderOnboarding = lazy(() => import("./pages/Onboarding"));
const ProviderServices = lazy(() => import("./pages/Services"));
const ProviderAvailability = lazy(() => import("./pages/Availability"));
const ProviderPayments = lazy(() => import("./pages/Payments"));
const ProviderInbox = lazy(() => import("./pages/Inbox"));
const ProviderSettings = lazy(() => import("./pages/Settings"));
const ProviderProfile = lazy(() => import("./pages/Profile"));
const ProviderSelfCare = lazy(() => import("./pages/SelfCare"));
const NotificationsPage = lazy(() => import("../../shared/pages/Notifications/NotificationsPage"));
const ProviderBookingDetail = lazy(() => import("./pages/BookingDetail"));

const buildRoutes = (): RouteObject[] => [
  {
    element: <ProviderShell />,
    children: [
      { index: true, element: <Navigate to="home" replace /> },
      {
        path: "home",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <ProviderHome />
          </Suspense>
        )
      },
      {
        path: "selfcare",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <ProviderSelfCare />
          </Suspense>
        )
      },
      {
        path: "onboarding",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <ProviderOnboarding />
          </Suspense>
        )
      },
      {
        path: "bookings",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <ProviderBookings />
          </Suspense>
        )
      },
      {
        path: "services",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <ProviderServices />
          </Suspense>
        )
      },
      {
        path: "availability",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <ProviderAvailability />
          </Suspense>
        )
      },
      {
        path: "payments",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <ProviderPayments />
          </Suspense>
        )
      },
      {
        path: "inbox/:threadId?",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <ProviderInbox />
          </Suspense>
        )
      },
      {
        path: "settings",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <ProviderSettings />
          </Suspense>
        )
      },
      {
        path: "profile",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <ProviderProfile />
          </Suspense>
        )
      },
      {
        path: "notifications",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <NotificationsPage />
          </Suspense>
        )
      },
      {
        path: "bookings/:bookingId",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <ProviderBookingDetail />
          </Suspense>
        )
      }
    ]
  }
];

const ProviderRoutes = () => {
  const element = useRoutes(buildRoutes());
  return element;
};

export default ProviderRoutes;
