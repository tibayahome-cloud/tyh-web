/**
 * The provider list showed "Account pending" and an Activate button for every provider, because
 * the request did not ask for the user's status and the page filled in "pending". It now shows the
 * real status when it has one, and nothing when it does not.
 */

import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../shared/libs/facilities", () => ({
  fetchFacilities: vi.fn().mockResolvedValue({ facilities: [{ id: "facility-1", name: "Care Point" }] }),
  fetchFacilityProviders: vi.fn(),
  fetchFacilityServices: vi.fn().mockResolvedValue([]),
  createFacilityProvider: vi.fn(),
  updateFacilityProvider: vi.fn(),
  updateFacilityProviderLifecycle: vi.fn()
}));
vi.mock("../../../../../shared/libs/telemedicineCatalog", () => ({
  fetchTelemedicineAdminServices: vi.fn().mockResolvedValue([]),
  fetchSelectableTelemedicineSubcategories: vi.fn().mockResolvedValue([])
}));

import { fetchFacilityProviders } from "../../../../../shared/libs/facilities";
import FacilityProvidersPage from "../FacilityProvidersPage";

const provider = (id: string, status?: string) => ({
  id,
  userId: `u-${id}`,
  user: { fullName: `Provider ${id}`, email: `${id}@care.test`, phone: null, ...(status ? { status } : {}) },
  gender: null,
  verified: true,
  isAvailable: true,
  telemedicineEnabled: true,
  financialsVisible: null,
  services: [],
  compensation: { mode: "employee", fixedPayoutCents: null, payoutPercentage: null },
  telemedicineSubcategoryAssignments: []
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <FacilityProvidersPage />
    </QueryClientProvider>
  );

describe("FacilityProvidersPage account status", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the real account status, and Activate only for an account that is not active", async () => {
    vi.mocked(fetchFacilityProviders).mockResolvedValue({
      providers: [provider("a", "active"), provider("b", "pending")]
    } as never);
    renderPage();

    expect(await screen.findByText("Account active")).toBeInTheDocument();
    expect(screen.getByText("Account pending")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Activate" })).toHaveLength(1);
  });

  it("does not claim 'Account pending' or offer Activate when the status is unknown", async () => {
    vi.mocked(fetchFacilityProviders).mockResolvedValue({ providers: [provider("c")] } as never);
    renderPage();

    await screen.findByText("Provider c");
    expect(screen.queryByText(/^Account /)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activate" })).not.toBeInTheDocument();
  });
});
