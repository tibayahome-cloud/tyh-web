import { Suspense } from "react";
import type { RouteObject } from "react-router-dom";
import { Navigate, useRoutes } from "react-router-dom";

import { Loading } from "../../shared/components/Loading";
import { ProviderShell } from "./components/ProviderShell";
import { lazyWithRetry } from "../../shared/utils/lazyWithRetry";

const ProviderHome = lazyWithRetry(() => import("./pages/Home"));
const ProviderBookings = lazyWithRetry(() => import("./pages/Bookings"));
const ProviderTelemedicine = lazyWithRetry(() => import("./pages/Telemedicine"));
const ProviderOnboarding = lazyWithRetry(() => import("./pages/Onboarding"));
const ProviderServices = lazyWithRetry(() => import("./pages/Services"));
const ProviderAvailability = lazyWithRetry(() => import("./pages/Availability"));
const ProviderPayments = lazyWithRetry(() => import("./pages/Payments"));
const ProviderInbox = lazyWithRetry(() => import("./pages/Inbox"));
const ProviderSettings = lazyWithRetry(() => import("./pages/Settings"));
const ProviderProfile = lazyWithRetry(() => import("./pages/Profile"));
const ProviderSelfCare = lazyWithRetry(() => import("./pages/SelfCare"));
const NotificationsPage = lazyWithRetry(() => import("../../shared/pages/Notifications/NotificationsPage"));
const ProviderBookingDetail = lazyWithRetry(() => import("./pages/BookingDetail"));

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
        path: "telemedicine",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <ProviderTelemedicine />
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
