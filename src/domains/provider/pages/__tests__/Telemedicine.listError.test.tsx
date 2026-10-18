/**
 * A failed request must not read as an empty list. A provider whose consultations could not be
 * loaded was told "No consultations assigned yet", which sent them looking for an assignment problem
 * that did not exist.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const list = vi.hoisted(() => ({ state: {} as Record<string, unknown>, refetch: vi.fn() }));

vi.mock("../../../../shared/hooks/useBookings", () => ({
  bookingKeys: { lists: () => ["bookings", "list"] },
  useBookingList: () => ({ refetch: list.refetch, dataUpdatedAt: 0, isFetching: false, ...list.state })
}));
vi.mock("../../../../shared/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("../../../../shared/hooks/useTelemedicine", () => ({
  useReportNoShowMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTelemedicinePolicy: () => ({ data: undefined })
}));
vi.mock("../../../../shared/components/ToastProvider", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("../../../../shared/components/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../../../../shared/components/NeedsYourResponse", () => ({ NeedsYourResponse: () => null }));
vi.mock("../../../../shared/components/TelemedicineCallPanel", () => ({ TelemedicineCallPanel: () => null }));
vi.mock("../../../../shared/components/TechnicalIssueDialog", () => ({ TechnicalIssueDialog: () => null }));

import ProviderTelemedicinePage from "../Telemedicine";

const renderPage = () =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>
        <ProviderTelemedicinePage />
      </QueryClientProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  list.refetch.mockClear();
});

describe("provider Telemedicine list", () => {
  it("says the consultations could not be loaded, with a retry, instead of 'No consultations assigned yet'", async () => {
    list.state = {
      isLoading: false,
      isError: true,
      data: undefined,
      error: new AxiosError("x", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 500, statusText: "", headers: {}, config: {}, data: ""
      } as never)
    };
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByText("Temporarily unavailable")).toBeInTheDocument();
    expect(screen.getByText(/Something went wrong on our side/)).toBeInTheDocument();
    expect(screen.queryByText("No consultations assigned yet")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(list.refetch).toHaveBeenCalled();
  });

  it("still says nothing is assigned when the request succeeded with no consultations", () => {
    list.state = { isLoading: false, isError: false, data: { bookings: [] }, error: null };
    renderPage();
    expect(screen.getByText("No consultations assigned yet")).toBeInTheDocument();
  });
});
