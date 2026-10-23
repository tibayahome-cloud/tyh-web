/**
 * The facilities list now carries each facility's active service count and a summary of its administrators, so a
 * row shows them at once instead of "0 active" for everyone or one request per row. Against an API without them
 * the row keeps loading the administrators lazily and shows no service count rather than a made-up zero.
 */

import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchFacilitiesMock = vi.fn();
const fetchAdminsMock = vi.fn();

vi.mock("../../../../../shared/libs/facilities", () => ({
  createFacility: vi.fn(),
  fetchFacilityAdminInvitationStatus: vi.fn(),
  fetchFacilities: (...args: unknown[]) => fetchFacilitiesMock(...args),
  fetchFacilityAdminAccess: (...args: unknown[]) => fetchAdminsMock(...args),
  resendFacilityAdminInvitation: vi.fn(),
  updateFacilityStatus: vi.fn()
}));
vi.mock("../../../../../shared/hooks/useRbac", () => ({
  useRbac: () => ({ hasRole: (role: string) => role === "admin.super", hasPermission: () => true })
}));
vi.mock("../../../../../shared/components/LocationPickerMap", () => ({ default: () => <div data-testid="map" /> }));

import FacilityManagementPage from "../FacilityManagementPage";
import { mapFacility } from "../../../../../shared/schemas/facility";

const facility = (over: Record<string, unknown> = {}) =>
  mapFacility({
    id: "f-1", name: "Test Clinic", facility_type: "clinic", address: "Main Road", county: "Nairobi", country_code: "KE",
    email: "front@clinic.test", status: "active", platform_fee_percent: 10, provider_financials_visible: true, ...over
  });

const renderWith = (facilities: ReturnType<typeof facility>[]) => {
  fetchFacilitiesMock.mockResolvedValue({
    facilities,
    meta: { page: { number: 1, size: 25, total: facilities.length, totalPages: 1 } },
    statusCounts: { pending: 0, active: facilities.length, suspended: 0 }
  });
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/admin/facilities"]}>
        <Routes>
          <Route path="/admin/facilities" element={<FacilityManagementPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchAdminsMock.mockResolvedValue([]);
});

describe("facility rows with counts from the list", () => {
  it("show the active services and the administrator summary straight away, with no per-row request", async () => {
    renderWith([
      facility({ active_service_count: 12, admin_summary: { active: 2, pending_setup: 1, suspended: 0 } })
    ]);
    const row = await screen.findByRole("article", { name: "Test Clinic" });

    expect(within(row).getByText("12 active")).toBeInTheDocument();
    expect(within(row).getByText("2 active, 1 setup pending")).toBeInTheDocument();
    expect(fetchAdminsMock).not.toHaveBeenCalled();
  });

  it("say 'No administrator' only when the server counted none, and a real zero for services", async () => {
    renderWith([facility({ active_service_count: 0, admin_summary: { active: 0, pending_setup: 0, suspended: 0 } })]);
    const row = await screen.findByRole("article", { name: "Test Clinic" });

    expect(within(row).getByText("0 active")).toBeInTheDocument();
    expect(within(row).getByText("No administrator")).toBeInTheDocument();
  });

  it("show a suspended administrator", async () => {
    renderWith([facility({ active_service_count: 3, admin_summary: { active: 1, pending_setup: 0, suspended: 1 } })]);
    const row = await screen.findByRole("article", { name: "Test Clinic" });
    expect(within(row).getByText("1 active, 1 suspended")).toBeInTheDocument();
  });
});

describe("facility rows against an API without the counts", () => {
  it("show no service count, and still load the administrators for the row", async () => {
    fetchAdminsMock.mockResolvedValue([
      { id: "a-1", facilityId: "f-1", userId: "u-1", email: "a@c.test", userStatus: "active", assignmentStatus: "active", active: true, invitation: { status: "completed" } }
    ]);
    renderWith([facility()]);
    const row = await screen.findByRole("article", { name: "Test Clinic" });

    expect(within(row).queryByText(/Services/)).not.toBeInTheDocument();
    expect(await within(row).findByText("1 active")).toBeInTheDocument();
    expect(fetchAdminsMock).toHaveBeenCalled();
  });
});
