/**
 * Client Home must not turn a missing or failed answer into a value. It said "Normal" for a client with
 * no readings, "No upcoming care scheduled" when the request had failed, and a heart-rate chip that
 * always read "-- bpm" because it looked up a field that is not on the record.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  upcoming: {} as Record<string, unknown>,
  history: {} as Record<string, unknown>,
  wallet: {} as Record<string, unknown>,
  checkins: {} as Record<string, unknown>,
  refetchUpcoming: vi.fn()
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
vi.mock("../../../../shared/hooks/useSelfCare", () => ({ useSelfCareCheckins: () => state.checkins }));
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

describe("client Home", () => {
  it("says there are no readings, not 'Normal', when no vitals were logged", () => {
    renderHome();
    expect(screen.getByText("No readings yet")).toBeInTheDocument();
    expect(screen.queryByText("Normal")).not.toBeInTheDocument();
  });

  it("shows the readings that exist, with units, and never a placeholder for the ones that do not", () => {
    state.checkins = { data: [{ vitals: { heartRate: 72, bpSystolic: 120, bpDiastolic: 80 } }], isLoading: false, isError: false };
    renderHome();
    expect(screen.getByText(/72 bpm/)).toBeInTheDocument();
    expect(screen.getAllByText(/120\/80/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/--/)).not.toBeInTheDocument();
  });

  it("does not print 'undefined/undefined' for a check-in that has a heart rate but no blood pressure", () => {
    state.checkins = { data: [{ vitals: { heartRate: 64 } }], isLoading: false, isError: false };
    renderHome();
    expect(screen.getByText(/64 bpm/)).toBeInTheDocument();
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
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

  it("still says nothing is scheduled when the request succeeded with no bookings", () => {
    renderHome();
    expect(screen.getByText("No upcoming care scheduled")).toBeInTheDocument();
  });

  it("does not show a failed wallet request as a balance", () => {
    state.wallet = { data: undefined, isError: true };
    renderHome();
    expect(screen.getByText("Balance unavailable")).toBeInTheDocument();
  });
});
