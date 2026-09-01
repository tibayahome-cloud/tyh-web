/**
 * The public homepage's calls to action all share one handler, so a single wrong
 * path breaks every conversion route on the site at once. That is what happened:
 * the handler sent authenticated visitors to "/client", which matches no route in
 * src/app/routes.tsx, so the router's catch-all bounced them to the login page.
 *
 * These tests reproduce that failure rather than asserting a path string. The
 * router below carries the same catch-all as the real one, so a CTA pointing at a
 * route that does not exist lands on the fallback and fails the assertion.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
const useServicesMock = vi.fn();

vi.mock("../../../../shared/hooks/useAuth", () => ({
  useAuth: () => useAuthMock()
}));

vi.mock("../../../../shared/hooks/useServices", () => ({
  useServices: () => useServicesMock()
}));

import { Home } from "../Home";

// framer-motion drives whileInView through IntersectionObserver, which jsdom does
// not implement. Observing nothing is enough here; the elements still mount.
class NoopIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

beforeAll(() => {
  vi.stubGlobal("IntersectionObserver", NoopIntersectionObserver);
});

const CLIENT_APP_HOME = "client-app-home";
const LOGIN_PAGE = "login-page";
const NOT_FOUND_FALLBACK = "not-found-fallback";

const renderHome = ({ isAuthenticated }: { isAuthenticated: boolean }) => {
  useAuthMock.mockReturnValue({ isAuthenticated });

  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* The real router mounts the client app behind a single "/app/*" splat, so every
            /app destination resolves there. Mirroring that keeps the fallback assertion
            honest: it fires for paths the app genuinely does not serve, rather than for
            /app routes this test did not happen to enumerate. */}
        <Route path="/app/*" element={<div>{CLIENT_APP_HOME}</div>} />
        <Route path="/login" element={<div>{LOGIN_PAGE}</div>} />
        {/* Mirrors src/app/routes.tsx: an unknown path redirects to login. */}
        <Route path="/unknown" element={<div>{NOT_FOUND_FALLBACK}</div>} />
        <Route path="*" element={<Navigate to="/unknown" replace />} />
      </Routes>
    </MemoryRouter>
  );
};

describe("homepage calls to action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useServicesMock.mockReturnValue({ data: [], isLoading: false });
  });

  describe("when the visitor is signed in", () => {
    it.each([
      "Talk to a Doctor",
      "Find a Specialist",
      "Book Home Care",
      "Get Ambulance",
      "View Detailed Care Packages"
    ])("sends %s into the client app rather than back to login", async (label) => {
      const user = userEvent.setup();
      renderHome({ isAuthenticated: true });

      await user.click(screen.getAllByRole("button", { name: new RegExp(label, "i") })[0]);

      expect(screen.getByText(CLIENT_APP_HOME)).toBeInTheDocument();
      expect(screen.queryByText(LOGIN_PAGE)).not.toBeInTheDocument();
      expect(screen.queryByText(NOT_FOUND_FALLBACK)).not.toBeInTheDocument();
    });

    it("routes every call to action to a route the router actually serves", async () => {
      const user = userEvent.setup();
      const { unmount } = renderHome({ isAuthenticated: true });
      const ctaCount = screen.getAllByRole("button").length;
      unmount();

      expect(ctaCount).toBeGreaterThan(0);

      for (let index = 0; index < ctaCount; index += 1) {
        const view = renderHome({ isAuthenticated: true });
        await user.click(screen.getAllByRole("button")[index]);

        expect(screen.queryByText(NOT_FOUND_FALLBACK)).not.toBeInTheDocument();
        view.unmount();
      }
    });
  });

  describe("when the visitor is signed out", () => {
    it("sends the primary call to action to login", async () => {
      const user = userEvent.setup();
      renderHome({ isAuthenticated: false });

      await user.click(screen.getAllByRole("button", { name: /Book Home Care/i })[0]);

      expect(screen.getByText(LOGIN_PAGE)).toBeInTheDocument();
      expect(screen.queryByText(CLIENT_APP_HOME)).not.toBeInTheDocument();
    });

    it.each(["Talk to a Doctor", "Find a Specialist", "Talk to a Doctor Online"])(
      "sends %s to login when the visitor is signed out",
      async (label) => {
        const user = userEvent.setup();
        renderHome({ isAuthenticated: false });

        await user.click(screen.getAllByRole("button", { name: new RegExp(label, "i") })[0]);

        expect(screen.getByText(LOGIN_PAGE)).toBeInTheDocument();
        expect(screen.queryByText(CLIENT_APP_HOME)).not.toBeInTheDocument();
      }
    );
  });
});
