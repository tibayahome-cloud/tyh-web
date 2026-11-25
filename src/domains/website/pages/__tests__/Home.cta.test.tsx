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

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
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
const SIGNUP_PAGE = "signup-page";
const PUBLIC_BOOKING_PAGE = "public-booking-page";
const PUBLIC_HOME_CARE_PAGE = "public-home-care-page";
const NOT_FOUND_FALLBACK = "not-found-fallback";

/** Shows where a visitor landed, including the destination carried in ?next=. */
const SignUpProbe = () => {
  const location = useLocation();
  return (
    <div>
      {SIGNUP_PAGE}
      <span data-testid="signup-search">{location.search}</span>
    </div>
  );
};

/** Shows where a visitor landed on the public booking page, with what they had already chosen. */
const BookingProbe = () => {
  const location = useLocation();
  return (
    <div>
      {PUBLIC_BOOKING_PAGE}
      <span data-testid="booking-search">{location.search}</span>
    </div>
  );
};

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
        <Route path="/signup" element={<SignUpProbe />} />
        <Route path="/book/telemedicine" element={<BookingProbe />} />
        <Route path="/book/home-care" element={<div>{PUBLIC_HOME_CARE_PAGE}</div>} />
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

  it("separates one-time telemedicine prices from monthly care package prices", () => {
    renderHome({ isAuthenticated: false });

    expect(screen.getByRole("heading", { name: "One-time telemedicine services" })).toBeInTheDocument();
    expect(screen.getByText("Video Consultation")).toBeInTheDocument();
    expect(screen.getByText("Drug & Lab Report Review")).toBeInTheDocument();
    expect(screen.getByText("Specialist Consultation")).toBeInTheDocument();
    expect(screen.getAllByText("From KES 1,000")).toHaveLength(2);
    expect(screen.getByText("From KES 2,000")).toBeInTheDocument();
    expect(screen.getAllByText("per call")).toHaveLength(2);
    expect(screen.getByText("per review")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Ongoing care packages" })).toBeInTheDocument();
    expect(screen.getByText("All prices shown per month")).toBeInTheDocument();
    expect(screen.getAllByText("/ month")).toHaveLength(5);
    expect(screen.queryByText(/per visit\s*\/\s*month/i)).not.toBeInTheDocument();
    expect(screen.getByText("Premium Palliative")).toBeInTheDocument();
  });

  describe("when the browser still holds a session", () => {
    // The site only checks that a login token is saved, not that it still works. A button that promised a booking must
    // therefore never lead into the app, where an expired session ends at the login page.
    it.each(["Video doctor", "Find a specialist", "Mental health", "Lab results review", "Scan results review", "Prescription review", "Home care"])(
      "sends the %s tile to the public booking pages, not into the app",
      async (label) => {
        const user = userEvent.setup();
        renderHome({ isAuthenticated: true });

        await user.click(screen.getByRole("link", { name: label }));

        expect(screen.queryByText(CLIENT_APP_HOME)).not.toBeInTheDocument();
        expect(screen.queryByText(SIGNUP_PAGE)).not.toBeInTheDocument();
        expect(screen.queryByText(NOT_FOUND_FALLBACK)).not.toBeInTheDocument();
      }
    );

    it("sends View All Services & Care Packages to the public home care page", async () => {
      const user = userEvent.setup();
      renderHome({ isAuthenticated: true });

      await user.click(screen.getAllByRole("button", { name: /View All Services & Care Packages/i })[0]);

      expect(screen.getByText(PUBLIC_HOME_CARE_PAGE)).toBeInTheDocument();
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
        expect(screen.queryByText(CLIENT_APP_HOME)).not.toBeInTheDocument();
        view.unmount();
      }
    });
  });

  describe("when the visitor is signed out", () => {
    it("sends the home-care call to action to the public home care booking page, not to sign-up", async () => {
      const user = userEvent.setup();
      renderHome({ isAuthenticated: false });

      await user.click(screen.getByRole("link", { name: "Home care" }));

      expect(screen.getByText(PUBLIC_HOME_CARE_PAGE)).toBeInTheDocument();
      expect(screen.queryByText(SIGNUP_PAGE)).not.toBeInTheDocument();
      expect(screen.queryByText(CLIENT_APP_HOME)).not.toBeInTheDocument();
    });

    it.each(["Video doctor", "Find a specialist", "Mental health", "Lab results review", "Scan results review", "Prescription review"])(
      "sends the %s tile to the public booking page, so the visitor sees services and times before any sign-up",
      async (label) => {
        const user = userEvent.setup();
        renderHome({ isAuthenticated: false });

        await user.click(screen.getByRole("link", { name: label }));

        expect(screen.getByText(PUBLIC_BOOKING_PAGE)).toBeInTheDocument();
        expect(screen.queryByText(SIGNUP_PAGE)).not.toBeInTheDocument();
        expect(screen.queryByText(CLIENT_APP_HOME)).not.toBeInTheDocument();
        expect(screen.queryByText(NOT_FOUND_FALLBACK)).not.toBeInTheDocument();
      }
    );
  });

  describe("what the visitor already chose is carried to the booking page", () => {
    const TILE_CHOICES: Array<[string, string]> = [
      ["Video doctor", "?category=firstcare"],
      ["Find a specialist", "?category=specialistcare"],
      ["Mental health", "?category=mental-health"],
      ["Lab results review", "?service=follow-up-medical-consultation"],
      ["Scan results review", "?service=diagnostic-report-review"],
      ["Prescription review", "?service=medical-advice-referral"]
    ];

    it.each(TILE_CHOICES)("the %s tile opens the booking with %s", async (label, search) => {
      const user = userEvent.setup();
      renderHome({ isAuthenticated: false });

      await user.click(screen.getByRole("link", { name: label }));

      expect(screen.getByTestId("booking-search")).toHaveTextContent(search);
    });

    it.each([
      ["Video Consultation", "?service=first-medical-consultation"],
      ["Drug & Lab Report Review", "?service=follow-up-medical-consultation"],
      ["Specialist Consultation", "?category=specialistcare"]
    ])("the %s card opens the booking with %s", async (name, search) => {
      const user = userEvent.setup();
      renderHome({ isAuthenticated: false });

      await user.click(screen.getByRole("button", { name: new RegExp(name) }));

      expect(screen.getByTestId("booking-search")).toHaveTextContent(search);
    });

    it("no longer repeats the tiles as a second grid of photo cards", () => {
      renderHome({ isAuthenticated: false });

      expect(screen.queryByRole("heading", { name: "Our Services" })).not.toBeInTheDocument();
      expect(screen.queryByText("Doctor & Nurse Home Visits")).not.toBeInTheDocument();
    });
  });

  describe("the task tiles", () => {
    it("offers the eight things a visitor comes to do, under one heading", () => {
      renderHome({ isAuthenticated: false });

      const heading = screen.getByRole("heading", { name: "What can we help you with today?" });
      const grid = heading.closest("section") as HTMLElement;
      const labels = within(grid)
        .getAllByRole("listitem")
        .map((item) => item.textContent);
      expect(labels).toEqual([
        "Video doctor",
        "Find a specialist",
        "Mental health",
        "Lab results review",
        "Scan results review",
        "Prescription review",
        "Home care",
        "Ambulance"
      ]);
    });

    it("takes the ambulance tile to the ambulance request page", () => {
      renderHome({ isAuthenticated: false });

      expect(screen.getByRole("link", { name: "Ambulance" })).toHaveAttribute("href", "/book/home-care?care=ambulance");
    });

    it("puts the numbers to call and a request button in the ambulance section lower on the page", () => {
      renderHome({ isAuthenticated: false });

      const section = document.getElementById("ambulance") as HTMLElement;
      expect(within(section).getByRole("link", { name: "Call 999" })).toHaveAttribute("href", "tel:999");
      expect(within(section).getByRole("link", { name: "Call 112" })).toHaveAttribute("href", "tel:112");
      expect(within(section).getByRole("link", { name: /^Call \+254/ })).toHaveAttribute("href", expect.stringMatching(/^tel:\+254/));
      expect(within(section).getByRole("link", { name: /Request an ambulance/ })).toHaveAttribute("href", "/book/home-care?care=ambulance");
    });
  });
});
