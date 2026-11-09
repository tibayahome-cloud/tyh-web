/**
 * Tapping a time reserves it for ten minutes. Going Back from the pay step used to leave that reservation in
 * place, so a client who changed their mind held a slot nobody else could book until it ran out, and each change of
 * mind held another. Back now gives the slot back at once.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { release } = vi.hoisted(() => ({ release: vi.fn() }));

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
  useTelemedicinePolicy: () => ({ data: { defaultTimezone: "Africa/Nairobi" } }),
  useCreateHoldMutation: () => ({ mutateAsync: () => Promise.resolve(HOLD), isPending: false }),
  useReleaseHoldMutation: () => ({ mutate: release, mutateAsync: vi.fn() }),
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

beforeEach(() => {
  release.mockClear();
});

const openConfirmStep = async (user: ReturnType<typeof userEvent.setup>) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TelemedicineRequestDialog open onClose={vi.fn()} serviceId="service-1" />
    </QueryClientProvider>
  );
  await user.click(await screen.findByText(FACILITY.name));
  await user.click(await screen.findByRole("button", { name: /skip for now/i }));
  await user.click(await screen.findByRole("button", { name: SLOT_LABEL }));
  await screen.findByRole("button", { name: /confirm & pay/i });
};

describe("Back from the pay step", () => {
  it("gives the reserved time back at once and shows the times again", async () => {
    const user = userEvent.setup();
    await openConfirmStep(user);
    expect(release).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith("hold-1");
    expect(await screen.findByRole("button", { name: SLOT_LABEL })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /confirm & pay/i })).not.toBeInTheDocument();
  });
});
