/**
 * A failed payments fetch must read as an error, not as "no payments exist".
 *
 * Before this test, `PaymentsPage` only checked `isLoading`; a network failure fell through
 * to the same "No payments match the selected filters." copy as a genuinely empty result,
 * which reads to an admin investigating a missing payment as "there's no record" instead of
 * "the request failed" -- exactly the wrong conclusion at the moment it matters most.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";

const showToastMock = vi.fn();

vi.mock("../../../../../shared/components/ToastProvider", () => ({
  useToast: () => ({ showToast: showToastMock, push: vi.fn() })
}));

vi.mock("../../../../../shared/hooks/useRbac", () => ({
  useRbac: () => ({
    roles: ["admin.super"],
    permissions: [],
    hasRole: () => true,
    hasPermission: () => true
  })
}));

const fetchAdminPaymentsMock = vi.fn();
const fetchFacilityPaymentsMock = vi.fn();
const fetchUnmatchedC2BTransactionsMock = vi.fn();

vi.mock("../../../../../shared/libs/payments", () => ({
  fetchAdminPayments: (...args: unknown[]) => fetchAdminPaymentsMock(...args),
  fetchFacilityPayments: (...args: unknown[]) => fetchFacilityPaymentsMock(...args),
  fetchUnmatchedC2BTransactions: (...args: unknown[]) => fetchUnmatchedC2BTransactionsMock(...args),
  reassignPaymentBooking: vi.fn(),
  reconcileC2BTransaction: vi.fn()
}));

vi.mock("../../../../../shared/libs/facilities", () => ({
  fetchFacilities: vi.fn().mockResolvedValue({ facilities: [] }),
  fetchFacility: vi.fn()
}));

import PaymentsPage from "../PaymentsPage";

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <PaymentsPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe("PaymentsPage error state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchUnmatchedC2BTransactionsMock.mockResolvedValue([]);
  });

  it("shows a retryable error banner instead of an empty-state message when the query fails", async () => {
    // An error with no message exercises the fallback copy `classifyApiError` supplies --
    // whatever the message, the point under test is that a fetch failure must never render as
    // the same "no data" copy as a genuinely empty result.
    fetchAdminPaymentsMock.mockRejectedValue(new Error());
    renderPage();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/couldn't load payments/i)).toBeInTheDocument();
    expect(screen.queryByText(/no payments match the selected filters/i)).not.toBeInTheDocument();

    expect(fetchAdminPaymentsMock).toHaveBeenCalledTimes(1);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => expect(fetchAdminPaymentsMock).toHaveBeenCalledTimes(2));
  });

  it("renders the payments table once the query succeeds", async () => {
    fetchAdminPaymentsMock.mockResolvedValue({
      payments: [],
      meta: { page: { number: 1, size: 25, total: 0, totalPages: 1 }, next_cursor: null }
    });
    renderPage();

    expect(await screen.findByText(/no payments match the selected filters/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
