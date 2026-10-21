import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  list: { data: { bookings: [] as unknown[] }, isLoading: false, isError: false, refetch: vi.fn() } as Record<string, unknown>,
  calls: [] as Array<Record<string, unknown>>
}));

vi.mock("../../../../shared/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "c1" } }) }));
vi.mock("../../../../shared/hooks/useBookings", () => ({
  useBookingList: (params: Record<string, unknown>) => {
    state.calls.push(params);
    return state.list;
  }
}));
vi.mock("../../../../shared/hooks/useTelemedicine", () => ({ useTelemedicinePolicy: () => ({ data: { defaultTimezone: "Africa/Nairobi" } }) }));
vi.mock("../../../../shared/libs/query", () => ({ prefetchBooking: vi.fn() }));
vi.mock("../../../../shared/components/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../../../../shared/components/BookingFeedbackDialog", () => ({ BookingFeedbackDialog: () => null }));

import BookingsPage from "../Bookings";

const video = {
  id: "b-video",
  isTelemedicine: true,
  status: "scheduled",
  scheduledAt: "2026-10-22T08:40:00Z",
  createdAt: "2026-10-20T08:00:00Z",
  estimateDurationMinutes: 30,
  addressText: null,
  service: { name: "Video consultation" },
  provider: { id: "p1", fullName: "Dr Example", avatarUrl: null },
  feedback: []
};
const home = {
  id: "b-home",
  isTelemedicine: false,
  status: "accepted",
  scheduledAt: null,
  createdAt: "2026-10-20T08:00:00Z",
  estimateDurationMinutes: 45,
  addressText: "Kilimani, Nairobi",
  service: { name: "Home nursing visit" },
  provider: null,
  feedback: []
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <BookingsPage />
    </MemoryRouter>
  );

const lastParams = () => state.calls[state.calls.length - 1];

beforeEach(() => {
  state.calls = [];
  state.list = { data: { bookings: [video, home] }, isLoading: false, isError: false, refetch: vi.fn() };
});

describe("client My bookings", () => {
  it("tells video from home visits with a badge, and shows a place only for a home visit", () => {
    renderPage();

    const videoCard = screen.getByRole("button", { name: "Video consultation" }).closest("article") as HTMLElement;
    const homeCard = screen.getByRole("button", { name: "Home nursing visit" }).closest("article") as HTMLElement;
    expect(within(videoCard).getByText("Video")).toBeInTheDocument();
    expect(within(homeCard).getByText("Home visit")).toBeInTheDocument();
    expect(within(homeCard).getByText("Kilimani, Nairobi")).toBeInTheDocument();
    expect(screen.queryByText(/location not specified/i)).not.toBeInTheDocument();
  });

  it("shows a video consultation's date and time in the facility timezone, and when a home visit was requested", () => {
    renderPage();

    expect(screen.getByText(/11:40/)).toBeInTheDocument();
    expect(screen.getByText(/Requested/)).toBeInTheDocument();
  });

  it("says a doctor is being found for a video consultation with none, and a provider for a home visit", () => {
    state.list = { data: { bookings: [{ ...video, provider: null }, home] }, isLoading: false, isError: false, refetch: vi.fn() };
    renderPage();

    expect(screen.getByText("Finding a doctor...")).toBeInTheDocument();
    expect(screen.getByText("Finding a provider...")).toBeInTheDocument();
  });

  it("asks for every booking at first, with no filters", () => {
    renderPage();

    expect(lastParams()).toMatchObject({ clientId: "c1", statuses: undefined, isTelemedicine: undefined });
  });

  it("sends the status tab and the type choice together as the one request", () => {
    renderPage();

    fireEvent.click(screen.getByRole("tab", { name: "Pending" }));
    expect(lastParams().statuses).toEqual(expect.arrayContaining(["requested", "telemedicine_paid_pending_assignment"]));

    fireEvent.click(screen.getByRole("button", { name: "Video" }));
    expect(lastParams()).toMatchObject({ isTelemedicine: true });
    expect(lastParams().statuses).toEqual(expect.arrayContaining(["requested"]));
  });

  it("explains an empty filtered list in words and clears the filters", () => {
    state.list = { data: { bookings: [] }, isLoading: false, isError: false, refetch: vi.fn() };
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Video" }));
    expect(screen.getByText(/No video consultations yet/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Clear filters" })[0]);
    expect(lastParams()).toMatchObject({ statuses: undefined, isTelemedicine: undefined });
  });

  it("shows an error with a retry, not an empty list, when the request fails", () => {
    const refetch = vi.fn();
    state.list = { data: undefined, isLoading: false, isError: true, refetch };
    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("We could not load your bookings");
    expect(screen.queryByText("Nothing here")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("shows loading placeholders while the list loads", () => {
    state.list = { data: undefined, isLoading: true, isError: false, refetch: vi.fn() };
    renderPage();

    expect(document.querySelector("[aria-busy='true']")).toBeInTheDocument();
  });
});
