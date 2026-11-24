import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  active: [] as unknown[],
  wallet: {} as Record<string, unknown>,
  checkins: {} as Record<string, unknown>
}));

vi.mock("../../../../shared/hooks/useOpenBookingChat", () => ({
  useOpenBookingChat: () => ({ openBookingChat: vi.fn(), openingBookingId: null })
}));
vi.mock("../../../../shared/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "c1", phone: "+254700000001" } }) }));
vi.mock("../../../../shared/hooks/useBookings", () => ({
  useBookingList: (params: { preset?: string }) =>
    params.preset === "detail" ? { data: { bookings: state.active }, isLoading: false } : { data: { bookings: [] }, isLoading: false },
  useConfirmBookingMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCancelBookingMutation: () => ({ mutateAsync: vi.fn(), isPending: false })
}));
vi.mock("../../../../shared/hooks/useWallet", () => ({ useWalletAccount: () => state.wallet }));
vi.mock("../../../../shared/hooks/useTelemedicine", () => ({ useTelemedicinePolicy: () => ({ data: { joinWindowBeforeMinutes: 10 } }) }));
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
vi.mock("../../components/BookingRequestDialog", () => ({ BookingRequestDialog: () => null }));
vi.mock("../../components/BookingSearchStatus", () => ({ BookingSearchStatus: () => null }));
vi.mock("../../components/PaymentReviewNotice", () => ({ PaymentReviewNotice: () => null }));
vi.mock("../../components/AIRecommendationsCard", () => ({ AIRecommendationsCard: () => null }));
vi.mock("../../components/ClientPageHeader", () => ({ ClientPageHeader: () => null }));
vi.mock("../../components/ImmersiveBookingView", () => ({ default: () => null }));
vi.mock("../../components/PaymentRequestNotice", () => ({ PaymentRequestNotice: () => <p>payment request status</p> }));

import ClientHome from "../Home";

/**
 * The "Payment for your visit" prompt could not be closed: closing cleared its fields but not the prompt, and an effect
 * reopened it on every refresh, so a client whose provider had finished could not use the app until they paid or
 * declined. It now closes, stays closed, and leaves a reminder on the page that brings it back.
 */

const completed = {
  id: "b-done",
  status: "completed_by_provider",
  isTelemedicine: false,
  priceCents: 150000,
  currency: "KES",
  provider: { id: "p1", fullName: "Dr Example", avatarUrl: null },
  disputes: [],
  feedback: []
};

const renderHome = () =>
  render(
    <MemoryRouter>
      <ClientHome />
    </MemoryRouter>
  );

beforeEach(() => {
  state.active = [completed];
  state.wallet = { data: { currency: "KES", balanceCents: 0 }, isError: false };
  state.checkins = { data: [], isLoading: false, isError: false };
});

describe("client Home: payment for your visit", () => {
  it("opens the prompt when the provider has finished, with a visible way to put it away", () => {
    renderHome();

    expect(screen.getByRole("heading", { name: /Payment for your visit/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Report a problem" })).toBeInTheDocument();
    expect(screen.getByText("payment request status")).toBeInTheDocument();
  });

  it("closes from the Close button", async () => {
    renderHome();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: /Payment for your visit/ })).not.toBeInTheDocument());
  });

  it("closes from Not now", async () => {
    renderHome();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: /Payment for your visit/ })).not.toBeInTheDocument());
  });

  it("closes from Escape", async () => {
    renderHome();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("heading", { name: /Payment for your visit/ })).not.toBeInTheDocument());
  });

  it("stays closed when the page refreshes its data", async () => {
    const { rerender } = renderHome();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: /Payment for your visit/ })).not.toBeInTheDocument());

    // The list is refetched and returns a new object for the same booking.
    state.active = [{ ...completed }];
    rerender(
      <MemoryRouter>
        <ClientHome />
      </MemoryRouter>
    );

    expect(screen.queryByRole("heading", { name: /Payment for your visit/ })).not.toBeInTheDocument();
  });

  it("leaves a reminder on the page, and the reminder brings the prompt back", async () => {
    renderHome();
    expect(screen.queryByRole("region", { name: "Payment for your visit" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    const reminder = await screen.findByRole("region", { name: "Payment for your visit" });
    expect(reminder).toHaveTextContent("Your visit with Dr Example is complete");

    fireEvent.click(screen.getByRole("button", { name: "View payment" }));
    expect(await screen.findByRole("heading", { name: /Payment for your visit/ })).toBeInTheDocument();
  });

  it("shows no prompt and no reminder when the visit is not awaiting confirmation", () => {
    state.active = [{ ...completed, status: "in_service" }];
    renderHome();

    expect(screen.queryByRole("heading", { name: /Payment for your visit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Payment for your visit" })).not.toBeInTheDocument();
  });
});

describe("client Home: the client no longer pays by typing a number", () => {
  it("offers no number field or confirm-and-pay button, only a way to report a problem", () => {
    renderHome();

    expect(screen.queryByRole("button", { name: /confirm/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /phone|number/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Report a problem" })).toBeInTheDocument();
  });

  it("asks what went wrong before sending a report", () => {
    renderHome();

    fireEvent.click(screen.getByRole("button", { name: "Report a problem" }));

    expect(screen.getByLabelText("What went wrong?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send report" })).toBeInTheDocument();
  });
});
