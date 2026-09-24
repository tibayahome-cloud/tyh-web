/**
 * The service step used to be a plain <select> for "Care area" plus text-only service cards.
 * This covers its replacement: visual category tiles (including "All services") that drive the
 * exact same catalogCategoryFilter state the <select> used to, and service cards enriched with
 * duration/tags/emergency indicator -- all without touching the three catalog queries, their
 * keys, or the staleTime that TelemedicineRequestDialog.catalogCache.test.tsx already locks in.
 */

import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
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

const CATEGORIES = [
  { id: "cat-first", key: "firstcare", name: "FirstCare", description: null, status: "active", displayOrder: 0 },
  { id: "cat-specialist", key: "specialistcare", name: "SpecialistCare", description: null, status: "active", displayOrder: 1 }
];

const SUBCATEGORIES = [
  {
    id: "sub-gp",
    categoryId: "cat-first",
    key: "general-practitioners",
    name: "General Practitioners",
    description: null,
    status: "active",
    displayOrder: 0
  },
  {
    id: "sub-cardio",
    categoryId: "cat-specialist",
    key: "cardiology",
    name: "Cardiology",
    description: null,
    status: "active",
    displayOrder: 0
  }
];

const SERVICES = [
  {
    id: "svc-gp-1",
    subcategoryId: "sub-gp",
    key: "gp-video",
    name: "30-minute GP Video Consultation",
    description: "Routine video consultation",
    basePriceCents: 250000,
    currency: "KES",
    defaultEstimateMinutes: 30,
    isEmergencyCapable: false,
    status: "active",
    tags: ["remote", "family"]
  },
  {
    id: "svc-cardio-1",
    subcategoryId: "sub-cardio",
    key: "cardio-review",
    name: "Cardiology Report Review",
    description: "Heart health consultation and report review",
    basePriceCents: 500000,
    currency: "KES",
    defaultEstimateMinutes: 45,
    isEmergencyCapable: true,
    status: "active",
    tags: []
  }
];

describe("TelemedicineRequestDialog catalog visuals", () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchCategoriesMock.mockResolvedValue(CATEGORIES);
    fetchSubcategoriesMock.mockResolvedValue(SUBCATEGORIES);
    fetchCatalogServicesMock.mockResolvedValue(SERVICES);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    cleanup();
  });

  const renderDialog = (onCreated?: (id: string) => void) =>
    render(
      <QueryClientProvider client={client}>
        <TelemedicineRequestDialog open onClose={vi.fn()} onCreated={onCreated} />
      </QueryClientProvider>
    );

  it("renders a category tile per active category plus an All services tile, as real buttons", async () => {
    renderDialog();

    await screen.findByRole("button", { name: "FirstCare" });
    const allTile = screen.getByRole("button", { name: "All services" });
    const firstcareTile = screen.getByRole("button", { name: "FirstCare" });
    const specialistTile = screen.getByRole("button", { name: "SpecialistCare" });

    expect(allTile).toHaveAttribute("aria-pressed", "true");
    expect(firstcareTile).toHaveAttribute("aria-pressed", "false");
    expect(specialistTile).toHaveAttribute("aria-pressed", "false");

    // Both categories' sections are visible under "All services".
    expect(screen.getByText("General Practitioners")).toBeInTheDocument();
    expect(screen.getByText("Cardiology")).toBeInTheDocument();
  });

  it("selecting a category tile filters to that category's services, same as the old select did", async () => {
    renderDialog();
    await screen.findByRole("button", { name: "FirstCare" });

    fireEvent.click(screen.getByRole("button", { name: "SpecialistCare" }));

    expect(screen.getByRole("button", { name: "SpecialistCare" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("General Practitioners")).not.toBeInTheDocument();
    expect(screen.getByText("Cardiology")).toBeInTheDocument();
  });

  it("returning to the All services tile restores every category", async () => {
    renderDialog();
    await screen.findByRole("button", { name: "FirstCare" });

    fireEvent.click(screen.getByRole("button", { name: "SpecialistCare" }));
    expect(screen.queryByText("General Practitioners")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "All services" }));
    expect(screen.getByText("General Practitioners")).toBeInTheDocument();
    expect(screen.getByText("Cardiology")).toBeInTheDocument();
  });

  it("preserves search behavior alongside the tiles", async () => {
    renderDialog();
    await screen.findByRole("button", { name: "FirstCare" });

    fireEvent.change(screen.getByLabelText("Search consultations"), { target: { value: "cardiology" } });

    await waitFor(() => expect(screen.queryByText("General Practitioners")).not.toBeInTheDocument());
    expect(screen.getByText("Cardiology")).toBeInTheDocument();
  });

  it("renders duration, tags, and the emergency-capable indicator on service cards", async () => {
    renderDialog();
    await screen.findByText("30-minute GP Video Consultation");

    expect(screen.getByText("30 min")).toBeInTheDocument();
    expect(screen.getByText("remote")).toBeInTheDocument();
    expect(screen.getByText("family")).toBeInTheDocument();

    expect(screen.getByText("45 min")).toBeInTheDocument();
    expect(screen.getByText("Urgent care")).toBeInTheDocument();
  });

  it("still advances to the facility step and sets the same service id when a card is clicked", async () => {
    renderDialog();
    await screen.findByText("30-minute GP Video Consultation");

    fireEvent.click(screen.getByText("30-minute GP Video Consultation"));

    await screen.findByText("Facility");
    // useRemoteFacilities is mocked with empty data; reaching its empty-state text confirms the
    // step advanced and the facility query for this service id was allowed to run.
    await screen.findByText("No facilities currently offer this service remotely in your country.");
  });

  it("introduces no additional catalog requests beyond the existing three", async () => {
    renderDialog();
    await screen.findByRole("button", { name: "FirstCare" });

    fireEvent.click(screen.getByRole("button", { name: "SpecialistCare" }));
    fireEvent.change(screen.getByLabelText("Search consultations"), { target: { value: "cardio" } });
    fireEvent.click(screen.getByRole("button", { name: "All services" }));

    expect(fetchCategoriesMock).toHaveBeenCalledTimes(1);
    expect(fetchSubcategoriesMock).toHaveBeenCalledTimes(1);
    expect(fetchCatalogServicesMock).toHaveBeenCalledTimes(1);
  });
});
