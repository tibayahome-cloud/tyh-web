/**
 * A provider who only does video consultations opened Bookings to an empty list: the default view
 * left out "scheduled" and only looked back seven days, so a booked or rescheduled consultation
 * could never appear.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ params: [] as Array<Record<string, unknown>> }));

vi.mock("../../../../shared/hooks/useBookings", () => ({
  bookingKeys: { lists: () => ["bookings", "list"] },
  useBookingList: (params: Record<string, unknown>) => {
    calls.params.push(params);
    return { data: { bookings: [], meta: {} }, isLoading: false, isFetching: false };
  }
}));
vi.mock("../../../../shared/hooks/useOpenBookingChat", () => ({
  useOpenBookingChat: () => ({ openBookingChat: vi.fn(), openingBookingId: null })
}));
vi.mock("../../../../shared/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "provider-1" } }) }));
vi.mock("../../../../shared/hooks/useSocket", () => ({ useSocket: () => null }));
vi.mock("../../../../shared/components/BookingFeedbackDialog", () => ({ BookingFeedbackDialog: () => null }));
vi.mock("../../../../shared/components/NeedsYourResponse", () => ({ NeedsYourResponse: () => null }));

import ProviderBookings from "../Bookings";

beforeEach(() => {
  calls.params = [];
});

describe("provider Bookings default view", () => {
  it("asks for booked consultations and does not limit the date range", () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <ProviderBookings />
        </QueryClientProvider>
      </MemoryRouter>
    );

    const params = calls.params[0];
    expect(params.statuses).toContain("scheduled");
    expect(params.from).toBeUndefined();
    expect(params.to).toBeUndefined();
    expect(params.scheduledFrom).toBeUndefined();
    expect(screen.getByText("Date: Any time")).toBeInTheDocument();
  });
});
