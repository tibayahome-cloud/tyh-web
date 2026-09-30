/**
 * The facility-response countdown lived as `nowMs` state on the whole page, ticking every
 * second via one shared setInterval. Every tick re-rendered the entire page -- filters,
 * dialogs, every other row -- for a value only one table cell actually used. The countdown
 * now owns its own timer in a small child component, so the rest of the page (here, the
 * filter panel's inputs) shouldn't re-render on every tick, while the countdown itself
 * keeps counting down correctly.
 */

import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

let inputRenderCount = 0;

vi.mock("../../../../../shared/components/Input", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../shared/components/Input")>();
  return {
    ...actual,
    Input: (props: Record<string, unknown>) => {
      inputRenderCount += 1;
      const { Input: ActualInput } = actual;
      return <ActualInput {...props} />;
    }
  };
});

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

describe("QueuePage countdown isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inputRenderCount = 0;
    vi.useFakeTimers();
    useBookingListMock.mockReturnValue({
      data: {
        bookings: [
          {
            id: "booking-1",
            status: "broadcasting",
            service: { name: "Home visit" },
            client: { fullName: "Jane" },
            provider: null,
            facilityStatus: "pending",
            facilityResponseDueAt: new Date(Date.now() + 5 * 60_000).toISOString(),
            updatedAt: new Date().toISOString(),
            disputes: [],
            meta: {},
            isTelemedicine: false,
            requestMode: "broadcast"
          }
        ]
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn()
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not rerender the filter panel's inputs on every countdown tick, but the countdown still updates", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /filters/i }));
    const baselineInputRenders = inputRenderCount;
    expect(baselineInputRenders).toBeGreaterThan(0);

    const countdownBefore = screen.getByText(/^\d+m \d{2}s$/).textContent;

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(inputRenderCount).toBe(baselineInputRenders);

    const countdownAfter = screen.getByText(/^\d+m \d{2}s$/).textContent;
    expect(countdownAfter).not.toBe(countdownBefore);
  });
});
