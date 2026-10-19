/**
 * A failed request is not a number. The earnings card showed KES 0.00 and the performance card a
 * rating of 0.0 when their requests failed, which told a provider they had nothing to withdraw and
 * no reviews when the truth was only that the page could not ask.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  earnings: {} as Record<string, unknown>,
  analytics: {} as Record<string, unknown>,
  refetch: vi.fn()
}));

vi.mock("../../../../shared/hooks/useWallet", () => ({
  useProviderEarningsSummary: () => ({ refetch: state.refetch, ...state.earnings })
}));
vi.mock("../../hooks/useProviderAnalytics", () => ({
  useProviderAnalytics: () => ({ refetch: state.refetch, ...state.analytics })
}));
vi.mock("../../../../shared/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));

import { PerformanceStats } from "../PerformanceStats";
import { RevenueSnapshot } from "../RevenueSnapshot";

beforeEach(() => state.refetch.mockClear());

describe("RevenueSnapshot", () => {
  it("says the earnings could not be loaded, with a retry, instead of showing KES 0.00", async () => {
    state.earnings = { isLoading: false, isError: true, data: undefined };
    const user = userEvent.setup();
    render(<RevenueSnapshot />, { wrapper: MemoryRouter });

    expect(screen.getByText("We could not load your earnings.")).toBeInTheDocument();
    expect(screen.queryByText(/KES.0\.00/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(state.refetch).toHaveBeenCalled();
  });

  it("shows the balance when it loaded, including a real zero", () => {
    state.earnings = {
      isLoading: false,
      isError: false,
      data: { availableBalanceCents: 0, pendingEarningsCents: 5000, paidOutTotalCents: 120000, currency: "KES" }
    };
    render(<RevenueSnapshot />, { wrapper: MemoryRouter });
    expect(screen.getByText(/KES.0\.00/)).toBeInTheDocument();
    expect(screen.queryByText(/could not load/)).not.toBeInTheDocument();
    // The one thing to do about the balance is one tap away.
    expect(screen.getByRole("link", { name: "Withdraw" })).toHaveAttribute("href", "/pro/payments");
    expect(screen.getByText("Not available yet")).toBeInTheDocument();
  });
});

describe("PerformanceStats", () => {
  const analytics = {
    rating_avg: 0, rating_count: 0, rank: null, total_providers: 12, active_services: 3, daily_request_limit: 8
  };

  it("says 'No ratings yet' for a provider with no reviews, not a rating of 0.0", () => {
    state.analytics = { isLoading: false, isError: false, data: analytics };
    render(<PerformanceStats />, { wrapper: MemoryRouter });
    expect(screen.getByText("No ratings yet")).toBeInTheDocument();
    expect(screen.getByText("Not ranked yet")).toBeInTheDocument();
    expect(screen.queryByText("0.0")).not.toBeInTheDocument();
  });

  it("shows the rating and rank once there are reviews", () => {
    state.analytics = { isLoading: false, isError: false, data: { ...analytics, rating_avg: 4.66, rating_count: 9, rank: 2 } };
    render(<PerformanceStats />, { wrapper: MemoryRouter });
    expect(screen.getByText("4.7")).toBeInTheDocument();
    expect(screen.getByText("9 reviews")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
  });

  it("says the performance could not be loaded, with a retry, instead of showing zeros", async () => {
    state.analytics = { isLoading: false, isError: true, data: undefined };
    const user = userEvent.setup();
    render(<PerformanceStats />, { wrapper: MemoryRouter });

    expect(screen.getByText("We could not load your performance.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(state.refetch).toHaveBeenCalled();
  });
});
