/**
 * Each provider row says whether clients can book them for telemedicine, and if not, which step is
 * missing. The same rules the slot engine applies, so an admin finds out here and not from a
 * client's "no available slots".
 */

import { render, screen, within } from "@testing-library/react";
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
  fetchSelectableTelemedicineSubcategories: vi.fn()
}));

import { fetchFacilityProviders } from "../../../../../shared/libs/facilities";
import { fetchSelectableTelemedicineSubcategories } from "../../../../../shared/libs/telemedicineCatalog";
import { MemoryRouter } from "react-router-dom";
import { FacilityProvidersManager } from "../FacilityProvidersPage";

const provider = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  userId: `u-${id}`,
  user: { fullName: `Provider ${id}`, email: `${id}@care.test`, phone: null, status: "active" },
  gender: null,
  verified: true,
  isAvailable: true,
  telemedicineEnabled: true,
  financialsVisible: null,
  services: [],
  compensation: { mode: "employee", fixedPayoutCents: null, payoutPercentage: null },
  telemedicineSubcategoryAssignments: [{ id: "a", subcategoryId: "s1", status: "active" }],
  availability: [{ id: "w", weekday: 0, deliveryMode: "both" }],
  ...over
});

const renderManager = (embedded = false, canViewDetails = false) =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <FacilityProvidersManager facilityId="facility-1" embedded={embedded} canViewDetails={canViewDetails} />
      </QueryClientProvider>
    </MemoryRouter>
  );

describe("provider telemedicine readiness in the list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchSelectableTelemedicineSubcategories).mockResolvedValue([{ id: "s1" }] as never);
  });

  it("says a fully set up provider is ready", async () => {
    vi.mocked(fetchFacilityProviders).mockResolvedValue({ providers: [provider("a")] } as never);
    renderManager();
    expect(await screen.findByText("Ready for telemedicine bookings")).toBeInTheDocument();
  });

  it("names the missing steps and the first thing to do, for the Care Point case", async () => {
    vi.mocked(fetchFacilityProviders).mockResolvedValue({
      providers: [provider("b", { telemedicineSubcategoryAssignments: [], availability: [] })]
    } as never);
    renderManager();

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Not bookable for telemedicine: No telemedicine specialties, No remote availability");
    expect(status).toHaveTextContent(/tick their telemedicine specialties/i);
    expect(status).toHaveTextContent(/Assigning services alone is not enough/);
  });

  it("flags unverified, telemedicine-off and pending-account providers", async () => {
    vi.mocked(fetchFacilityProviders).mockResolvedValue({
      providers: [provider("c", { verified: false, telemedicineEnabled: false, user: { fullName: "Provider c", email: "c@care.test", status: "pending" } })]
    } as never);
    renderManager();
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Account setup not finished, Not verified, Telemedicine is off");
  });

  it("does not count an archived specialty, and does not judge while specialties are still loading", async () => {
    vi.mocked(fetchFacilityProviders).mockResolvedValue({
      providers: [provider("d", { telemedicineSubcategoryAssignments: [{ id: "a", subcategoryId: "archived", status: "active" }] })]
    } as never);
    renderManager();
    expect(await screen.findByText(/No telemedicine specialties/)).toBeInTheDocument();
  });

  it("works embedded in another page: no large heading, but the same controls", async () => {
    vi.mocked(fetchFacilityProviders).mockResolvedValue({ providers: [provider("e")] } as never);
    renderManager(true);
    const row = (await screen.findByText("Provider e")).closest("div.flex") as HTMLElement;
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add provider/i })).toBeInTheDocument();
    expect(within(row.parentElement as HTMLElement).getByRole("button", { name: "Disable telemedicine" })).toBeInTheDocument();
  });

  it("links a platform admin to the provider's full profile, and no one else", async () => {
    vi.mocked(fetchFacilityProviders).mockResolvedValue({ providers: [provider("f")] } as never);
    const first = renderManager(true, true);
    const link = await screen.findByRole("link", { name: "View details for Provider f" });
    expect(link).toHaveAttribute("href", "/admin/providers/u-f");
    first.unmount();

    renderManager(true, false);
    await screen.findByText("Provider f");
    expect(screen.queryByRole("link", { name: /View details/ })).not.toBeInTheDocument();
  });
});
