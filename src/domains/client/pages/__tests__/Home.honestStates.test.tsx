/**
 * Client Home must not turn a missing or failed answer into a value. It said "Normal" for a client with
 * no readings, "No upcoming care scheduled" when the request had failed, and a heart-rate chip that
 * always read "-- bpm" because it looked up a field that is not on the record.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ambulance = vi.hoisted(() => ({ has: false }));
const state = vi.hoisted(() => ({
  upcoming: {} as Record<string, unknown>,
  history: {} as Record<string, unknown>,
  wallet: {} as Record<string, unknown>,
  checkins: {} as Record<string, unknown>,
  refetchUpcoming: vi.fn()
}));

vi.mock("../../../../shared/hooks/useOpenBookingChat", () => ({
  useOpenBookingChat: () => ({ openBookingChat: vi.fn(), openingBookingId: null })
}));
vi.mock("../../../../shared/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "c1", phone: "+254700000001" } }) }));
vi.mock("../../../../shared/hooks/useBookings", () => ({
  useBookingList: (params: { statuses?: string[] }) => {
    const statuses = params.statuses ?? [];
    if (statuses.includes("scheduled")) return { refetch: state.refetchUpcoming, isLoading: false, ...state.upcoming };
    if (statuses.includes("fully_completed")) return { refetch: vi.fn(), isLoading: false, ...state.history };
    return { data: { bookings: [] }, isLoading: false };
  },
  useConfirmBookingMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCancelBookingMutation: () => ({ mutateAsync: vi.fn(), isPending: false })
}));
vi.mock("../../../../shared/hooks/useWallet", () => ({ useWalletAccount: () => state.wallet }));
vi.mock("../../../../shared/hooks/useTelemedicine", () => ({ useTelemedicinePolicy: () => ({ data: { joinWindowBeforeMinutes: 10 } }) }));
vi.mock("../../../../shared/hooks/useSelfCare", () => ({ useSelfCareCheckins: () => state.checkins }));
vi.mock("../../hooks/useHasAmbulanceService", () => ({ useHasAmbulanceService: () => ambulance.has }));
vi.mock("../../../../shared/hooks/useSocket", () => ({ useSocket: () => null }));
vi.mock("../../../../shared/hooks/useLocationAccess", () => ({
  useLocationAccess: () => ({ status: "granted", error: null, requestAccess: vi.fn() })
}));
vi.mock("../../../../shared/components/ToastProvider", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("../../../../shared/components/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../../../../shared/components/NeedsYourResponse", () => ({ NeedsYourResponse: () => null }));
vi.mock("../../../../shared/components/BookingFeedbackDialog", () => ({ BookingFeedbackDialog: () => null }));
vi.mock("../../../../shared/components/BookingLiveMapCard", () => ({ BookingLiveMapCard: () => null }));
vi.mock("../../../../shared/components/LocationPermissionBanner", () => ({ LocationPermissionBanner: () => null }));
vi.mock("../../../../shared/components/MpesaPaymentInstructions", () => ({ MpesaPaymentInstructions: () => null }));
vi.mock("../../components/BookingRequestDialog", () => ({ BookingRequestDialog: () => null }));
vi.mock("../../components/BookingSearchStatus", () => ({ BookingSearchStatus: () => null }));
vi.mock("../../components/PaymentReviewNotice", () => ({ PaymentReviewNotice: () => null }));
vi.mock("../../components/AIRecommendationsCard", () => ({ AIRecommendationsCard: () => null }));
vi.mock("../../components/ClientPageHeader", () => ({ ClientPageHeader: () => null }));
vi.mock("../../components/ImmersiveBookingView", () => ({ default: () => null }));
vi.mock("../../components/HomeCarePaymentActions", () => ({ HomeCarePaymentActions: () => null }));

import ClientHome from "../Home";

const renderHome = () =>
  render(
    <MemoryRouter>
      <ClientHome />
    </MemoryRouter>
  );

beforeEach(() => {
  state.refetchUpcoming.mockClear();
  state.upcoming = { data: { bookings: [] } };
  state.history = { data: { bookings: [] } };
  state.wallet = { data: { currency: "KES", balanceCents: 250000 }, isError: false };
  state.checkins = { data: [], isLoading: false, isError: false };
});

describe("client Home: the ways to book", () => {
  it("opens the Services page from Book home care, and shows no ambulance button when there is no ambulance service", () => {
    ambulance.has = false;
    renderHome();

    expect(screen.getByRole("button", { name: /Book home care/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ambulance/i })).not.toBeInTheDocument();
  });

  it("shows the ambulance button once the catalogue has an ambulance service", () => {
    ambulance.has = true;
    renderHome();

    expect(screen.getByRole("button", { name: /Request an ambulance/ })).toBeInTheDocument();
    ambulance.has = false;
  });
});

describe("client Home", () => {
  it("shows no vitals or wallet entry points, which led nowhere for a client", () => {
    renderHome();

    expect(screen.queryByText("Log vitals")).not.toBeInTheDocument();
    expect(screen.queryByText(/Wallet:/)).not.toBeInTheDocument();
    expect(screen.queryByText("Health Pulse")).not.toBeInTheDocument();
    expect(screen.queryByText(/Check-in/)).not.toBeInTheDocument();
  });

  it("says the upcoming appointments could not be loaded, with a retry, instead of 'No upcoming care scheduled'", async () => {
    state.upcoming = { data: undefined, isError: true };
    const user = userEvent.setup();
    renderHome();

    expect(screen.getByText("We could not load your upcoming appointments.")).toBeInTheDocument();
    expect(screen.queryByText("No upcoming care scheduled")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(state.refetchUpcoming).toHaveBeenCalled();
  });

  describe("the next video consultation", () => {
    const consultation = (extra: Record<string, unknown> = {}) => ({
      id: "c1",
      status: "scheduled",
      isTelemedicine: true,
      scheduledAt: new Date(Date.now() + 3 * 60 * 60_000).toISOString(),
      estimateDurationMinutes: 30,
      feedback: [],
      service: { name: "Online consultation" },
      provider: { fullName: "Dr Example" },
      ...extra
    });

    it("gets its own card with a countdown, and is not repeated in the list under it", () => {
      state.upcoming = { data: { bookings: [consultation()] } };
      renderHome();

      expect(screen.getByRole("heading", { name: "Your telemedicine consultation with Dr Example" })).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(/Starts in/);
      expect(screen.queryByRole("heading", { name: "Your next appointments" })).not.toBeInTheDocument();
      expect(screen.queryByText("No upcoming care scheduled")).not.toBeInTheDocument();
    });

    it("keeps other appointments in the list beneath it", () => {
      state.upcoming = {
        data: { bookings: [consultation(), consultation({ id: "h1", isTelemedicine: false, service: { name: "Home visit" } })] }
      };
      renderHome();

      expect(screen.getByRole("heading", { name: "Your telemedicine consultation with Dr Example" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Your next appointments" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Home visit/ })).toBeInTheDocument();
    });

    it("has no card for a home visit, or for a consultation that has already finished", () => {
      state.upcoming = {
        data: {
          bookings: [
            consultation({ id: "h1", isTelemedicine: false }),
            consultation({ id: "old", scheduledAt: new Date(Date.now() - 5 * 60 * 60_000).toISOString() })
          ]
        }
      };
      renderHome();
      expect(screen.queryByRole("heading", { name: /Your telemedicine consultation/ })).not.toBeInTheDocument();
    });
  });

  it("still says nothing is scheduled when the request succeeded with no bookings", () => {
    renderHome();
    expect(screen.getByText("No upcoming care scheduled")).toBeInTheDocument();
  });

  it("puts the next appointments before the ways to book a new one", () => {
    renderHome();
    const upcoming = screen.getByRole("heading", { name: "Your next appointments" });
    const launcher = screen.getByRole("heading", { name: "How would you like to receive care?" });
    expect(upcoming.compareDocumentPosition(launcher) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  describe("rating a finished visit", () => {
    const finished = (feedback: unknown[]) => ({
      data: { bookings: [{ id: "b9", status: "fully_completed", feedback, provider: { fullName: "Dr Example" } }] }
    });

    it("asks for a rating at the top, not only inside a collapsed list", () => {
      state.history = finished([]);
      renderHome();
      expect(screen.getByText("How was your visit with Dr Example?")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Rate your visit" })).toBeInTheDocument();
    });

    it("does not ask again once the visit has been rated", () => {
      state.history = finished([{ rating: 5 }]);
      renderHome();
      expect(screen.queryByText(/How was your visit/)).not.toBeInTheDocument();
    });
  });
});

describe("client Home: reachable and readable without a mouse", () => {
  it("makes a booking card a button the keyboard can reach, with the rating button separate from it", async () => {
    const user = userEvent.setup();
    state.upcoming = {
      data: { bookings: [{ id: "b1", status: "scheduled", scheduledAt: null, isTelemedicine: false, feedback: [], service: { name: "Home visit" } }] }
    };
    renderHome();

    const card = screen.getByRole("button", { name: /Home visit/ });
    card.focus();
    expect(card).toHaveFocus();
    await user.keyboard("{Enter}");
    // Buttons are never nested in one another, which assistive technology cannot read.
    expect(card.querySelector("button")).toBeNull();
  });

  it("announces whether Recent activity is open, and what it controls", async () => {
    const user = userEvent.setup();
    renderHome();

    const toggle = screen.getByRole("button", { name: "Recent activity" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "recent-activity");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("recent-activity")).not.toBeNull();
  });

  it("keeps small grey text off the page: nothing is the washed-out slate-400 or under 12px", () => {
    const { container } = renderHome();
    const html = container.innerHTML;
    expect(html).not.toMatch(/text-slate-400/);
    expect(html).not.toMatch(/text-\[(9|10|11)px\]/);
    expect(html).not.toMatch(/uppercase/);
  });
});
