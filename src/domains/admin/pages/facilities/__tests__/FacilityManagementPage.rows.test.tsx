/**
 * Facility rows: scannable identity, administrator summary and fee, one primary action ("Open
 * facility") and the lifecycle actions grouped in a labelled menu. The list endpoint carries no
 * administrators or services, so the summary is loaded per row and nothing is invented for them.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchFacilitiesMock = vi.fn();
const fetchAdminsMock = vi.fn();
const hasRoleMock = vi.fn();
const hasPermissionMock = vi.fn();

vi.mock("../../../../../shared/libs/facilities", () => ({
  createFacility: vi.fn(),
  fetchFacilityAdminInvitationStatus: vi.fn(),
  fetchFacilities: (...args: unknown[]) => fetchFacilitiesMock(...args),
  fetchFacilityAdminAccess: (...args: unknown[]) => fetchAdminsMock(...args),
  resendFacilityAdminInvitation: vi.fn(),
  updateFacilityStatus: vi.fn()
}));
vi.mock("../../../../../shared/hooks/useRbac", () => ({
  useRbac: () => ({ hasRole: hasRoleMock, hasPermission: hasPermissionMock })
}));
vi.mock("../../../../../shared/components/LocationPickerMap", () => ({ default: () => <div data-testid="map" /> }));

import FacilityManagementPage from "../FacilityManagementPage";
import { mapFacility } from "../../../../../shared/schemas/facility";

const facility = (over: Record<string, unknown> = {}) =>
  mapFacility({
    id: "f-1", name: "Karen Hospital", facility_type: "hospital", hospital_level: 4, address: "Karen Road",
    county: "Nairobi", country_code: "KE", email: "front@karen.test", status: "pending", platform_fee_percent: 12.5,
    provider_financials_visible: true, ...over
  });

let counter = 0;
const admin = (accountStatus: string, assignmentStatus: string, invitation = "completed") => ({
  id: `a-${++counter}`, facilityId: "f-1", userId: `u-${counter}`, email: "a@c.test", userStatus: accountStatus,
  assignmentStatus, active: assignmentStatus === "active", invitation: { status: invitation }
});

const Where = () => {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.hash}</p>;
};

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/admin/facilities"]}>
        <Routes>
          <Route path="/admin/facilities" element={<FacilityManagementPage />} />
          <Route path="/admin/facilities/:id" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

const asSuperAdmin = () => {
  hasRoleMock.mockImplementation((role: string) => role === "admin.super");
  hasPermissionMock.mockReturnValue(true);
};

describe("facility rows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asSuperAdmin();
    fetchAdminsMock.mockResolvedValue([admin("active", "active")]);
    fetchFacilitiesMock.mockResolvedValue({
      facilities: [facility()],
      meta: { page: { number: 1, size: 25, total: 1, totalPages: 1 } },
      statusCounts: { pending: 1, active: 0, suspended: 0 }
    });
  });

  it("shows identity, location, status and fee, and nothing the list cannot know", async () => {
    renderPage();
    const row = await screen.findByRole("article", { name: "Karen Hospital" });

    expect(within(row).getByText("Pending")).toBeInTheDocument();
    expect(within(row).getByText(/Hospital · Level 4 · Nairobi, KE/)).toBeInTheDocument();
    expect(within(row).getByText("Karen Road")).toBeInTheDocument();
    expect(within(row).getByText("front@karen.test")).toBeInTheDocument();
    expect(within(row).getByText("12.5%")).toBeInTheDocument();
    // The list endpoint returns no services or phones; showing "0 active" or "-" would mislead.
    expect(within(row).queryByText(/services/i)).not.toBeInTheDocument();
    expect(within(row).queryByText(/Phone/i)).not.toBeInTheDocument();
  });

  it("has one primary action, Open facility, and one labelled menu for the rest", async () => {
    renderPage();
    const row = await screen.findByRole("article", { name: "Karen Hospital" });

    expect(within(row).getAllByRole("button").map((b) => b.textContent?.trim())).toEqual(["Open facility", "Manage"]);
    expect(within(row).getByRole("button", { name: "Manage Karen Hospital" })).toHaveAttribute("aria-haspopup", "menu");
  });

  it("lists only the lifecycle actions that apply to the facility's status, plus Manage administrators", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Manage Karen Hospital" }));

    const items = (await screen.findAllByRole("menuitem")).map((i) => i.textContent);
    expect(items).toEqual(["Approve facility", "Suspend facility", "Manage administrators"]);
  });

  it("confirms a status change chosen from the menu before applying it", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Manage Karen Hospital" }));
    await user.click(await screen.findByRole("menuitem", { name: "Suspend facility" }));

    expect(await screen.findByRole("dialog")).toHaveTextContent("Karen Hospital will be marked suspended.");
  });

  it("opens the facility from the primary action", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Open facility Karen Hospital" }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/admin/facilities/f-1");
  });

  it("goes to the administrators section from the menu", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Manage Karen Hospital" }));
    await user.click(await screen.findByRole("menuitem", { name: "Manage administrators" }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/admin/facilities/f-1#facility-administrators");
  });

  describe("administrator summary", () => {
    it.each([
      ["one active", () => [admin("active", "active")], "1 active"],
      ["active and pending", () => [admin("active", "active"), admin("pending", "active", "pending")], "1 active, 1 setup pending"],
      ["expired invitation", () => [admin("pending", "active", "expired")], "1 setup pending"],
      ["suspended assignment", () => [admin("active", "suspended"), admin("active", "active")], "1 active, 1 suspended"]
    ])("summarises %s", async (_name, make, expected) => {
      fetchAdminsMock.mockResolvedValue(make());
      renderPage();
      expect(await screen.findByText(expected)).toBeInTheDocument();
    });

    it("does not count removed assignments and flags a facility with no administrator", async () => {
      fetchAdminsMock.mockResolvedValue([admin("active", "removed")]);
      renderPage();
      expect(await screen.findByText("No administrator")).toBeInTheDocument();
    });

    it("shows a quiet error if the summary cannot load, leaving the row usable", async () => {
      fetchAdminsMock.mockRejectedValue(new Error("nope"));
      renderPage();
      expect(await screen.findByText("Could not load")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Open facility Karen Hospital" })).toBeInTheDocument();
    });

    it("waits until the row is on screen before loading, when the browser can tell", async () => {
      const observe = vi.fn();
      class FakeObserver {
        observe = observe;
        disconnect = vi.fn();
        unobserve = vi.fn();
        takeRecords = () => [];
      }
      vi.stubGlobal("IntersectionObserver", FakeObserver);
      try {
        renderPage();
        await screen.findByRole("article", { name: "Karen Hospital" });
        await waitFor(() => expect(observe).toHaveBeenCalled());
        expect(fetchAdminsMock).not.toHaveBeenCalled();
        expect(screen.getByText("Loading...")).toBeInTheDocument();
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  describe("without permission", () => {
    it("shows no administrator summary and no Manage menu for someone who cannot manage admins", async () => {
      hasRoleMock.mockReturnValue(false);
      hasPermissionMock.mockImplementation((perm: string) => perm === "facility:read");
      renderPage();
      const row = await screen.findByRole("article", { name: "Karen Hospital" });

      expect(within(row).queryByText("Administrators")).not.toBeInTheDocument();
      expect(fetchAdminsMock).not.toHaveBeenCalled();
      expect(within(row).queryByRole("button", { name: /^Manage/ })).not.toBeInTheDocument();
      expect(within(row).getByRole("button", { name: "Open facility Karen Hospital" })).toBeInTheDocument();
    });
  });
});
