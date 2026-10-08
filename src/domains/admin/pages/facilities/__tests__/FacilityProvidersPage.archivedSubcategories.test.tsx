/**
 * Provider specialty assignment: only active, selectable subcategories are offered; an archived
 * one the provider still holds is named, blocks saving until removed, and a server rejection of
 * the same kind is explained specifically rather than as a generic failed save.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateProviderMock = vi.fn();

vi.mock("../../../../../shared/libs/facilities", () => ({
  fetchFacilities: vi.fn().mockResolvedValue({ facilities: [{ id: "facility-1", name: "Karen Hospital" }] }),
  fetchFacilityProviders: vi.fn(),
  fetchFacilityServices: vi.fn().mockResolvedValue([]),
  createFacilityProvider: vi.fn(),
  updateFacilityProvider: (...args: unknown[]) => updateProviderMock(...args),
  updateFacilityProviderLifecycle: vi.fn()
}));

vi.mock("../../../../../shared/libs/telemedicineCatalog", () => ({
  fetchTelemedicineAdminServices: vi.fn().mockResolvedValue([]),
  fetchSelectableTelemedicineSubcategories: vi.fn()
}));

import { fetchFacilityProviders } from "../../../../../shared/libs/facilities";
import { fetchSelectableTelemedicineSubcategories } from "../../../../../shared/libs/telemedicineCatalog";
import FacilityProvidersPage from "../FacilityProvidersPage";

const provider = {
  id: "p-1",
  userId: "u-1",
  user: { fullName: "Dr Amina", email: "amina@karen.test", phone: null, status: "active" },
  gender: null,
  verified: true,
  isAvailable: true,
  telemedicineEnabled: true,
  financialsVisible: null,
  services: [],
  compensation: { mode: "employee", fixedPayoutCents: null, payoutPercentage: null },
  telemedicineSubcategoryAssignments: [
    { id: "as-1", providerId: "p-1", facilityId: "facility-1", subcategoryId: "sub-live", status: "active", subcategory: { name: "Dermatology", status: "active" } },
    { id: "as-2", providerId: "p-1", facilityId: "facility-1", subcategoryId: "sub-old", status: "active", subcategory: { name: "Legacy cardiology", status: "archived" } }
  ]
};

const selectable = [
  { id: "sub-live", categoryId: "c1", key: "derm", name: "Dermatology", description: null, status: "active", displayOrder: 1, category: { id: "c1", name: "Skin", key: "skin", description: null, status: "active", displayOrder: 1 } },
  { id: "sub-new", categoryId: "c1", key: "ped", name: "Paediatrics", description: null, status: "active", displayOrder: 2, category: { id: "c1", name: "Skin", key: "skin", description: null, status: "active", displayOrder: 1 } }
];

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <FacilityProvidersPage />
    </QueryClientProvider>
  );

const openEdit = async () => {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: /^edit$/i }));
  return user;
};

describe("FacilityProvidersPage archived telemedicine subcategories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchFacilityProviders).mockResolvedValue({ providers: [provider] } as never);
    vi.mocked(fetchSelectableTelemedicineSubcategories).mockResolvedValue(selectable as never);
  });

  it("offers only the selectable specialties as checkboxes", async () => {
    renderPage();
    await openEdit();
    expect(await screen.findByLabelText("Paediatrics")).toBeInTheDocument();
    expect(screen.getByLabelText("Dermatology")).toBeChecked();
    expect(screen.queryByLabelText("Legacy cardiology")).not.toBeInTheDocument();
  });

  it("names a stale archived selection and blocks saving until it is removed", async () => {
    renderPage();
    const user = await openEdit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Archived specialties are still selected");
    expect(alert).toHaveTextContent("Legacy cardiology");
    expect(screen.getByRole("button", { name: /save provider/i })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /remove legacy cardiology/i }));
    await waitFor(() => expect(screen.queryByText("Archived specialties are still selected")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /save provider/i })).toBeEnabled();
  });

  it("never sends the stale id once it is removed, and keeps the live one", async () => {
    updateProviderMock.mockResolvedValue(provider);
    renderPage();
    const user = await openEdit();
    await user.click(await screen.findByRole("button", { name: /remove legacy cardiology/i }));
    await user.click(screen.getByRole("button", { name: /save provider/i }));

    await waitFor(() => expect(updateProviderMock).toHaveBeenCalled());
    expect(updateProviderMock.mock.calls[0][2].telemedicineSubcategoryIds).toEqual(["sub-live"]);
  });

  it("does not call a loading list a stale selection", async () => {
    vi.mocked(fetchSelectableTelemedicineSubcategories).mockReturnValue(new Promise(() => {}) as never);
    renderPage();
    await openEdit();
    expect(screen.queryByText("Archived specialties are still selected")).not.toBeInTheDocument();
  });

  it("explains a server rejection for an archived subcategory instead of a generic failure", async () => {
    updateProviderMock.mockRejectedValue(
      new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 400,
        statusText: "",
        headers: {},
        config: {} as never,
        data: { error: { code: 400, name: "BadRequest", message: "Every telemedicine subcategory must be active" } }
      })
    );
    vi.mocked(fetchSelectableTelemedicineSubcategories).mockResolvedValue(selectable as never);
    renderPage();
    const user = await openEdit();
    await user.click(await screen.findByRole("button", { name: /remove legacy cardiology/i }));
    await user.click(screen.getByRole("button", { name: /save provider/i }));

    expect(await screen.findByText(/archived since this form was opened/i)).toBeInTheDocument();
    expect(screen.queryByText("Unable to save provider")).not.toBeInTheDocument();
  });
});
