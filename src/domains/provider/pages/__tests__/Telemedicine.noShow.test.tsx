/**
 * "Client didn't join" was offered on every scheduled consultation, including one three hours away. It is
 * offered only after the call time and a short grace period, to a provider who was in the call while the client
 * was not.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
vi.mock("../../../../shared/components/TelemedicineCallPanel", () => ({ TelemedicineCallPanel: () => null }));
vi.mock("../../../../shared/components/TechnicalIssueDialog", () => ({ TechnicalIssueDialog: () => null }));

import ProviderTelemedicinePage from "../Telemedicine";

const NOW = new Date("2026-10-22T08:00:00Z");

const consultation = (minutesFromNow: number, session: Record<string, unknown> | null, disputes: unknown[] = []) => ({
  id: "b1",
  isTelemedicine: true,
  status: "scheduled",
  scheduledAt: new Date(NOW.getTime() + minutesFromNow * 60_000).toISOString(),
  estimateDurationMinutes: 30,
  service: { name: "Video consultation" },
  client: { fullName: "Amina Client" },
  disputes,
  telemedicineSession: session
});

const renderPage = (booking: unknown) => {
  list.state = { isLoading: false, isError: false, data: { bookings: [booking] }, error: null };
  return render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>
        <ProviderTelemedicinePage />
      </QueryClientProvider>
    </MemoryRouter>
  );
};

const providerHere = { id: "s1", status: "scheduled", providerJoinedAt: "2026-10-22T07:58:00Z", clientJoinedAt: null };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("provider Telemedicine: client did not join", () => {
  it("is not offered on a consultation that has not started, and the wait reads in hours", () => {
    renderPage(consultation(197, null));

    expect(screen.queryByRole("button", { name: /Client didn't join/ })).not.toBeInTheDocument();
    expect(screen.getByText(/The call opens in 3 h 7 min/)).toBeInTheDocument();
    expect(screen.queryByText(/Joinable in/)).not.toBeInTheDocument();
  });

  it("is not offered before the grace period ends, and says when it opens", () => {
    renderPage(consultation(-3, providerHere));

    expect(screen.queryByRole("button", { name: /Client didn't join/ })).not.toBeInTheDocument();
    expect(screen.getByText(/If your client has not joined by 11:07, you can report it here/)).toBeInTheDocument();
  });

  it("is offered once the grace period has passed and the client is still absent", () => {
    renderPage(consultation(-15, providerHere));

    expect(screen.getByRole("button", { name: /Client didn't join/ })).toBeInTheDocument();
  });

  it("is not offered to a provider who never joined", () => {
    renderPage(consultation(-15, null));

    expect(screen.queryByRole("button", { name: /Client didn't join/ })).not.toBeInTheDocument();
  });

  it("shows that a report is waiting for review instead of offering it again", () => {
    renderPage(consultation(-15, providerHere, [{ disputeType: "telemedicine_no_show" }]));

    expect(screen.queryByRole("button", { name: /Client didn't join/ })).not.toBeInTheDocument();
    expect(screen.getByText("Reported, pending review")).toBeInTheDocument();
  });
});
