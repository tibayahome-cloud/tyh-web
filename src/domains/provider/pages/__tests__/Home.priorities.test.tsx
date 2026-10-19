/**
 * Provider Home puts what needs the provider first: requests waiting for an answer, then what is in
 * progress and coming up, and only then earnings and performance. It used to open on two decorative
 * cards of numbers with the live requests tucked into a sidebar.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  profile: { id: "p1", is_available: true, facility: null } as Record<string, unknown>,
  offers: [] as Array<Record<string, unknown>>,
  active: [] as Array<Record<string, unknown>>,
  upcoming: [] as Array<Record<string, unknown>>,
  history: [] as Array<Record<string, unknown>>,
  setAvailable: vi.fn(),
  dismiss: vi.fn()
}));

vi.mock("../../../../shared/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("../../../../shared/hooks/useSocket", () => ({ useSocket: () => null }));
vi.mock("../../../../shared/hooks/useLocationAccess", () => ({ useLocationAccess: () => ({ isGranted: false }) }));
vi.mock("../../../../shared/hooks/useLiveLocationPublisher", () => ({ useLiveLocationPublisher: () => undefined }));
vi.mock("../../../../shared/components/ToastProvider", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("../../hooks/useProviderProfile", () => ({
  useProviderProfile: () => ({ data: state.profile, isLoading: false }),
  useUpdateProviderStatus: () => ({ mutate: state.setAvailable, isPending: false }),
  providerFinancialsAreVisible: () => true
}));
vi.mock("../../../../shared/hooks/useBookings", () => ({
  bookingKeys: { lists: () => ["bookings", "list"] },
  useBookingList: (params: { statuses?: string[] }) => {
    const statuses = params.statuses ?? [];
    const bookings = statuses.includes("completed_by_provider") && statuses.includes("in_service")
      ? state.active
      : statuses.includes("fully_completed")
        ? state.history
        : state.upcoming;
    return { data: { bookings }, isFetching: false, isError: false, refetch: vi.fn() };
  },
  useAcceptBookingMutation: () => ({ mutate: vi.fn(), isPending: false })
}));
vi.mock("../../contexts/BroadcastQueueContext", () => ({
  useBroadcastQueueContext: () => ({ queue: state.offers, dismiss: state.dismiss })
}));
vi.mock("../../../../shared/components/NeedsYourResponse", () => ({
  NeedsYourResponse: () => <p>NEEDS-RESPONSE</p>
}));
vi.mock("../../components/RevenueSnapshot", () => ({ RevenueSnapshot: () => <p>EARNINGS</p> }));
vi.mock("../../components/PerformanceStats", () => ({ PerformanceStats: () => <p>PERFORMANCE</p> }));
vi.mock("../../components/ProviderSetupCard", () => ({ ProviderSetupCard: () => null }));
vi.mock("../../components/ProviderFacilityAffiliation", () => ({ ProviderFacilityAffiliation: () => null }));
vi.mock("../../components/ClientHealthAlertsCard", () => ({ ClientHealthAlertsCard: () => null }));
vi.mock("../../components/ImmersiveProviderBookingView", () => ({ default: () => null }));
vi.mock("../../../../shared/components/BookingLiveMapCard", () => ({ BookingLiveMapCard: () => null }));
vi.mock("../../../../shared/components/BookingFeedbackDialog", () => ({ BookingFeedbackDialog: () => null }));

import ProviderHome from "../Home";

const offer = {
  booking: { id: "b1", service: { name: "Wound dressing" } },
  wave: 1,
  radiusM: 5000,
  candidateCount: 4,
  distanceM: 2300,
  receivedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString()
};

const renderHome = () =>
  render(
    <MemoryRouter initialEntries={["/pro/home"]}>
      <QueryClientProvider client={new QueryClient()}>
        <ProviderHome />
      </QueryClientProvider>
    </MemoryRouter>
  );

const before = (first: HTMLElement, second: HTMLElement) =>
  Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

beforeEach(() => {
  state.profile = { id: "p1", is_available: true, facility: null };
  state.offers = [];
  state.active = [];
  state.upcoming = [];
  state.history = [];
  state.setAvailable.mockClear();
  state.dismiss.mockClear();
  sessionStorage.clear();
});

describe("provider Home", () => {
  it("shows what needs a response, then work, then earnings and performance", () => {
    state.offers = [offer];
    renderHome();

    const needs = screen.getByText("NEEDS-RESPONSE");
    const requests = screen.getByRole("heading", { name: /New requests \(1\)/ });
    const inProgress = screen.getByRole("heading", { name: "Nothing in progress right now" });
    const upcoming = screen.getByRole("heading", { name: "Upcoming" });
    const earnings = screen.getByText("EARNINGS");
    const performance = screen.getByText("PERFORMANCE");

    expect(before(needs, requests)).toBe(true);
    expect(before(requests, inProgress)).toBe(true);
    expect(before(inProgress, upcoming)).toBe(true);
    expect(before(upcoming, earnings)).toBe(true);
    expect(before(earnings, performance)).toBe(true);
  });

  it("shows a waiting request with how far away it is and how long ago it arrived, not a made-up deadline", () => {
    state.offers = [offer];
    renderHome();

    expect(screen.getByText("Wound dressing")).toBeInTheDocument();
    expect(screen.getByText(/2\.3 km away/)).toBeInTheDocument();
    expect(screen.getByText(/received 2 minutes ago/)).toBeInTheDocument();
    expect(screen.queryByText(/radius/i)).not.toBeInTheDocument();
  });

  it("lets the provider dismiss a request with a button big enough to tap", async () => {
    state.offers = [offer];
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(state.dismiss).toHaveBeenCalledWith("b1");
  });

  it("has no request section when nothing is waiting", () => {
    renderHome();
    expect(screen.queryByRole("heading", { name: /New requests/ })).not.toBeInTheDocument();
  });

  it("offers availability as a labelled on/off switch that says what it means", async () => {
    const user = userEvent.setup();
    renderHome();

    const toggle = screen.getByRole("switch", { name: "Availability" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("You are online. Clients can request you.")).toBeInTheDocument();

    await user.click(toggle);
    expect(state.setAvailable).toHaveBeenCalledWith(false, expect.anything());
  });

  it("says offline in words when the provider is offline", () => {
    state.profile = { id: "p1", is_available: false, facility: null };
    renderHome();
    expect(screen.getByRole("switch", { name: "Availability" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("You are offline. Turn this on to receive requests.")).toBeInTheDocument();
  });

  it("no longer repeats the sidebar as a list of quick links", () => {
    renderHome();
    expect(screen.queryByText("Quick Links")).not.toBeInTheDocument();
  });

  describe("without a mouse", () => {
    const booking = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
      id,
      status: "scheduled",
      scheduledAt: "2026-10-20T09:00:00Z",
      isTelemedicine: true,
      service: { name },
      client: { fullName: "Sample Client" },
      ...extra
    });

    it("makes upcoming and history rows buttons the keyboard can reach", () => {
      state.upcoming = [booking("b1", "Follow-up consultation")];
      state.history = [booking("b2", "Earlier consultation", { status: "fully_completed" })];
      renderHome();

      expect(screen.getByRole("button", { name: /Follow-up consultation/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Earlier consultation/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "View all" })).toBeInTheDocument();
    });

    it("gives the icon-only chat button a name", () => {
      state.active = [booking("b3", "Home visit", { status: "arrived", isTelemedicine: false })];
      renderHome();
      expect(screen.getByRole("button", { name: "Open chat with the client" })).toBeInTheDocument();
    });

    it("keeps small grey text and all-caps labels off the page", () => {
      state.upcoming = [booking("b1", "Follow-up consultation")];
      state.history = [booking("b2", "Earlier consultation", { status: "fully_completed" })];
      const { container } = renderHome();

      const textElements = Array.from(container.querySelectorAll("*")).filter((el) => !(el instanceof SVGElement));
      const classes = textElements.map((el) => el.getAttribute("class") ?? "").join(" ");
      expect(classes).not.toMatch(/text-slate-400/);
      expect(classes).not.toMatch(/text-\[(9|10|11)px\]/);
      expect(classes).not.toMatch(/uppercase/);
    });
  });
});
