/**
 * The facility profile editor and the facility-admin access panel are platform-level controls.
 * They render for a super admin and are absent for a facility admin (admin.ops), even when that
 * admin holds facility:manage. The API enforces the same rule; this keeps the UI from offering it.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

let roles: string[] = ["admin.super"];

vi.mock("../../../../../shared/libs/facilities", () => ({
  fetchFacilities: vi.fn().mockResolvedValue({ facilities: [{ id: "facility-1" }] }),
  fetchFacility: vi.fn(),
  fetchFacilityBookings: vi.fn().mockResolvedValue({ bookings: [] }),
  fetchFacilityProviders: vi.fn().mockResolvedValue({ providers: [] }),
  fetchFacilityServices: vi.fn().mockResolvedValue([]),
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
  fetchTelemedicineAdminServices: vi.fn().mockResolvedValue([]),
  fetchTelemedicineAdminSubcategories: vi.fn().mockResolvedValue([])
}));
vi.mock("../../../../../shared/hooks/useRbac", () => ({
  useRbac: () => ({ roles, hasPermission: () => true, hasRole: (role: string) => roles.includes(role) })
}));
vi.mock("../FacilityFinanceSummaryCard", () => ({ FacilityFinanceSummaryCard: () => null }));
vi.mock("../../../components/FacilityAdministratorsSection", () => ({
  FacilityAdministratorsSection: () => <div>admin-access-card</div>
}));

import { fetchFacility } from "../../../../../shared/libs/facilities";
import type { Facility } from "../../../../../shared/schemas/facility";
import FacilityWorkspacePage from "../FacilityWorkspacePage";

const facility: Facility = {
  id: "facility-1",
  name: "Karen Clinic",
  facilityType: "clinic",
  hospitalLevel: null,
  address: "Karen, Nairobi",
  county: "Nairobi",
  countryCode: "KE",
  email: "front@karen.test",
  status: "active",
  lat: null,
  lng: null,
  platformFeePercent: 12,
  providerFinancialsVisible: true,
  fastResponseEnabled: false,
  approvedAt: null,
  suspendedAt: null,
  phones: [],
  operatingHours: [],
  services: [],
  admins: []
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/admin/facilities/facility-1"]}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Routes>
          <Route path="/admin/facilities/:facilityId" element={<FacilityWorkspacePage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );

describe("FacilityWorkspacePage super-admin controls", () => {
  beforeEach(() => {
    vi.mocked(fetchFacility).mockResolvedValue(facility);
  });

  it("offers the profile editor and the admin access panel to a super admin", async () => {
    roles = ["admin.super"];
    renderPage();
    expect(await screen.findByRole("button", { name: /edit facility profile/i })).toBeInTheDocument();
    expect(screen.queryByText("admin-access-card")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Administrators" }));
    expect(screen.getByText("admin-access-card")).toBeInTheDocument();
  });

  it("organizes facility work into focused sections instead of stacking every panel", async () => {
    roles = ["admin.super"];
    renderPage();
    await screen.findByRole("button", { name: /edit facility profile/i });
    const tabs = screen.getByRole("tablist", { name: "Facility workspace sections" });
    expect(within(tabs).getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Overview",
      "Administrators",
      "Services",
      "Providers & bookings",
      "Finance"
    ]);
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Facility settings")).toBeInTheDocument();
    expect(screen.queryByText("Facility services")).not.toBeInTheDocument();
    expect(screen.queryByText("admin-access-card")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Administrators" }));
    expect(screen.getByText("admin-access-card")).toBeInTheDocument();
    expect(screen.queryByText("Facility settings")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Services" }));
    expect(screen.getByText("Facility services")).toBeInTheDocument();
    expect(screen.queryByText("admin-access-card")).not.toBeInTheDocument();
  });

  it("offers neither to a facility admin, who keeps the operations settings", async () => {
    roles = ["admin.ops"];
    renderPage();
    expect(await screen.findByRole("button", { name: /edit operations settings/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit facility profile/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Facility profile")).not.toBeInTheDocument();
    expect(screen.queryByText("admin-access-card")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Administrators" })).not.toBeInTheDocument();
  });
});
