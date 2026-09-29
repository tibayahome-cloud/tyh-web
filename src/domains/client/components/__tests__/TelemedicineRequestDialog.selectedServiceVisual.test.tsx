/**
 * The confirm step reuses the catalog's service resolver for a small visual next to the chosen
 * service. It is derived from the three catalog queries the dialog already runs (keys only), so
 * it adds no request, and it only appears when the service was picked from that catalog.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const fetchCategoriesMock = vi.fn();
const fetchSubcategoriesMock = vi.fn();
const fetchCatalogServicesMock = vi.fn();

vi.mock("../../../../shared/libs/telemedicineCatalog", () => ({
  fetchTelemedicineCategories: (...args: unknown[]) => fetchCategoriesMock(...args),
  fetchTelemedicineSubcategories: (...args: unknown[]) => fetchSubcategoriesMock(...args),
  fetchTelemedicineCatalogServices: (...args: unknown[]) => fetchCatalogServicesMock(...args)
}));

vi.mock("../../../../shared/hooks/useTelemedicine", () => ({
  useAvailableSlots: () => ({
    data: { slots: [SLOT], timezone: "Africa/Nairobi" },
    isLoading: false,
    isError: false
  }),
  useRemoteFacilities: () => ({ data: [FACILITY], isLoading: false }),
  useTelemedicinePolicy: () => ({ data: { defaultTimezone: "Africa/Nairobi" } }),
  useCreateHoldMutation: () => ({ mutateAsync: () => Promise.resolve(HOLD), isPending: false }),
  useReleaseHoldMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useInitiateHoldPaymentMutation: () => ({ mutateAsync: vi.fn(), isPending: false, isSuccess: false }),
  useHoldQuery: () => ({ data: HOLD, isLoading: false })
}));

vi.mock("../../../../shared/hooks/useAuth", () => ({
  useAuth: () => ({ user: { phone: "+254700000001", countryCode: "KE" }, isAuthenticated: true })
}));

vi.mock("../../../../shared/components/ToastProvider", () => ({
  useToast: () => ({ showToast: vi.fn(), push: vi.fn() })
}));

import { TelemedicineRequestDialog } from "../TelemedicineRequestDialog";

const NAIROBI = "Africa/Nairobi";
const TODAY_IN_NAIROBI = new Intl.DateTimeFormat("en-CA", {
  timeZone: NAIROBI,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

const SLOT = {
  startAt: `${TODAY_IN_NAIROBI}T06:00:00Z`,
  endAt: `${TODAY_IN_NAIROBI}T06:30:00Z`,
  availableProviderCount: 2
};
const SLOT_LABEL = /09:00/;

const FACILITY = {
  id: "facility-1",
  name: "Kilimani Clinic",
  facilityType: "clinic",
  address: "Kilimani",
  county: "Nairobi",
  facilityServiceId: "facility-service-1",
  priceCents: 150000,
  currency: "KES",
  estimateDurationMinutes: 30,
  timezone: NAIROBI
};

const HOLD = {
  id: "hold-1",
  facilityId: FACILITY.id,
  facilityServiceId: FACILITY.facilityServiceId,
  startAt: SLOT.startAt,
  endAt: SLOT.endAt,
  status: "active",
  isActive: true,
  expiresAt: "2099-01-01T00:00:00Z",
  remainingSeconds: 600,
  bookingId: "booking-1",
  bookingStatus: "telemedicine_payment_pending",
  paymentPending: false
};

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
  { id: "cat-wellness", key: "wellnesscare", name: "WellnessCare", description: null, status: "active", displayOrder: 0 },
  { id: "cat-connect", key: "careconnect", name: "CareConnect", description: null, status: "active", displayOrder: 1 }
];
const SUBCATEGORIES = [
  { id: "sub-psych", categoryId: "cat-wellness", key: "psychology-counselling", name: "Psychology and Counselling", description: null, status: "active", displayOrder: 0 },
  { id: "sub-referral", categoryId: "cat-connect", key: "hospital-referrals", name: "Hospital Referrals", description: null, status: "active", displayOrder: 0 },
  { id: "sub-unknown", categoryId: "cat-connect", key: "some-future-group", name: "Future Group", description: null, status: "active", displayOrder: 1 }
];
const catalogService = (id: string, subcategoryId: string, key: string, name: string) => ({
  id,
  subcategoryId,
  key,
  name,
  description: null,
  basePriceCents: 100000,
  currency: "KES",
  defaultEstimateMinutes: 30,
  isEmergencyCapable: false,
  status: "active",
  tags: []
});
const SERVICES = [
  catalogService("svc-mental", "sub-psych", "mental-health-assessment", "Mental Health Assessment"),
  catalogService("svc-referral", "sub-referral", "hospital-referral-coordination", "Hospital Referral Coordination"),
  catalogService("svc-future", "sub-unknown", "brand-new-service", "Brand New Service")
];

const reachConfirmStep = async (user: ReturnType<typeof userEvent.setup>, serviceName: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TelemedicineRequestDialog open onClose={vi.fn()} />
    </QueryClientProvider>
  );
  await user.click(await screen.findByText(serviceName));
  await user.click(await screen.findByText(FACILITY.name));
  await user.click(await screen.findByRole("button", { name: /skip for now/i }));
  await user.click(await screen.findByRole("button", { name: SLOT_LABEL }));
  await screen.findByRole("button", { name: /confirm & pay/i });
};

describe("confirm step selected-service visual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchCategoriesMock.mockResolvedValue(CATEGORIES);
    fetchSubcategoriesMock.mockResolvedValue(SUBCATEGORIES);
    fetchCatalogServicesMock.mockResolvedValue(SERVICES);
  });

  it("shows the service's picture beside its name, without a new request", async () => {
    const user = userEvent.setup();
    await reachConfirmStep(user, "Mental Health Assessment");

    const name = screen.getByText("Mental Health Assessment");
    const summary = name.closest(".rounded-2xl") as HTMLElement;
    const visual = summary.querySelector("[data-visual-source]") as HTMLElement;
    expect(visual).toHaveAttribute("data-visual-source", "image");
    expect(visual.querySelector("img")?.getAttribute("src")).toContain("mental-health-support");
    expect(visual.querySelector("img")).toHaveAttribute("alt", "");
    expect(screen.getByText(FACILITY.name)).toBeInTheDocument();

    expect(fetchCategoriesMock).toHaveBeenCalledTimes(1);
    expect(fetchSubcategoriesMock).toHaveBeenCalledTimes(1);
    expect(fetchCatalogServicesMock).toHaveBeenCalledTimes(1);
  });

  it("shows the non-emergency care-navigation picture for a referral service", async () => {
    const user = userEvent.setup();
    await reachConfirmStep(user, "Hospital Referral Coordination");

    const summary = screen.getByText("Hospital Referral Coordination").closest(".rounded-2xl") as HTMLElement;
    expect(summary.querySelector("[data-visual-source]")).toHaveAttribute("data-visual-source", "image");
    expect(summary.querySelector("img")?.getAttribute("src")).toContain("care-navigation");
  });

  it("shows a neutral icon, not a picture, for a service added to the catalog later", async () => {
    const user = userEvent.setup();
    await reachConfirmStep(user, "Brand New Service");

    const summary = screen.getByText("Brand New Service").closest(".rounded-2xl") as HTMLElement;
    expect(summary.querySelector("[data-visual-source]")).toHaveAttribute("data-visual-source", "icon");
    expect(summary.querySelector("img")).toBeNull();
  });
});
