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
const clockTime = (iso: string, timezone: string) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone
  }).format(new Date(iso));

/** A slot button's accessible name: the whole appointment interval, not just its start. */
const expectedLabel = (slot: { startAt: string; endAt: string }, timezone: string) =>
  `${clockTime(slot.startAt, timezone)} \u2013 ${clockTime(slot.endAt, timezone)}`;

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
  await user.click(await screen.findByRole("button", { name: /skip for now/i }));
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
      await screen.findByRole("button", { name: expectedLabel(SLOTS[0], NAIROBI) })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: expectedLabel(SLOTS[1], NAIROBI) })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: expectedLabel(SLOTS[2], NAIROBI) })
    ).not.toBeInTheDocument();
  });

  it("switches the times when another day is chosen", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openSlotStep(user);

    const strip = await screen.findByRole("group", { name: /choose a day/i });
    await user.click(within(strip).getAllByRole("button")[1]);

    expect(
      await screen.findByRole("button", { name: expectedLabel(SLOTS[2], NAIROBI) })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: expectedLabel(SLOTS[0], NAIROBI) })
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
      await screen.findByRole("button", { name: expectedLabel(SLOTS[0], "America/New_York") })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: expectedLabel(SLOTS[0], NAIROBI) })
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

  describe("week navigation", () => {
    const dayNumbers = (strip: HTMLElement) =>
      within(strip)
        .getAllByRole("button")
        .map((button) => button.textContent?.match(/\d+/)?.[0] ?? "");

    it("keeps the same week when a day inside it is chosen", async () => {
      // The reported bug: selecting the last day rebuilt the strip starting from that day,
      // so the earlier days vanished and there was no way back to them.
      const user = userEvent.setup();
      renderDialog();
      await openSlotStep(user);

      const strip = await screen.findByRole("group", { name: /choose a day/i });
      const before = dayNumbers(strip);

      await user.click(within(strip).getAllByRole("button")[6]);

      expect(dayNumbers(await screen.findByRole("group", { name: /choose a day/i }))).toEqual(before);
    });

    it("moves a whole week forward and back again", async () => {
      const user = userEvent.setup();
      renderDialog();
      await openSlotStep(user);

      const first = dayNumbers(await screen.findByRole("group", { name: /choose a day/i }));

      await user.click(screen.getByRole("button", { name: /next week/i }));
      const second = dayNumbers(await screen.findByRole("group", { name: /choose a day/i }));
      expect(second).not.toEqual(first);

      await user.click(screen.getByRole("button", { name: /previous week/i }));
      expect(dayNumbers(await screen.findByRole("group", { name: /choose a day/i }))).toEqual(first);
    });

    it("cannot page back before the facility's today", async () => {
      const user = userEvent.setup();
      renderDialog();
      await openSlotStep(user);

      expect(await screen.findByRole("button", { name: /previous week/i })).toBeDisabled();
    });

    it("stops paging forward at the API's lookahead limit", async () => {
      const user = userEvent.setup();
      renderDialog();
      await openSlotStep(user);

      // 30-day lookahead, 7-day pages: the fifth page would start beyond it.
      for (let page = 0; page < 4; page += 1) {
        const next = screen.getByRole("button", { name: /next week/i });
        if ((next as HTMLButtonElement).disabled) break;
        await user.click(next);
      }

      expect(screen.getByRole("button", { name: /next week/i })).toBeDisabled();
    });

    it("labels the range on screen so the dates shown are never a guess", async () => {
      const user = userEvent.setup();
      renderDialog();
      await openSlotStep(user);

      // 1 September 2026 is a Tuesday; a seven-day strip ends on Monday the 7th.
      expect(await screen.findByText(/Tue 1\s*–\s*Mon 7/)).toBeInTheDocument();
    });

    it("shows each slot's full interval, not just when it starts", async () => {
      // "08:00" alone does not tell a client whether they are committing 20 minutes or an
      // hour, and the services in the catalogue range from 15 to 45.
      const user = userEvent.setup();
      renderDialog();
      await openSlotStep(user);

      expect(
        await screen.findByRole("button", { name: expectedLabel(SLOTS[0], NAIROBI) })
      ).toBeInTheDocument();
    });
  });
});
