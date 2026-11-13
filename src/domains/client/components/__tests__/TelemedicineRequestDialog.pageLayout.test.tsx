/**
 * The booking as a page.
 *
 * A visitor who taps "Talk to a doctor" used to land on an almost empty page with the booking opened over it as a popup.
 * With layout="page" the same steps are the page itself: no popup, no close button, a heading on every step that says what
 * to do, and a first screen that leads with the choice. The popup layout is still what a client inside the app gets, so
 * its own tests (and the contrast test at the end) keep covering it.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type TestUser = { phone: string; countryCode: string | null };

const { auth, scrollTo, fetchCategoriesMock, fetchSubcategoriesMock, fetchCatalogServicesMock } = vi.hoisted(() => ({
  auth: { user: null as TestUser | null },
  scrollTo: vi.fn(),
  fetchCategoriesMock: vi.fn(),
  fetchSubcategoriesMock: vi.fn(),
  fetchCatalogServicesMock: vi.fn()
}));

vi.mock("../../../../shared/libs/telemedicineCatalog", () => ({
  fetchTelemedicineCategories: (...args: unknown[]) => fetchCategoriesMock(...args),
  fetchTelemedicineSubcategories: (...args: unknown[]) => fetchSubcategoriesMock(...args),
  fetchTelemedicineCatalogServices: (...args: unknown[]) => fetchCatalogServicesMock(...args)
}));

const NAIROBI = "Africa/Nairobi";
const TODAY_IN_NAIROBI = new Intl.DateTimeFormat("en-CA", {
  timeZone: NAIROBI,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

const SLOT = { startAt: `${TODAY_IN_NAIROBI}T06:00:00Z`, endAt: `${TODAY_IN_NAIROBI}T06:30:00Z`, availableProviderCount: 0 };
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
  timezone: "Africa/Nairobi"
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
  bookingId: null,
  bookingStatus: null,
  paymentPending: false
};

vi.mock("../../../../shared/hooks/useTelemedicine", () => ({
  useAvailableSlots: () => ({ data: { slots: [SLOT], timezone: "Africa/Nairobi" }, isLoading: false, isError: false }),
  useRemoteFacilities: () => ({ data: [FACILITY], isLoading: false }),
  useTelemedicinePolicy: () => ({ data: { defaultTimezone: "Africa/Nairobi", cancellationCutoffMinutes: 10 } }),
  useCreateHoldMutation: () => ({ mutateAsync: () => Promise.resolve(HOLD), isPending: false }),
  useReleaseHoldMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useInitiateHoldPaymentMutation: () => ({ mutateAsync: vi.fn(), isPending: false, isSuccess: false }),
  useHoldQuery: () => ({ data: HOLD, isLoading: false })
}));

vi.mock("../../../../shared/hooks/useAuth", () => ({
  useAuth: () => ({ user: auth.user, isAuthenticated: Boolean(auth.user) })
}));

vi.mock("../../../../shared/components/ToastProvider", () => ({
  useToast: () => ({ showToast: vi.fn(), push: vi.fn() })
}));

vi.mock("../BookingAccountStep", () => ({
  BookingAccountStep: () => <h2>Your details</h2>
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
  { id: "cat-first", key: "firstcare", name: "FirstCare", description: "First point of care", status: "active", displayOrder: 0 },
  { id: "cat-specialist", key: "specialistcare", name: "SpecialistCare", description: null, status: "active", displayOrder: 1 }
];
const SUBCATEGORIES = [
  { id: "sub-gp", categoryId: "cat-first", key: "general-practitioners", name: "General Practitioners", description: null, status: "active", displayOrder: 0 },
  { id: "sub-cardio", categoryId: "cat-specialist", key: "cardiology", name: "Cardiology", description: null, status: "active", displayOrder: 0 }
];
const SERVICES = [
  {
    id: "svc-gp-1",
    subcategoryId: "sub-gp",
    key: "gp-video",
    name: "GP Video Consultation",
    description: "Routine video consultation",
    basePriceCents: 250000,
    currency: "KES",
    defaultEstimateMinutes: 30,
    isEmergencyCapable: false,
    status: "active",
    tags: []
  },
  {
    id: "svc-cardio-1",
    subcategoryId: "sub-cardio",
    key: "cardio-review",
    name: "Cardiology Report Review",
    description: "Heart health consultation",
    basePriceCents: 500000,
    currency: "KES",
    defaultEstimateMinutes: 45,
    isEmergencyCapable: false,
    status: "active",
    tags: []
  }
];

const SIGNED_IN: TestUser = { phone: "+254700000001", countryCode: "KE" };

beforeEach(() => {
  auth.user = null;
  scrollTo.mockClear();
  Object.defineProperty(window, "scrollTo", { value: scrollTo, writable: true, configurable: true });
  fetchCategoriesMock.mockReset().mockResolvedValue(CATEGORIES);
  fetchSubcategoriesMock.mockReset().mockResolvedValue(SUBCATEGORIES);
  fetchCatalogServicesMock.mockReset().mockResolvedValue(SERVICES);
});

const renderBooking = (layout: "page" | "dialog" = "page") => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TelemedicineRequestDialog open onClose={vi.fn()} layout={layout} />
    </QueryClientProvider>
  );
};

const stepTitles = async () => {
  const list = await screen.findByRole("list");
  return Array.from(list.querySelectorAll("li p.font-semibold")).map((node) => node.textContent);
};

describe("the booking as a page", () => {
  it("is the page itself: no popup, no close button, one page heading", async () => {
    renderBooking();

    expect(await screen.findByRole("heading", { level: 1, name: "Talk to a doctor online" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /close/i })).not.toBeInTheDocument();
    // The page does not take focus when it opens: nothing has been asked of the person yet.
    expect(document.body).toHaveFocus();
  });

  it("names the steps in a visitor's words, without descriptions that wrap in a narrow column", async () => {
    renderBooking();

    expect(await stepTitles()).toEqual(["Consultation", "Clinic", "Time", "Details", "Pay"]);
    expect(screen.queryByText("What kind of consultation?")).not.toBeInTheDocument();
    expect(screen.getByText("Step 1 of 5: Consultation")).toBeInTheDocument();
  });

  it("shows a signed-in client four steps, with no Details", async () => {
    auth.user = SIGNED_IN;
    renderBooking();

    expect(await stepTitles()).toEqual(["Consultation", "Clinic", "Time", "Pay"]);
  });

  it("leads with the choice, and tells a visitor that details come only after a time", async () => {
    renderBooking();

    expect(await screen.findByRole("heading", { level: 2, name: "Choose a consultation" })).toBeInTheDocument();
    expect(screen.getByText(/You give your details only after choosing a time\./)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /GP Video Consultation/ })).toBeInTheDocument();
  });

  it("tells a signed-in client what comes next instead, since they give no details", async () => {
    auth.user = SIGNED_IN;
    renderBooking();

    expect(await screen.findByText("Next you pick a clinic and a time, then pay with M-Pesa.")).toBeInTheDocument();
    expect(screen.queryByText(/give your details/i)).not.toBeInTheDocument();
  });

  it("gives the search a name but no label of its own, since the heading says what the screen is for", async () => {
    renderBooking();

    expect(await screen.findByRole("searchbox", { name: "Search consultations" })).toBeInTheDocument();
    expect(screen.queryByText("Search consultations")).not.toBeInTheDocument();
  });

  it("offers the care areas as one group of toggle buttons and filters by the one chosen", async () => {
    const user = userEvent.setup();
    renderBooking();
    const group = await screen.findByRole("group", { name: "Filter by care area" });
    expect(within(group).getByRole("button", { name: "All services" })).toHaveAttribute("aria-pressed", "true");

    await user.click(within(group).getByRole("button", { name: "SpecialistCare" }));

    expect(within(group).getByRole("button", { name: "SpecialistCare" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Cardiology Report Review/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /GP Video Consultation/ })).not.toBeInTheDocument();
  });

  it("shows each care area as one flat group: a heading, then its consultations as the only cards", async () => {
    renderBooking();
    const heading = await screen.findByRole("heading", { level: 3, name: "FirstCare" });

    const section = heading.closest("section") as HTMLElement;
    expect(section).not.toHaveClass("border");
    expect(section).not.toHaveClass("shadow-sm");
    expect(within(section).getByRole("heading", { level: 4, name: "General Practitioners" })).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: /GP Video Consultation/ })).toBeInTheDocument();
  });

  it("gives a way back when nothing matches, and the way back works", async () => {
    const user = userEvent.setup();
    renderBooking();
    await user.type(await screen.findByRole("searchbox", { name: "Search consultations" }), "zzzz");

    expect(screen.getByText("No consultations match your search or filter.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show all consultations" }));

    expect(screen.getByRole("searchbox", { name: "Search consultations" })).toHaveValue("");
    expect(await screen.findByRole("button", { name: /GP Video Consultation/ })).toBeInTheDocument();
  });
});

describe("the first screen while loading and when loading fails", () => {
  it("shows a placeholder shaped like the catalogue while it loads, then replaces it", async () => {
    let finish: (value: typeof CATEGORIES) => void = () => undefined;
    fetchCategoriesMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderBooking();

    expect(await screen.findByText("Loading consultations")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Choose a consultation" })).not.toBeInTheDocument();

    finish(CATEGORIES);

    expect(await screen.findByRole("heading", { name: "Choose a consultation" })).toBeInTheDocument();
    expect(screen.queryByText("Loading consultations")).not.toBeInTheDocument();
  });

  it("says that loading failed, and does not claim nothing is available", async () => {
    fetchCategoriesMock.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));
    renderBooking();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We could not reach the server. Check your connection and try again.");
    expect(screen.queryByText(/No remote consultations are available/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Choose a consultation" })).not.toBeInTheDocument();
  });

  it("tries again on request, asking only for what failed", async () => {
    fetchCategoriesMock.mockRejectedValueOnce(new AxiosError("Network Error", "ERR_NETWORK"));
    const user = userEvent.setup();
    renderBooking();

    await user.click(await screen.findByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { name: "Choose a consultation" })).toBeInTheDocument();
    expect(fetchCategoriesMock).toHaveBeenCalledTimes(2);
    expect(fetchSubcategoriesMock).toHaveBeenCalledTimes(1);
    expect(fetchCatalogServicesMock).toHaveBeenCalledTimes(1);
  });

  it("still says so plainly when the catalogue loads but is empty", async () => {
    fetchCategoriesMock.mockResolvedValue([]);
    fetchSubcategoriesMock.mockResolvedValue([]);
    fetchCatalogServicesMock.mockResolvedValue([]);
    renderBooking();

    expect(await screen.findByText("No remote consultations are available right now.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("moving between steps on the page", () => {
  it("takes the person back to the top and tells a screen reader which step they are on", async () => {
    const user = userEvent.setup();
    auth.user = SIGNED_IN;
    renderBooking();
    await user.click(await screen.findByRole("button", { name: /Cardiology Report Review/ }));

    expect(await screen.findByRole("heading", { level: 2, name: "Choose a clinic" })).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
    expect(screen.getByRole("region", { name: "Step 2 of 4: Clinic" })).toHaveFocus();
  });

  it("gives every step a heading that says what to do", async () => {
    const user = userEvent.setup();
    auth.user = SIGNED_IN;
    renderBooking();
    await user.click(await screen.findByRole("button", { name: /GP Video Consultation/ }));
    await screen.findByRole("heading", { name: "Choose a clinic" });

    await user.click(await screen.findByText(FACILITY.name));
    expect(await screen.findByRole("heading", { name: "Pick a time" })).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /09:00/ }));
    expect(await screen.findByRole("heading", { name: "Review and pay" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Step 4 of 4: Pay" })).toHaveFocus();
  });

  it("gives a visitor's Details step the same kind of heading, between Time and Pay", async () => {
    const user = userEvent.setup();
    renderBooking();
    await user.click(await screen.findByRole("button", { name: /GP Video Consultation/ }));
    await user.click(await screen.findByText(FACILITY.name));
    await user.click(await screen.findByRole("button", { name: /09:00/ }));

    expect(await screen.findByRole("heading", { level: 2, name: "Your details" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("region", { name: "Step 4 of 5: Details" })).toHaveFocus());
  });
});

describe("the popup layout, which is what a client inside the app still gets", () => {
  it("stays a popup with its own title and the original step names", async () => {
    auth.user = SIGNED_IN;
    renderBooking("dialog");

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Talk to a doctor online" })).not.toBeInTheDocument();
    expect(await stepTitles()).toEqual(["Service", "Facility", "Slot", "Confirm"]);
    expect(screen.getByText("What kind of consultation?")).toBeInTheDocument();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
