/**
 * The provider Telemedicine page puts the call to join first, then what needs the provider, then what is coming up.
 * "Client didn't join" used to show on every scheduled consultation, including one three hours away; it is offered
 * only after the call time and a short grace period, to a provider who was in the call while the client was not.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const list = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));

vi.mock("../../../../shared/hooks/useBookings", () => ({
  bookingKeys: { lists: () => ["bookings", "list"] },
  useBookingList: () => ({ refetch: vi.fn(), dataUpdatedAt: 0, isFetching: false, ...list.state })
}));
vi.mock("../../../../shared/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("../../../../shared/hooks/useTelemedicine", () => ({
  useReportNoShowMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTelemedicinePolicy: () => ({ data: { defaultTimezone: "Africa/Nairobi", joinWindowBeforeMinutes: 10 } })
}));
vi.mock("../../../../shared/components/ToastProvider", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("../../../../shared/components/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../../../../shared/components/NeedsYourResponse", () => ({ NeedsYourResponse: () => null }));
vi.mock("../../../../shared/components/TelemedicineCallPanel", () => ({
  TelemedicineCallPanel: ({ bookingId }: { bookingId: string }) => <div>call panel for {bookingId}</div>
}));
vi.mock("../../../../shared/components/TechnicalIssueDialog", () => ({ TechnicalIssueDialog: () => null }));

import ProviderTelemedicinePage from "../Telemedicine";

const NOW = new Date("2026-10-22T08:00:00Z");

const consultation = (id: string, minutesFromNow: number, overrides: Record<string, unknown> = {}) => ({
  id,
  isTelemedicine: true,
  status: "scheduled",
  scheduledAt: new Date(NOW.getTime() + minutesFromNow * 60_000).toISOString(),
  estimateDurationMinutes: 30,
  service: { name: `Consultation ${id}` },
  client: { fullName: "Amina Client" },
  disputes: [],
  telemedicineSession: null,
  ...overrides
});

const providerHere = { id: "s1", status: "scheduled", providerJoinedAt: "2026-10-22T07:58:00Z", clientJoinedAt: null };

const renderPage = (bookings: unknown[]) => {
  list.state = { isLoading: false, isError: false, data: { bookings }, error: null };
  return render(
    <MemoryRouter initialEntries={["/pro/telemedicine"]}>
      <QueryClientProvider client={new QueryClient()}>
        <Routes>
          <Route path="/pro/telemedicine" element={<ProviderTelemedicinePage />} />
          <Route path="/pro/bookings/:id" element={<div>booking details page</div>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("provider Telemedicine: the call to join comes first", () => {
  it("features the soonest consultation with a Join button, above everything else, whatever order they arrive in", () => {
    renderPage([consultation("far", 1500), consultation("old", -60 * 24 * 40, { status: "paid" }), consultation("near", 5)]);

    const hero = screen.getByRole("heading", { name: /Your telemedicine consultation with Amina Client/ });
    const comingUp = screen.getByRole("region", { name: "Coming up" });
    expect(screen.getByRole("button", { name: "Join call" })).toBeInTheDocument();
    // The featured call is before the list in the page, and is not repeated in it.
    expect(hero.compareDocumentPosition(comingUp) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(comingUp).queryByText("Consultation near")).not.toBeInTheDocument();
    expect(within(comingUp).getByText("Consultation far")).toBeInTheDocument();
  });

  it("opens the call from the featured Join button", () => {
    renderPage([consultation("near", 5)]);

    fireEvent.click(screen.getByRole("button", { name: "Join call" }));

    expect(screen.getByText("call panel for near")).toBeInTheDocument();
  });

  it("keeps finished and paid consultations out of Coming up, behind one button with their count", () => {
    renderPage([consultation("near", 5), consultation("paid", -60 * 24 * 40, { status: "paid" }), consultation("done", -60 * 24 * 50, { status: "fully_completed" })]);

    expect(within(screen.getByRole("region", { name: "Coming up" })).queryByText("Consultation paid")).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: /Earlier/ });
    expect(toggle).toHaveTextContent("(2)");
    expect(screen.queryByText("Consultation paid")).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(screen.getByText("Consultation paid")).toBeInTheDocument();
  });

  it("lists the rest soonest first, and reads the wait in hours", () => {
    renderPage([consultation("near", 5), consultation("c", 600), consultation("b", 197)]);

    const comingUp = screen.getByRole("region", { name: "Coming up" });
    const titles = within(comingUp).getAllByRole("button", { name: /^Consultation / }).map((el) => el.textContent);
    expect(titles).toEqual(["Consultation b", "Consultation c"]);
    expect(within(comingUp).getByText(/The call opens in 3 h 7 min/)).toBeInTheDocument();
    expect(screen.queryByText(/Joinable in/)).not.toBeInTheDocument();
  });
});

describe("provider Telemedicine: client did not join", () => {
  it("is not offered before the call time or during the grace period", () => {
    renderPage([consultation("early", 197, { telemedicineSession: providerHere }), consultation("grace", -3, { telemedicineSession: providerHere })]);

    expect(screen.queryByRole("region", { name: "Needs you" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Client didn't join/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Report" })).not.toBeInTheDocument();
  });

  it("is offered under Needs you once the grace period has passed and the client is still absent", () => {
    renderPage([consultation("absent", -15, { telemedicineSession: providerHere })]);

    const needs = screen.getByRole("region", { name: "Needs you" });
    expect(within(needs).getByText("Amina Client has not joined. You can report it")).toBeInTheDocument();
    fireEvent.click(within(needs).getByRole("button", { name: "Report" }));
    expect(screen.getByText("Report a problem")).toBeInTheDocument();
  });

  it("is not offered to a provider who never joined", () => {
    renderPage([consultation("absent", -15, { telemedicineSession: null })]);

    expect(screen.queryByRole("region", { name: "Needs you" })).not.toBeInTheDocument();
  });

  it("shows that a report is waiting for review instead of offering it again", () => {
    renderPage([
      consultation("near", 5),
      consultation("reported", 600, { disputes: [{ disputeType: "telemedicine_no_show" }], telemedicineSession: providerHere })
    ]);

    expect(screen.queryByRole("region", { name: "Needs you" })).not.toBeInTheDocument();
    expect(screen.getByText("Reported, pending review")).toBeInTheDocument();
  });

  it("asks for a new time when nobody joined", () => {
    renderPage([consultation("nobody", -90, { status: "telemedicine_unattended" })]);

    const needs = screen.getByRole("region", { name: "Needs you" });
    expect(within(needs).getByText("Nobody joined. Suggest a new time")).toBeInTheDocument();
    fireEvent.click(within(needs).getByRole("button", { name: "Choose a time" }));
    expect(screen.getByText("booking details page")).toBeInTheDocument();
  });
});

describe("provider Telemedicine: opening a consultation", () => {
  it("opens the booking from the View details button", () => {
    renderPage([consultation("near", 5), consultation("later", 600)]);

    const row = within(screen.getByRole("region", { name: "Coming up" }));
    fireEvent.click(row.getByRole("button", { name: "View details" }));

    expect(screen.getByText("booking details page")).toBeInTheDocument();
  });

  it("opens the booking from the consultation's name too", () => {
    renderPage([consultation("near", 5), consultation("later", 600)]);

    fireEvent.click(screen.getByRole("button", { name: "Consultation later" }));

    expect(screen.getByText("booking details page")).toBeInTheDocument();
  });
});
