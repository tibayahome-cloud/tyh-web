/**
 * The facility list is paged, searched and filtered on the server, and its summary counts cover
 * every page. The create form's fast-response option belongs to super-administrators only.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchFacilitiesMock = vi.fn();
const hasRoleMock = vi.fn();
const hasPermissionMock = vi.fn();

vi.mock("../../../../../shared/libs/facilities", () => ({
  assignFacilityAdmin: vi.fn(),
  fetchFacilityAdminAccess: vi.fn().mockResolvedValue([]),
  createFacility: vi.fn(),
  fetchFacilityAdminInvitationStatus: vi.fn(),
  fetchFacilities: (...args: unknown[]) => fetchFacilitiesMock(...args),
  resendFacilityAdminInvitation: vi.fn(),
  updateFacilityStatus: vi.fn()
}));

vi.mock("../../../../../shared/hooks/useRbac", () => ({
  useRbac: () => ({ hasRole: hasRoleMock, hasPermission: hasPermissionMock })
}));

vi.mock("../../../../../shared/components/LocationPickerMap", () => ({ default: () => <div data-testid="map" /> }));

import FacilityManagementPage from "../FacilityManagementPage";
import { mapFacility } from "../../../../../shared/schemas/facility";

const facility = (id: string, name: string) =>
  mapFacility({
    id,
    name,
    facility_type: "clinic",
    address: "Kilimani",
    county: "Nairobi",
    email: `${id}@clinic.test`,
    status: "active",
    platform_fee_percent: 10,
    provider_financials_visible: true
  });

const result = (pageNumber: number, totalPages = 3) => ({
  facilities: [facility(`f-${pageNumber}`, `Clinic ${pageNumber}`)],
  meta: { page: { number: pageNumber, size: 25, total: 60, totalPages } },
  statusCounts: { pending: 4, active: 50, suspended: 6 }
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <FacilityManagementPage />
      </MemoryRouter>
    </QueryClientProvider>
  );

const asSuperAdmin = () => {
  hasRoleMock.mockImplementation((role: string) => role === "admin.super");
  hasPermissionMock.mockReturnValue(true);
};

describe("facility management page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asSuperAdmin();
    fetchFacilitiesMock.mockImplementation(async ({ page = 1 }: { page?: number }) => result(page));
  });

  it("asks the server for the first page and shows where the person is", async () => {
    renderPage();

    await screen.findByText("Clinic 1");
    expect(fetchFacilitiesMock).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 25, status: undefined, search: undefined })
    );
    expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });

  it("moves between pages with the server, not the client", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Clinic 1");

    await user.click(screen.getByRole("button", { name: "Next" }));

    await screen.findByText("Clinic 2");
    expect(fetchFacilitiesMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    expect(screen.queryByText("Clinic 1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
  });

  it("shows summary counts for every page, not just the visible one", async () => {
    renderPage();
    await screen.findByText("Clinic 1");

    // Metric tiles are the only <p> elements labelled with these words (the filter uses <option>).
    const valueFor = (label: string) => {
      const heading = screen.getAllByText(label).find((element) => element.tagName === "P");
      return heading?.nextElementSibling?.textContent;
    };
    expect(valueFor("Total")).toBe("60");
    expect(valueFor("Active")).toBe("50");
    expect(valueFor("Pending")).toBe("4");
    expect(valueFor("Suspended")).toBe("6");
  });

  it("debounces search, sends it to the server and returns to the first page", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Clinic 1");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Clinic 2");
    fetchFacilitiesMock.mockClear();

    await user.type(screen.getByLabelText("Search"), "kili");

    await waitFor(() =>
      expect(fetchFacilitiesMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, search: "kili" }))
    );
    // One request for the settled term, not one per keystroke.
    expect(fetchFacilitiesMock.mock.calls.filter(([params]) => params.search).length).toBe(1);
  });

  it("filters by status on the server and returns to the first page", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Clinic 1");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Clinic 2");

    await user.selectOptions(screen.getByRole("combobox"), "pending");

    await waitFor(() =>
      expect(fetchFacilitiesMock).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, status: "pending" }))
    );
  });

  it("hides the pager when everything fits on one page", async () => {
    fetchFacilitiesMock.mockResolvedValue(result(1, 1));
    renderPage();

    await screen.findByText("Clinic 1");
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  describe("fast-response option", () => {
    it("is offered to super-administrators in the create form, off by default", async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText("Clinic 1");

      await user.click(screen.getByRole("button", { name: /Add facility/ }));

      const option = await screen.findByLabelText(/Fast-response candidate/);
      expect(option).not.toBeChecked();
      await user.click(option);
      expect(option).toBeChecked();
      expect(screen.getByText(/Client-facing ranking remains disabled/)).toBeInTheDocument();
    });

    it("is not reachable for admin operations users, who cannot create facilities", async () => {
      hasRoleMock.mockImplementation((role: string) => role === "admin.ops");
      renderPage();
      await screen.findByText("Clinic 1");

      expect(screen.queryByRole("button", { name: /Add facility/ })).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Fast-response candidate/)).not.toBeInTheDocument();
    });
  });
});
