/**
 * The facility workspace shows what is missing before telemedicine works, and lets a super admin
 * manage the facility's providers on the same page: the setup checklist on Overview, and the full
 * provider management screen in the Providers & bookings tab.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

let denied: string[] = [];

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
  useRbac: () => ({ roles: ["admin.super"], hasPermission: (perm: string) => !denied.includes(perm), hasRole: () => true })
}));
vi.mock("../FacilityFinanceSummaryCard", () => ({ FacilityFinanceSummaryCard: () => null }));
vi.mock("../../../components/FacilityAdministratorsSection", () => ({ FacilityAdministratorsSection: () => null }));

import { fetchFacility, fetchFacilityProviders, fetchFacilityServices } from "../../../../../shared/libs/facilities";
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

const inPerson = { id: "fs1", facilityId: "facility-1", serviceId: "x", priceCents: 1, currency: "KES", estimateDurationMinutes: 30, active: true, isEmergencyCapable: false, deliveryMode: "in_person", service: null };
const remote = { ...inPerson, id: "fs2", serviceId: "svc1", deliveryMode: "remote" };

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

describe("facility workspace: setup checklist and providers", () => {
  beforeEach(() => {
    denied = [];
    vi.clearAllMocks();
    vi.mocked(fetchFacility).mockResolvedValue(facility);
    vi.mocked(fetchFacilityProviders).mockResolvedValue({ providers: [readyProvider] } as never);
    vi.mocked(fetchFacilityServices).mockResolvedValue([remote] as never);
  });

  it("shows a complete checklist when everything is in place", async () => {
    renderPage();
    expect(await screen.findByText("Telemedicine setup")).toBeInTheDocument();
    expect(await screen.findByText("Ready")).toBeInTheDocument();
  });

  it("finds the CARE POINT case: a ready provider but only in-person services, and goes to Services", async () => {
    vi.mocked(fetchFacilityServices).mockResolvedValue([inPerson] as never);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("No telemedicine services.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Go to Services" }));
    expect(screen.getByRole("tab", { name: "Services" })).toHaveAttribute("aria-selected", "true");
  });

  it("finds a facility with services but no providers, and opens the Providers tab with the full controls", async () => {
    vi.mocked(fetchFacilityProviders).mockResolvedValue({ providers: [] } as never);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("No providers.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Go to Providers" }));
    expect(screen.getByRole("tab", { name: "Providers & bookings" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByRole("button", { name: /add provider/i })).toBeInTheDocument();
  });

  it("manages providers in the facility workspace: readiness, lifecycle and telemedicine controls", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Providers & bookings" }));

    expect(await screen.findByText("Dr Gitobu")).toBeInTheDocument();
    expect(screen.getByText("Ready for telemedicine bookings")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disable telemedicine" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set unavailable" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Edit$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /onboard an existing user/i })).toBeInTheDocument();
  });

  it("shows no checklist or provider management to someone who cannot verify providers", async () => {
    denied = ["provider:verify"];
    renderPage();
    const user = userEvent.setup();
    await screen.findByRole("tab", { name: "Overview" });
    await waitFor(() => expect(screen.queryByText("Telemedicine setup")).not.toBeInTheDocument());
    // The bookings tab stays for booking managers, but without provider management.
    await user.click(screen.getByRole("tab", { name: "Providers & bookings" }));
    expect(screen.queryByRole("button", { name: /add provider/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Providers" })).not.toBeInTheDocument();
    expect(fetchFacilityProviders).not.toHaveBeenCalled();
  });
});
