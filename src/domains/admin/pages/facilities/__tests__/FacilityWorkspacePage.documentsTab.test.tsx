/** A super admin adds and reviews a facility's documents from the facility's own Documents tab. */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

let roles: string[] = ["admin.super"];

vi.mock("../../../../../shared/libs/facilities", () => ({
  fetchFacilities: vi.fn().mockResolvedValue({ facilities: [{ id: "facility-1" }] }),
  fetchFacility: vi.fn(),
  fetchFacilityBookings: vi.fn().mockResolvedValue({ bookings: [] }),
  fetchFacilityProviders: vi.fn(),
  fetchFacilityServices: vi.fn(),
  createFacilityProvider: vi.fn(),
  updateFacilityProvider: vi.fn(),
  updateFacilityProviderLifecycle: vi.fn(),
  createFacilityService: vi.fn(),
  deleteFacilityService: vi.fn(),
  assignFacilityBookingProvider: vi.fn(),
  bootstrapFacilityProvider: vi.fn(),
  replaceFacilityServices: vi.fn(),
  updateFacility: vi.fn(),
  updateFacilityStatus: vi.fn(),
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
  fetchTelemedicineAdminServices: vi.fn().mockResolvedValue([{ id: "svc1", subcategoryId: "s1" }]),
  fetchTelemedicineAdminSubcategories: vi.fn().mockResolvedValue([]),
  fetchSelectableTelemedicineSubcategories: vi.fn().mockResolvedValue([{ id: "s1" }])
}));
vi.mock("../../../../../shared/hooks/useRbac", () => ({
  useRbac: () => ({ roles, hasPermission: () => true, hasRole: (role: string) => roles.includes(role) })
}));
vi.mock("../FacilityFinanceSummaryCard", () => ({ FacilityFinanceSummaryCard: () => null }));
vi.mock("../../../components/FacilityAdministratorsSection", () => ({ FacilityAdministratorsSection: () => null }));
vi.mock("../../documents/FacilityDocumentsPanel", () => ({
  FacilityDocumentsPanel: ({ facilityId, mode }: { facilityId: string; mode: string }) => <p>Documents panel for {facilityId} as {mode}</p>
}));

import { fetchFacility, fetchFacilityBookings, fetchFacilityProviders, fetchFacilityServices } from "../../../../../shared/libs/facilities";
import type { Facility } from "../../../../../shared/schemas/facility";
import FacilityWorkspacePage from "../FacilityWorkspacePage";

const facility: Facility = {
  id: "facility-1", name: "Care Point", facilityType: "clinic", hospitalLevel: null, address: "Nairobi", county: "Nairobi",
  countryCode: "KE", email: "front@care.test", status: "active", lat: null, lng: null, platformFeePercent: 10,
  providerFinancialsVisible: true, fastResponseEnabled: false, approvedAt: null, suspendedAt: null,
  phones: [], operatingHours: [], services: [], admins: []
};

const readyProvider = {
  id: "p1", userId: "u1", facilityId: "facility-1",
  user: { fullName: "Dr Gitobu", email: "g@care.test", phone: null, status: "active" },
  gender: null, verified: true, isAvailable: true, telemedicineEnabled: true, financialsVisible: null, services: [],
  compensation: { mode: "employee", fixedPayoutCents: null, payoutPercentage: null },
  telemedicineSubcategoryAssignments: [{ id: "a", subcategoryId: "s1", status: "active" }],
  availability: [{ id: "w", weekday: 0, deliveryMode: "both" }], blackouts: []
};


const renderPage = (hash = "") =>
  render(
    <MemoryRouter initialEntries={["/admin/facilities/facility-1" + hash]}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Routes>
          <Route path="/admin/facilities/:facilityId" element={<FacilityWorkspacePage showOperationalSections={false} />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );

describe("facility workspace: Documents tab", () => {
  beforeEach(() => {
    roles = ["admin.super"];
    window.location.hash = "";
    vi.clearAllMocks();
    vi.mocked(fetchFacility).mockResolvedValue(facility);
    vi.mocked(fetchFacilityProviders).mockResolvedValue({ providers: [] } as never);
    vi.mocked(fetchFacilityServices).mockResolvedValue([] as never);
  });

  it("gives a super admin a Documents tab that opens the facility's documents in super admin mode", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Documents" }));

    expect(screen.getByRole("tab", { name: "Documents" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("Documents panel for facility-1 as super_admin")).toBeInTheDocument();
  });

  it("opens straight on Documents from a #facility-documents link", async () => {
    window.location.hash = "#facility-documents";
    renderPage();

    expect(await screen.findByText("Documents panel for facility-1 as super_admin")).toBeInTheDocument();
  });

  it("does not offer the tab to a facility admin, who has their own Documents page", async () => {
    roles = ["admin.ops"];
    renderPage();
    await screen.findByRole("tab", { name: "Overview" });

    expect(screen.queryByRole("tab", { name: "Documents" })).not.toBeInTheDocument();
  });
});
