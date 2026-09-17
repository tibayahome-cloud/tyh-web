/**
 * Provider withdrawal dialog: sending a payout to a different M-Pesa number than the provider's
 * registered one is optional and, once opted into, must be verified before submission -- this
 * preserves the exact business rule the bespoke inline implementation had, now backed by the
 * shared PayoutDestinationVerifier component.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

const showToastMock = vi.fn();
const mutateAsyncMock = vi.fn();
const requestDestinationMock = vi.fn();
const verifyDestinationMock = vi.fn();

vi.mock("../../../../shared/components/ToastProvider", () => ({
  useToast: () => ({ showToast: showToastMock, push: vi.fn() })
}));

vi.mock("../../../../shared/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "provider-1" } })
}));

vi.mock("../../hooks/useProviderProfile", () => ({
  useProviderProfile: () => ({
    data: { compensation_mode: "fixed", facility: null },
    isLoading: false
  }),
  providerFinancialsAreVisible: (profile: { compensation_mode?: string } | null | undefined) =>
    profile?.compensation_mode !== "employee"
}));

vi.mock("../../../../shared/hooks/useWallet", () => ({
  useWalletAccount: () => ({
    data: { balanceCents: 500000, pendingWithdrawalCents: 0, currency: "KES", status: "active", transactions: [], withdrawals: [] },
    isLoading: false,
    isError: false
  }),
  useProviderEarningsSummary: () => ({
    data: {
      currency: "KES",
      pendingEarningsCents: 0,
      availableBalanceCents: 500000,
      paidOutTotalCents: 0,
      reversedTotalCents: 0,
      nextReleaseAt: null,
      withdrawals: []
    },
    isLoading: false,
    isError: false
  }),
  useWalletWithdrawalRequest: () => ({
    mutateAsync: mutateAsyncMock,
    isLoading: false
  }),
  usePayoutDestinationRequest: () => ({
    mutateAsync: requestDestinationMock
  }),
  usePayoutDestinationVerification: () => ({
    mutateAsync: verifyDestinationMock
  })
}));

import ProviderPayments from "../Payments";

const renderPage = () => render(<ProviderPayments />, { wrapper: MemoryRouter });

describe("Provider withdrawal — alternate payout number", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsyncMock.mockResolvedValue({ id: "w1", status: "requested" });
  });

  it("hides the destination verifier until the alternate-number checkbox is checked", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /request withdrawal/i }));
    expect(screen.queryByLabelText("Different M-Pesa number")).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /send this withdrawal to a different m-pesa number/i }));
    expect(screen.getByLabelText("Different M-Pesa number")).toBeInTheDocument();
  });

  it("blocks submission when an alternate number is chosen but not yet verified", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /request withdrawal/i }));
    await user.type(screen.getByLabelText("Amount"), "100");
    await user.click(screen.getByRole("checkbox", { name: /send this withdrawal to a different m-pesa number/i }));
    await user.type(screen.getByLabelText("Different M-Pesa number"), "0712345678");

    await user.click(screen.getByRole("button", { name: /^submit$/i }));

    await waitFor(() =>
      expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Verify the payout number" }))
    );
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it("submits the verified alternate number once it's confirmed", async () => {
    requestDestinationMock.mockResolvedValue({ phone_masked: "07** ***678", verified: false });
    verifyDestinationMock.mockResolvedValue({ phone_masked: "07** ***678", verified: true });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /request withdrawal/i }));
    await user.type(screen.getByLabelText("Amount"), "100");
    await user.click(screen.getByRole("checkbox", { name: /send this withdrawal to a different m-pesa number/i }));
    await user.type(screen.getByLabelText("Different M-Pesa number"), "0712345678");
    await user.click(screen.getByRole("button", { name: /send code/i }));

    await user.type(await screen.findByLabelText(/verification code/i), "123456");
    await user.click(screen.getByRole("button", { name: /^verify$/i }));
    await screen.findByText("Send payout to 07** ***678");

    await user.click(screen.getByRole("button", { name: /^submit$/i }));

    await waitFor(() =>
      expect(mutateAsyncMock).toHaveBeenCalledWith({ amountCents: 10000, payoutPhoneNumber: "0712345678" })
    );
  });

  it("defaults to the provider's registered number when the checkbox is left unchecked", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /request withdrawal/i }));
    await user.type(screen.getByLabelText("Amount"), "50");
    await user.click(screen.getByRole("button", { name: /^submit$/i }));

    await waitFor(() =>
      expect(mutateAsyncMock).toHaveBeenCalledWith({ amountCents: 5000, payoutPhoneNumber: undefined })
    );
  });
});
