import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const fetchFacilityPaymentsMock = vi.fn();

vi.mock("../../../../../shared/libs/payments", () => ({
  fetchFacilityPayments: (...args: unknown[]) => fetchFacilityPaymentsMock(...args)
}));

import { FacilityFinanceSection } from "../FacilityFinanceSection";

const renderSection = (canManage = true) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <FacilityFinanceSection facilityId="facility-1" canManage={canManage} />
    </QueryClientProvider>
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

describe("FacilityFinanceSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchFacilityPaymentsMock.mockResolvedValue({ payments: [], meta: { page: { number: 1, size: 10, total: 0, totalPages: 1 } } });
  });

  it("renders nothing when the actor cannot manage facility finance", () => {
    const { container } = renderSection(false);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows wallet balances and the verified payout destination", async () => {
    fetchFacilityEarningsSummaryMock.mockResolvedValue(walletFixture());
    renderSection();

    expect(await screen.findAllByText((_, node) => (node?.textContent ?? "").replace(/ /g, " ") === "KES 200.00")).not.toHaveLength(0);
    expect(screen.getByText("07** ***123")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("blocks a withdrawal request that exceeds the available balance", async () => {
    fetchFacilityEarningsSummaryMock.mockResolvedValue(walletFixture({ availableBalanceCents: 1000 }));
    const user = userEvent.setup();
    renderSection();

    await screen.findByRole("button", { name: /request withdrawal/i });
    await user.click(screen.getByRole("button", { name: /request withdrawal/i }));
    const amountInput = await screen.findByLabelText("Amount");
    await user.type(amountInput, "500");
    await user.click(screen.getByRole("button", { name: /^submit$/i }));

    await waitFor(() =>
      expect(showToastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Amount exceeds available balance" })
      )
    );
    expect(requestFacilityWithdrawalMock).not.toHaveBeenCalled();
  });

  it("blocks a withdrawal request when no payout destination is verified", async () => {
    fetchFacilityEarningsSummaryMock.mockResolvedValue(
      walletFixture({ payoutDestination: { phoneMasked: null, verified: false } })
    );
    const user = userEvent.setup();
    renderSection();

    await screen.findByRole("button", { name: /request withdrawal/i });
    await user.click(screen.getByRole("button", { name: /request withdrawal/i }));
    const amountInput = await screen.findByLabelText("Amount");
    await user.type(amountInput, "10");
    await user.click(screen.getByRole("button", { name: /^submit$/i }));

    await waitFor(() =>
      expect(showToastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Verify a payout destination first" })
      )
    );
    expect(requestFacilityWithdrawalMock).not.toHaveBeenCalled();
  });

  it("requests an OTP code for a new payout destination", async () => {
    fetchFacilityEarningsSummaryMock.mockResolvedValue(walletFixture({ payoutDestination: null }));
    requestFacilityPayoutDestinationMock.mockResolvedValue({ phone_masked: "07** ***123", verified: false, active: false });
    const user = userEvent.setup();
    renderSection();

    const phoneInput = await screen.findByLabelText("M-Pesa payout number");
    await user.type(phoneInput, "0712345678");
    await user.click(screen.getByRole("button", { name: /send code/i }));

    await waitFor(() => expect(requestFacilityPayoutDestinationMock).toHaveBeenCalledWith("facility-1", "0712345678"));
    expect(await screen.findByLabelText("Verification code")).toBeInTheDocument();
  });
});
