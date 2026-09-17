/**
 * A facility-admin's own facility briefly rendered as "This facility is not assigned to your
 * admin ops account" -- in red -- on every single page load, not just an occasional race. The
 * cause: facilityScopeQuery.isLoading was folded into the same condition as the actual
 * not-assigned determination, and hasFacilityScope defaults to false before the query resolves
 * (scopedFacilities defaults to []). This locks in the fix: the loading state must show a
 * spinner, never the red "not assigned" text, for a facility-admin who does have access.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";

const fetchFacilitiesMock = vi.fn();
const fetchFacilityMock = vi.fn();

vi.mock("../../../../../shared/libs/facilities", () => ({
  fetchFacilities: (...args: unknown[]) => fetchFacilitiesMock(...args),
  fetchFacility: (...args: unknown[]) => fetchFacilityMock(...args),
  createFacilityService: vi.fn(),
  deleteFacilityService: vi.fn(),
  assignFacilityBookingProvider: vi.fn(),
  fetchFacilityBookings: vi.fn().mockResolvedValue({ bookings: [] }),
  fetchFacilityProviders: vi.fn().mockResolvedValue({ providers: [] }),
  fetchFacilityServices: vi.fn().mockResolvedValue([]),
  bootstrapFacilityProvider: vi.fn(),
  replaceFacilityServices: vi.fn(),
  updateFacility: vi.fn(),
  updateFacilityProviderCompensation: vi.fn(),
  updateFacilityService: vi.fn()
}));

vi.mock("../../../../../shared/libs/serviceRequests", () => ({
  fetchFacilityServiceRequests: vi.fn().mockResolvedValue([]),
  cancelFacilityServiceRequest: vi.fn(),
  createFacilityServiceRequest: vi.fn()
}));

vi.mock("../../../../../shared/libs/telemedicineCatalog", () => ({
  fetchTelemedicineAdminCategories: vi.fn().mockResolvedValue([]),
  fetchTelemedicineAdminServices: vi.fn().mockResolvedValue([]),
  fetchTelemedicineAdminSubcategories: vi.fn().mockResolvedValue([])
}));

vi.mock("../../../../../shared/hooks/useRbac", () => ({
  useRbac: () => ({
    roles: ["admin.ops"],
    hasPermission: () => true,
    hasRole: () => false
  })
}));

vi.mock("../FacilityFinanceSummaryCard", () => ({
  FacilityFinanceSummaryCard: () => null
}));

import FacilityWorkspacePage from "../FacilityWorkspacePage";
import type { Facility } from "../../../../../shared/schemas/facility";

const facilityFactory = (overrides: Partial<Facility> = {}): Facility => ({
  id: "facility-1",
  name: "Karen Hospital",
  facilityType: "hospital",
  hospitalLevel: 1,
  address: "Karen, Nairobi",
  county: "Nairobi",
  countryCode: "KE",
  email: "facility@example.test",
  status: "active",
  lat: -1.29,
  lng: 36.82,
  platformFeePercent: 10,
  providerFinancialsVisible: true,
  approvedAt: null,
  suspendedAt: null,
  phones: [],
  operatingHours: [],
  services: [],
  admins: [],
  ...overrides
});

const renderAtFacility = (facilityId: string) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <MemoryRouter initialEntries={[`/admin/facilities/${facilityId}`]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/admin/facilities/:facilityId" element={<FacilityWorkspacePage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe("FacilityWorkspacePage facility-admin scope check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading spinner, never the not-assigned message, while facility scope is still resolving", async () => {
    let resolveFacilities: (value: { facilities: Array<{ id: string }> }) => void = () => {};
    fetchFacilitiesMock.mockReturnValue(
      new Promise((resolve) => {
        resolveFacilities = resolve;
      })
    );
    fetchFacilityMock.mockResolvedValue(facilityFactory());

    renderAtFacility("facility-1");

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText(/not assigned to your admin ops account/i)).not.toBeInTheDocument();

    resolveFacilities({ facilities: [{ id: "facility-1" }] });

    await waitFor(() => expect(screen.queryByText("Loading…")).not.toBeInTheDocument());
    expect(screen.queryByText(/not assigned to your admin ops account/i)).not.toBeInTheDocument();
  });

  it("still shows the not-assigned message once scope has genuinely resolved without this facility", async () => {
    fetchFacilitiesMock.mockResolvedValue({ facilities: [{ id: "some-other-facility" }] });
    fetchFacilityMock.mockResolvedValue(facilityFactory());

    renderAtFacility("facility-1");

    expect(await screen.findByText(/not assigned to your admin ops account/i)).toBeInTheDocument();
  });
});
