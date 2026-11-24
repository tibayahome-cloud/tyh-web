/**
 * A tile or card on the site can say what the visitor already chose: a care area (the list opens filtered to it) or one
 * service (the booking opens at choosing a clinic). A key that is not in the catalogue changes nothing.
 */

import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const fetchCategoriesMock = vi.fn();
const fetchSubcategoriesMock = vi.fn();
const fetchCatalogServicesMock = vi.fn();
const facilities = vi.hoisted(() => ({ serviceIds: [] as Array<string | null> }));

vi.mock("../../../../shared/libs/telemedicineCatalog", () => ({
  fetchTelemedicineCategories: (...args: unknown[]) => fetchCategoriesMock(...args),
  fetchTelemedicineSubcategories: (...args: unknown[]) => fetchSubcategoriesMock(...args),
  fetchTelemedicineCatalogServices: (...args: unknown[]) => fetchCatalogServicesMock(...args)
}));

vi.mock("../../../../shared/hooks/useTelemedicine", () => ({
  useAvailableSlots: () => ({ data: undefined, isLoading: false, isError: false }),
  useRemoteFacilities: (serviceId: string | null) => {
    facilities.serviceIds.push(serviceId);
    return { data: [], isLoading: false };
  },
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

const CATEGORIES = [
  { id: "cat-first", key: "firstcare", name: "FirstCare", description: null, status: "active", displayOrder: 0 },
  { id: "cat-specialist", key: "specialistcare", name: "SpecialistCare", description: null, status: "active", displayOrder: 1 }
];
const SUBCATEGORIES = [
  { id: "sub-gp", categoryId: "cat-first", key: "general-practitioners", name: "General Practitioners", description: null, status: "active", displayOrder: 0 },
  { id: "sub-cardio", categoryId: "cat-specialist", key: "cardiology", name: "Cardiology", description: null, status: "active", displayOrder: 0 }
];
const service = (id: string, subcategoryId: string, key: string, name: string) => ({
  id, subcategoryId, key, name, description: null, basePriceCents: 100000, currency: "KES", defaultEstimateMinutes: 30,
  isEmergencyCapable: false, status: "active", tags: []
});
const SERVICES = [
  service("svc-gp", "sub-gp", "first-medical-consultation", "First Video Doctor Consultation"),
  service("svc-cardio", "sub-cardio", "cardio-review", "Cardiology Report Review")
];

describe("TelemedicineRequestDialog with a choice made before it opened", () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    facilities.serviceIds = [];
    fetchCategoriesMock.mockResolvedValue(CATEGORIES);
    fetchSubcategoriesMock.mockResolvedValue(SUBCATEGORIES);
    fetchCatalogServicesMock.mockResolvedValue(SERVICES);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => cleanup());

  const renderDialog = (props: { categoryKey?: string | null; serviceKey?: string | null }) =>
    render(
      <QueryClientProvider client={client}>
        <TelemedicineRequestDialog open onClose={vi.fn()} {...props} />
      </QueryClientProvider>
    );

  it("opens the list filtered to a care area", async () => {
    renderDialog({ categoryKey: "specialistcare" });

    await waitFor(() => expect(screen.getByRole("button", { name: "SpecialistCare" })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.queryByText("General Practitioners")).not.toBeInTheDocument();
    expect(screen.getByText("Cardiology")).toBeInTheDocument();
  });

  it("goes straight to choosing a clinic for a service", async () => {
    renderDialog({ serviceKey: "first-medical-consultation" });

    await waitFor(() => expect(facilities.serviceIds).toContain("svc-gp"));
    expect(screen.queryByRole("button", { name: "All services" })).not.toBeInTheDocument();
  });

  it("shows the whole list when the care area is not in the catalogue", async () => {
    renderDialog({ categoryKey: "no-such-area" });

    await screen.findByRole("button", { name: "FirstCare" });
    expect(screen.getByRole("button", { name: "All services" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("General Practitioners")).toBeInTheDocument();
    expect(screen.getByText("Cardiology")).toBeInTheDocument();
  });

  it("shows the whole list when the service is not in the catalogue", async () => {
    renderDialog({ serviceKey: "no-such-service" });

    await screen.findByRole("button", { name: "FirstCare" });
    expect(screen.getByRole("button", { name: "All services" })).toHaveAttribute("aria-pressed", "true");
    expect(facilities.serviceIds.every((id) => id === null)).toBe(true);
  });
});
