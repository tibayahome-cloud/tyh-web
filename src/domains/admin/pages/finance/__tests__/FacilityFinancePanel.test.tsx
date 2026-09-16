import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";

const showToastMock = vi.fn();

vi.mock("../../../../../shared/components/ToastProvider", () => ({
  useToast: () => ({ showToast: showToastMock, push: vi.fn() })
}));

const fetchFacilityEarningsSummaryMock = vi.fn();
const requestFacilityWithdrawalMock = vi.fn();
const requestFacilityPayoutDestinationMock = vi.fn();
const verifyFacilityPayoutDestinationMock = vi.fn();

vi.mock("../../../../../shared/libs/wallet", () => ({
  fetchFacilityEarningsSummary: (...args: unknown[]) => fetchFacilityEarningsSummaryMock(...args),
  requestFacilityWithdrawal: (...args: unknown[]) => requestFacilityWithdrawalMock(...args),
  requestFacilityPayoutDestination: (...args: unknown[]) => requestFacilityPayoutDestinationMock(...args),
  verifyFacilityPayoutDestination: (...args: unknown[]) => verifyFacilityPayoutDestinationMock(...args)
}));

const fetchReviewQueueMock = vi.fn();

vi.mock("../../../../../shared/libs/telemedicineOps", () => ({
  fetchReviewQueue: (...args: unknown[]) => fetchReviewQueueMock(...args)
}));

import { FacilityFinancePanel } from "../FacilityFinancePanel";

const renderPanel = (canManageFunds = true) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <FacilityFinancePanel facilityId="facility-1" facilityName="Nairobi Clinic" canManageFunds={canManageFunds} />
      </QueryClientProvider>
    </MemoryRouter>
  );
};

const walletFixture = (overrides: Partial<Record<string, unknown>> = {}) => ({
  currency: "KES",
  pendingEarningsCents: 5000,
  availableBalanceCents: 20000,
  paidOutTotalCents: 10000,
  reversedTotalCents: 0,
  nextReleaseAt: null,
  withdrawals: [],
  payoutDestination: { phoneMasked: "07** ***123", verified: true },
  ...overrides
});

describe("FacilityFinancePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchReviewQueueMock.mockResolvedValue([]);
  });

  it("renders wallet stats and the facility name in the title", async () => {
    fetchFacilityEarningsSummaryMock.mockResolvedValue(walletFixture());
    renderPanel();

    expect(await screen.findByText("07** ***123")).toBeInTheDocument();
    expect(screen.getByText("Finance — Nairobi Clinic")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("hides fund-management actions when the actor cannot manage facility funds", async () => {
    fetchFacilityEarningsSummaryMock.mockResolvedValue(walletFixture());
    renderPanel(false);

    await screen.findByText("07** ***123");
    expect(screen.queryByRole("button", { name: /request withdrawal/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /change destination/i })).not.toBeInTheDocument();
  });

  it("shows an open-review badge linking into the facility-scoped review queue", async () => {
    fetchFacilityEarningsSummaryMock.mockResolvedValue(walletFixture());
    fetchReviewQueueMock.mockResolvedValue([
      { category: "payment_review", id: "r1", status: "open", bookingId: null, facilityId: "facility-1", scheduledAt: null, paymentId: null, openedAt: null, summary: null }
    ]);
    renderPanel();

    const link = await screen.findByRole("link", { name: /review & disputes/i });
    expect(link).toHaveAttribute("href", "/admin/finance/reviews");
    expect(await screen.findByText("1 open")).toBeInTheDocument();
  });

  it("blocks a withdrawal that exceeds the available balance", async () => {
    fetchFacilityEarningsSummaryMock.mockResolvedValue(walletFixture({ availableBalanceCents: 1000 }));
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: /request withdrawal/i }));
    const amountInput = await screen.findByLabelText("Amount");
    await user.type(amountInput, "500");
    await user.click(screen.getByRole("button", { name: /^submit$/i }));

    await waitFor(() =>
      expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Amount exceeds available balance" }))
    );
    expect(requestFacilityWithdrawalMock).not.toHaveBeenCalled();
  });

  it("opens the withdrawal history modal", async () => {
    fetchFacilityEarningsSummaryMock.mockResolvedValue(
      walletFixture({
        withdrawals: [
          {
            id: "w1",
            amountCents: 5000,
            status: "disbursed",
            requestedAt: "2026-07-30T10:00:00Z",
            disbursedAt: "2026-07-30T10:05:00Z",
            payoutRef: "ref-1",
            payoutPhoneMasked: "07** ***123",
            failureReason: null
          }
        ]
      })
    );
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: /withdrawal history/i }));
    expect(await screen.findByText("disbursed")).toBeInTheDocument();
    expect(
      await screen.findAllByText((_, node) => (node?.textContent ?? "").includes("50.00"))
    ).not.toHaveLength(0);
  });
});
