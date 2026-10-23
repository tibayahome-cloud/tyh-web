import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ListState = Record<string, unknown>;

const state = vi.hoisted(() => ({
  open: {} as Record<string, unknown>,
  earlier: {} as Record<string, unknown>,
  calls: [] as Array<Record<string, unknown>>
}));

vi.mock("../../../../shared/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "p1" } }) }));
vi.mock("../../../../shared/hooks/useSocket", () => ({ useSocket: () => null }));
vi.mock("../../../../shared/hooks/useBookings", () => ({
  bookingKeys: { lists: () => ["bookings", "list"] },
  useBookingList: (params: { statuses?: string[] }) => {
    state.calls.push(params as Record<string, unknown>);
    return params.statuses?.includes("scheduled") ? state.open : state.earlier;
  }
}));
vi.mock("../../../../shared/hooks/useTelemedicine", () => ({
  useTelemedicinePolicy: () => ({ data: { defaultTimezone: "Africa/Nairobi", joinWindowBeforeMinutes: 10 } })
}));
vi.mock("../../../../shared/components/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../../../../shared/components/NeedsYourResponse", () => ({ NeedsYourResponse: () => null }));
vi.mock("../../../../shared/components/BookingFeedbackDialog", () => ({
  BookingFeedbackDialog: ({ open, targetName }: { open: boolean; targetName: string }) => (open ? <div>rating dialog for {targetName}</div> : null)
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => ({ invalidateQueries: vi.fn().mockResolvedValue(undefined) })
}));

import ProviderBookings from "../Bookings";

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
  client: { id: "c1", fullName: "Amina Client", avatarUrl: null },
  provider: { id: "p1", fullName: "Dr Example" },
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
    <MemoryRouter initialEntries={["/pro/bookings"]}>
      <Routes>
        <Route path="/pro/bookings" element={<ProviderBookings />} />
        <Route path="/pro/bookings/:id" element={<div>booking page</div>} />
        <Route path="/pro/availability" element={<div>availability page</div>} />
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

describe("provider Bookings agenda", () => {
  it("has no filter pop-up, status pills or date range: it is sorted into sections", () => {
    state.open = list([make({ id: "a" })]);
    renderPage();

    expect(screen.queryByRole("button", { name: /Filters/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Any time/)).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bookings" })).toBeInTheDocument();
  });

  it("features the next telemedicine call with a Join button, and sends it to the booking to join", () => {
    state.open = list([make({ id: "soon", scheduledAt: at(5) })]);
    renderPage();

    expect(screen.getByRole("heading", { name: /Your telemedicine consultation with Amina Client/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Join call" })).toHaveAttribute("href", "/pro/bookings/soon?join=1");
  });

  it("shows home visits and telemedicine together, each with its badge, and a place only for the visit", () => {
    state.open = list([
      make({ id: "hero", scheduledAt: at(5), service: { name: "Featured consultation" } }),
      make({ id: "t", scheduledAt: at(600), service: { name: "Consultation" } }),
      make({ id: "h", isTelemedicine: false, status: "scheduled", scheduledAt: at(900), addressText: "Kilimani, Nairobi", service: { name: "Home nursing visit" } })
    ]);
    renderPage();

    const comingUp = screen.getByRole("region", { name: "Coming up" });
    expect(within(comingUp).getByText("Telemedicine")).toBeInTheDocument();
    expect(within(comingUp).getByText("Home based")).toBeInTheDocument();
    expect(within(comingUp).getByText("Kilimani, Nairobi")).toBeInTheDocument();
    expect(within(comingUp).getAllByText("Amina Client").length).toBe(2);
    expect(screen.queryByText(/Address hidden/)).not.toBeInTheDocument();
  });

  it("shows the real appointment time of a telemedicine booking, not a dash", () => {
    state.open = list([make({ id: "hero", scheduledAt: at(5) }), make({ id: "t", scheduledAt: at(600) })]);
    renderPage();

    // 18:00 UTC is 21:00 in Nairobi.
    expect(screen.getByText(/21:00/)).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("puts a home visit under way in its own In progress section, above Coming up", () => {
    state.open = list([
      make({ id: "later", scheduledAt: at(900), service: { name: "Later consultation" } }),
      make({ id: "on-way", isTelemedicine: false, status: "en_route", scheduledAt: null, addressText: "Westlands", service: { name: "Wound dressing" } })
    ]);
    renderPage();

    const inProgress = screen.getByRole("region", { name: "In progress" });
    const comingUp = screen.getByRole("region", { name: "Coming up" });
    expect(within(inProgress).getByText("Wound dressing")).toBeInTheDocument();
    expect(within(comingUp).queryByText("Wound dressing")).not.toBeInTheDocument();
    expect(inProgress.compareDocumentPosition(comingUp) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("asks for a new time when nobody joined, once, and opens that booking", () => {
    state.open = list([make({ id: "nobody", status: "telemedicine_unattended", scheduledAt: at(-90), service: { name: "Missed consultation" } })]);
    renderPage();

    const needs = screen.getByRole("region", { name: "Needs you" });
    expect(within(needs).getByText("Nobody joined. Suggest a new time")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Coming up" })).queryByText("Missed consultation")).not.toBeInTheDocument();
    fireEvent.click(within(needs).getByRole("button", { name: "Choose a time" }));
    expect(screen.getByText("booking page")).toBeInTheDocument();
  });

  it("asks the provider to rate the client after a recent finished visit, and not once they have", () => {
    state.earlier = list([make({ id: "done", status: "fully_completed", scheduledAt: at(-2 * 24 * 60) })]);
    const { unmount } = renderPage();

    fireEvent.click(within(screen.getByRole("region", { name: "Needs you" })).getByRole("button", { name: "Rate" }));
    expect(screen.getByText("rating dialog for Amina Client")).toBeInTheDocument();
    unmount();

    state.earlier = list([make({ id: "done", status: "fully_completed", scheduledAt: at(-2 * 24 * 60), feedback: [{ rater: { id: "p1" } }] })]);
    renderPage();
    expect(screen.queryByRole("region", { name: "Needs you" })).not.toBeInTheDocument();
  });

  it("keeps earlier bookings behind one button with their count, and loads more in steps", () => {
    state.earlier = list([make({ id: "old", status: "paid", scheduledAt: at(-9000), service: { name: "Old consultation" } })], 25);
    renderPage();

    const toggle = screen.getByRole("button", { name: /Earlier/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveTextContent("(25)");
    expect(screen.queryByText("Old consultation")).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByText("Old consultation")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(earlierCalls().at(-1)).toMatchObject({ pageSize: 20 });
  });

  it("asks for open and earlier bookings by their own statuses, for this provider", () => {
    renderPage();

    expect(openCalls()[0]).toMatchObject({ providerId: "p1" });
    expect(openCalls()[0].statuses).toEqual(expect.arrayContaining(["scheduled", "en_route", "completed_by_provider", "telemedicine_unattended"]));
    expect(openCalls()[0].statuses).not.toContain("paid");
    expect(earlierCalls()[0].statuses).toEqual(expect.arrayContaining(["paid", "fully_completed", "cancelled_by_client"]));
  });

  it("says there are no bookings, and how to get some, when there are none at all", () => {
    renderPage();

    expect(screen.getByText("No bookings yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Set your hours" }));
    expect(screen.getByText("availability page")).toBeInTheDocument();
  });

  it("shows an error with a retry for the part that failed, not an empty list", () => {
    const refetch = vi.fn();
    state.open = { data: undefined, isLoading: false, isError: true, refetch };
    state.earlier = list([make({ id: "old", status: "paid", scheduledAt: at(-9000) })]);
    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("We could not load your bookings");
    expect(screen.queryByText("No bookings yet")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("shows a loading placeholder while the lists load", () => {
    state.open = { data: undefined, isLoading: true, isError: false, refetch: vi.fn() };
    renderPage();

    expect(screen.getByLabelText("Loading your bookings")).toBeInTheDocument();
  });
});
