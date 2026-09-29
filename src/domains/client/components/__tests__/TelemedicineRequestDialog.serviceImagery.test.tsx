/**
 * Service cards in the catalog step now carry a picture (or an icon when no artwork fits). This
 * pins that the pictures are decorative + fixed-size, that a failed image degrades to the icon,
 * that mental health has exactly the same visual weight as its neighbours, and that none of it
 * disturbs selection, filtering, search or the three catalog requests.
 */

import { fireEvent, render, screen, waitFor, cleanup, within } from "@testing-library/react";
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

const category = (id: string, key: string, name: string, displayOrder: number) => ({
  id,
  key,
  name,
  description: null,
  status: "active",
  displayOrder
});
const subcategory = (id: string, categoryId: string, key: string, name: string) => ({
  id,
  categoryId,
  key,
  name,
  description: null,
  status: "active",
  displayOrder: 0
});
const service = (id: string, subcategoryId: string, key: string, name: string) => ({
  id,
  subcategoryId,
  key,
  name,
  description: `${name} description`,
  basePriceCents: 100000,
  currency: "KES",
  defaultEstimateMinutes: 30,
  isEmergencyCapable: false,
  status: "active",
  tags: []
});

// Real stable keys from the approved catalog.
const CATEGORIES = [
  category("cat-first", "firstcare", "FirstCare", 0),
  category("cat-specialist", "specialistcare", "SpecialistCare", 1),
  category("cat-wellness", "wellnesscare", "WellnessCare", 2),
  category("cat-connect", "careconnect", "CareConnect", 3)
];
const SUBCATEGORIES = [
  subcategory("sub-gp", "cat-first", "general-practitioners", "General Practitioners"),
  subcategory("sub-paed", "cat-specialist", "paediatrics", "Paediatrics"),
  subcategory("sub-psych", "cat-wellness", "psychology-counselling", "Psychology and Counselling"),
  subcategory("sub-referral", "cat-connect", "hospital-referrals", "Hospital Referrals"),
  subcategory("sub-unknown", "cat-connect", "some-future-group", "Future Group")
];
const SERVICES = [
  service("svc-gp", "sub-gp", "first-medical-consultation", "First Medical Consultation"),
  service("svc-child", "sub-paed", "childrens-health-consultation", "Children's Health Consultation"),
  service("svc-mental", "sub-psych", "mental-health-assessment", "Mental Health Assessment"),
  service("svc-counsel", "sub-psych", "counselling-session", "Counselling Session"),
  service("svc-referral", "sub-referral", "hospital-referral-coordination", "Hospital Referral Coordination"),
  service("svc-future", "sub-unknown", "brand-new-service", "Brand New Service")
];

describe("TelemedicineRequestDialog service imagery", () => {
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

  const renderDialog = () =>
    render(
      <QueryClientProvider client={client}>
        <TelemedicineRequestDialog open onClose={vi.fn()} />
      </QueryClientProvider>
    );

  const card = (name: string) => {
    const button = screen.getByText(name).closest("button");
    if (!button) throw new Error(`Card for ${name} not found`);
    return button;
  };
  const visualOf = (name: string) => {
    const element = card(name).querySelector("[data-visual-source]");
    if (!element) throw new Error(`Visual for ${name} not found`);
    return element as HTMLElement;
  };

  it("renders a picture on cards whose service or specialty has supplied artwork", async () => {
    renderDialog();
    await screen.findByText("First Medical Consultation");

    expect(visualOf("First Medical Consultation")).toHaveAttribute("data-visual-source", "image");
    expect(visualOf("First Medical Consultation").querySelector("img")?.getAttribute("src")).toContain(
      "general-consultation"
    );
    expect(visualOf("Children's Health Consultation").querySelector("img")?.getAttribute("src")).toContain(
      "paediatric-consultation"
    );
    expect(visualOf("Mental Health Assessment").querySelector("img")?.getAttribute("src")).toContain(
      "mental-health-support"
    );
  });

  it("uses a neutral icon, never a picture, for referral services and unknown new services", async () => {
    renderDialog();
    await screen.findByText("Hospital Referral Coordination");

    for (const name of ["Hospital Referral Coordination", "Brand New Service"]) {
      expect(visualOf(name)).toHaveAttribute("data-visual-source", "icon");
      expect(card(name).querySelector("img")).toBeNull();
      expect(visualOf(name).querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("marks pictures decorative and gives them fixed dimensions so nothing shifts on load", async () => {
    renderDialog();
    await screen.findByText("First Medical Consultation");

    const image = visualOf("First Medical Consultation").querySelector("img") as HTMLImageElement;
    // The service name is right beside it, so the picture adds no information for a screen reader.
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveAttribute("width", "256");
    expect(image).toHaveAttribute("height", "256");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("decoding", "async");
    expect(image.className).toContain("aspect-square");
    expect(visualOf("First Medical Consultation").className).toMatch(/\bh-14\b.*\bw-14\b/);
  });

  it("keeps the visible name, description, price and duration next to the picture", async () => {
    renderDialog();
    await screen.findByText("Mental Health Assessment");

    const mental = within(card("Mental Health Assessment"));
    expect(mental.getByText("Mental Health Assessment")).toBeVisible();
    expect(mental.getByText("Mental Health Assessment description")).toBeVisible();
    expect(mental.getByText(/From/)).toBeVisible();
    expect(mental.getByText("30 min")).toBeVisible();
  });

  it("gives mental health exactly the same visual footprint as every other service", async () => {
    renderDialog();
    await screen.findByText("Mental Health Assessment");

    // The tint (bg-*) legitimately differs per specialty; size, shape and layout must not.
    const withoutTint = (className: string) => className.replace(/\bbg-[a-z]+-\d+\b/g, "").replace(/\s+/g, " ").trim();
    const mentalCard = card("Mental Health Assessment");
    const otherCard = card("First Medical Consultation");
    expect(mentalCard.className).toBe(otherCard.className);
    expect(withoutTint(visualOf("Mental Health Assessment").className)).toBe(
      withoutTint(visualOf("First Medical Consultation").className)
    );
    expect(withoutTint(visualOf("Counselling Session").className)).toBe(
      withoutTint(visualOf("First Medical Consultation").className)
    );
    expect(visualOf("Mental Health Assessment").querySelector("img")?.className).toBe(
      visualOf("First Medical Consultation").querySelector("img")?.className
    );
  });

  it("falls back to the icon when a picture fails to load, without disturbing the card", async () => {
    renderDialog();
    await screen.findByText("Mental Health Assessment");

    const image = visualOf("Mental Health Assessment").querySelector("img") as HTMLImageElement;
    fireEvent.error(image);

    await waitFor(() => expect(visualOf("Mental Health Assessment")).toHaveAttribute("data-visual-source", "icon"));
    expect(card("Mental Health Assessment").querySelector("img")).toBeNull();
    expect(screen.getByText("Mental Health Assessment")).toBeInTheDocument();
    // Other cards that share the same picture family keep theirs.
    expect(visualOf("Counselling Session")).toHaveAttribute("data-visual-source", "image");
  });

  it("still advances to the facility step from a card that has a picture", async () => {
    renderDialog();
    await screen.findByText("Mental Health Assessment");

    fireEvent.click(screen.getByText("Mental Health Assessment"));

    await screen.findByText("Facility");
    await screen.findByText("No facilities currently offer this service remotely in your country.");
  });

  it("still filters by category tile and by search with pictures present", async () => {
    renderDialog();
    await screen.findByText("First Medical Consultation");
    expect(document.querySelectorAll("img").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "WellnessCare" }));
    expect(screen.queryByText("First Medical Consultation")).not.toBeInTheDocument();
    expect(screen.getByText("Counselling Session")).toBeInTheDocument();
    expect(visualOf("Counselling Session")).toHaveAttribute("data-visual-source", "image");

    fireEvent.click(screen.getByRole("button", { name: "All services" }));
    fireEvent.change(screen.getByLabelText("Search consultations"), { target: { value: "counselling" } });
    await waitFor(() => expect(screen.queryByText("First Medical Consultation")).not.toBeInTheDocument());
    expect(screen.getByText("Counselling Session")).toBeInTheDocument();
  });

  it("does not make additional catalog requests because of images", async () => {
    renderDialog();
    await screen.findByText("Mental Health Assessment");

    fireEvent.error(visualOf("Mental Health Assessment").querySelector("img") as HTMLImageElement);
    fireEvent.click(screen.getByRole("button", { name: "WellnessCare" }));
    fireEvent.click(screen.getByRole("button", { name: "All services" }));

    expect(fetchCategoriesMock).toHaveBeenCalledTimes(1);
    expect(fetchSubcategoriesMock).toHaveBeenCalledTimes(1);
    expect(fetchCatalogServicesMock).toHaveBeenCalledTimes(1);
  });

  it("keeps category filter tiles compact and icon-led (no pictures in the tile row)", async () => {
    renderDialog();
    await screen.findByRole("button", { name: "FirstCare" });

    const group = screen.getByRole("group", { name: "Filter by care area" });
    expect(group.querySelector("img")).toBeNull();
    expect(group.querySelectorAll("svg").length).toBeGreaterThanOrEqual(5);
  });
});
