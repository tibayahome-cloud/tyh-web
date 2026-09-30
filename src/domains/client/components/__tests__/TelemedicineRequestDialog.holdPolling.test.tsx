/**
 * The hold-status query polled every 4 seconds for as long as a holdId existed, with no regard
 * for whether there was anything left to learn -- once payment is confirmed (or the hold has
 * expired/been released without being picked up) the booking outcome is already settled, and
 * polling only burns requests. This proves the interval turns itself off in exactly those
 * cases, and stays on while payment is genuinely still pending.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let capturedRefetchInterval: ((query: { state: { data?: unknown } }) => number | false) | undefined;

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
  timezone: "Africa/Nairobi"
};

vi.mock("../../../../shared/hooks/useTelemedicine", () => ({
  useAvailableSlots: () => ({
    data: { slots: [SLOT], timezone: "Africa/Nairobi" },
    isLoading: false,
    isError: false
  }),
  useRemoteFacilities: () => ({ data: [FACILITY], isLoading: false }),
  useTelemedicinePolicy: () => ({ data: { defaultTimezone: "Africa/Nairobi" } }),
  useCreateHoldMutation: () => ({
    mutateAsync: () =>
      Promise.resolve({
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
      }),
    isPending: false
  }),
  useReleaseHoldMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useInitiateHoldPaymentMutation: () => ({ mutateAsync: vi.fn(), isPending: false, isSuccess: false }),
  useHoldQuery: (holdId: string | null, options: { refetchInterval?: typeof capturedRefetchInterval }) => {
    capturedRefetchInterval = options?.refetchInterval;
    return { data: undefined, isLoading: false };
  }
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

const renderDialog = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TelemedicineRequestDialog open onClose={vi.fn()} serviceId="service-1" />
    </QueryClientProvider>
  );
};

/** Walk to the point where a hold has been created, so holdId is set and polling is live. */
const createHold = async (user: ReturnType<typeof userEvent.setup>) => {
  renderDialog();
  await user.click(await screen.findByText(FACILITY.name));
  await user.click(await screen.findByRole("button", { name: /skip for now/i }));
  await user.click(await screen.findByRole("button", { name: SLOT_LABEL }));
  await screen.findByRole("button", { name: /confirm & pay/i });
};

describe("TelemedicineRequestDialog hold polling", () => {
  beforeEach(() => {
    capturedRefetchInterval = undefined;
  });

  it("keeps polling every 4s while payment is still pending", async () => {
    const user = userEvent.setup();
    await createHold(user);

    expect(capturedRefetchInterval).toBeInstanceOf(Function);
    expect(
      capturedRefetchInterval!({
        state: { data: { isActive: true, bookingStatus: "telemedicine_payment_pending" } }
      })
    ).toBe(4000);
  });

  it("stops polling once payment is confirmed", async () => {
    const user = userEvent.setup();
    await createHold(user);

    expect(
      capturedRefetchInterval!({
        state: { data: { isActive: true, bookingStatus: "telemedicine_paid_pending_assignment" } }
      })
    ).toBe(false);
  });

  it("stops polling once the hold reaches a terminal, unconfirmed state", async () => {
    const user = userEvent.setup();
    await createHold(user);

    expect(
      capturedRefetchInterval!({
        state: { data: { isActive: false, bookingStatus: null } }
      })
    ).toBe(false);
  });
});
