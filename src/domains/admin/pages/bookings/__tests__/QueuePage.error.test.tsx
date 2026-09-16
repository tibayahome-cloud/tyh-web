/**
 * The booking queue only checked `isLoading`; a fetch failure fell through to the same
 * "No bookings in this queue." copy as a genuinely empty queue, which reads to an admin
 * investigating a stuck booking as "nothing is queued" instead of "the request failed."
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";

const useBookingListMock = vi.fn();

vi.mock("../../../../../shared/hooks/useBookings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../shared/hooks/useBookings")>();
  return {
    ...actual,
    useBookingList: (...args: unknown[]) => useBookingListMock(...args)
  };
});

vi.mock("../../../../../shared/components/ToastProvider", () => ({
  useToast: () => ({ showToast: vi.fn(), push: vi.fn() })
}));

vi.mock("../../../../../shared/hooks/useAuth", () => ({
  useAuth: () => ({ roles: ["admin.ops"], permissions: [], accessToken: "token" })
}));

import AdminBookingQueuePage from "../QueuePage";

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <AdminBookingQueuePage />
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe("QueuePage error state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a retryable error banner instead of the empty-queue message when the fetch fails", async () => {
    const refetch = vi.fn();
    useBookingListMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error(),
      refetch
    });

    renderPage();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/couldn't load the booking queue/i)).toBeInTheDocument();
    expect(screen.queryByText(/no bookings in this queue/i)).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
  });

  it("shows the plain empty-state message when the queue genuinely has nothing in it", async () => {
    useBookingListMock.mockReturnValue({
      data: { bookings: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn()
    });

    renderPage();

    expect(await screen.findByText(/no bookings in this queue/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
