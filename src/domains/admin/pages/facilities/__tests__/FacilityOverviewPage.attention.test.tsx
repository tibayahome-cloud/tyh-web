/**
 * The overview read 0 for "Needs assignment" while a client who had paid was waiting for a provider,
 * and a failed load was a bare card with no way to try again. These pin that what needs a person is
 * listed first with the screen to act on it, that an older API that does not send it is never read as
 * "all clear", and that a failure offers a retry.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchFacilitiesMock = vi.fn();
const fetchFacilityOverviewMock = vi.fn();

vi.mock("../../../../../shared/libs/facilities", () => ({
  fetchFacilities: (...args: unknown[]) => fetchFacilitiesMock(...args),
  fetchFacilityOverview: (...args: unknown[]) => fetchFacilityOverviewMock(...args)
}));

import FacilityOverviewPage from "../FacilityOverviewPage";

const renderPage = () =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <FacilityOverviewPage />
      </QueryClientProvider>
    </MemoryRouter>
  );

const overview = (needsAttention: unknown) => ({
  facility: { id: "facility-1", name: "Test Clinic" },
  metrics: {
    openBookings: 5,
    unassignedBookings: 3,
    inProgressBookings: 2,
    upcomingBookings: 1,
    providersTotal: 4,
    activeServices: 9,
    providersAvailable: 3,
    providersPendingVerification: 1,
    asOf: "2026-10-19T09:30:00Z",
    needsAttention
  },
  readiness: { locationReady: true, contactReady: false, operatingHoursConfigured: true }
});

beforeEach(() => {
  vi.clearAllMocks();
  fetchFacilitiesMock.mockResolvedValue({ facilities: [{ id: "facility-1", name: "Test Clinic" }] });
});

describe("facility overview: needs attention", () => {
  it("lists what needs a person first, with a count and the screen to act on it", async () => {
    fetchFacilityOverviewMock.mockResolvedValue(
      overview({ unassignedConsultations: 2, unattendedConsultations: 1, paymentReview: 0, awaitingResponse: 2, total: 5 })
    );
    renderPage();

    const section = await screen.findByRole("region", { name: /Needs attention \(5\)/ });
    const waiting = within(section).getByRole("link", { name: /Paid consultations waiting for a provider/ });
    expect(waiting).toHaveAttribute("href", "/admin/telemedicine?tab=queue");
    expect(within(waiting).getByText("2")).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: /New times offered and waiting/ })).toHaveAttribute(
      "href",
      "/admin/telemedicine?tab=consultations"
    );
    // A row with nothing in it is not listed.
    expect(within(section).queryByText(/payment decision/)).not.toBeInTheDocument();
  });

  it("says nothing needs attention only when the server said so", async () => {
    fetchFacilityOverviewMock.mockResolvedValue(
      overview({ unassignedConsultations: 0, unattendedConsultations: 0, paymentReview: 0, awaitingResponse: 0, total: 0 })
    );
    renderPage();
    expect(await screen.findByText("Nothing needs attention right now.")).toBeInTheDocument();
  });

  it("does not claim all is clear when the API sent no needs-attention answer", async () => {
    fetchFacilityOverviewMock.mockResolvedValue(overview(null));
    renderPage();

    expect(await screen.findByText("Test Clinic")).toBeInTheDocument();
    expect(screen.queryByText("Nothing needs attention right now.")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Needs attention/ })).not.toBeInTheDocument();
  });

  it("makes the counts links to the screens that hold them", async () => {
    fetchFacilityOverviewMock.mockResolvedValue(overview(null));
    renderPage();

    expect(await screen.findByRole("link", { name: /Open bookings: 5/ })).toHaveAttribute("href", "/admin/bookings");
    expect(screen.getByRole("link", { name: /Needs a provider: 3/ })).toHaveAttribute("href", "/admin/telemedicine?tab=queue");
    expect(screen.getByRole("link", { name: /Providers: 4/ })).toHaveAttribute("href", "/admin/facility/providers");
  });

  it("points an unfinished readiness item at where to fix it", async () => {
    fetchFacilityOverviewMock.mockResolvedValue(overview(null));
    renderPage();

    expect(await screen.findByRole("link", { name: /Needs attention. Fix it/ })).toHaveAttribute("href", "/admin/facilities/facility-1");
  });

  it("shows when it was last updated", async () => {
    fetchFacilityOverviewMock.mockResolvedValue(overview(null));
    renderPage();
    expect(await screen.findByText(/Updated \d{1,2}:\d{2}/)).toBeInTheDocument();
  });
});

describe("facility overview: a failed load", () => {
  it("says what went wrong and offers a retry instead of a bare card", async () => {
    fetchFacilityOverviewMock.mockRejectedValueOnce(
      new AxiosError("x", "ERR_BAD_RESPONSE", undefined, undefined, { status: 500, statusText: "", headers: {}, config: {}, data: "" } as never)
    );
    fetchFacilityOverviewMock.mockResolvedValueOnce(overview(null));
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Temporarily unavailable")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(fetchFacilityOverviewMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Test Clinic")).toBeInTheDocument();
  });
});
