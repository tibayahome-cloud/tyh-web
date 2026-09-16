/**
 * A correctly-linked facility admin briefly saw "Your admin.ops account is not linked to
 * exactly one facility" on every load of this page. The cause: the facility-overview query is
 * disabled until the facility-scope query resolves, and in TanStack Query v5 a disabled query
 * reports `isLoading: false` (isLoading requires active fetching) right up until its first
 * fetch actually starts. The old guard folded "overview query has no data yet" into the same
 * branch as "no facility is linked," so that ordinary gap rendered the wrong message instead of
 * a spinner. This test freezes exactly that gap -- facility resolved, overview still pending --
 * and asserts the loading state wins, not the linkage error.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";

const fetchFacilitiesMock = vi.fn();
const fetchFacilityOverviewMock = vi.fn();

vi.mock("../../../../../shared/libs/facilities", () => ({
  fetchFacilities: (...args: unknown[]) => fetchFacilitiesMock(...args),
  fetchFacilityOverview: (...args: unknown[]) => fetchFacilityOverviewMock(...args)
}));

import FacilityOverviewPage from "../FacilityOverviewPage";

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <FacilityOverviewPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
};

const overviewFixture = {
  facility: { id: "facility-1", name: "Karen Hospital" },
  metrics: {
    openBookings: 2,
    unassignedBookings: 1,
    providersTotal: 5,
    activeServices: 10,
    providersAvailable: 3,
    providersPendingVerification: 1
  },
  readiness: { locationReady: true, contactReady: true, operatingHoursConfigured: false }
};

describe("FacilityOverviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stays on the loading state while the overview query is still pending for a resolved facility, instead of flashing the linkage error", async () => {
    fetchFacilitiesMock.mockResolvedValue({ facilities: [{ id: "facility-1", name: "Karen Hospital" }] });
    // Never resolves within this test -- simulates the window between facilityId resolving and
    // the overview query's first fetch actually completing.
    fetchFacilityOverviewMock.mockReturnValue(new Promise(() => {}));

    renderPage();

    await waitFor(() => expect(fetchFacilityOverviewMock).toHaveBeenCalledWith("facility-1"));
    expect(screen.queryByText(/not linked to exactly one facility/i)).not.toBeInTheDocument();
  });

  it("renders the overview once both queries resolve", async () => {
    fetchFacilitiesMock.mockResolvedValue({ facilities: [{ id: "facility-1", name: "Karen Hospital" }] });
    fetchFacilityOverviewMock.mockResolvedValue(overviewFixture);

    renderPage();

    expect(await screen.findByText("Karen Hospital")).toBeInTheDocument();
    expect(screen.queryByText(/not linked to exactly one facility/i)).not.toBeInTheDocument();
  });

  it("still shows the linkage message when the account genuinely has no single facility", async () => {
    fetchFacilitiesMock.mockResolvedValue({ facilities: [] });

    renderPage();

    expect(await screen.findByText(/not linked to exactly one facility/i)).toBeInTheDocument();
    expect(fetchFacilityOverviewMock).not.toHaveBeenCalled();
  });
});
