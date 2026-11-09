/**
 * Four steps, and nothing optional on the pay screen.
 *
 * Preferences (clinician, language, a note) used to be a step of their own, and putting them on the pay screen would
 * spend the ten minutes the chosen time is held. They now sit collapsed on the time-picking step, before a time is chosen
 * and so before the hold starts.
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
  useTelemedicinePolicy: () => ({ data: { defaultTimezone: "Africa/Nairobi", cancellationCutoffMinutes: 10 } }),
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

const renderDialog = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TelemedicineRequestDialog open onClose={vi.fn()} serviceId="service-1" />
    </QueryClientProvider>
  );
};

describe("the booking steps", () => {
  it("are Service, Facility, Slot and Confirm: Preferences is not one of them", async () => {
    renderDialog();

    const list = await screen.findByRole("list");
    expect(Array.from(list.querySelectorAll("li p.font-semibold")).map((node) => node.textContent)).toEqual([
      "Service",
      "Facility",
      "Slot",
      "Confirm"
    ]);
    expect(screen.queryByText("Preferences")).not.toBeInTheDocument();
  });

  it("keep preferences collapsed on the time-picking step until the person opens them", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(await screen.findByText(FACILITY.name));

    const open = await screen.findByRole("button", { name: /add a preference for your clinician/i });
    expect(screen.queryByRole("combobox", { name: /clinician/i })).not.toBeInTheDocument();

    await user.click(open);
    expect(await screen.findByRole("combobox", { name: /clinician/i })).toBeInTheDocument();
  });

  it("leave nothing optional on the pay screen", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(await screen.findByText(FACILITY.name));
    await user.click(await screen.findByRole("button", { name: SLOT_LABEL }));
    await screen.findByRole("button", { name: /confirm & pay/i });

    expect(screen.queryByRole("combobox", { name: /clinician/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add a preference/i })).not.toBeInTheDocument();
  });

  it("tell the client what happens if plans change or the appointment cannot be confirmed", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(await screen.findByText(FACILITY.name));
    await user.click(await screen.findByRole("button", { name: SLOT_LABEL }));
    await screen.findByRole("button", { name: /confirm & pay/i });

    expect(screen.getByText(/You can cancel until 10 minutes before your appointment\./)).toBeInTheDocument();
    expect(screen.getByText(/we review the payment and contact you/i)).toBeInTheDocument();
  });
});
