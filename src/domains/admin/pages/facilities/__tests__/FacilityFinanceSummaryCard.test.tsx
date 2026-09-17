import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

const fetchFacilityEarningsSummaryMock = vi.fn();

vi.mock("../../../../../shared/libs/wallet", () => ({
  fetchFacilityEarningsSummary: (...args: unknown[]) => fetchFacilityEarningsSummaryMock(...args)
}));

import { FacilityFinanceSummaryCard } from "../FacilityFinanceSummaryCard";

const renderCard = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <FacilityFinanceSummaryCard facilityId="facility-1" />
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe("FacilityFinanceSummaryCard", () => {
  it("shows a compact balance summary and links into the Payments tab, scoped to this facility", async () => {
    fetchFacilityEarningsSummaryMock.mockResolvedValue({
      currency: "KES",
      availableBalanceCents: 15000,
      pendingEarningsCents: 2000,
      paidOutTotalCents: 0,
      reversedTotalCents: 0,
      nextReleaseAt: null,
      withdrawals: [],
      payoutDestination: null
    });

    renderCard();

    expect(await screen.findByText(/available/i)).toBeInTheDocument();
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /manage funds/i });
    expect(link).toHaveAttribute("href", "/admin/finance/payments?facilityId=facility-1");
  });
});
