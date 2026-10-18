/**
 * The Services tab keeps home-based care and telemedicine services apart: each has its own tab,
 * count, search and add button, and a telemedicine service is edited as always remote.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../shared/libs/api", () => {
  const api = { get: vi.fn().mockResolvedValue({ data: { data: [] } }), post: vi.fn(), patch: vi.fn() };
  return { api, default: api };
});
vi.mock("../../../../../shared/libs/facilities", () => ({
  fetchFacilities: vi.fn().mockResolvedValue({ facilities: [{ id: "facility-1" }] }),
  fetchFacility: vi.fn(),
  fetchFacilityBookings: vi.fn().mockResolvedValue({ bookings: [] }),
  fetchFacilityProviders: vi.fn().mockResolvedValue({ providers: [] }),
  fetchFacilityServices: vi.fn(),
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
  fetchTelemedicineAdminCategories: vi.fn().mockResolvedValue([{ id: "cat1", key: "c", name: "Specialist care", description: null, status: "active", displayOrder: 1 }]),
  fetchTelemedicineAdminSubcategories: vi.fn().mockResolvedValue([{ id: "sub1", categoryId: "cat1", key: "s", name: "Cardiology", description: null, status: "active", displayOrder: 1 }]),
  fetchTelemedicineAdminServices: vi.fn(),
  fetchSelectableTelemedicineSubcategories: vi.fn().mockResolvedValue([])
}));
vi.mock("../../../../../shared/hooks/useRbac", () => ({
  useRbac: () => ({ roles: ["admin.super"], hasPermission: () => true, hasRole: () => true })
}));
vi.mock("../FacilityFinanceSummaryCard", () => ({ FacilityFinanceSummaryCard: () => null }));
vi.mock("../../../components/FacilityAdministratorsSection", () => ({ FacilityAdministratorsSection: () => null }));

import { fetchFacility, fetchFacilityServices, updateFacilityService } from "../../../../../shared/libs/facilities";
import { fetchTelemedicineAdminServices } from "../../../../../shared/libs/telemedicineCatalog";
import type { Facility } from "../../../../../shared/schemas/facility";
import FacilityWorkspacePage from "../FacilityWorkspacePage";

const facility: Facility = {
  id: "facility-1", name: "Care Point", facilityType: "clinic", hospitalLevel: null, address: "Nairobi", county: "Nairobi",
  countryCode: "KE", email: "front@care.test", status: "active", lat: null, lng: null, platformFeePercent: 10,
  providerFinancialsVisible: true, fastResponseEnabled: false, approvedAt: null, suspendedAt: null,
  phones: [], operatingHours: [], services: [], admins: []
};

const svc = (id: string, serviceId: string, name: string, over: Record<string, unknown> = {}) => ({
  id, facilityId: "facility-1", serviceId, priceCents: 150000, currency: "KES", estimateDurationMinutes: 30, active: true,
  isEmergencyCapable: false, deliveryMode: "in_person", service: { id: serviceId, key: serviceId, name, basePriceCents: 100000, defaultEstimateMinutes: 30 }, ...over
});

const homeA = svc("fs1", "h1", "Nurse Visit at Home");
const homeB = svc("fs2", "h2", "Wound Care at Home", { active: false });
const tele = svc("fs3", "t1", "First Medical Consultation", { deliveryMode: "remote", priceCents: 400000 });
const teleB = svc("fs4", "t2", "Cardiology Consultation", { deliveryMode: "remote", priceCents: 500000 });

const catalogTele = (id: string, name: string) => ({ id, key: id, name, description: null, basePriceCents: 100000, currency: "KES", defaultEstimateMinutes: 30, isEmergencyCapable: false, status: "active", tags: [], subcategoryId: "sub1", subcategory: null });

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/admin/facilities/facility-1"]}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <Routes>
          <Route path="/admin/facilities/:facilityId" element={<FacilityWorkspacePage showOperationalSections={false} />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );

const openServices = async () => {
  const user = userEvent.setup();
  renderPage();
  await user.click(await screen.findByRole("tab", { name: "Services" }));
  return user;
};

describe("facility Services tab: home-based care and telemedicine apart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchFacility).mockResolvedValue(facility);
    vi.mocked(fetchFacilityServices).mockResolvedValue([homeA, homeB, tele, teleB] as never);
    vi.mocked(fetchTelemedicineAdminServices).mockResolvedValue([catalogTele("t1", "First Medical Consultation"), catalogTele("t2", "Cardiology Consultation")] as never);
    vi.mocked(updateFacilityService).mockResolvedValue(tele as never);
  });

  it("shows two tabs with their own counts and lists only home-based care by default", async () => {
    await openServices();
    const tabs = await screen.findByRole("tablist", { name: "Service type" });
    expect(within(tabs).getByRole("tab", { name: /Home-based care/ })).toHaveTextContent("1 active of 2");
    expect(within(tabs).getByRole("tab", { name: /Telemedicine/ })).toHaveTextContent("2 active");
    expect(await screen.findByText("Nurse Visit at Home")).toBeInTheDocument();
    expect(screen.getByText("Wound Care at Home")).toBeInTheDocument();
    expect(screen.queryByText("First Medical Consultation")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add home-based care services" })).toBeInTheDocument();
  });

  it("switches to telemedicine, showing only those services with their specialty and remote delivery", async () => {
    const user = await openServices();
    await user.click(await screen.findByRole("tab", { name: /Telemedicine/ }));

    expect(await screen.findByText("First Medical Consultation")).toBeInTheDocument();
    expect(screen.getByText("Cardiology Consultation")).toBeInTheDocument();
    expect(screen.queryByText("Nurse Visit at Home")).not.toBeInTheDocument();
    expect(screen.getAllByText("Specialist care / Cardiology")).toHaveLength(2);
    expect(screen.getAllByText("Remote only")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Add telemedicine services" })).toBeInTheDocument();
    expect(screen.getByText(/Providers need the matching telemedicine specialty/)).toBeInTheDocument();
  });

  it("searches within the selected kind only, and clears the search when switching", async () => {
    const user = await openServices();
    await user.type(await screen.findByLabelText("Search services"), "wound");
    expect(screen.getByText("Wound Care at Home")).toBeInTheDocument();
    expect(screen.queryByText("Nurse Visit at Home")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Telemedicine/ }));
    expect(await screen.findByText("First Medical Consultation")).toBeInTheDocument();
    expect(screen.getByLabelText("Search services")).toHaveValue("");
    await user.type(screen.getByLabelText("Search services"), "cardio");
    expect(screen.queryByText("First Medical Consultation")).not.toBeInTheDocument();
    expect(screen.getByText("Cardiology Consultation")).toBeInTheDocument();
  });

  it("moves between the tabs with the arrow keys", async () => {
    const user = await openServices();
    const home = await screen.findByRole("tab", { name: /Home-based care/ });
    home.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /Telemedicine/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Telemedicine/ })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: /Home-based care/ })).toHaveAttribute("aria-selected", "true");
  });

  it("opens on telemedicine when the facility offers only telemedicine", async () => {
    vi.mocked(fetchFacilityServices).mockResolvedValue([tele] as never);
    await openServices();
    expect(await screen.findByText("First Medical Consultation")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Telemedicine/ })).toHaveAttribute("aria-selected", "true");
  });

  it("explains an empty telemedicine tab and points at specialties", async () => {
    vi.mocked(fetchFacilityServices).mockResolvedValue([homeA] as never);
    const user = await openServices();
    await user.click(await screen.findByRole("tab", { name: /Telemedicine/ }));
    expect(await screen.findByText(/No telemedicine services at this facility yet/)).toBeInTheDocument();
    expect(screen.getByText(/matching specialties/)).toBeInTheDocument();
  });

  it("edits a telemedicine facility price as remote only, without the in-person options", async () => {
    const user = await openServices();
    await user.click(await screen.findByRole("tab", { name: /Telemedicine/ }));
    const row = (await screen.findByText("First Medical Consultation")).closest("article") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Edit" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Delivery: remote only/)).toBeInTheDocument();
    expect(within(dialog).queryByText("Delivery mode")).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/isn.t enabled for remote delivery/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Emergency capable")).not.toBeInTheDocument();

    const price = within(dialog).getByLabelText("Facility price");
    await user.clear(price);
    await user.type(price, "4500");
    await user.click(within(dialog).getByRole("button", { name: /save/i }));

    await waitFor(() => expect(updateFacilityService).toHaveBeenCalledTimes(1));
    const [facilityId, facilityServiceId, input] = vi.mocked(updateFacilityService).mock.calls[0] as unknown as [string, string, Record<string, unknown>];
    expect([facilityId, facilityServiceId]).toEqual(["facility-1", "fs3"]);
    expect(input).toMatchObject({ priceCents: 450000, deliveryMode: "remote" });
  });

  it("keeps the delivery mode choice for a home-based care service", async () => {
    const user = await openServices();
    const row = (await screen.findByText("Nurse Visit at Home")).closest("article") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Delivery mode")).toBeInTheDocument();
    expect(within(dialog).getByText("Emergency capable")).toBeInTheDocument();
  });

  it("starts the add dialog on the kind of service being viewed", async () => {
    const user = await openServices();
    await user.click(await screen.findByRole("button", { name: "Add home-based care services" }));
    expect(within(await screen.findByRole("dialog")).getByRole("tab", { name: "Normal services" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(await screen.findByRole("tab", { name: /Telemedicine/ }));
    await user.click(await screen.findByRole("button", { name: "Add telemedicine services" }));
    expect(within(await screen.findByRole("dialog")).getByRole("tab", { name: "Telemedicine services" })).toHaveAttribute("aria-selected", "true");
  });

  it("warns when the telemedicine catalogue cannot be loaded", async () => {
    vi.mocked(fetchTelemedicineAdminServices).mockRejectedValue(new Error("down"));
    await openServices();
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load the telemedicine catalogue/i);
  });
});
