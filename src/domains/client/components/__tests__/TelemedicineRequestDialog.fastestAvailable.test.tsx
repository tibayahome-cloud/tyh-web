/**
 * "Fastest available" sits beside the manual facility list. It asks the API for the earliest-slot
 * ranking only when chosen, picks the facility with the earliest open time, and offers that time
 * on the slot step. The manual list, its order and the hold request are unchanged.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const discoverRemoteFacilitiesMock = vi.fn();
const useRemoteFacilitiesMock = vi.fn();
const useAvailableSlotsMock = vi.fn();
const createHoldMock = vi.fn();

vi.mock("../../../../shared/libs/telemedicine", () => ({
  discoverRemoteFacilities: (...args: unknown[]) => discoverRemoteFacilitiesMock(...args)
}));

vi.mock("../../../../shared/hooks/useTelemedicine", () => ({
  useAvailableSlots: (...args: unknown[]) => useAvailableSlotsMock(...args),
  useRemoteFacilities: (...args: unknown[]) => useRemoteFacilitiesMock(...args),
  useTelemedicinePolicy: () => ({ data: { defaultTimezone: "Africa/Nairobi" } }),
  useCreateHoldMutation: () => ({ mutateAsync: (...args: unknown[]) => createHoldMock(...args), isPending: false }),
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
import { formatTelemedicineDateTime } from "../../../../shared/utils/telemedicine";

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

const TZ = "Africa/Nairobi";
// Fixed times on today's facility-local calendar (Nairobi is UTC+3, no daylight saving), so the
// slots always fall on the day the picker opens on, whatever time the suite runs.
const TODAY_IN_NAIROBI = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const EARLY = new Date(`${TODAY_IN_NAIROBI}T09:00:00+03:00`);
const LATER = new Date(`${TODAY_IN_NAIROBI}T15:00:00+03:00`);

const facility = (id: string, name: string, priceCents: number, earliest: Date | null = null) => ({
  id,
  name,
  facilityType: "clinic",
  address: "Kilimani",
  county: "Nairobi",
  facilityServiceId: `fs-${id}`,
  priceCents,
  currency: "KES",
  estimateDurationMinutes: 30,
  earliestAvailableAt: earliest ? earliest.toISOString() : null,
  availableSlotCount: earliest ? 3 : 0,
  timezone: TZ
});

// Manual order: cheapest first. Ranked order: soonest first.
const NYALI = facility("f-nyali", "Nyali Hospital", 100000);
const KILIMANI = facility("f-kilimani", "Kilimani Clinic", 150000);

const slot = (start: Date) => ({
  startAt: start.toISOString(),
  endAt: new Date(start.getTime() + 30 * 60_000).toISOString(),
  availableProviderCount: 2
});

const HOLD = {
  id: "hold-1",
  facilityId: KILIMANI.id,
  facilityServiceId: KILIMANI.facilityServiceId,
  startAt: EARLY.toISOString(),
  endAt: new Date(EARLY.getTime() + 30 * 60_000).toISOString(),
  status: "active",
  isActive: true,
  expiresAt: "2099-01-01T00:00:00Z",
  remainingSeconds: 600,
  bookingId: "booking-1",
  bookingStatus: "telemedicine_payment_pending",
  paymentPending: false
};

const time = (iso: string) => formatTelemedicineDateTime(iso, TZ, { hour: "2-digit", minute: "2-digit" });

const renderDialog = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TelemedicineRequestDialog open onClose={vi.fn()} serviceId="service-1" />
    </QueryClientProvider>
  );

describe("fastest available facility selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRemoteFacilitiesMock.mockReturnValue({ data: [NYALI, KILIMANI], isLoading: false });
    discoverRemoteFacilitiesMock.mockResolvedValue([
      facility("f-kilimani", "Kilimani Clinic", 150000, EARLY),
      facility("f-nyali", "Nyali Hospital", 100000, LATER)
    ]);
    useAvailableSlotsMock.mockImplementation((facilityId: string | null) => ({
      data: {
        timezone: TZ,
        slots: facilityId === KILIMANI.id ? [slot(EARLY), slot(new Date(EARLY.getTime() + 3600_000))] : [slot(LATER)]
      },
      isLoading: false,
      isError: false
    }));
    createHoldMock.mockResolvedValue(HOLD);
  });

  describe("beside the manual list", () => {
    it("is offered above the facility list, which keeps its own order", () => {
      renderDialog();

      expect(screen.getByRole("heading", { name: "Fastest available" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Find the earliest time" })).toBeInTheDocument();
      expect(screen.getByText("Or choose a facility yourself")).toBeInTheDocument();
      const facilityButtons = screen.getAllByRole("button").filter((b) => /Hospital|Clinic/.test(b.textContent ?? ""));
      expect(facilityButtons.map((b) => b.querySelector("p")?.textContent)).toEqual(["Nyali Hospital", "Kilimani Clinic"]);
    });

    it("asks for nothing extra to show the manual list: no ranking request until it is chosen", () => {
      renderDialog();

      expect(useRemoteFacilitiesMock).toHaveBeenCalled();
      for (const call of useRemoteFacilitiesMock.mock.calls) {
        expect(call.length).toBeLessThanOrEqual(3);
        expect(JSON.stringify(call)).not.toMatch(/ranking|earliest/);
      }
      expect(discoverRemoteFacilitiesMock).not.toHaveBeenCalled();
    });

    it("is not offered when there is no facility to choose from", () => {
      useRemoteFacilitiesMock.mockReturnValue({ data: [], isLoading: false });
      renderDialog();

      expect(screen.queryByRole("heading", { name: "Fastest available" })).not.toBeInTheDocument();
      expect(screen.getByText(/No facilities currently offer this service remotely/)).toBeInTheDocument();
    });
  });

  describe("choosing it", () => {
    it("asks the API for the earliest-slot ranking once, then shows the pick before anything is held", async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.click(screen.getByRole("button", { name: "Find the earliest time" }));

      await screen.findByText(/Fastest available: Kilimani Clinic\./);
      expect(discoverRemoteFacilitiesMock).toHaveBeenCalledTimes(1);
      expect(discoverRemoteFacilitiesMock).toHaveBeenCalledWith("service-1", "KE", { ranking: "earliest_slot" });
      expect(screen.getByRole("status")).toHaveTextContent(new RegExp(`Earliest open time .* at ${time(EARLY.toISOString())}`));
      expect(createHoldMock).not.toHaveBeenCalled();
    });

    it("picks the facility with the earliest time, not the cheapest", async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.click(screen.getByRole("button", { name: "Find the earliest time" }));

      await screen.findByText(/Fastest available: Kilimani Clinic\./);
      expect(screen.queryByText(/Nyali Hospital/)).not.toBeInTheDocument();
    });

    it("offers the earliest slot on the time step and books exactly that slot", async () => {
      const user = userEvent.setup();
      renderDialog();
      await user.click(screen.getByRole("button", { name: "Find the earliest time" }));
      await user.click(await screen.findByRole("button", { name: "Continue to choose a time" }));

      const banner = await screen.findByText(/Earliest available:/);
      expect(banner.parentElement).toHaveTextContent(`at ${time(EARLY.toISOString())} at Kilimani Clinic`);

      await user.click(screen.getByRole("button", { name: "Book this time" }));

      await waitFor(() => expect(createHoldMock).toHaveBeenCalledTimes(1));
      expect(createHoldMock).toHaveBeenCalledWith({
        facilityId: "f-kilimani",
        facilityServiceId: "fs-f-kilimani",
        startAt: EARLY.toISOString(),
        idempotencyKey: expect.any(String)
      });
    });

    it("shows the chosen facility and earliest slot on the confirm step", async () => {
      const user = userEvent.setup();
      renderDialog();
      await user.click(screen.getByRole("button", { name: "Find the earliest time" }));
      await user.click(await screen.findByRole("button", { name: "Continue to choose a time" }));
      await user.click(await screen.findByRole("button", { name: "Book this time" }));

      const confirm = await screen.findByRole("button", { name: /confirm & pay/i });
      const summary = confirm.closest("div")?.parentElement as HTMLElement;
      expect(document.body).toHaveTextContent("Kilimani Clinic");
      expect(document.body).toHaveTextContent(time(EARLY.toISOString()));
      expect(summary).toBeTruthy();
    });

    it("sends the same hold payload shape as a manual choice", async () => {
      const user = userEvent.setup();
      renderDialog();
      await user.click(screen.getByRole("button", { name: /Kilimani Clinic/ }));
      await user.click(await screen.findByRole("button", { name: "Continue to choose a time" }));
      await user.click(await screen.findByRole("button", { name: new RegExp(time(EARLY.toISOString())) }));

      await waitFor(() => expect(createHoldMock).toHaveBeenCalledTimes(1));
      const manualPayload = createHoldMock.mock.calls[0][0];
      expect(Object.keys(manualPayload).sort()).toEqual(["facilityId", "facilityServiceId", "idempotencyKey", "startAt"]);
      expect(manualPayload).not.toHaveProperty("ranking");
    });

    it("takes the person to the preferences step first, so preferences are still asked for", async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.click(screen.getByRole("button", { name: "Find the earliest time" }));

      expect(await screen.findByRole("button", { name: "Continue to choose a time" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Skip for now" })).toBeInTheDocument();
    });
  });

  describe("when the earliest time is gone or nothing is open", () => {
    it("says the earliest time was taken and offers no one-click booking for it", async () => {
      const user = userEvent.setup();
      useAvailableSlotsMock.mockReturnValue({
        data: { timezone: TZ, slots: [slot(new Date(EARLY.getTime() + 2 * 3600_000))] },
        isLoading: false,
        isError: false
      });
      renderDialog();
      await user.click(screen.getByRole("button", { name: "Find the earliest time" }));
      await user.click(await screen.findByRole("button", { name: "Continue to choose a time" }));

      expect(await screen.findByText(/has just been taken/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Book this time" })).not.toBeInTheDocument();
    });

    it("explains when no facility has an open time and leaves the manual list usable", async () => {
      const user = userEvent.setup();
      discoverRemoteFacilitiesMock.mockResolvedValue([facility("f-nyali", "Nyali Hospital", 100000), facility("f-kilimani", "Kilimani Clinic", 150000)]);
      renderDialog();

      await user.click(screen.getByRole("button", { name: "Find the earliest time" }));

      expect(await screen.findByText(/No facility has an open time in the next 7 days/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Nyali Hospital/ })).toBeEnabled();
      expect(screen.queryByRole("button", { name: "Continue to choose a time" })).not.toBeInTheDocument();
    });

    it("shows an error with Try again when the lookup fails, and works on the retry", async () => {
      const user = userEvent.setup();
      discoverRemoteFacilitiesMock.mockRejectedValueOnce(new AxiosError("Network Error", "ERR_NETWORK"));
      renderDialog();

      await user.click(screen.getByRole("button", { name: "Find the earliest time" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(/could not check availability/i);
      await user.click(screen.getByRole("button", { name: "Try again" }));

      await screen.findByText(/Fastest available: Kilimani Clinic\./);
      expect(discoverRemoteFacilitiesMock).toHaveBeenCalledTimes(2);
    });

    it("shows progress and blocks a second lookup while the first is running", async () => {
      const user = userEvent.setup();
      discoverRemoteFacilitiesMock.mockReturnValue(new Promise(() => undefined));
      renderDialog();

      await user.click(screen.getByRole("button", { name: "Find the earliest time" }));

      const button = await screen.findByRole("button", { name: "Find the earliest time" });
      await waitFor(() => expect(button).toBeDisabled());
      expect(button).toHaveAttribute("aria-busy", "true");
      fireEvent.click(button);
      expect(discoverRemoteFacilitiesMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("manual selection still works", () => {
    it("shows no earliest-time banner after choosing a facility by hand", async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.click(screen.getByRole("button", { name: /Nyali Hospital/ }));

      expect(screen.queryByText(/Fastest available:/)).not.toBeInTheDocument();
      await user.click(await screen.findByRole("button", { name: "Continue to choose a time" }));
      expect(screen.queryByText(/Earliest available:/)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Book this time" })).not.toBeInTheDocument();
    });

    it("books a manually chosen slot at that facility", async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.click(screen.getByRole("button", { name: /Nyali Hospital/ }));
      await user.click(await screen.findByRole("button", { name: "Continue to choose a time" }));
      await user.click(await screen.findByRole("button", { name: new RegExp(time(LATER.toISOString())) }));

      await waitFor(() => expect(createHoldMock).toHaveBeenCalledTimes(1));
      expect(createHoldMock.mock.calls[0][0]).toMatchObject({ facilityId: "f-nyali", facilityServiceId: "fs-f-nyali", startAt: LATER.toISOString() });
    });

    it("forgets the fastest pick when the person goes back and chooses a facility themselves", async () => {
      const user = userEvent.setup();
      renderDialog();
      await user.click(screen.getByRole("button", { name: "Find the earliest time" }));
      await screen.findByText(/Fastest available: Kilimani Clinic\./);

      await user.click(screen.getByRole("button", { name: "Back" }));
      await user.click(await screen.findByRole("button", { name: /Nyali Hospital/ }));

      expect(screen.queryByText(/Fastest available: /)).not.toBeInTheDocument();
      await user.click(await screen.findByRole("button", { name: "Continue to choose a time" }));
      expect(screen.queryByText(/Earliest available:/)).not.toBeInTheDocument();
    });
  });

  it("uses labelled, keyboard-reachable controls", () => {
    renderDialog();

    const region = screen.getByRole("heading", { name: "Fastest available" }).closest("section") as HTMLElement;
    expect(region).toHaveAttribute("aria-labelledby", "fastest-available-heading");
    const button = within(region).getByRole("button", { name: "Find the earliest time" });
    button.focus();
    expect(button).toHaveFocus();
  });
});
