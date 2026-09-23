/**
 * The telemedicine category/subcategory/service catalog had no staleTime at all (default 0),
 * unlike the neighboring policy query which explicitly caches for 5 minutes because the catalog
 * "changes about as rarely as the policy does." Every dialog reopen within the same session
 * silently refetched all three in the background even though nothing had changed. This proves
 * a close-then-reopen within the stale window does not refetch.
 */

import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const fetchCategoriesMock = vi.fn();
const fetchSubcategoriesMock = vi.fn();
const fetchCatalogServicesMock = vi.fn();

vi.mock("../../../../shared/libs/telemedicineCatalog", () => ({
  fetchTelemedicineCategories: (...args: unknown[]) => fetchCategoriesMock(...args),
  fetchTelemedicineSubcategories: (...args: unknown[]) => fetchSubcategoriesMock(...args),
  fetchTelemedicineCatalogServices: (...args: unknown[]) => fetchCatalogServicesMock(...args)
}));

vi.mock("../../../../shared/hooks/useTelemedicine", () => ({
  useAvailableSlots: () => ({ data: undefined, isLoading: false, isError: false }),
  useRemoteFacilities: () => ({ data: [], isLoading: false }),
  useRemoteServiceOptions: () => ({ data: [], isLoading: false }),
  useTelemedicinePolicy: () => ({ data: { defaultTimezone: "Africa/Nairobi" } }),
  useCreateHoldMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReleaseHoldMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useInitiateHoldPaymentMutation: () => ({ mutateAsync: vi.fn(), isPending: false, isSuccess: false }),
  useHoldQuery: () => ({ data: undefined, isLoading: false })
}));

vi.mock("../../../../shared/hooks/useAuth", () => ({
  useAuth: () => ({ user: { phone: "+254700000001", countryCode: "KE" }, isAuthenticated: true })
}));

vi.mock("../../../../shared/components/ToastProvider", () => ({
  useToast: () => ({ showToast: vi.fn(), push: vi.fn() })
}));

import { TelemedicineRequestDialog } from "../TelemedicineRequestDialog";

class NoopIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

beforeAll(() => {
  vi.stubGlobal("IntersectionObserver", NoopIntersectionObserver);
});

describe("TelemedicineRequestDialog catalog caching", () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchCategoriesMock.mockResolvedValue([{ id: "cat-1", name: "General" }]);
    fetchSubcategoriesMock.mockResolvedValue([]);
    fetchCatalogServicesMock.mockResolvedValue([]);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    cleanup();
  });

  const renderDialog = (onClose: () => void) =>
    render(
      <QueryClientProvider client={client}>
        <TelemedicineRequestDialog open onClose={onClose} />
      </QueryClientProvider>
    );

  it("fetches the catalog once on first open", async () => {
    renderDialog(vi.fn());

    await waitFor(() => expect(fetchCategoriesMock).toHaveBeenCalledTimes(1));
    expect(fetchSubcategoriesMock).toHaveBeenCalledTimes(1);
    expect(fetchCatalogServicesMock).toHaveBeenCalledTimes(1);
  });

  it("does not refetch the catalog on close-then-reopen within the stale window", async () => {
    const { unmount } = renderDialog(vi.fn());
    await waitFor(() => expect(fetchCategoriesMock).toHaveBeenCalledTimes(1));

    // Simulate closing the dialog (unmount) and reopening it moments later, sharing the same
    // QueryClient -- exactly what happens across two opens of the same modal in one session.
    unmount();
    renderDialog(vi.fn());

    await screen.findByText("General");
    expect(fetchCategoriesMock).toHaveBeenCalledTimes(1);
    expect(fetchSubcategoriesMock).toHaveBeenCalledTimes(1);
    expect(fetchCatalogServicesMock).toHaveBeenCalledTimes(1);
  });
});
