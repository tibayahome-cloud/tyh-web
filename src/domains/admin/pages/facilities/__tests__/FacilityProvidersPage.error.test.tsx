/**
 * A failed facilities/providers fetch used to fall through to whatever the next check produced:
 * "Your admin.ops account is not linked to exactly one facility" for a facilities-fetch error
 * (wrong diagnosis -- the account might be fine, the network wasn't), or a silently empty list
 * for a providers-fetch error. Both now render an explicit, retryable error banner instead.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";

const fetchFacilitiesMock = vi.fn();
const fetchFacilityProvidersMock = vi.fn();
const fetchFacilityServicesMock = vi.fn();

vi.mock("../../../../../shared/libs/facilities", () => ({
  fetchFacilities: (...args: unknown[]) => fetchFacilitiesMock(...args),
  fetchFacilityProviders: (...args: unknown[]) => fetchFacilityProvidersMock(...args),
  fetchFacilityServices: (...args: unknown[]) => fetchFacilityServicesMock(...args),
  createFacilityProvider: vi.fn(),
  updateFacilityProvider: vi.fn(),
  updateFacilityProviderLifecycle: vi.fn()
}));

vi.mock("../../../../../shared/libs/telemedicineCatalog", () => ({
  fetchTelemedicineAdminServices: vi.fn().mockResolvedValue([]),
  fetchTelemedicineSubcategories: vi.fn().mockResolvedValue([])
}));

import FacilityProvidersPage from "../FacilityProvidersPage";

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <FacilityProvidersPage />
    </QueryClientProvider>
  );
};

describe("FacilityProvidersPage error and empty states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchFacilityServicesMock.mockResolvedValue([]);
  });

  it("shows a retryable error banner when the facility scope lookup fails, not the linkage message", async () => {
    fetchFacilitiesMock.mockRejectedValue(new Error());
    renderPage();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/couldn't load your facility/i)).toBeInTheDocument();
    expect(screen.queryByText(/not linked to exactly one facility/i)).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(fetchFacilitiesMock).toHaveBeenCalledTimes(2));
  });

  it("shows a retryable error banner instead of a blank list when providers fail to load", async () => {
    fetchFacilitiesMock.mockResolvedValue({ facilities: [{ id: "facility-1", name: "Karen Hospital" }] });
    fetchFacilityProvidersMock.mockRejectedValue(new Error());
    renderPage();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/couldn't load providers/i)).toBeInTheDocument();
  });

  it("shows an empty-state message rather than a blank card when there are no providers", async () => {
    fetchFacilitiesMock.mockResolvedValue({ facilities: [{ id: "facility-1", name: "Karen Hospital" }] });
    fetchFacilityProvidersMock.mockResolvedValue({ providers: [] });
    renderPage();

    expect(await screen.findByText("No providers yet.")).toBeInTheDocument();
  });
});
