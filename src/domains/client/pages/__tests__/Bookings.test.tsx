import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ListState = Record<string, unknown>;

const state = vi.hoisted(() => ({
  open: {} as Record<string, unknown>,
  earlier: {} as Record<string, unknown>,
  calls: [] as Array<Record<string, unknown>>
}));

vi.mock("../../../../shared/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "c1" } }) }));
vi.mock("../../../../shared/hooks/useBookings", () => ({
  useBookingList: (params: { statuses?: string[] }) => {
    state.calls.push(params as Record<string, unknown>);
    return params.statuses?.includes("scheduled") ? state.open : state.earlier;
  }
}));
vi.mock("../../../../shared/hooks/useTelemedicine", () => ({
  useTelemedicinePolicy: () => ({ data: { defaultTimezone: "Africa/Nairobi", joinWindowBeforeMinutes: 10 } })
}));
vi.mock("../../../../shared/libs/query", () => ({ prefetchBooking: vi.fn() }));
vi.mock("../../../../shared/components/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../../../../shared/components/NeedsYourResponse", () => ({ NeedsYourResponse: () => null }));
vi.mock("../../../../shared/components/BookingFeedbackDialog", () => ({
  BookingFeedbackDialog: ({ open, targetName }: { open: boolean; targetName: string }) => (open ? <div>rating dialog for {targetName}</div> : null)
}));

import BookingsPage from "../Bookings";

const NOW = new Date("2026-10-22T08:00:00Z");
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString();

const make = (overrides: Record<string, unknown>) => ({
  id: "b",
  isTelemedicine: true,
  status: "scheduled",
  scheduledAt: at(120),
  createdAt: at(-1000),
  estimateDurationMinutes: 30,
  addressText: null,
  service: { name: "General consultation" },
  provider: { id: "p", fullName: "Dr Example", avatarUrl: null },
  feedback: [],
  ...overrides
});

const list = (bookings: unknown[], total = bookings.length): ListState => ({
  data: { bookings, meta: { page: { number: 1, size: 10, total, totalPages: 1 } } },
  isLoading: false,
  isError: false,
  refetch: vi.fn()
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/app/bookings"]}>
      <Routes>
        <Route path="/app/bookings" element={<BookingsPage />} />
        <Route path="/app/bookings/:id" element={<div>booking page</div>} />
        <Route path="/app/telemedicine" element={<div>telemedicine page</div>} />
        <Route path="/app/services" element={<div>services page</div>} />
      </Routes>
    </MemoryRouter>
  );

const openCalls = () => state.calls.filter((c) => (c.statuses as string[]).includes("scheduled"));
const earlierCalls = () => state.calls.filter((c) => (c.statuses as string[]).includes("fully_completed"));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  state.calls = [];
  state.open = list([]);
  state.earlier = list([]);
});
afterEach(() => vi.useRealTimers());

describe("client My bookings agenda", () => {
  it("has no filter tabs: it is sorted into sections instead", () => {
    state.open = list([make({ id: "a" })]);
    renderPage();

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByText("Pending")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "My bookings" })).toBeInTheDocument();
  });

  it("features the next consultation with its Join button when the call is open", () => {
    state.open = list([make({ id: "soon", scheduledAt: at(5) })]);
    renderPage();

    expect(screen.getByRole("heading", { name: /Your telemedicine consultation with Dr Example/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Join call" })).toBeInTheDocument();
  });

  it("does not repeat the featured consultation in Coming up, and lists the others under it", () => {
    state.open = list([
      make({ id: "next", scheduledAt: at(30), service: { name: "First consultation" } }),
      make({ id: "later", scheduledAt: at(26 * 60), service: { name: "Second consultation" } })
    ]);
    renderPage();

    const comingUp = screen.getByRole("region", { name: "Coming up" });
    expect(within(comingUp).getByText("Second consultation")).toBeInTheDocument();
    expect(within(comingUp).queryByText("First consultation")).not.toBeInTheDocument();
  });

  it("shows a home based booking in Coming up with its address and its badge", () => {
    state.open = list([make({ id: "h", isTelemedicine: false, status: "accepted", scheduledAt: null, addressText: "Kilimani, Nairobi", service: { name: "Home nursing visit" }, provider: null })]);
    renderPage();

    const comingUp = screen.getByRole("region", { name: "Coming up" });
    expect(within(comingUp).getByText("Home based")).toBeInTheDocument();
    expect(within(comingUp).getByText("Kilimani, Nairobi")).toBeInTheDocument();
    expect(within(comingUp).getByText("Soon")).toBeInTheDocument();
    expect(screen.queryByText(/not specified/i)).not.toBeInTheDocument();
  });

  it("puts what is waiting on the client under Needs you, once, and opens that booking", () => {
    state.open = list([make({ id: "pay", status: "telemedicine_payment_pending", scheduledAt: at(300), service: { name: "Unpaid consultation" } })]);
    renderPage();

    const needs = screen.getByRole("region", { name: "Needs you" });
    expect(within(needs).getByText("Pay to confirm your consultation")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Coming up" })).queryByText("Unpaid consultation")).not.toBeInTheDocument();

    fireEvent.click(within(needs).getByRole("button", { name: "Complete payment" }));
    expect(screen.getByText("booking page")).toBeInTheDocument();
  });

  it("asks for a rating on a recent finished visit, and opens the rating dialog", () => {
    state.earlier = list([make({ id: "done", status: "fully_completed", scheduledAt: at(-2 * 24 * 60) })]);
    renderPage();

    const needs = screen.getByRole("region", { name: "Needs you" });
    fireEvent.click(within(needs).getByRole("button", { name: "Rate" }));

    expect(screen.getByText("rating dialog for Dr Example")).toBeInTheDocument();
  });

  it("shows no Needs you section when nothing is waiting", () => {
    state.open = list([make({ id: "a" })]);
    renderPage();

    expect(screen.queryByRole("region", { name: "Needs you" })).not.toBeInTheDocument();
  });

  it("keeps earlier bookings behind one button, with their count, until asked", () => {
    state.earlier = list([make({ id: "old", status: "cancelled_by_client", scheduledAt: at(-9000), service: { name: "Old consultation" } })], 14);
    renderPage();

    const toggle = screen.getByRole("button", { name: /Earlier/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveTextContent("(14)");
    expect(screen.queryByText("Old consultation")).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Old consultation")).toBeInTheDocument();
    expect(screen.getByText("Cancelled by Client")).toBeInTheDocument();
  });

  it("loads more earlier bookings in steps, and stops when it has them all", () => {
    state.earlier = list([make({ id: "e1", status: "paid", scheduledAt: at(-9000) })], 25);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Earlier/ }));

    expect(earlierCalls().at(-1)).toMatchObject({ pageSize: 10 });
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(earlierCalls().at(-1)).toMatchObject({ pageSize: 20 });
  });

  it("asks for open and earlier bookings by their own statuses", () => {
    renderPage();

    expect(openCalls()[0].statuses).toEqual(expect.arrayContaining(["scheduled", "telemedicine_payment_pending", "telemedicine_paid_pending_assignment"]));
    expect(openCalls()[0].statuses).not.toContain("fully_completed");
    expect(earlierCalls()[0].statuses).toEqual(expect.arrayContaining(["fully_completed", "cancelled_by_client", "telemedicine_cancelled_payment_review"]));
    expect(earlierCalls()[0].statuses).not.toContain("scheduled");
  });

  it("says there are no bookings, and how to make one, when there are none at all", () => {
    renderPage();

    expect(screen.getByText("No bookings yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Book a consultation" }));
    expect(screen.getByText("telemedicine page")).toBeInTheDocument();
  });

  it("says nothing is coming up, with a way to book, when only earlier bookings exist", () => {
    state.earlier = list([make({ id: "old", status: "paid", scheduledAt: at(-9000) })]);
    renderPage();

    expect(within(screen.getByRole("region", { name: "Coming up" })).getByText(/Nothing is coming up/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Book a home visit" })).toBeInTheDocument();
  });

  it("shows an error with a retry for the part that failed, not an empty list", () => {
    const refetch = vi.fn();
    state.open = { data: undefined, isLoading: false, isError: true, refetch };
    state.earlier = list([make({ id: "old", status: "paid", scheduledAt: at(-9000) })]);
    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("We could not load your upcoming bookings");
    expect(screen.queryByText("No bookings yet")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Coming up" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("shows a loading placeholder while the lists load", () => {
    state.open = { data: undefined, isLoading: true, isError: false, refetch: vi.fn() };
    renderPage();

    expect(screen.getByLabelText("Loading your bookings")).toBeInTheDocument();
    expect(screen.queryByText("No bookings yet")).not.toBeInTheDocument();
  });
});
