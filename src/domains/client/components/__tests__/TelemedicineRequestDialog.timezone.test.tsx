/**
 * The slot picker renders a week of the facility's calendar, not the device's.
 *
 * These tests drive the real dialog with a fixed clock and a stubbed slots hook, so they pin
 * the wiring the unit tests cannot: that one request covers seven local days, that slots are
 * grouped and labelled in the facility's zone, and that the zone travelling with the slots
 * wins over the platform default.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const useAvailableSlotsMock = vi.fn();
const useRemoteFacilitiesMock = vi.fn();
const useTelemedicinePolicyMock = vi.fn();

vi.mock("../../../../shared/hooks/useTelemedicine", () => ({
  useAvailableSlots: (...args: unknown[]) => useAvailableSlotsMock(...args),
  useRemoteFacilities: (...args: unknown[]) => useRemoteFacilitiesMock(...args),
  useTelemedicinePolicy: () => useTelemedicinePolicyMock(),
  useCreateHoldMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReleaseHoldMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useInitiateHoldPaymentMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useHoldQuery: () => ({ data: null })
}));

vi.mock("../../../../shared/hooks/useAuth", () => ({
  useAuth: () => ({ user: { phone: "+254700000001", countryCode: "KE" }, isAuthenticated: true })
}));

vi.mock("../../../../shared/components/ToastProvider", () => ({
  useToast: () => ({ push: vi.fn(), show: vi.fn() })
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { TelemedicineRequestDialog } from "../TelemedicineRequestDialog";

const NAIROBI = "Africa/Nairobi";

/**
 * The time label a slot should carry, computed independently of the component.
 *
 * Written out rather than hard-coding "11:30 PM" because Intl picks 12- or 24-hour from the
 * runtime locale, and a test that pins one of those fails on a machine set to the other. The
 * timezone argument is the part under test, so it is passed explicitly here.
 */
const expectedLabel = (iso: string, timezone: string) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone
  }).format(new Date(iso));

// 09:00 UTC = 12:00 Nairobi, comfortably mid-day so "today" is unambiguous.
const FIXED_NOW = new Date("2026-09-01T09:00:00Z");

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

// 06:00Z = 09:00 Nairobi (1 Sep) · 20:30Z = 23:30 Nairobi (1 Sep) · 21:30Z = 00:30 (2 Sep)
const SLOTS = [
  { startAt: "2026-09-01T06:00:00Z", endAt: "2026-09-01T06:30:00Z", availableProviderCount: 2 },
  { startAt: "2026-09-01T20:30:00Z", endAt: "2026-09-01T21:00:00Z", availableProviderCount: 1 },
  { startAt: "2026-09-01T21:30:00Z", endAt: "2026-09-01T22:00:00Z", availableProviderCount: 1 }
];

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

const renderDialog = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TelemedicineRequestDialog open onClose={vi.fn()} serviceId="service-1" />
    </QueryClientProvider>
  );
};

const openSlotStep = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByText(FACILITY.name));
};

describe("telemedicine slot picker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(FIXED_NOW);

    useTelemedicinePolicyMock.mockReturnValue({ data: { defaultTimezone: NAIROBI } });
    useRemoteFacilitiesMock.mockReturnValue({ data: [FACILITY], isLoading: false });
    useAvailableSlotsMock.mockReturnValue({
      data: { slots: SLOTS, timezone: NAIROBI },
      isLoading: false,
      isError: false
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("requests seven facility-local days in one call", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openSlotStep(user);

    await waitFor(() => expect(useAvailableSlotsMock).toHaveBeenCalled());
    const [, , startDate, endDate] = useAvailableSlotsMock.mock.calls.at(-1) as string[];

    expect(startDate).toBe("2026-09-01");
    expect(endDate).toBe("2026-09-07");
  });

  it("shows a day for each of the seven dates", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openSlotStep(user);

    const strip = await screen.findByRole("group", { name: /choose a day/i });
    expect(within(strip).getAllByRole("button")).toHaveLength(7);
  });

  it("counts a late-evening slot against the next facility-local day", async () => {
    // 21:30Z is 00:30 on 2 September in Nairobi. Counting by UTC date would show 3 openings
    // on the 1st and none on the 2nd -- the client would never find that appointment.
    const user = userEvent.setup();
    renderDialog();
    await openSlotStep(user);

    const strip = await screen.findByRole("group", { name: /choose a day/i });
    const [firstDay, secondDay] = within(strip).getAllByRole("button");

    expect(firstDay).toHaveTextContent("2 open");
    expect(secondDay).toHaveTextContent("1 open");
  });

  it("shows only the selected day's times, in the facility's clock", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openSlotStep(user);

    // 06:00Z (09:00 local) and 20:30Z (23:30 local) fall on 1 September; 21:30Z does not.
    expect(
      await screen.findByRole("button", { name: expectedLabel(SLOTS[0].startAt, NAIROBI) })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: expectedLabel(SLOTS[1].startAt, NAIROBI) })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: expectedLabel(SLOTS[2].startAt, NAIROBI) })
    ).not.toBeInTheDocument();
  });

  it("switches the times when another day is chosen", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openSlotStep(user);

    const strip = await screen.findByRole("group", { name: /choose a day/i });
    await user.click(within(strip).getAllByRole("button")[1]);

    expect(
      await screen.findByRole("button", { name: expectedLabel(SLOTS[2].startAt, NAIROBI) })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: expectedLabel(SLOTS[0].startAt, NAIROBI) })
    ).not.toBeInTheDocument();
  });

  it("disables a day with nothing open", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openSlotStep(user);

    const strip = await screen.findByRole("group", { name: /choose a day/i });
    // Only the first two days carry slots in this fixture.
    expect(within(strip).getAllByRole("button")[6]).toBeDisabled();
  });

  it("prefers the timezone the slots arrived with over the platform default", async () => {
    // A facility outside the default zone: the response's meta.timezone must win, or every
    // appointment renders in a zone that is not the one it was scheduled in.
    useTelemedicinePolicyMock.mockReturnValue({ data: { defaultTimezone: NAIROBI } });
    useRemoteFacilitiesMock.mockReturnValue({
      data: [{ ...FACILITY, timezone: "America/New_York" }],
      isLoading: false
    });
    useAvailableSlotsMock.mockReturnValue({
      data: { slots: [SLOTS[0]], timezone: "America/New_York" },
      isLoading: false,
      isError: false
    });

    const user = userEvent.setup();
    renderDialog();
    await openSlotStep(user);

    // 06:00Z is 02:00 in New York and 09:00 in Nairobi; the response's zone must decide.
    expect(
      await screen.findByRole("button", { name: expectedLabel(SLOTS[0].startAt, "America/New_York") })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: expectedLabel(SLOTS[0].startAt, NAIROBI) })
    ).not.toBeInTheDocument();
  });

  it("reports an empty week rather than blaming the chosen day", async () => {
    useAvailableSlotsMock.mockReturnValue({
      data: { slots: [], timezone: NAIROBI },
      isLoading: false,
      isError: false
    });

    const user = userEvent.setup();
    renderDialog();
    await openSlotStep(user);

    expect(await screen.findByText(/no open appointments in the next 7 days/i)).toBeInTheDocument();
  });

  it("surfaces a load failure instead of showing an empty week", async () => {
    useAvailableSlotsMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    const user = userEvent.setup();
    renderDialog();
    await openSlotStep(user);

    expect(await screen.findByText(/could not load appointment times/i)).toBeInTheDocument();
    expect(screen.queryByText(/no open appointments/i)).not.toBeInTheDocument();
  });
});
