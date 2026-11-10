/**
 * /book/telemedicine is the one page a visitor can start booking from without an account, so it must be reachable by
 * someone who is signed out and must not be swallowed by the app's catch-all, which sends unknown paths to the sign-in
 * page. The catch-all is added below exactly as src/app/routes.tsx has it.
 */

import { Suspense } from "react";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, Navigate, Outlet, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../shared/libs/capacitor", () => ({ isNativePlatform: () => false }));
vi.mock("../../../shared/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: false, roles: [] }) }));
vi.mock("../pages/Home", () => ({ Home: () => <p>website home</p> }));
vi.mock("../pages/BookTelemedicine", () => ({ BookTelemedicine: () => <p>public booking page</p> }));
vi.mock("../components/WebsiteLayout", () => ({
  WebsiteLayout: () => (
    <Suspense fallback={null}>
      <Outlet />
    </Suspense>
  )
}));

import { websiteRoutes } from "../routes";

const renderAt = (path: string) => {
  const router = createMemoryRouter(
    [
      ...websiteRoutes,
      { path: "/login", element: <p>sign-in page</p> },
      // The app's catch-all: anything unknown goes to sign-in.
      { path: "*", element: <Navigate to="/login" replace /> }
    ],
    { initialEntries: [path] }
  );
  return render(<RouterProvider router={router} />);
};

describe("the public booking route", () => {
  it("shows the booking page to someone who is signed out, without sending them to sign in", async () => {
    renderAt("/book/telemedicine");

    expect(await screen.findByText("public booking page")).toBeInTheDocument();
    expect(screen.queryByText("sign-in page")).not.toBeInTheDocument();
  });

  it("is a route of its own: a path under it that does not exist still goes to sign-in", async () => {
    renderAt("/book/telemedicine/elsewhere");

    expect(await screen.findByText("sign-in page")).toBeInTheDocument();
    expect(screen.queryByText("public booking page")).not.toBeInTheDocument();
  });
});
