/**
 * The booking dialog never asks for a country. When the client's country is known it goes straight on to the clinics;
 * when it is not (a number from outside Kenya), it says plainly that remote consultations are in Kenya for now.
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { auth } = vi.hoisted(() => ({ auth: { countryCode: "KE" as string | null } }));

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
  useAvailableSlots: () => ({ data: { slots: [], timezone: "Africa/Nairobi" }, isLoading: false, isError: false }),
  useRemoteFacilities: () => ({ data: [FACILITY], isLoading: false }),
  useTelemedicinePolicy: () => ({ data: { defaultTimezone: "Africa/Nairobi", cancellationCutoffMinutes: 10 } }),
  useCreateHoldMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReleaseHoldMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useInitiateHoldPaymentMutation: () => ({ mutateAsync: vi.fn(), isPending: false, isSuccess: false }),
  useHoldQuery: () => ({ data: undefined, isLoading: false })
}));

vi.mock("../../../../shared/hooks/useAuth", () => ({
  useAuth: () => ({ user: { phone: "+254700000001", countryCode: auth.countryCode }, isAuthenticated: true })
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
  auth.countryCode = "KE";
});

const renderDialog = (onClose = vi.fn()) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TelemedicineRequestDialog open onClose={onClose} serviceId="service-1" />
    </QueryClientProvider>
  );
  return onClose;
};

describe("the booking dialog and the client's country", () => {
  it("goes straight on to the clinics when the country is known, with nothing about a country", async () => {
    renderDialog();

    expect(await screen.findByText(FACILITY.name)).toBeInTheDocument();
    expect(screen.queryByText(/Remote consultations are available in Kenya for now/)).not.toBeInTheDocument();
    expect(screen.queryByText(/country required/i)).not.toBeInTheDocument();
  });

  it("says remote consultations are in Kenya for now, instead of the clinics, when the country is not known", async () => {
    auth.countryCode = null;
    renderDialog();

    expect(await screen.findByText(/Remote consultations are available in Kenya for now/)).toBeInTheDocument();
    expect(screen.queryByText(FACILITY.name)).not.toBeInTheDocument();
    expect(screen.queryByText(/country required/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /country/i })).not.toBeInTheDocument();
  });

  it("closes from the notice", async () => {
    auth.countryCode = null;
    const user = userEvent.setup();
    const onClose = renderDialog();

    // The dialog's own close icon is also named "Close", so reach for the one inside the notice.
    await user.click(within(await screen.findByRole("status")).getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalled();
  });
});
