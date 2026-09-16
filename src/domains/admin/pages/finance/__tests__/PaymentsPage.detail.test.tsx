/**
 * The payment detail modal must never describe its own backend implementation status to an
 * admin. A missing settlement breakdown used to render a sentence written for a developer
 * ("...should remain hidden until backend support exists") verbatim in the product UI.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PaymentRecord } from "../../../../../shared/schemas/payment";

// MUI's DataGrid measures its container with ResizeObserver, which jsdom doesn't implement.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).ResizeObserver = ResizeObserverMock;

vi.mock("../../../../../shared/components/ToastProvider", () => ({
  useToast: () => ({ showToast: vi.fn(), push: vi.fn() })
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

vi.mock("../../../../../shared/libs/payments", () => ({
  fetchAdminPayments: (...args: unknown[]) => fetchAdminPaymentsMock(...args),
  fetchFacilityPayments: vi.fn(),
  fetchUnmatchedC2BTransactions: vi.fn().mockResolvedValue([]),
  reassignPaymentBooking: vi.fn(),
  reconcileC2BTransaction: vi.fn()
}));

vi.mock("../../../../../shared/libs/facilities", () => ({
  fetchFacilities: vi.fn().mockResolvedValue({ facilities: [] }),
  fetchFacility: vi.fn()
}));

import PaymentsPage from "../PaymentsPage";

const unsettledPayment: PaymentRecord = {
  id: "pay-1",
  bookingId: "booking-1",
  bookingServiceName: "IV Therapy",
  facilityId: "facility-1",
  facilityName: "Nairobi Clinic",
  clientUserId: null,
  clientName: "Jane Doe",
  providerUserId: null,
  providerName: "Dr. Smith",
  status: "succeeded",
  channel: "mpesa",
  providerRef: "REF123",
  amountCents: 150000,
  currency: "KES",
  description: null,
  retryCount: 0,
  failureReason: null,
  mpesaReceiptNumber: null,
  merchantRequestId: null,
  checkoutRequestId: null,
  initiatedAt: "2026-01-01T10:00:00Z",
  succeededAt: "2026-01-01T10:05:00Z",
  failedAt: null,
  completedAt: "2026-01-01T10:05:00Z",
  createdAt: "2026-01-01T10:00:00Z",
  updatedAt: "2026-01-01T10:05:00Z",
  refundStatus: null,
  refundedAt: null,
  reviewStatus: null,
  settlement: null,
  attempts: []
};

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

describe("PaymentsPage payment detail modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchAdminPaymentsMock.mockResolvedValue({
      payments: [unsettledPayment],
      meta: { page: { number: 1, size: 25, total: 1, totalPages: 1 }, next_cursor: null }
    });
  });

  it("explains a missing settlement without leaking backend implementation status", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("IV Therapy");
    await user.click(screen.getAllByRole("button", { name: /^view$/i })[0]);

    expect(await screen.findByText(/settlement breakdown isn't available for this payment yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/backend support exists/i)).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("Payment detail")).toBeInTheDocument());
  });

  it("uses the shared status vocabulary rather than the raw backend value", async () => {
    // "succeeded" used to render as the literal backend string ("succeeded"); the shared
    // paymentStatus.ts vocabulary describes it to an operator as "Paid".
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("IV Therapy");
    await user.click(screen.getAllByRole("button", { name: /^view$/i })[0]);

    expect(await screen.findAllByText("Paid")).not.toHaveLength(0);
    expect(screen.queryByText("succeeded")).not.toBeInTheDocument();
  });
});
