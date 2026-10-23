/**
 * The Join button on Home sends a provider to the Telemedicine page with ?join=<booking>. The call has to open
 * on arrival, once, and the parameter has to go so a refresh does not reopen it.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../shared/hooks/useBookings", () => ({
  bookingKeys: { lists: () => ["bookings", "list"] },
  useBookingList: () => ({ data: { bookings: [] }, isLoading: false, isFetching: false, dataUpdatedAt: 0, refetch: vi.fn() })
}));
vi.mock("../../../../shared/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("../../../../shared/hooks/useTelemedicine", () => ({
  useReportNoShowMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTelemedicinePolicy: () => ({ data: undefined })
}));
vi.mock("../../../../shared/components/ToastProvider", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("../../../../shared/components/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../../../../shared/components/NeedsYourResponse", () => ({ NeedsYourResponse: () => null }));
vi.mock("../../../../shared/components/TechnicalIssueDialog", () => ({ TechnicalIssueDialog: () => null }));
vi.mock("../../../../shared/components/TelemedicineCallPanel", () => ({
  TelemedicineCallPanel: ({ bookingId }: { bookingId: string }) => <p>CALL {bookingId}</p>
}));

import ProviderTelemedicinePage from "../Telemedicine";

const Where = () => <p data-testid="where">{useLocation().search || "(no query)"}</p>;

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <QueryClientProvider client={new QueryClient()}>
        <ProviderTelemedicinePage />
        <Where />
      </QueryClientProvider>
    </MemoryRouter>
  );

describe("provider Telemedicine ?join", () => {
  it("opens the call for the booking named in the link, and removes the parameter", async () => {
    renderAt("/pro/telemedicine?join=booking-42");
    expect(await screen.findByText("CALL booking-42")).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("(no query)");
  });

  it("opens nothing when there is no join parameter", () => {
    renderAt("/pro/telemedicine");
    expect(screen.queryByText(/^CALL /)).not.toBeInTheDocument();
  });
});
