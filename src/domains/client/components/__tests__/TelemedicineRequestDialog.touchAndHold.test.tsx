/**
 * Two things a person in a hurry on a phone needs from the time and pay steps.
 *
 * The controls on the time-picking step must be big enough to hit with a thumb (the week arrows used to be 23 by 30 pixels
 * and the time buttons 38 high), and the pay step must say plainly how long the chosen time is held, in text large enough to
 * notice, since the hold is the one thing on that screen with a deadline.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeAll, describe, expect, it, vi } from "vitest";

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

describe("the time-picking step", () => {
  it("has week arrows and time buttons big enough to tap", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(await screen.findByText(FACILITY.name));

    // 44 pixels is the smallest comfortable touch target; h-11 / w-11 are 2.75rem.
    for (const name of ["Previous week", "Next week"]) {
      expect(await screen.findByRole("button", { name })).toHaveClass("h-11", "w-11");
    }
    expect(await screen.findByRole("button", { name: SLOT_LABEL })).toHaveClass("min-h-[44px]");
  });
});

describe("the pay step", () => {
  it("says how long the time is held, in plain words and without a stray double hyphen", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(await screen.findByText(FACILITY.name));
    await user.click(await screen.findByRole("button", { name: SLOT_LABEL }));
    await screen.findByRole("button", { name: /confirm & pay/i });

    const line = screen.getByText(
      (_content, element) =>
        element?.tagName === "P" &&
        /^Holding this slot for \d+:\d{2}\. Complete payment before it expires\.$/.test(element.textContent ?? "")
    );
    expect(line.textContent).not.toContain("--");
    // Readable at a glance: not the 12px caption it used to be.
    expect(line).toHaveClass("text-sm", "font-medium");
  });
});
