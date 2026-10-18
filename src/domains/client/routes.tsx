import { Suspense } from "react";
import type { RouteObject } from "react-router-dom";
import { Navigate, useRoutes } from "react-router-dom";

import { Loading } from "../../shared/components/Loading";
import { ClientShell } from "./components/ClientShell";
import { lazyWithRetry } from "../../shared/utils/lazyWithRetry";

const ClientHome = lazyWithRetry(() => import("./pages/Home"));
const ClientTelemedicine = lazyWithRetry(() => import("./pages/Telemedicine"));
const ClientServices = lazyWithRetry(() => import("./pages/Services"));
const ClientServiceDetail = lazyWithRetry(() => import("./pages/ServiceDetail"));
const NotificationsPage = lazyWithRetry(() => import("../../shared/pages/Notifications/NotificationsPage"));
const BookingDetailPage = lazyWithRetry(() => import("./pages/BookingDetail"));
const BookingsPage = lazyWithRetry(() => import("./pages/Bookings"));
const SelfCarePage = lazyWithRetry(() => import("./pages/SelfCare"));
const ClientProfilePage = lazyWithRetry(() => import("./pages/Profile"));
const ClientSettingsPage = lazyWithRetry(() => import("./pages/Settings"));
const ClientInboxPage = lazyWithRetry(() => import("./pages/Inbox"));

const buildRoutes = (): RouteObject[] => [
  {
    element: <ClientShell />,
    children: [
      { index: true, element: <Navigate to="home" replace /> },
      {
        path: "home",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <ClientHome />
          </Suspense>
        )
      },
      {
        path: "services",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <ClientServices />
          </Suspense>
        )
      },
      {
        path: "telemedicine",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <ClientTelemedicine />
          </Suspense>
        )
      },
      {
        path: "services/:serviceId",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <ClientServiceDetail />
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
            <BookingDetailPage />
          </Suspense>
        )
      },
      {
        path: "bookings",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <BookingsPage />
          </Suspense>
        )
      },
      {
        path: "inbox/:threadId?",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <ClientInboxPage />
          </Suspense>
        )
      },
      {
        path: "selfcare",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <SelfCarePage />
          </Suspense>
        )
      },
      {
        path: "profile",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <ClientProfilePage />
          </Suspense>
        )
      },
      {
        path: "settings",
        element: (
          <Suspense fallback={<Loading fullHeight />}>
            <ClientSettingsPage />
          </Suspense>
        )
      }
    ]
  }
];

const ClientRoutes = () => {
  const element = useRoutes(buildRoutes());
  return element;
};

export default ClientRoutes;
